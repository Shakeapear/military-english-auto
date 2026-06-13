# ============================================================
# 军事英语单词抓取脚本 (Military English Vocabulary Scraper)
# 目标网站: https://175.178.248.67/wordbook
# ============================================================
# 依赖安装:
#   pip install selenium pandas webdriver-manager
#
# webdriver-manager 会自动下载与本地 Edge 版本匹配的 msedgedriver，
# 无需手动管理 WebDriver 路径。
# ============================================================

import os
import sys
import time
import random
import logging
from pathlib import Path

import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.edge.service import Service as EdgeService
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.microsoft import EdgeChromiumDriverManager

# ============================================================
# 日志配置
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ============================================================
# 可配置参数
# ============================================================

# 目标 URL
TARGET_URL = "https://175.178.248.67/wordbook"

# 登录凭据
LOGIN_USERNAME = "1568"
LOGIN_PASSWORD = "leoli979973"

# 输出 CSV 文件名
OUTPUT_FILE = "military_vocabulary.csv"

# 每次点击单元后的随机等待范围 (秒)
CLICK_DELAY_MIN = 1.0
CLICK_DELAY_MAX = 3.0

# 点击后等待表格出现的最长时间 (秒)
TABLE_WAIT_TIMEOUT = 15

# 总单元数 (U1 ~ U21)
TOTAL_UNITS = 21


def build_edge_options() -> EdgeOptions:
    """
    构建 Edge 浏览器选项，包含反爬对抗措施和 SSL 忽略配置。
    返回: EdgeOptions 实例
    """
    options = EdgeOptions()

    # ----------------------------------------------------------
    # 反爬对抗措施 1: 禁用 Chrome 自动化控制特征
    #   该 flag 阻止浏览器在 navigator.webdriver 等属性中暴露自动化标记，
    #   使网站无法通过 Blink 引擎的 AutomationControlled 特征检测到 Selenium。
    # ----------------------------------------------------------
    options.add_argument("--disable-blink-features=AutomationControlled")

    # ----------------------------------------------------------
    # 反爬对抗措施 2: 排除自动化开关
    #   excludeSwitches 去掉 Chrome 的 "enable-automation" 开关，
    #   防止浏览器顶部显示"Chrome 正受到自动测试软件的控制"提示条，
    #   同时移除 window.navigator.webdriver 的自动化标记。
    # ----------------------------------------------------------
    options.add_experimental_option("excludeSwitches", ["enable-automation"])

    # ----------------------------------------------------------
    # 反爬对抗措施 3: 禁用自动化扩展
    #   useAutomationExtension = False 阻止加载 Chrome Automation 扩展，
    #   防止网站通过检测该扩展的存在来识别自动化工具。
    # ----------------------------------------------------------
    options.add_experimental_option("useAutomationExtension", False)

    # ----------------------------------------------------------
    # 反爬对抗措施 4: 设置真实的 User-Agent
    #   将 Selenium 默认的 WebDriver UA 替换为真实 Edge 浏览器的 User-Agent，
    #   避免被目标网站的 UA 过滤规则拦截。
    # ----------------------------------------------------------
    options.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"
    )

    # ----------------------------------------------------------
    # 反爬对抗措施 5: 设置固定窗口大小
    #   标准桌面分辨率使浏览器窗口尺寸与真实用户环境一致，
    #   防止无头/极小窗口被识别为机器人。
    # ----------------------------------------------------------
    options.add_argument("--window-size=1920,1080")

    # ----------------------------------------------------------
    # 反爬对抗措施 6: 禁用 GPU 加速 (可选)
    #   在部分环境（虚拟机、无 GPU 服务器）中 GPU 渲染可能异常；
    #   禁用后减少崩溃概率，同时使浏览器指纹更接近普通用户的软件渲染模式。
    # ----------------------------------------------------------
    options.add_argument("--disable-gpu")

    # ----------------------------------------------------------
    # 反爬对抗措施 7: 禁用自动化密码保存提示
    #   减少浏览器 UI 弹窗干扰，使交互更干净。
    # ----------------------------------------------------------
    prefs = {
        "credentials_enable_service": False,
        "profile.password_manager_enabled": False,
    }
    options.add_experimental_option("prefs", prefs)

    # ----------------------------------------------------------
    # SSL 证书处理: 忽略自签名证书错误
    #   目标网站使用自签名 SSL 证书，默认会被浏览器拦截。
    #   --ignore-certificate-errors 告诉 Chromium 跳过证书验证；
    #   accept_insecure_certs = True 是 Selenium 层面的能力声明，
    #   双重保障确保自签名证书不会导致浏览器崩溃。
    # ----------------------------------------------------------
    options.add_argument("--ignore-certificate-errors")
    options.add_argument("--ignore-ssl-errors")
    options.add_argument("--allow-running-insecure-content")
    options.add_argument("--disable-web-security")
    options.accept_insecure_certs = True

    return options


def do_login(driver, username: str, password: str) -> bool:
    """
    自动登录目标网站。
    流程：访问 /login → 填写表单 → 提交 → 等待跳转到 /dashboard。

    参数:
        driver: Selenium WebDriver 实例
        username: 登录用户名 (用户ID)
        password: 登录密码
    返回:
        bool: 登录是否成功
    """
    LOGIN_URL = "https://175.178.248.67/login"
    logger.info("正在访问登录页面: %s", LOGIN_URL)
    driver.get(LOGIN_URL)
    time.sleep(3)

    try:
        username_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "loginUserId"))
        )
        password_input = driver.find_element(By.ID, "loginPassword")
        submit_btn = driver.find_element(By.CSS_SELECTOR, "#loginForm button[type='submit']")

        logger.info("登录表单已找到，正在填写凭据...")

        # 逐字符输入用户名，模拟人类打字节奏
        username_input.clear()
        time.sleep(random.uniform(0.2, 0.5))
        for ch in username:
            username_input.send_keys(ch)
            time.sleep(random.uniform(0.05, 0.15))
        time.sleep(random.uniform(0.3, 0.8))

        # 逐字符输入密码
        password_input.clear()
        time.sleep(random.uniform(0.2, 0.5))
        for ch in password:
            password_input.send_keys(ch)
            time.sleep(random.uniform(0.05, 0.15))
        time.sleep(random.uniform(0.3, 0.8))

        submit_btn.click()
        logger.info("登录表单已提交，等待跳转...")

        # 等待页面跳转到 /dashboard 或 wordbook
        try:
            WebDriverWait(driver, 10).until(
                lambda d: "/dashboard" in d.current_url or "/wordbook" in d.current_url
            )
            logger.info("登录成功，当前 URL: %s", driver.current_url)
            return True
        except TimeoutException:
            pass

        # 检查是否有错误提示
        try:
            alert = driver.find_element(By.ID, "loginAlert")
            if alert.text.strip():
                logger.error("登录失败，错误信息: %s", alert.text.strip())
        except NoSuchElementException:
            pass

        return False

    except TimeoutException:
        logger.error("登录页面加载超时：未找到表单元素")
        driver.save_screenshot("login_failed.png")
        return False
    except Exception as e:
        logger.error("登录过程异常: %s", e)
        return False


def wait_for_table_data(driver, timeout: int = TABLE_WAIT_TIMEOUT):
    """
    显式等待表格中出现至少一行数据 (<tbody> 内的 <tr>)。
    使用 WebDriverWait 而非固定 sleep，更高效且不易因网络波动失败。

    参数:
        driver: Selenium WebDriver 实例
        timeout: 最长等待时间 (秒)
    返回:
        bool: 是否成功等到数据行
    """
    try:
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "#wordsTableWrap table tbody tr")
            )
        )
        return True
    except TimeoutException:
        logger.warning("等待表格数据超时 (%d 秒)", timeout)
        return False


def click_unit_button(driver, unit_index: int):
    """
    在页面上查找并点击指定编号的单元按钮。
    按钮位于 id="unitList" 内，文本包含 "U{index}"。

    参数:
        driver: Selenium WebDriver 实例
        unit_index: 单元编号 (1-21)
    返回:
        element: 被点击的按钮元素；若找不到则返回 None
    """
    unit_selector = f"#unitList button"
    buttons = driver.find_elements(By.CSS_SELECTOR, unit_selector)

    for btn in buttons:
        text = btn.text.strip()
        if f"U{unit_index}" in text:
            return btn

    logger.error("未找到单元 U%d 的按钮", unit_index)
    return None


def scrape_unit(driver, unit_index: int) -> list[dict]:
    """
    抓取单个单元的全部单词数据，含重试机制。

    流程:
    1. 找到对应单元按钮并点击
    2. 随机等待 1~3 秒 (反爬)
    3. 显式等待表格加载
    4. 若超时，重试一次: 重新点击 + 等待
    5. 从表格行中提取 序号/英文/中文

    参数:
        driver: Selenium WebDriver 实例
        unit_index: 单元编号
    返回:
        list[dict]: 该单元单词列表，每个元素为 {"单元": ..., "序号": ..., "英文": ..., "中文": ...}
    """
    for attempt in range(2):  # 最多尝试 2 次 (初次 + 重试一次)
        # --- 找到并点击单元按钮 ---
        btn = click_unit_button(driver, unit_index)
        if btn is None:
            return []

        try:
            btn.click()
        except Exception as e:
            logger.warning("点击 U%d 按钮异常: %s", unit_index, e)
            time.sleep(1)
            continue

        # ----------------------------------------------------------
        # 反爬对抗措施 8: 每次点击后随机等待 1~3 秒
        #   模拟人类阅读与点击节奏，避免机械化的固定间隔被反爬系统识别。
        # ----------------------------------------------------------
        delay = random.uniform(CLICK_DELAY_MIN, CLICK_DELAY_MAX)
        time.sleep(delay)

        # --- 等待表格数据加载 ---
        loaded = wait_for_table_data(driver)

        if loaded:
            return extract_table_data(driver, unit_index)
        else:
            if attempt == 0:
                logger.info("U%d 表格未加载，重试中...", unit_index)
            else:
                logger.error("U%d 重试后仍未加载，跳过该单元", unit_index)

    return []


def extract_table_data(driver, unit_index: int) -> list[dict]:
    """
    从当前页面的 #wordsTableWrap table 中提取所有单词行。

    参数:
        driver: Selenium WebDriver 实例
        unit_index: 当前单元编号
    返回:
        list[dict]: 提取的单词数据
    """
    rows = driver.find_elements(By.CSS_SELECTOR, "#wordsTableWrap table tbody tr")
    records = []

    for row in rows:
        cells = row.find_elements(By.TAG_NAME, "td")
        if len(cells) < 3:
            # 跳过不完整的行 (可能无数据或仅占位)
            continue

        seq_num = cells[0].text.strip()
        english = cells[1].text.strip()
        chinese = cells[2].text.strip()

        # 跳过空行
        if not english and not chinese:
            continue

        records.append(
            {
                "单元": f"U{unit_index}",
                "序号": seq_num,
                "英文": english,
                "中文": chinese,
            }
        )

    logger.info("U%d: 成功提取 %d 条单词", unit_index, len(records))
    return records


def main():
    logger.info("=" * 60)
    logger.info("军事英语单词抓取脚本启动")
    logger.info("目标: %s", TARGET_URL)
    logger.info("=" * 60)

    # --- 构建浏览器选项 ---
    options = build_edge_options()

    # --- 自动下载并配置 Edge WebDriver ---
    driver_path = EdgeChromiumDriverManager().install()
    service = EdgeService(executable_path=driver_path)

    # --- 启动浏览器 ---
    driver = None
    try:
        driver = webdriver.Edge(service=service, options=options)
        logger.info("Edge 浏览器已启动")

        # --- 登录 ---
        if not do_login(driver, LOGIN_USERNAME, LOGIN_PASSWORD):
            logger.error("登录失败，无法继续")
            return 1

        # --- 导航到 wordbook 页面 ---
        logger.info("正在访问词库页面: %s", TARGET_URL)
        driver.get(TARGET_URL)
        time.sleep(3)

        # 等待左侧单元列表出现，确认页面已完全加载
        try:
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.ID, "unitList"))
            )
            logger.info("词库页面加载成功，单元列表已出现")
        except TimeoutException:
            logger.error("词库页面加载超时：未检测到单元列表 (id=unitList)")
            driver.save_screenshot("page_load_timeout.png")
            return 1

        # 额外等待确保 JavaScript 初始化完成
        time.sleep(2)

        # --- 逐单元抓取 ---
        all_records = []
        for i in range(1, TOTAL_UNITS + 1):
            logger.info("--- 正在抓取 U%d ---", i)
            records = scrape_unit(driver, i)
            all_records.extend(records)

        logger.info("=" * 60)
        logger.info("抓取完成！共获取 %d 条单词记录", len(all_records))

        # --- 保存为 CSV ---
        if all_records:
            df = pd.DataFrame(all_records, columns=["单元", "序号", "英文", "中文"])
            # UTF-8 with BOM: 确保 Excel 直接打开不乱码
            df.to_csv(OUTPUT_FILE, index=False, encoding="utf-8-sig")
            logger.info("数据已保存至: %s", os.path.abspath(OUTPUT_FILE))
            logger.info("各单元统计:\n%s", df["单元"].value_counts().sort_index().to_string())
        else:
            logger.warning("未抓取到任何数据，请检查网络连接或网站状态")
            return 1

    except Exception as e:
        logger.exception("脚本运行异常: %s", e)
        return 1

    finally:
        if driver:
            driver.quit()
            logger.info("浏览器已关闭")

    return 0


if __name__ == "__main__":
    sys.exit(main())
