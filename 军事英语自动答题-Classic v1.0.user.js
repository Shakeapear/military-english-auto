// ==UserScript==
// @name         军事英语自动答题助手-Classic v1.0
// @namespace    https://github.com/Shakeapear/military-english-auto
// @version      1.0.0
// @description  自动作答军事英语词汇选择题和填空题，支持四种答题模式（荣耀之战/无尽挑战/定时挑战/选题练习），通过本地题库双向匹配实现英汉互译自动答题
// @author       Shakeapear
// @match        https://175.178.248.67/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

/*
 * 军事英语自动答题助手 (Military English Auto Answer Assistant)
 * Copyright (C) 2026  Shakeapear
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * This file is part of version 1.0 (Basic).
 */

"use strict";

/* ================================================================
 * 用户可配置区域 —— 请根据需要修改以下变量
 * ================================================================ */

// 题目文本选择器
var QUESTION_SELECTOR = "#questionText";

// 题型标识选择器（用于判断是选择题还是填空题）
var QUESTION_TYPE_SELECTOR = "#questionType";

// 选项容器选择器
var OPTIONS_GRID_SELECTOR = "#optionsGrid";

// 填空题输入框选择器
var FILL_INPUT_SELECTOR = "#spellingInput";

// 下一题/提交按钮选择器（仅填空题需要点击）
var NEXT_BUTTON_SELECTOR = "#optionsGrid > button";

// 操作延迟（毫秒）—— 等待页面渲染稳定后再执行
var RENDER_DELAY_MIN = 300; // 最小延迟
var RENDER_DELAY_MAX = 500; // 最大延迟

// 填写完成后到点击下一题的延迟（毫秒）
var SUBMIT_DELAY_MIN = 300;
var SUBMIT_DELAY_MAX = 500;

// 重试次数上限
var MAX_RETRIES = 3;

// 重试间隔（毫秒）
var RETRY_INTERVAL = 300;

// 遇到未知单词时，是否自动随机点击选项或填入占位符以跳过（true=自动跳过，false=仅记录警告）
var SKIP_UNKNOWN = true;

// isProcessing 最大保持时间（毫秒），超过此时间强制重置，防止死锁
var PROCESSING_TIMEOUT = 10000;

/* ================================================================
 * 题库字典 —— 多对多映射（英文 ↔ 中文）
 * 格式：{ "题目文本": "正确答案" } 或 { "题目文本": ["答案1", "答案2"] }
 * 一个词有多个正确翻译或一个翻译对应多个单词时，使用数组值
 * 用户可直接增删条目来扩充或修改题库
 * ================================================================ */

var dict = {
  "Air Force": "空军",
  "Armored Personnel Carrier": "人员装甲运输车",
  "Army": "陆军（首字母常用大写）；军队；集团军",
  "Army National Guard": "(美)陆军国民警卫队",
  "Army Reserve": "(美)陆军预备役",
  "Blind Carbon Copy": "密件抄送；密送",
  "Blue Beret": "蓝色贝雷帽；维和人员",
  "Blue Sword-2023": "蓝剑-2023",
  "Carbon copy/ Courtesy copy": "抄送",
  "Civil-Military Cooperation(CIMIC)": "军民合作",
  "Coast Guard": "海岸警卫队",
  "Cobra Gold-2024": "金色眼镜蛇-2024",
  "Code of Conduct": "行为准则",
  "Command Post Exercise": "指挥所演习",
  "Commissioned Officer": "军官",
  "Counter-Terrorism Field Training Exercise-2023": "反恐实兵演习-2023",
  "Department of War": "（美）战争部",
  "Department of War(abbr.)": "DoW",
  "Department of the Air Force(abbr.)": "DAF",
  "Deputy Commander": "副指挥官",
  "Direct Reporting Unit": "直属单位",
  "Directed Energy Weapon": "定向能武器",
  "Eagle Strike-2024": "雄鹰突击-2024",
  "Enemy Prisoner of War": "战俘",
  "Head Up Display": "平视显示器",
  "Infantry Fighting Vehicle(IFV)": "步兵战车",
  "Joint Chiefs of Staff": "参谋长联席会议",
  "Joint Operations Command Center": "联合作战指挥中心",
  "Joint Staff Department(JSD)": "联合参谋部",
  "Marine Corps": "海军陆战队",
  "Military Grid Reference System": "军事网格坐标",
  "Navy": "海军",
  "Non-Commissioned Officer": "士官",
  "North Atlantic Treaty Organization": "北大西洋公约组织（北约）",
  "Nuclear, Biological and Chemical Contamination": "核生化污染",
  "Nuclear, biological and chemical (NBC) protection": "核生化防护",
  "Office for the Coordination of Humanitarian Affairs(OCHA)": "人道主义事务协调办公室",
  "Official Use Only": "官方填写；仅供官方使用",
  "Peace Angel-2023": "和平天使-2023",
  "Physical Fitness Test": "体能测试",
  "Post Exchange": "军营超市",
  "Protocol Chief": "礼宾处处长",
  "Public Information Office": "新闻处",
  "Pure Homeland-2023": "净土-2023",
  "Regrets Only": "如不能出席请务必回复",
  "Rules of Engagement(ROE)": "交战规则",
  "See Distribution": "见收件人清单",
  "Space Command": "（美）太空司令部",
  "Space Command(abbr.)": "SPC",
  "Space Force": "(美)太空军",
  "Task Element": "特混支队",
  "UN Charter": "联合国宪章",
  "UN Children's Fund": "联合国儿童基金会",
  "World Food Programme": "世界粮食计划署",
  "accommodate": "使适应, 顺应",
  "accord": "使受到，给予（某种待遇）",
  "active service": "现役",
  "address": "称呼",
  "addressee": "收信人；收件人",
  "admiral": "（海军）上将",
  "air defense": "防空",
  "air-to-air missile": "空空导弹；空战导弹",
  "aircraft carrier": "航空母舰",
  "airlift": "空运",
  "airman": "空军士兵，飞行员",
  "algorithm": "算法，运算法则",
  "allergy": "过敏；敏感",
  "alleviate": "减轻，缓和",
  "allowance": "津贴",
  "alumni": "校友",
  "ambivalence": "矛盾情绪；正反感情并存",
  "ambush": "伏击",
  "ammo": "弹药;军火",
  "ammo pouch": "弹药袋",
  "amphibious": "两栖作战的；水陆两用的；两栖的",
  "animosity": "仇恨，敌意",
  "anti-personnel mine": "反步兵地雷；杀伤性地雷",
  "anti-terrorism drill": "反恐演习",
  "area of responsibility": "责任区",
  "arm": "兵种；武器；武装",
  "armed escort": "武装护卫",
  "armistice": "休战协议",
  "armor": "装甲；装甲兵；装甲部队",
  "arsenal": "武器库；军火库；兵工厂",
  "arterial": "动脉的",
  "artificial intelligence": "人工智能",
  "artillery": "炮兵；火炮",
  "assault": "攻击或袭击（敌方阵地）",
  "assault position": "冲锋出发阵地",
  "assessment": "评估，评价，评定",
  "assign": "编入建制；委派；任命；指派",
  "attachment": "配属部队",
  "attack position": "进攻出发阵地",
  "authorize": "授权，批准",
  "automated external defibrillator": "自动体外除颤器",
  "aviation": "航空兵",
  "band": "段；带，箍；带状物",
  "bandage": "绷带",
  "barbed wire": "铁丝网",
  "barrel": "枪管；炮筒",
  "basic training": "新兵训练",
  "battalion": "营",
  "beam": "梁、横梁；（体操的）平衡木",
  "big data": "大数据",
  "blemish": "瑕疵",
  "blockage": "堵塞，阻塞",
  "bomber": "轰炸机",
  "boot camp": "新兵（训练）营；新兵训练中心",
  "boulevard": "大街；（市区的）林荫大道",
  "breakdown": "（机器的）故障",
  "breastplate": "胸甲",
  "brigade": "旅",
  "brigadier general": "（陆、空、海军陆战队）准将",
  "brigadier general(abbr.)": "BG",
  "buffer zone": "缓冲区：中立区",
  "bulldozer": "推土机",
  "bunker": "掩体；地堡；暗堡",
  "buttstock": "枪托",
  "cadet": "（军校）学员",
  "caliber": "（枪、炮等的）口径",
  "callsign": "无线电通联呼号",
  "camaraderie": "友情；情谊",
  "camouflage": "迷彩",
  "cannon": "火炮；加农炮；机关炮",
  "canteen": "水壶",
  "captain": "（陆、空、海军陆战队）上尉；（海军）上校",
  "captain(abbr.)": "CPT",
  "carbon fiber": "碳纤维",
  "cardiac arrest": "心脏骤停",
  "cardio": "有氧运动",
  "cardiopulmonary resuscitation(CPR)": "心肺复苏术",
  "cargo net": "绳网",
  "casualty": "伤亡人员；（常用复数）伤亡人数",
  "casualty evacuation": "伤病员后送",
  "catastrophe": "灾难",
  "cavalry": "骑兵；高度机动的地面部队",
  "ceasefire": "停火协议",
  "ceiling": "升限；射高；（飞机）舱顶",
  "chain mail": "锁子甲",
  "chain of command": "指挥系统；指挥关系；指挥链",
  "checkpoint": "检查站，关卡",
  "chest seal": "胸腔密封贴，胸封",
  "chevron": "V形线条",
  "chief of staff(COS)": "参谋长",
  "chow": "食物",
  "chronological": "按发生时间顺序排列的",
  "circulation": "血液循环",
  "civilian": "平民，百姓；平民的",
  "clammy": "湿粘的；湿冷的",
  "classified": "列入密级的；保密的",
  "clear": "音质清晰",
  "clearing mines or ordnance": "扫雷排爆",
  "cliff": "悬崖",
  "clip": "夹子",
  "colonel": "（陆、空、海军陆战队）上校",
  "colonel(abbr.)": "COL",
  "coma": "昏迷",
  "combat arms": "作战部队",
  "combat arms support": "作战支援部队",
  "combat boots": "作战靴",
  "combat order": "战斗命令",
  "combat service support": "作战支援保障部队",
  "combat uniform": "作训服",
  "combined training": "协同训练；联合训练",
  "combined training exercise": "多国合成训练演习",
  "command sergeant major": "（美陆军）一级军士长（指挥）",
  "commander": "（海军）中校",
  "commanding officer": "指挥官；舰长；主官",
  "compile": "收集，搜集（信息，资料）",
  "complimentary close": "结尾客套语",
  "comply": "服从,顺从",
  "compression": "胸部按压",
  "compromise": "失密；泄密；暴露",
  "concept of operations": "作战概念",
  "confidential": "机密",
  "configuration": "布局，构造；配置",
  "conscript": "义务兵；被征召入伍者；征召；招募",
  "consent": "同意",
  "consolidate": "巩固，加强",
  "contingency": "突发事件",
  "contingent troop": "维和分队",
  "contour line": "等高线",
  "convoy": "车队；护送；护卫",
  "coordinate": "使协调; 使调和",
  "copies furnished": "提供的副本",
  "corporal": "下士",
  "corps": "军；军团；特殊兵种；部队",
  "corpsman": "医护兵;卫生员",
  "corvette": "轻型护卫舰;轻巡洋舰",
  "counterattack": "反击;反攻",
  "covert": "隐密的",
  "crane": "起重机",
  "crossroad": "十字路口",
  "cruiser": "巡洋舰",
  "cryptology": "密码术",
  "curve": "弯道",
  "cyber exercise": "网络演习",
  "dead reckoning": "航位推算法",
  "dearth": "缺乏",
  "declassify": "解密",
  "demining": "扫雷",
  "demobilization": "复员，遣散",
  "demonstration": "示威",
  "demote": "降衔（级）",
  "depression": "洼地",
  "deprivation": "贫困，匮乏，剥夺",
  "destroyer": "驱逐舰",
  "detachment": "分遣队",
  "detect": "发现；探测",
  "deterioration": "恶化",
  "digit": "（零到九中的任一）数字",
  "director of staff": "参谋部主任",
  "disarmament": "裁军；缴械",
  "disaster relief": "减灾；赈灾",
  "discharge": "退伍；退役",
  "discontent": "不满",
  "discretion": "谨慎；慎重",
  "disinformation": "虚假信息",
  "dismount": "下车",
  "dispatch": "派遣",
  "displacement": "（舰船）排水量",
  "disposable": "一次性的",
  "dispute": "争论，纠纷，争夺",
  "disrupt": "扰乱;瓦解",
  "distal pulse": "远端脉搏",
  "distorted": "声音失真",
  "distress signal": "遇险求救信号；遇难信号",
  "distribution of relief items": "分发救济品",
  "ditch": "壕沟",
  "division": "师",
  "dog tag": "狗牌：美军脖子上的一块小金属牌刻有姓名编号",
  "draft": "征兵；(船的）吃水深度",
  "draw": "山坳",
  "dress uniform": "礼服",
  "drill": "队列训练；操练",
  "drone": "无人机",
  "drought": "干旱；旱灾",
  "dump truck": "自动倾卸卡车、翻斗车",
  "earthquake": "地震",
  "electromagnetic spectrum": "电磁波谱",
  "elevation": "海拔",
  "elite": "尖子，精英",
  "emergency medical assistance": "紧急医疗援助",
  "emplacement": "炮火掩体；炮位",
  "enclosure": "附件",
  "engagement": "参加，从事",
  "engineer": "工兵",
  "enlist": "征募；参军；入伍",
  "enlisted": "士兵",
  "ensign": "（海军）少尉",
  "entangle": "使某人缠绕",
  "escort": "护送，陪同；护航舰；护卫队；护送者",
  "estimated time of arrival": "预计到达时间",
  "etiquette": "礼节",
  "evacuate": "撤离；疏散",
  "excavator": "挖掘机",
  "executive officer(XO)": "执行官；副舰长；副职指挥员",
  "exoskeleton": "外骨骼",
  "extract": "撤出（作战区域）；撤离",
  "facsimile": "传真",
  "fading": "信号变弱",
  "famine": "饥荒",
  "feed": "进弹，装弹，送弹",
  "fence": "栅栏",
  "field training exercise": "野战训练演习",
  "fighter": "战斗机；歼击机；斗士；战斗员",
  "figure": "数字",
  "fire coordination exercise": "火力协调演习",
  "fire team": "火力小组",
  "first aid": "急救",
  "first aid kit": "急救包",
  "first sergeant": "（美陆军）二级军士长（指挥）",
  "flak vest": "防弹背心",
  "flank": "翼侧;侧面",
  "fleet": "舰队；（飞机的）机队",
  "flight": "（飞行）小队；机群",
  "flotilla": "（小）舰队；（小）船队；纵队",
  "folding shovel": "折叠锹",
  "foot march": "徒步行军",
  "fortification": "防御工事",
  "foster": "培养",
  "fracture": "断裂；骨折",
  "fragmentary order": "补充命令",
  "frigate": "护卫舰",
  "gauze": "纱布；薄纱；",
  "general": "（陆、空、海军陆战队）上将",
  "general(abbr.)": "GEN",
  "geopolitics": "地缘政治",
  "goggles": "护目镜",
  "good": "信号好",
  "grenade": "手雷；手榴弹；枪榴弹",
  "grid": "坐标网格",
  "grip": "握把",
  "group": "大队",
  "guardian": "（美）太空军士兵",
  "gunnery sergeant": "枪炮军士",
  "halt": "停止；立定",
  "handle": "手柄，把手",
  "harass": "屡次袭扰（敌人）",
  "harassing attack": "扰乱攻击",
  "hard duty": "重型负载",
  "headquarters": "司令部；指挥部；总部",
  "hedging strategy": "对冲策略",
  "helicopter": "直升机",
  "helmet": "头盔",
  "high-energy laser system": "高能激光系统",
  "high-powered microwave system": "高功率微波系统",
  "hill": "小山",
  "hoist": "升降机；绞车",
  "honor code": "行为准则",
  "horizontal": "水平的, 与地平线平行的",
  "hornet": "大黄蜂",
  "hostile": "敌对，敌方的；怀敌意的",
  "howitzer": "榴弹炮",
  "hull": "壳体（坦克、自行火炮、舰艇等的主要结构）",
  "humanitarian aid": "人道主义救援",
  "humanitarian crisis": "人道主义危机",
  "hurricane": "飓风",
  "immunity": "免除，豁免",
  "impartiality": "公正",
  "improved road": "铺装路面",
  "inactivity": "不作为",
  "individual training": "单兵训练",
  "infiltration": "渗透；潜入",
  "inflict": "使遭受;使承受",
  "infrared strobes": "红外线频闪灯",
  "ingenuity": "聪明才智，巧妙",
  "insignia": "勋章；佩章；徽章；标记；识别符号",
  "instruction": "指令",
  "insurgent": "叛乱",
  "intelligence": "情报",
  "interference": "信号有干扰",
  "interim": "暂时的；过渡的",
  "intermediation": "调解，仲裁，调停",
  "intermittent": "信号时有时无",
  "intermittent stream": "间歇河流",
  "javelon": "标枪，投枪",
  "joint exercise": "联合军演",
  "joint force": "联合部队",
  "joint operations": "联合作战",
  "joint training": "联合训练；",
  "junction": "岔路口",
  "k-i-a": "阵亡",
  "khaki": "卡其色；卡其布",
  "kit": "成套工具，成套设备；箱子",
  "landmine": "地雷",
  "landslide": "山体滑坡；塌方",
  "lapel": "翻领",
  "laser beam": "激光束",
  "latitude": "纬度",
  "legend": "图例",
  "legitimacy": "合法性，合理性",
  "lethal": "致命的",
  "lever": "杠杆，手柄",
  "leverage": "利用",
  "liaise": "联络，沟通",
  "liaison": "联络",
  "lieutenant": "（陆、空、海军陆战队）中尉；（海军）上尉",
  "lieutenant colonel": "（陆、空、海军陆战队）中校",
  "lieutenant colonel(abbr.)": "LTC",
  "lieutenant commander": "(海军)少校",
  "lieutenant general": "（陆、海、海军陆战队）中将",
  "lieutenant general(abbr.)": "LG",
  "lieutenant junior grade": "(海军)中尉",
  "lieutenant(abbr.)": "LT",
  "line of departure": "起始线;出发线",
  "litter": "担架",
  "loader": "装载机",
  "log": "圆木",
  "logistics": "后勤；后勤学",
  "long-sleeve": "长袖",
  "long-term food aid": "长期粮食援助",
  "longitude": "经度",
  "loud": "信号强",
  "machinegun": "机枪；机关枪",
  "magazine": "弹匣；弹仓",
  "main battle tank(MBT)": "主战坦克",
  "main effort": "主攻部队",
  "major": "（陆、空、海军陆战队）少校",
  "major general": "（陆、海、海军陆战队）少将",
  "major general(abbr.)": "MG",
  "major(abbr.)": "MAJ",
  "man": "保卫（防御工事）",
  "mandate": "授权，委托",
  "map exercise": "地图推演",
  "marine": "海军陆战队员；海上的；海事的",
  "marine expeditionary brigade": "美国海军陆战队远征旅",
  "marksman": "射击能手；神枪手",
  "marksmanship": "枪法；射击术",
  "marsh": "湿地；沼泽",
  "masquerade": "掩饰",
  "master sergeant": "（美陆军）二级军士长（机关）",
  "medal ribbon": "勋章授带",
  "mediation": "调解，仲裁",
  "medical assistance": "医疗援助",
  "medical evacuation": "医疗后送",
  "memorandum": "备忘录",
  "midday": "中午，正午",
  "military academy": "军事院校",
  "military alphabet": "军用字母表",
  "military observer": "军事观察员",
  "mine clearance": "扫雷，排雷",
  "misinterpretation": "曲解",
  "mission": "特派团",
  "mobilization": "动员（尤指战时）",
  "monitor": "监督，监控，监视",
  "morale": "士气；民心；斗志",
  "mortar": "迫击炮",
  "multi-dimensional": "多层面",
  "muzzle": "枪口；炮口",
  "name plate": "姓名牌",
  "nasopharyngeal airway": "鼻咽导气管",
  "negotiation": "谈判，协商，",
  "neutrality": "中立",
  "neutralize": "（在军事或秘密行动中）消除威胁；摧毁",
  "nomination": "提名",
  "non-governmental organization": "非政府组织",
  "nothing heard": "听不见",
  "nylon": "尼龙",
  "obstacle course": "障碍训练（场）",
  "onset": "（尤指某种坏事情的）开始；发作",
  "operations order": "作战命令",
  "oral rehydration salts": "口服补液盐",
  "orchard": "果园",
  "order": "命令",
  "ordnance": "军械",
  "outreach": "外联",
  "overrun": "占领",
  "oversee": "监督；管理",
  "pants": "裤子",
  "patrol pack": "巡逻背包",
  "payload": "战斗部",
  "peacekeeping": "维和",
  "pentagon": "（美）国防部",
  "petty officer": "海军士官；海军军士",
  "physical training uniform": "体能服",
  "pistol": "手枪",
  "platoon": "排",
  "pleat": "褶皱，裤褶",
  "plot": "绘制; 标出",
  "point of contact": "联系人",
  "polyester": "聚酯纤维，涤纶",
  "precipitous": "险峻的, 陡峭的",
  "prioritize": "优先",
  "private": "列兵",
  "private first class": "上等兵",
  "projectile": "弹丸；炮弹；射弹",
  "promote": "晋升",
  "propeller": "推进器",
  "proportionate": "成比例的；相称的；适当的",
  "propulsion": "推进",
  "providing medical assistance": "提供医疗救助",
  "proword": "无线电通联规范用语",
  "pull-up": "引体向上",
  "push-up": "俯卧撑",
  "quartermaster": "军需",
  "radio check": "电台检查",
  "radio net": "无线电通信网络",
  "raid": "突击",
  "ramp": "斜坡，坡道",
  "range": "射程；靶场；射击场",
  "ration": "口粮；给养",
  "re-establishing infrastructure": "重建基础设施",
  "readability": "信号音质",
  "readable": "可以听清",
  "rear admiral lower half": "（海军）准将",
  "rear admiral upper half": "(海军)少将",
  "recce": "侦察（非正式）",
  "reconciliation": "和解；复交",
  "reconnaissance": "侦察（正式）",
  "reconstruction": "重建",
  "referendum": "全民投票",
  "refugee": "难民，避难者",
  "regime": "政权",
  "regiment": "团",
  "rehabilitation": "复原；恢复；修复",
  "reinforce": "增援",
  "release point": "分进点",
  "relief": "地形；（地形的）凹凸",
  "relocation of victims": "灾民转移",
  "reporting point": "报告点",
  "resilience": "弹性；韧性",
  "ridge": "山脊",
  "rifle": "来复枪；步枪；膛线",
  "roadblock": "路障，障碍物",
  "rocket launcher": "火箭炮；火箭发射器",
  "rod": "棒，杆",
  "roger": "已收到，明白",
  "rotate": "轮流；轮换；轮岗",
  "round": "一发（弹），整发弹；一轮",
  "roundabout": "环岛",
  "rucksack": "帆布背包",
  "saddle": "鞍部",
  "safety": "安全设备，保险装置",
  "sailor": "海军士兵，水兵",
  "salutation": "称呼；称谓",
  "salute": "敬礼",
  "sandstorm": "沙暴；沙尘暴",
  "scout group/team": "侦察组",
  "second lieutenant": "（陆、空、海军陆战队）少尉",
  "second lieutenant(abbr.)": "2LT",
  "sensor": "传感器",
  "sergeant": "军士；（美陆军、海军陆战队）中士",
  "sergeant first class": "(美陆军)三级军士长",
  "sergeant major": "(美)陆军一级军士长（机关）",
  "sergeant major of the army": "（美陆军）总军士长",
  "serve": "服役",
  "service": "军种；服役",
  "service cap": "军帽；大檐帽",
  "shipment": "运送",
  "short-sleeve": "短袖",
  "shoulder badge": "肩章",
  "shrapnel": "弹片；榴霰弹",
  "sideline": "边线；副业",
  "sight": "瞄准具；观测器；瞄准",
  "signal": "通信兵",
  "signal strength": "信号强度",
  "signpost": "指示牌",
  "sit-up": "仰卧起坐",
  "situation report": "军情报告",
  "situational awareness": "态势感知",
  "situational exercise": "情景训练演习",
  "small arms": "轻武器",
  "snowstorm": "雪暴；暴风雪",
  "spasm": "痉挛，抽搐",
  "special forces": "特种部队",
  "specialist": "专业兵；专业军士",
  "specification": "性能表，规格，规范",
  "spill-over": "溢出 ; 外溢",
  "splint": "（固定断骨的）夹板",
  "sprint": "冲刺、短跑",
  "spur": "尖坡",
  "squad": "班",
  "squadron": "中队",
  "staff": "参谋人员；参谋机构；参谋部",
  "staff exercise": "参谋人员演习",
  "staff sergeant": "（美陆军、海军陆战队）上士；（美空军）中士",
  "standard operating procedure": "标准作战程序；标准作业程序",
  "start point": "出发点",
  "stealth": "隐形",
  "strap": "带子；皮带",
  "strip map": "带状图",
  "stripe": "条纹",
  "submarine": "潜艇",
  "subordinate": "下级；下属",
  "superior": "上级；长官",
  "supervise": "指导，监督",
  "surface vessel": "水面舰艇",
  "surface-to-air missile": "地对空导弹；舰对空导弹",
  "surgical gloves": "外科手套；手术手套；医用手套",
  "surveillance": "监视",
  "sustain": "作战保障；战斗保障",
  "swamp": "沼泽（地）",
  "swarm": "蜂群",
  "synchronize": "同步；协调",
  "synthetic aperture radar": "合成孔径雷达",
  "table top exercise": "桌面推演",
  "tactic": "策略，战术",
  "tandem": "串列的，串联的；（飞机）串座式的",
  "team site": "观察员营地",
  "template": "模板",
  "temporize": "顺应时势,迎合潮流;拖延，耽搁",
  "terminate": "终止；使停止",
  "terrain": "地形；地势",
  "the 10th Mountain Division": "第十山地师",
  "topographic": "地形的",
  "tourniquet": "止血带",
  "trajectory": "轨道；弹道",
  "transmit": "（无线电等信号的）播送，发送",
  "trauma": "精神创伤，心理创伤；损伤，外伤",
  "truce": "停战（或停火）",
  "tsunami": "海啸",
  "tuition": "学费",
  "tunnel": "坑道",
  "turret": "炮塔",
  "underbrush": "矮树丛",
  "unpko": "联合国维和行动",
  "valley": "山谷",
  "vault": "跳跃，跃过",
  "ventilator": "人工呼吸器",
  "verify": "证实，证明，核实",
  "vertical": "垂直的，直立的",
  "vice admiral": "（海军）中将",
  "vigilance": "警戒；警惕",
  "volunteer": "志愿兵；志愿军人",
  "warrant officer": "文职人员",
  "waypoint": "路径；路标",
  "weak": "信号弱",
  "webbing": "背带，挂带",
  "wield": "运用，使用",
  "wildfire": "野火",
  "wing": "空军联队；航空兵联队；侧翼部队",
  "withdrawal": "撤退",
  "woods": "树林",
  "workout": "锻炼；训练",
  "(海军)中尉": "lieutenant junior grade",
  "(海军)少将": "rear admiral upper half",
  "(海军)少校": "lieutenant commander",
  "(美)太空军": "Space Force",
  "(美)陆军一级军士长（机关）": "sergeant major",
  "(美)陆军国民警卫队": "Army National Guard",
  "(美)陆军预备役": "Army Reserve",
  "(美陆军)三级军士长": "sergeant first class",
  "2LT": "second lieutenant(abbr.)",
  "BG": "brigadier general(abbr.)",
  "COL": "colonel(abbr.)",
  "CPT": "captain(abbr.)",
  "DAF": "Department of the Air Force(abbr.)",
  "DoW": "Department of War(abbr.)",
  "GEN": "general(abbr.)",
  "LG": "lieutenant general(abbr.)",
  "LT": "lieutenant(abbr.)",
  "LTC": "lieutenant colonel(abbr.)",
  "MAJ": "major(abbr.)",
  "MG": "major general(abbr.)",
  "SPC": "Space Command(abbr.)",
  "V形线条": "chevron",
  "一发（弹），整发弹；一轮": "round",
  "一次性的": "disposable",
  "上等兵": "private first class",
  "上级；长官": "superior",
  "下士": "corporal",
  "下级；下属": "subordinate",
  "下车": "dismount",
  "不作为": "inactivity",
  "不满": "discontent",
  "专业兵；专业军士": "specialist",
  "世界粮食计划署": "World Food Programme",
  "两栖作战的；水陆两用的；两栖的": "amphibious",
  "中午，正午": "midday",
  "中立": "neutrality",
  "中队": "squadron",
  "串列的，串联的；（飞机）串座式的": "tandem",
  "主战坦克": "main battle tank(MBT)",
  "主攻部队": "main effort",
  "义务兵；被征召入伍者；征召；招募": "conscript",
  "争论，纠纷，争夺": "dispute",
  "交战规则": "Rules of Engagement(ROE)",
  "人员装甲运输车": "Armored Personnel Carrier",
  "人工呼吸器": "ventilator",
  "人工智能": "artificial intelligence",
  "人道主义事务协调办公室": "Office for the Coordination of Humanitarian Affairs(OCHA)",
  "人道主义危机": "humanitarian crisis",
  "人道主义救援": "humanitarian aid",
  "仇恨，敌意": "animosity",
  "仰卧起坐": "sit-up",
  "伏击": "ambush",
  "休战协议": "armistice",
  "优先": "prioritize",
  "传感器": "sensor",
  "传真": "facsimile",
  "伤亡人员；（常用复数）伤亡人数": "casualty",
  "伤病员后送": "casualty evacuation",
  "体能服": "physical training uniform",
  "体能测试": "Physical Fitness Test",
  "作战保障；战斗保障": "sustain",
  "作战命令": "operations order",
  "作战支援保障部队": "combat service support",
  "作战支援部队": "combat arms support",
  "作战概念": "concept of operations",
  "作战部队": "combat arms",
  "作战靴": "combat boots",
  "作训服": "combat uniform",
  "使协调; 使调和": "coordinate",
  "使受到，给予（某种待遇）": "accord",
  "使某人缠绕": "entangle",
  "使适应, 顺应": "accommodate",
  "使遭受;使承受": "inflict",
  "侦察组": "scout group/team",
  "侦察（正式）": "reconnaissance",
  "侦察（非正式）": "recce",
  "保卫（防御工事）": "man",
  "信号变弱": "fading",
  "信号好": "good",
  "信号弱": "weak",
  "信号强": "loud",
  "信号强度": "signal strength",
  "信号时有时无": "intermittent",
  "信号有干扰": "interference",
  "信号音质": "readability",
  "俯卧撑": "push-up",
  "停战（或停火）": "truce",
  "停止；立定": "halt",
  "停火协议": "ceasefire",
  "免除，豁免": "immunity",
  "全民投票": "referendum",
  "公正": "impartiality",
  "兵种；武器；武装": "arm",
  "军事网格坐标": "Military Grid Reference System",
  "军事观察员": "military observer",
  "军事院校": "military academy",
  "军士；（美陆军、海军陆战队）中士": "sergeant",
  "军官": "Commissioned Officer",
  "军帽；大檐帽": "service cap",
  "军情报告": "situation report",
  "军械": "ordnance",
  "军民合作": "Civil-Military Cooperation(CIMIC)",
  "军用字母表": "military alphabet",
  "军种；服役": "service",
  "军营超市": "Post Exchange",
  "军需": "quartermaster",
  "军；军团；特殊兵种；部队": "corps",
  "冲刺、短跑": "sprint",
  "冲锋出发阵地": "assault position",
  "净土-2023": "Pure Homeland-2023",
  "减灾；赈灾": "disaster relief",
  "减轻，缓和": "alleviate",
  "出发点": "start point",
  "分发救济品": "distribution of relief items",
  "分进点": "release point",
  "分遣队": "detachment",
  "列入密级的；保密的": "classified",
  "列兵": "private",
  "利用": "leverage",
  "副指挥官": "Deputy Commander",
  "动员（尤指战时）": "mobilization",
  "动脉的": "arterial",
  "勋章授带": "medal ribbon",
  "勋章；佩章；徽章；标记；识别符号": "insignia",
  "北大西洋公约组织（北约）": "North Atlantic Treaty Organization",
  "医护兵;卫生员": "corpsman",
  "医疗后送": "medical evacuation",
  "医疗援助": "medical assistance",
  "十字路口": "crossroad",
  "升降机；绞车": "hoist",
  "升限；射高；（飞机）舱顶": "ceiling",
  "协同训练；联合训练": "combined training",
  "单兵训练": "individual training",
  "占领": "overrun",
  "卡其色；卡其布": "khaki",
  "参加，从事": "engagement",
  "参谋人员演习": "staff exercise",
  "参谋人员；参谋机构；参谋部": "staff",
  "参谋部主任": "director of staff",
  "参谋长": "chief of staff(COS)",
  "参谋长联席会议": "Joint Chiefs of Staff",
  "友情；情谊": "camaraderie",
  "反击;反攻": "counterattack",
  "反恐实兵演习-2023": "Counter-Terrorism Field Training Exercise-2023",
  "反恐演习": "anti-terrorism drill",
  "反步兵地雷；杀伤性地雷": "anti-personnel mine",
  "发现；探测": "detect",
  "叛乱": "insurgent",
  "口服补液盐": "oral rehydration salts",
  "口粮；给养": "ration",
  "可以听清": "readable",
  "司令部；指挥部；总部": "headquarters",
  "合成孔径雷达": "synthetic aperture radar",
  "合法性，合理性": "legitimacy",
  "同意": "consent",
  "同步；协调": "synchronize",
  "后勤；后勤学": "logistics",
  "听不见": "nothing heard",
  "命令": "order",
  "和平天使-2023": "Peace Angel-2023",
  "和解；复交": "reconciliation",
  "团": "regiment",
  "图例": "legend",
  "圆木": "log",
  "地图推演": "map exercise",
  "地对空导弹；舰对空导弹": "surface-to-air missile",
  "地形的": "topographic",
  "地形；地势": "terrain",
  "地形；（地形的）凹凸": "relief",
  "地缘政治": "geopolitics",
  "地雷": "landmine",
  "地震": "earthquake",
  "坐标网格": "grid",
  "坑道": "tunnel",
  "垂直的，直立的": "vertical",
  "培养": "foster",
  "堵塞，阻塞": "blockage",
  "增援": "reinforce",
  "壕沟": "ditch",
  "士兵": "enlisted",
  "士官": "Non-Commissioned Officer",
  "士气；民心；斗志": "morale",
  "声音失真": "distorted",
  "壳体（坦克、自行火炮、舰艇等的主要结构）": "hull",
  "备忘录": "memorandum",
  "复原；恢复；修复": "rehabilitation",
  "复员，遣散": "demobilization",
  "外科手套；手术手套；医用手套": "surgical gloves",
  "外联": "outreach",
  "外骨骼": "exoskeleton",
  "多国合成训练演习": "combined training exercise",
  "多层面": "multi-dimensional",
  "大数据": "big data",
  "大街；（市区的）林荫大道": "boulevard",
  "大队": "group",
  "大黄蜂": "hornet",
  "失密；泄密；暴露": "compromise",
  "头盔": "helmet",
  "夹子": "clip",
  "如不能出席请务必回复": "Regrets Only",
  "姓名牌": "name plate",
  "学费": "tuition",
  "安全设备，保险装置": "safety",
  "官方填写；仅供官方使用": "Official Use Only",
  "定向能武器": "Directed Energy Weapon",
  "密件抄送；密送": "Blind Carbon Copy",
  "密码术": "cryptology",
  "对冲策略": "hedging strategy",
  "射击能手；神枪手": "marksman",
  "射程；靶场；射击场": "range",
  "小山": "hill",
  "尖坡": "spur",
  "尖子，精英": "elite",
  "尼龙": "nylon",
  "屡次袭扰（敌人）": "harass",
  "山体滑坡；塌方": "landslide",
  "山坳": "draw",
  "山脊": "ridge",
  "山谷": "valley",
  "岔路口": "junction",
  "巡洋舰": "cruiser",
  "巡逻背包": "patrol pack",
  "工兵": "engineer",
  "巩固，加强": "consolidate",
  "已收到，明白": "roger",
  "布局，构造；配置": "configuration",
  "帆布背包": "rucksack",
  "师": "division",
  "带子；皮带": "strap",
  "带状图": "strip map",
  "干旱；旱灾": "drought",
  "平民，百姓；平民的": "civilian",
  "平视显示器": "Head Up Display",
  "引体向上": "pull-up",
  "弯道": "curve",
  "弹丸；炮弹；射弹": "projectile",
  "弹匣；弹仓": "magazine",
  "弹性；韧性": "resilience",
  "弹片；榴霰弹": "shrapnel",
  "弹药;军火": "ammo",
  "弹药袋": "ammo pouch",
  "征兵；(船的）吃水深度": "draft",
  "征募；参军；入伍": "enlist",
  "徒步行军": "foot march",
  "心肺复苏术": "cardiopulmonary resuscitation(CPR)",
  "心脏骤停": "cardiac arrest",
  "志愿兵；志愿军人": "volunteer",
  "态势感知": "situational awareness",
  "急救": "first aid",
  "急救包": "first aid kit",
  "性能表，规格，规范": "specification",
  "恶化": "deterioration",
  "悬崖": "cliff",
  "情报": "intelligence",
  "情景训练演习": "situational exercise",
  "成套工具，成套设备；箱子": "kit",
  "成比例的；相称的；适当的": "proportionate",
  "战俘": "Enemy Prisoner of War",
  "战斗命令": "combat order",
  "战斗机；歼击机；斗士；战斗员": "fighter",
  "战斗部": "payload",
  "手枪": "pistol",
  "手柄，把手": "handle",
  "手雷；手榴弹；枪榴弹": "grenade",
  "执行官；副舰长；副职指挥员": "executive officer(XO)",
  "扫雷": "demining",
  "扫雷排爆": "clearing mines or ordnance",
  "扫雷，排雷": "mine clearance",
  "扰乱;瓦解": "disrupt",
  "扰乱攻击": "harassing attack",
  "抄送": "Carbon copy/ Courtesy copy",
  "折叠锹": "folding shovel",
  "护卫舰": "frigate",
  "护目镜": "goggles",
  "护送，陪同；护航舰；护卫队；护送者": "escort",
  "报告点": "reporting point",
  "担架": "litter",
  "指令": "instruction",
  "指导，监督": "supervise",
  "指挥官；舰长；主官": "commanding officer",
  "指挥所演习": "Command Post Exercise",
  "指挥系统；指挥关系；指挥链": "chain of command",
  "指示牌": "signpost",
  "按发生时间顺序排列的": "chronological",
  "挖掘机": "excavator",
  "授权，委托": "mandate",
  "授权，批准": "authorize",
  "排": "platoon",
  "推土机": "bulldozer",
  "推进": "propulsion",
  "推进器": "propeller",
  "掩体；地堡；暗堡": "bunker",
  "掩饰": "masquerade",
  "提供医疗救助": "providing medical assistance",
  "提供的副本": "copies furnished",
  "提名": "nomination",
  "握把": "grip",
  "撤出（作战区域）；撤离": "extract",
  "撤离；疏散": "evacuate",
  "撤退": "withdrawal",
  "收信人；收件人": "addressee",
  "收集，搜集（信息，资料）": "compile",
  "攻击或袭击（敌方阵地）": "assault",
  "政权": "regime",
  "敌对，敌方的；怀敌意的": "hostile",
  "敬礼": "salute",
  "数字": "figure",
  "文职人员": "warrant officer",
  "斜坡，坡道": "ramp",
  "断裂；骨折": "fracture",
  "新兵训练": "basic training",
  "新兵（训练）营；新兵训练中心": "boot camp",
  "新闻处": "Public Information Office",
  "旅": "brigade",
  "无人机": "drone",
  "无线电通信网络": "radio net",
  "无线电通联呼号": "callsign",
  "无线电通联规范用语": "proword",
  "昏迷": "coma",
  "晋升": "promote",
  "暂时的；过渡的": "interim",
  "曲解": "misinterpretation",
  "有氧运动": "cardio",
  "服从,顺从": "comply",
  "服役": "serve",
  "机密": "confidential",
  "机枪；机关枪": "machinegun",
  "杠杆，手柄": "lever",
  "条纹": "stripe",
  "来复枪；步枪；膛线": "rifle",
  "果园": "orchard",
  "枪口；炮口": "muzzle",
  "枪托": "buttstock",
  "枪法；射击术": "marksmanship",
  "枪炮军士": "gunnery sergeant",
  "枪管；炮筒": "barrel",
  "栅栏": "fence",
  "标准作战程序；标准作业程序": "standard operating procedure",
  "标枪，投枪": "javelon",
  "树林": "woods",
  "校友": "alumni",
  "核生化污染": "Nuclear, Biological and Chemical Contamination",
  "核生化防护": "Nuclear, biological and chemical (NBC) protection",
  "桌面推演": "table top exercise",
  "梁、横梁；（体操的）平衡木": "beam",
  "检查站，关卡": "checkpoint",
  "棒，杆": "rod",
  "榴弹炮": "howitzer",
  "模板": "template",
  "止血带": "tourniquet",
  "步兵战车": "Infantry Fighting Vehicle(IFV)",
  "武器库；军火库；兵工厂": "arsenal",
  "武装护卫": "armed escort",
  "段；带，箍；带状物": "band",
  "水壶": "canteen",
  "水平的, 与地平线平行的": "horizontal",
  "水面舰艇": "surface vessel",
  "沙暴；沙尘暴": "sandstorm",
  "沼泽（地）": "swamp",
  "津贴": "allowance",
  "洼地": "depression",
  "派遣": "dispatch",
  "海军": "Navy",
  "海军士兵，水兵": "sailor",
  "海军士官；海军军士": "petty officer",
  "海军陆战队": "Marine Corps",
  "海军陆战队员；海上的；海事的": "marine",
  "海啸": "tsunami",
  "海岸警卫队": "Coast Guard",
  "海拔": "elevation",
  "渗透；潜入": "infiltration",
  "湿地；沼泽": "marsh",
  "湿粘的；湿冷的": "clammy",
  "溢出 ; 外溢": "spill-over",
  "潜艇": "submarine",
  "激光束": "laser beam",
  "火力协调演习": "fire coordination exercise",
  "火力小组": "fire team",
  "火炮；加农炮；机关炮": "cannon",
  "火箭炮；火箭发射器": "rocket launcher",
  "灾民转移": "relocation of victims",
  "灾难": "catastrophe",
  "炮兵；火炮": "artillery",
  "炮塔": "turret",
  "炮火掩体；炮位": "emplacement",
  "特派团": "mission",
  "特混支队": "Task Element",
  "特种部队": "special forces",
  "狗牌：美军脖子上的一块小金属牌刻有姓名编号": "dog tag",
  "环岛": "roundabout",
  "现役": "active service",
  "班": "squad",
  "瑕疵": "blemish",
  "电台检查": "radio check",
  "电磁波谱": "electromagnetic spectrum",
  "痉挛，抽搐": "spasm",
  "监督，监控，监视": "monitor",
  "监督；管理": "oversee",
  "监视": "surveillance",
  "直升机": "helicopter",
  "直属单位": "Direct Reporting Unit",
  "瞄准具；观测器；瞄准": "sight",
  "矛盾情绪；正反感情并存": "ambivalence",
  "短袖": "short-sleeve",
  "矮树丛": "underbrush",
  "碳纤维": "carbon fiber",
  "示威": "demonstration",
  "礼宾处处长": "Protocol Chief",
  "礼服": "dress uniform",
  "礼节": "etiquette",
  "称呼": "address",
  "称呼；称谓": "salutation",
  "空军": "Air Force",
  "空军士兵，飞行员": "airman",
  "空军联队；航空兵联队；侧翼部队": "wing",
  "空空导弹；空战导弹": "air-to-air missile",
  "空运": "airlift",
  "突击": "raid",
  "突发事件": "contingency",
  "第十山地师": "the 10th Mountain Division",
  "等高线": "contour line",
  "策略，战术": "tactic",
  "算法，运算法则": "algorithm",
  "精神创伤，心理创伤；损伤，外伤": "trauma",
  "紧急医疗援助": "emergency medical assistance",
  "红外线频闪灯": "infrared strobes",
  "纬度": "latitude",
  "纱布；薄纱；": "gauze",
  "终止；使停止": "terminate",
  "经度": "longitude",
  "结尾客套语": "complimentary close",
  "绘制; 标出": "plot",
  "绳网": "cargo net",
  "维和": "peacekeeping",
  "维和分队": "contingent troop",
  "绷带": "bandage",
  "缓冲区：中立区": "buffer zone",
  "编入建制；委派；任命；指派": "assign",
  "缺乏": "dearth",
  "网络演习": "cyber exercise",
  "美国海军陆战队远征旅": "marine expeditionary brigade",
  "翻领": "lapel",
  "翼侧;侧面": "flank",
  "联合作战": "joint operations",
  "联合作战指挥中心": "Joint Operations Command Center",
  "联合军演": "joint exercise",
  "联合参谋部": "Joint Staff Department(JSD)",
  "联合国儿童基金会": "UN Children's Fund",
  "联合国宪章": "UN Charter",
  "联合国维和行动": "unpko",
  "联合训练；": "joint training",
  "联合部队": "joint force",
  "联系人": "point of contact",
  "联络": "liaison",
  "联络，沟通": "liaise",
  "聚酯纤维，涤纶": "polyester",
  "聪明才智，巧妙": "ingenuity",
  "肩章": "shoulder badge",
  "背带，挂带": "webbing",
  "胸甲": "breastplate",
  "胸腔密封贴，胸封": "chest seal",
  "胸部按压": "compression",
  "自动体外除颤器": "automated external defibrillator",
  "自动倾卸卡车、翻斗车": "dump truck",
  "致命的": "lethal",
  "航位推算法": "dead reckoning",
  "航空兵": "aviation",
  "航空母舰": "aircraft carrier",
  "舰队；（飞机的）机队": "fleet",
  "营": "battalion",
  "蓝剑-2023": "Blue Sword-2023",
  "蓝色贝雷帽；维和人员": "Blue Beret",
  "虚假信息": "disinformation",
  "蜂群": "swarm",
  "血液循环": "circulation",
  "行为准则": ["honor code", "Code of Conduct"],
  "补充命令": "fragmentary order",
  "裁军；缴械": "disarmament",
  "装甲；装甲兵；装甲部队": "armor",
  "装载机": "loader",
  "裤子": "pants",
  "褶皱，裤褶": "pleat",
  "见收件人清单": "See Distribution",
  "观察员营地": "team site",
  "解密": "declassify",
  "警戒；警惕": "vigilance",
  "证实，证明，核实": "verify",
  "评估，评价，评定": "assessment",
  "调解，仲裁": "mediation",
  "调解，仲裁，调停": "intermediation",
  "谈判，协商，": "negotiation",
  "谨慎；慎重": "discretion",
  "责任区": "area of responsibility",
  "贫困，匮乏，剥夺": "deprivation",
  "起始线;出发线": "line of departure",
  "起重机": "crane",
  "路径；路标": "waypoint",
  "路障，障碍物": "roadblock",
  "跳跃，跃过": "vault",
  "车队；护送；护卫": "convoy",
  "轨道；弹道": "trajectory",
  "轮流；轮换；轮岗": "rotate",
  "轰炸机": "bomber",
  "轻型护卫舰;轻巡洋舰": "corvette",
  "轻武器": "small arms",
  "边线；副业": "sideline",
  "过敏；敏感": "allergy",
  "运用，使用": "wield",
  "运送": "shipment",
  "进弹，装弹，送弹": "feed",
  "进攻出发阵地": "attack position",
  "远端脉搏": "distal pulse",
  "迫击炮": "mortar",
  "迷彩": "camouflage",
  "退伍；退役": "discharge",
  "通信兵": "signal",
  "遇险求救信号；遇难信号": "distress signal",
  "配属部队": "attachment",
  "重型负载": "hard duty",
  "重建": "reconstruction",
  "重建基础设施": "re-establishing infrastructure",
  "野战训练演习": "field training exercise",
  "野火": "wildfire",
  "金色眼镜蛇-2024": "Cobra Gold-2024",
  "铁丝网": "barbed wire",
  "铺装路面": "improved road",
  "锁子甲": "chain mail",
  "锻炼；训练": "workout",
  "长期粮食援助": "long-term food aid",
  "长袖": "long-sleeve",
  "间歇河流": "intermittent stream",
  "队列训练；操练": "drill",
  "防弹背心": "flak vest",
  "防御工事": "fortification",
  "防空": "air defense",
  "阵亡": "k-i-a",
  "附件": "enclosure",
  "陆军（首字母常用大写）；军队；集团军": "Army",
  "降衔（级）": "demote",
  "险峻的, 陡峭的": "precipitous",
  "隐密的": "covert",
  "隐形": "stealth",
  "障碍训练（场）": "obstacle course",
  "难民，避难者": "refugee",
  "雄鹰突击-2024": "Eagle Strike-2024",
  "雪暴；暴风雪": "snowstorm",
  "非政府组织": "non-governmental organization",
  "鞍部": "saddle",
  "音质清晰": "clear",
  "顺应时势,迎合潮流;拖延，耽搁": "temporize",
  "预计到达时间": "estimated time of arrival",
  "飓风": "hurricane",
  "食物": "chow",
  "饥荒": "famine",
  "驱逐舰": "destroyer",
  "骑兵；高度机动的地面部队": "cavalry",
  "高功率微波系统": "high-powered microwave system",
  "高能激光系统": "high-energy laser system",
  "鼻咽导气管": "nasopharyngeal airway",
  "（军校）学员": "cadet",
  "（固定断骨的）夹板": "splint",
  "（在军事或秘密行动中）消除威胁；摧毁": "neutralize",
  "（小）舰队；（小）船队；纵队": "flotilla",
  "（尤指某种坏事情的）开始；发作": "onset",
  "（无线电等信号的）播送，发送": "transmit",
  "（机器的）故障": "breakdown",
  "（枪、炮等的）口径": "caliber",
  "（海军）上将": "admiral",
  "（海军）中将": "vice admiral",
  "（海军）中校": "commander",
  "（海军）准将": "rear admiral lower half",
  "（海军）少尉": "ensign",
  "（美陆军、海军陆战队）上士；（美空军）中士": "staff sergeant",
  "（美陆军）一级军士长（指挥）": "command sergeant major",
  "（美陆军）二级军士长（指挥）": "first sergeant",
  "（美陆军）二级军士长（机关）": "master sergeant",
  "（美陆军）总军士长": "sergeant major of the army",
  "（美）国防部": "pentagon",
  "（美）太空军士兵": "guardian",
  "（美）太空司令部": "Space Command",
  "（美）战争部": "Department of War",
  "（舰船）排水量": "displacement",
  "（陆、海、海军陆战队）中将": "lieutenant general",
  "（陆、海、海军陆战队）少将": "major general",
  "（陆、空、海军陆战队）上将": "general",
  "（陆、空、海军陆战队）上尉；（海军）上校": "captain",
  "（陆、空、海军陆战队）上校": "colonel",
  "（陆、空、海军陆战队）中尉；（海军）上尉": "lieutenant",
  "（陆、空、海军陆战队）中校": "lieutenant colonel",
  "（陆、空、海军陆战队）准将": "brigadier general",
  "（陆、空、海军陆战队）少尉": "second lieutenant",
  "（陆、空、海军陆战队）少校": "major",
  "（零到九中的任一）数字": "digit",
  "（飞行）小队；机群": "flight",
};

/* ================================================================
 * 内部状态变量
 * ================================================================ */

// 记录上一次处理的题目文本，用于调试日志和页面推进检测对比
var lastQuestionText = "";

// 标记是否正在处理中，防止并发作答
var isProcessing = false;

// MutationObserver 实例引用
var observer = null;

/* ================================================================
 * 工具函数
 * ================================================================ */

/**
 * 生成指定范围内的随机延迟（毫秒）
 * @param {number} min - 最小延迟
 * @param {number} max - 最大延迟
 * @returns {number} 随机延迟值
 */
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 获取题目文本（去除首尾空格）
 * @returns {string|null} 题目文本，如果元素不存在则返回 null
 */
function getQuestionText() {
  try {
    var el = document.querySelector(QUESTION_SELECTOR) || document.querySelector("#battleQuestionText");
    if (!el) { return null; }
    return el.textContent.trim();
  } catch (e) {
    console.warn("[自动答题] 获取题目文本失败:", e.message);
    return null;
  }
}

/**
 * 在字典中查找题目的所有正确答案（支持多对多映射）
 * 比对时忽略首尾空格与大小写差异（获取题目时已做 trim，此处再做一层保护）
 * @param {string} question - 题目文本
 * @returns {string[]|null} 正确答案列表，未找到返回 null
 */
function lookupAnswer(question) {
  if (!question) { return null; }
  var q = normalizeText(question);
  if (normalizedDict && Object.prototype.hasOwnProperty.call(normalizedDict, q)) {
    return normalizedDict[q];
  }
  return null;
}

/**
 * 判断当前题目类型
 * 依据页面上的 #questionType 元素内容判断：
 *   - 包含"拼写单词" → 填空题
 *   - 包含"选择正确单词" → 选择题（中文→英文）
 *   - 包含"选择正确释义" → 选择题（英文→中文）
 * @returns {string} "fill" | "choice" | "unknown"
 */
function getQuestionType() {
  try {
    var typeEl = document.querySelector(QUESTION_TYPE_SELECTOR) || document.querySelector("#battleQuestionType");
    if (!typeEl) { return "unknown"; }
    var text = typeEl.textContent.trim();
    if (text.indexOf("拼写单词") !== -1) {
      return "fill";
    }
    if (text.indexOf("选择正确单词") !== -1 || text.indexOf("选择正确释义") !== -1) {
      return "choice";
    }
    return "unknown";
  } catch (e) {
    console.warn("[自动答题] 判断题型失败:", e.message);
    return "unknown";
  }
}

/**
 * 检查填空题输入框是否可见
 * @returns {boolean}
 */
function isFillInputVisible() {
  try {
    var input = document.querySelector(FILL_INPUT_SELECTOR);
    if (!input) { return false; }
    var style = window.getComputedStyle(input);
    return style.display !== "none" && style.visibility !== "hidden" && input.offsetParent !== null;
  } catch (e) {
    return false;
  }
}

/* ================================================================
 * 核心作答逻辑
 * ================================================================ */

/**
 * 文本规范化：将全角 ASCII 字符转换为半角，去除首尾空格，转小写
 * 处理中文网站上常见的全角英文字母（如 ｎｙｌｏｎ → nylon）
 * @param {string} text - 原始文本
 * @returns {string} 规范化后的文本
 */
function normalizeText(text) {
  if (!text) { return ""; }
  return text
    .replace(/[\uFF01-\uFF5E]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    })
    .replace(/[\u200B-\u200F\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * 规范化后的词库字典：由原始 dict 在初始化时构建一次
 * 将原始 dict 的所有 key 经 normalizeText 处理后作为新 key，
 * value 统一为字符串数组（单个答案也包装为数组），
 * 若多个原始 key 规范化后相同，其 value 数组合并去重，
 * 使题目文本（也经 normalizeText）能精确匹配并返回所有可能答案
 */
var normalizedDict = null;

/**
 * 构建规范化词库字典
 * 支持 string 和数组两种原始 value 格式，自动统一为数组
 * 重复 key 合并去重
 */
function buildNormalizedDict() {
  normalizedDict = {};
  var keys = Object.keys(dict);
  for (var i = 0; i < keys.length; i++) {
    var rawKey = keys[i];
    var normKey = normalizeText(rawKey);
    var rawValue = dict[rawKey];
    var values = Array.isArray(rawValue) ? rawValue : [rawValue];

    if (!Object.prototype.hasOwnProperty.call(normalizedDict, normKey)) {
      normalizedDict[normKey] = [];
    }

    for (var j = 0; j < values.length; j++) {
      if (normalizedDict[normKey].indexOf(values[j]) === -1) {
        normalizedDict[normKey].push(values[j]);
      }
    }
  }
}

/**
 * 处理选择题：遍历 #optionsGrid 下的所有按钮，
 * 将按钮文本与正确答案列表逐一比对（精确匹配 + 模糊包含），
 * 选择选项中包含的第一个正确答案
 * 支持内部重试，重试成功后通过 onSuccess 回调通知调用方
 * @param {string[]} correctAnswers - 字典中查到的正确答案列表
 * @param {number} retriesLeft - 重试次数（内部用，首次调用省略）
 * @param {function} onSuccess - 成功点击后的回调（用于重置 isProcessing 和记录 lastQuestionText）
 * @returns {boolean} 首轮调用是否成功（重试通过回调通知，不反映在返回值中）
 */
function answerChoice(correctAnswers, retriesLeft, onSuccess) {
  if (retriesLeft === undefined) { retriesLeft = MAX_RETRIES; }

  try {
    if (!correctAnswers || correctAnswers.length === 0) {
      console.warn("[自动答题] 答案列表为空，无法匹配");
      return false;
    }

    var answersNormalized = [];
    for (var a = 0; a < correctAnswers.length; a++) {
      var norm = normalizeText(correctAnswers[a]);
      if (norm) { answersNormalized.push(norm); }
    }
    if (answersNormalized.length === 0) {
      console.warn("[自动答题] 答案文本全部为空，无法匹配");
      return false;
    }

      var grid = document.querySelector(OPTIONS_GRID_SELECTOR) || document.querySelector("#battleOptionsGrid");
    if (!grid) {
      console.warn("[自动答题] 未找到选项容器:", OPTIONS_GRID_SELECTOR);
      return false;
    }
    var buttons = grid.querySelectorAll("button");
    if (buttons.length === 0) {
      if (retriesLeft > 0) {
        console.log("[自动答题] 选项按钮尚未渲染，等待重试... 剩余次数:", retriesLeft);
        setTimeout(function () {
          answerChoice(correctAnswers, retriesLeft - 1, onSuccess);
        }, RETRY_INTERVAL);
        return false;
      }
      console.warn("[自动答题] 未找到任何选项按钮");
      return false;
    }

    var foundIndex = -1;
    var matchedAnswer = "";

    // 遍历每个选项按钮，对每个可能的正确答案尝试匹配
    for (var i = 0; i < buttons.length; i++) {
      var btnNormalized = normalizeText(buttons[i].textContent);
      for (var k = 0; k < answersNormalized.length; k++) {
        var ansNorm = answersNormalized[k];
        if (btnNormalized === ansNorm) {
          foundIndex = i;
          matchedAnswer = correctAnswers[k];
          break;
        }
        if (btnNormalized.indexOf(ansNorm) !== -1 || ansNorm.indexOf(btnNormalized) !== -1) {
          foundIndex = i;
          matchedAnswer = correctAnswers[k];
          console.log("[自动答题] 模糊匹配成功: 按钮文本='" + buttons[i].textContent.trim() + "' 包含答案='" + matchedAnswer + "'");
          break;
        }
      }
      if (foundIndex !== -1) { break; }
    }

    if (foundIndex !== -1) {
      var targetBtn = buttons[foundIndex];
      console.log("[自动答题] 选择题匹配成功: '" + targetBtn.textContent.trim() + "' (答案: '" + matchedAnswer + "') → 点击选项 #" + (foundIndex + 1));

      var clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0
      });
      targetBtn.dispatchEvent(clickEvent);

      if (onSuccess && retriesLeft < MAX_RETRIES) { onSuccess(); }
      return true;
    }

    var availableTexts = Array.from(buttons).map(function (b) { return b.textContent.trim(); });
    console.warn("[自动答题] 选择题未找到匹配选项。正确答案: " + JSON.stringify(correctAnswers) + ", 可用选项:", availableTexts);

    if (retriesLeft > 0) {
      console.log("[自动答题] 等待 DOM 更新后重试... 剩余次数:", retriesLeft);
      setTimeout(function () {
        answerChoice(correctAnswers, retriesLeft - 1, onSuccess);
      }, RETRY_INTERVAL);
      return false;
    }

    return false;
  } catch (e) {
    console.error("[自动答题] 处理选择题时出错:", e.message);
    return false;
  }
}

/**
 * 处理填空题：从多个正确答案中随机选择一个填入输入框，然后自动点击提交按钮
 * @param {string[]} correctAnswers - 字典中查到的正确答案列表
 */
function answerFill(correctAnswers) {
  try {
    if (!correctAnswers || correctAnswers.length === 0) {
      console.warn("[自动答题] 答案列表为空，无法填写");
      return;
    }

    var chosenAnswer = correctAnswers[Math.floor(Math.random() * correctAnswers.length)];
    console.log("[自动答题] 填空题从 " + JSON.stringify(correctAnswers) + " 中随机选择: '" + chosenAnswer + "'");

    var input = document.querySelector(FILL_INPUT_SELECTOR);
    if (!input) {
      console.warn("[自动答题] 未找到填空输入框:", FILL_INPUT_SELECTOR);
      return;
    }

    // 设置输入框的值（绕过 React/Vue 等框架的响应式系统）
    var valueDescriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    if (valueDescriptor && valueDescriptor.set) {
      valueDescriptor.set.call(input, chosenAnswer);
    } else {
      input.value = chosenAnswer;
    }

    // 触发 input 事件，确保网站的 JS 框架能感知值的变化
    var inputEvent = new Event("input", { bubbles: true });
    input.dispatchEvent(inputEvent);

    // 触发 change 事件
    var changeEvent = new Event("change", { bubbles: true });
    input.dispatchEvent(changeEvent);

    console.log("[自动答题] 填空题已填入答案: '" + chosenAnswer + "'");

    // 等待随机延迟后点击提交按钮
    setTimeout(function () {
      clickNextButton();
    }, randomDelay(SUBMIT_DELAY_MIN, SUBMIT_DELAY_MAX));
  } catch (e) {
    console.error("[自动答题] 处理填空题时出错:", e.message);
  }
}

/**
 * 点击下一题/提交按钮（仅用于填空题）
 */
function clickNextButton() {
  try {
    var btn = document.querySelector(NEXT_BUTTON_SELECTOR) || document.querySelector("#battleOptionsGrid > button");
    if (!btn) {
      console.warn("[自动答题] 未找到提交按钮:", NEXT_BUTTON_SELECTOR);
      return;
    }
    console.log("[自动答题] 点击提交按钮进入下一题");
    btn.click();
  } catch (e) {
    console.error("[自动答题] 点击提交按钮时出错:", e.message);
  }
}

/* ================================================================
 * 主流程：识别题目、查找答案、自动作答
 * ================================================================ */

/**
 * 执行一次完整的自动答题流程
 */
function processQuestion() {
  if (isProcessing) { return; }
  isProcessing = true;

  // 看门狗：如果 isProcessing 超过 PROCESSING_TIMEOUT 未重置，强制重置
  var watchdog = setTimeout(function () {
    if (isProcessing) {
      console.warn("[自动答题] isProcessing 看门狗触发超时（" + PROCESSING_TIMEOUT + "ms），强制重置");
      isProcessing = false;
    }
  }, PROCESSING_TIMEOUT);

  try {
    var questionText = getQuestionText();
    if (!questionText) {
      console.warn("[自动答题] 未获取到题目文本，跳过");
      clearTimeout(watchdog);
      isProcessing = false;
      return;
    }

    // 不再拦截 lastQuestionText 重复：题目池随机出题，同一道题可连续出现两次，
    // 依赖 isProcessing 互斥锁防止并发重复作答即可

    console.log("[自动答题] 检测到新题目: '" + questionText + "'");

    var answers = lookupAnswer(questionText);
    if (!answers || answers.length === 0) {
      console.warn("[自动答题] 题库中未找到该题目的答案: '" + questionText + "'");
      lastQuestionText = questionText;
      handleUnknownQuestion();
      clearTimeout(watchdog);
      isProcessing = false;
      return;
    }

    console.log("[自动答题] 在题库中找到答案: " + JSON.stringify(answers));

    var questionType = getQuestionType();

    if (questionType === "choice") {
      // 选择题：遍历选项按钮，匹配答案并点击
      // 成功回调：重试匹配成功后立即重置 isProcessing 并记录 lastQuestionText
      // 由于重试点击可能发生在 isProcessing=true 窗口内，MutationObserver 可能已错过
      // 新题的 DOM 变化，重置后主动探测一次是否需要处理新题
      var onChoiceSuccess = function () {
        lastQuestionText = questionText;
        clearTimeout(watchdog);
        isProcessing = false;
        console.log("[自动答题] 选择题作答完成，状态已重置");
        // 如果页面在此期间已推进到新题目，立即处理
        setTimeout(function () {
          var currentQ = getQuestionText();
          if (currentQ && currentQ !== questionText) {
            console.log("[自动答题] 检测到等待中的新题目: '" + currentQ + "'");
            processQuestion();
          }
        }, 100);
      };

      var choiceSuccess = answerChoice(answers, MAX_RETRIES, onChoiceSuccess);
      if (choiceSuccess) {
        // 首轮就成功：直接记录并延迟重置
        lastQuestionText = questionText;
        clearTimeout(watchdog);
        setTimeout(function () {
          isProcessing = false;
          // 同样，检查页面是否已推进
          var currentQ = getQuestionText();
          if (currentQ && currentQ !== questionText) {
            console.log("[自动答题] 检测到等待中的新题目: '" + currentQ + "'");
            processQuestion();
          }
        }, randomDelay(SUBMIT_DELAY_MIN, SUBMIT_DELAY_MAX));
      } else {
        // 正在内部重试：onChoiceSuccess 回调最终会处理重置
        // 添加兜底超时防止 isProcessing 永久阻塞
        setTimeout(function () {
          if (isProcessing) {
            console.warn("[自动答题] 选择题重试兜底超时，强制重置 isProcessing");
            clearTimeout(watchdog);
            isProcessing = false;
          }
        }, RETRY_INTERVAL * (MAX_RETRIES + 2) + 500);
      }
    } else if (questionType === "fill") {
      answerFill(answers);
      lastQuestionText = questionText;
      clearTimeout(watchdog);
      setTimeout(function () {
        isProcessing = false;
        // 填空提交后检查是否有新题
        var currentQ = getQuestionText();
        if (currentQ && currentQ !== questionText) {
          console.log("[自动答题] 检测到等待中的新题目: '" + currentQ + "'");
          processQuestion();
        }
      }, randomDelay(SUBMIT_DELAY_MIN, SUBMIT_DELAY_MAX) + 1000);
    } else {
      if (isFillInputVisible()) {
        console.log("[自动答题] 通过输入框可见性判断为填空题");
        answerFill(answers);
        lastQuestionText = questionText;
        clearTimeout(watchdog);
        setTimeout(function () {
          isProcessing = false;
          var currentQ = getQuestionText();
          if (currentQ && currentQ !== questionText) {
            console.log("[自动答题] 检测到等待中的新题目: '" + currentQ + "'");
            processQuestion();
          }
        }, randomDelay(SUBMIT_DELAY_MIN, SUBMIT_DELAY_MAX) + 1000);
      } else {
        console.warn("[自动答题] 无法判断题型，跳过本题。请确认 QUESTION_TYPE_SELECTOR 是否正确匹配页面元素");
        clearTimeout(watchdog);
        isProcessing = false;
      }
    }
  } catch (e) {
    console.error("[自动答题] 处理题目时发生严重错误:", e.message);
    clearTimeout(watchdog);
    isProcessing = false;
  }
}

/**
 * 处理未知单词：根据 SKIP_UNKNOWN 配置决定跳过策略
 */
function handleUnknownQuestion() {
  if (!SKIP_UNKNOWN) {
    console.log("[自动答题] SKIP_UNKNOWN=false，保留当前题目供手动作答");
    return;
  }

  var questionType = getQuestionType();
  if (questionType === "choice") {
    // 选择题：随机点击一个选项以跳过
    try {
    var grid = document.querySelector(OPTIONS_GRID_SELECTOR) || document.querySelector("#battleOptionsGrid");
      if (!grid) { return; }
      var buttons = grid.querySelectorAll("button");
      if (buttons.length > 0) {
        var randomIndex = Math.floor(Math.random() * buttons.length);
        console.log("[自动答题] 未知单词，随机跳过 → 点击选项 #" + (randomIndex + 1));
        var clickEvent = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
          button: 0
        });
        buttons[randomIndex].dispatchEvent(clickEvent);
      }
    } catch (e) {
      console.warn("[自动答题] 尝试跳过选择题时出错:", e.message);
    }
  } else if (questionType === "fill" || (questionType === "unknown" && isFillInputVisible())) {
    // 填空题（包括通过输入框可见性推断的题型）：输入占位文本后点击提交
    try {
      var input = document.querySelector(FILL_INPUT_SELECTOR);
      if (input) {
        var valueDescriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
        if (valueDescriptor && valueDescriptor.set) {
          valueDescriptor.set.call(input, "?");
        } else {
          input.value = "?";
        }
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        console.log("[自动答题] 未知单词，填入占位符后跳过");
        setTimeout(function () {
          clickNextButton();
        }, randomDelay(SUBMIT_DELAY_MIN, SUBMIT_DELAY_MAX));
      }
    } catch (e) {
      console.warn("[自动答题] 尝试跳过填空题时出错:", e.message);
    }
  }
}

/* ================================================================
 * 主入口：根据加载方式启动监听
 * ================================================================ */

/**
 * 带重试的初始化入口
 */
function initAutoAnswer(retriesLeft) {
  if (retriesLeft === undefined) { retriesLeft = MAX_RETRIES; }

  // 检查核心元素是否已渲染
  var questionEl = document.querySelector(QUESTION_SELECTOR) || document.querySelector("#battleQuestionText");
  var typeEl = document.querySelector(QUESTION_TYPE_SELECTOR) || document.querySelector("#battleQuestionType");

  if (!questionEl && !typeEl) {
    if (retriesLeft > 0) {
      console.log("[自动答题] 等待页面渲染... 剩余重试次数:", retriesLeft);
      setTimeout(function () {
        initAutoAnswer(retriesLeft - 1);
      }, RETRY_INTERVAL);
      return;
    }
    console.warn("[自动答题] 初始化超时：未检测到答题区域元素。请确认已在答题页面。");
    return;
  }

  console.log("[自动答题] 军事英语自动答题助手已启动");
  console.log("[自动答题] 题库条目数:", Object.keys(dict).length);
  console.log("[自动答题] 当前页面:", window.location.href);

  // AJAX 无刷新模式：使用 MutationObserver 监听题目区域变化
  setupObserver();

  // 立即尝试处理当前已加载的题目
  setTimeout(function () {
    processQuestion();
  }, randomDelay(RENDER_DELAY_MIN, RENDER_DELAY_MAX));
}

/**
 * 设置 MutationObserver 监听题目区域的变化
 * 由于网站使用 AJAX 无刷新方式加载新题目，
 * 当题目区域的 DOM 发生变化时，观察器会自动触发重新作答
 */
function setupObserver() {
  // 断开已有的观察器（避免重复绑定）
  if (observer) {
    observer.disconnect();
  }

  // 找到要监听的目标节点
  // 优先监听选项容器，因为选择题和填空题的下一题按钮都在这个容器中
  var targetNode = document.querySelector(OPTIONS_GRID_SELECTOR)
    || document.querySelector("#battleOptionsGrid")
    || document.querySelector(QUESTION_SELECTOR)
    || document.body;

  // 配置观察选项：监听子节点的添加/删除以及子树变化
  var config = {
    childList: true,    // 监听子节点的添加和删除
    subtree: true,      // 监听所有后代节点
    characterData: true, // 监听文本内容变化
    attributes: false   // 不监听属性变化（减少触发频率）
  };

  // 使用防抖机制：多次快速变化只触发一次处理
  var debounceTimer = null;

  observer = new MutationObserver(function (mutations) {
    // 如果正在处理中，忽略本次变化
    if (isProcessing) { return; }

    // 防抖：等待 DOM 变化停止一段时间后再处理
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(function () {
      debounceTimer = null;
      // 再等待随机渲染延迟以确保 DOM 完全稳定
      setTimeout(function () {
        processQuestion();
      }, randomDelay(RENDER_DELAY_MIN, RENDER_DELAY_MAX));
    }, 200);
  });

  observer.observe(targetNode, config);
  console.log("[自动答题] MutationObserver 已启动，正在监听题目变化...");
}

/**
 * 脚本入口点
 * 在 document-end 时由 Tampermonkey 自动调用
 */
(function () {
  "use strict";

  // 构建规范化词库，确保题目文本匹配时能处理全角字符和大小写差异
  buildNormalizedDict();

  // 等待页面完全加载后再初始化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initAutoAnswer();
    });
  } else {
    // DOM 已经加载完毕，直接初始化
    initAutoAnswer();
  }
})();

