// ==UserScript==
// @name         军事英语自动答题-TeamBattle v6.0
// @namespace    https://github.com/Shakeapear/military-english-auto
// @version      6.0.1
// @description  军事英语自动答题 — v6.0 团队对战版：适配 team_battle 模式，双向词典查询，释义选词/选词释义/拼写题全覆盖
// @author       Shakeapear
// @match        https://175.178.248.67/game/team_battle/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

/*
 * 军事英语自动答题助手 — TeamBattle v6.0
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
 * v6.0 变更摘要:
 *   - 适配 team_battle 页面 HTML 元素 (questionTypeBadge, opt_0~3, spellingSubmitBtn)
 *   - 新增双向词典查询 (cnToEn / enToCn)
 *   - 三种题型全覆盖: 释义选词 / 选词释义 / 拼写题
 *   - 保留 v5.x 全部反检测基础设施 (smartDelay, simulateMouseClick, simulateTyping 等)
 *   - 保留词边界匹配、增强重试、MutationObserver 防抖
 */

"use strict";

/* ================================================================
 * 模块 A — 用户可配置区域
 * ================================================================ */

var CFG = {
    // ---- team_battle 专用选择器 ----
    QUESTION_TEXT_SELECTOR:   "#questionText",
    QUESTION_TYPE_SELECTOR:   "#questionTypeBadge",
    OPTION_SELECTORS:         ["#opt_0", "#opt_1", "#opt_2", "#opt_3"],
    SPELLING_INPUT_SELECTOR:  "#spellingInput",
    SPELLING_SUBMIT_SELECTOR: "#spellingSubmitBtn",
    OPTIONS_GRID_SELECTOR:    null,  // v6.0: 不再依赖 grid 容器，直接用 #opt_x

    // ---- 题型标签文本 ----
    TYPE_DEF_TO_WORD:         "释义选词",    // 中文释义 → 选英文词
    TYPE_WORD_TO_DEF:         "选词释义",    // 英文词 → 选中文释义
    TYPE_SPELLING:            "拼写题",       // 中文释义 → 拼写英文词

    // ---- 重试 & 超时 ----
    MAX_RETRIES:        3,
    RETRY_INTERVAL:     50,     // ms
    RETRY_BACKOFF_MUL:  1.8,
    SKIP_UNKNOWN:       true,
    PROCESSING_TIMEOUT: 4000,   // ms

    // ---- Observer ----
    OBSERVER_DEBOUNCE:  25,     // ms
    RAF_DOUBLE_FRAME:   true,

    // ---- normalizeText 缓存 ----
    NORM_CACHE_SIZE:    64,

    // ---- 调试 ----
    PERF_LOG: false,
    DEBUG_LOG: false,

    // ---- 别名匹配 ----
    ALIAS_MATCH_ENABLED:  true,
    DUPLICATE_WINDOW:     2000,

    // ---- v5.0 反检测配置 ----
    ANTI_DETECT_ENABLED:  true,
    SPEED_PROFILE:         "balanced",

    BURST_COUNT:           5,
    STEADY_DELAY_MEAN:     200,
    STEADY_DELAY_STDDEV:   100,
    DELAY_MIN:             30,
    DELAY_MAX:             1200,
    BETWEEN_QUESTION_MIN:  15,
    BETWEEN_QUESTION_MAX:  80,

    MOUSE_SIM_ENABLED:    true,
    MOUSE_PATH_STEPS:     6,
    MOUSE_SKIP_DISTANCE:  80,

    TYPE_SIM_ENABLED:     true,
    TYPE_SKIP_SHORT:      3,
    TYPE_DELAY_MIN:       10,
    TYPE_DELAY_MAX:       40,

    SCROLL_SIM_ENABLED:   false,
    SCROLL_INTERVAL_MIN:  15000,
    SCROLL_INTERVAL_MAX:  45000,

    RETRY_JITTER_ENABLED: true,
    LONG_PAUSE_ENABLED:   true,
    MAX_CONSECUTIVE_FAILS: 5,
    LONG_PAUSE_MIN:       30000,
    LONG_PAUSE_MAX:       60000
};

/* ================================================================
 * 模块 B — 题库字典 (与 v5.0 完全一致)
 * ================================================================ */

var dict = {
  "Air Force":"空军","Armored Personnel Carrier":"人员装甲运输车","Army":"陆军（首字母常用大写）；军队；集团军","Army National Guard":"(美)陆军国民警卫队"
  ,"Army Reserve":"(美)陆军预备役","Blind Carbon Copy":"密件抄送；密送","Blue Beret":"蓝色贝雷帽；维和人员","Blue Sword-2023":"蓝剑-2023"
  ,"Carbon copy/ Courtesy copy":"抄送","Civil-Military Cooperation(CIMIC)":"军民合作","Coast Guard":"海岸警卫队","Cobra Gold-2024":"金色眼镜蛇-2024"
  ,"Code of Conduct":"行为准则","Command Post Exercise":"指挥所演习","Commissioned Officer":"军官"
  ,"Counter-Terrorism Field Training Exercise-2023":"反恐实兵演习-2023","Department of War":"（美）战争部","Department of War(abbr.)":"DoW"
  ,"Department of the Air Force(abbr.)":"DAF","Deputy Commander":"副指挥官","Direct Reporting Unit":"直属单位","Directed Energy Weapon":"定向能武器"
  ,"Eagle Strike-2024":"雄鹰突击-2024","Enemy Prisoner of War":"战俘","Head Up Display":"平视显示器","Infantry Fighting Vehicle(IFV)":"步兵战车"
  ,"Joint Chiefs of Staff":"参谋长联席会议","Joint Operations Command Center":"联合作战指挥中心","Joint Staff Department(JSD)":"联合参谋部"
  ,"Marine Corps":"海军陆战队","Military Grid Reference System":"军事网格坐标","Navy":"海军","Non-Commissioned Officer":"士官"
  ,"North Atlantic Treaty Organization":"北大西洋公约组织（北约）","Nuclear, Biological and Chemical Contamination":"核生化污染"
  ,"Nuclear, biological and chemical (NBC) protection":"核生化防护","Office for the Coordination of Humanitarian Affairs(OCHA)":"人道主义事务协调办公室"
  ,"Official Use Only":"官方填写；仅供官方使用","Peace Angel-2023":"和平天使-2023","Physical Fitness Test":"体能测试","Post Exchange":"军营超市"
  ,"Protocol Chief":"礼宾处处长","Public Information Office":"新闻处","Pure Homeland-2023":"净土-2023","Regrets Only":"如不能出席请务必回复"
  ,"Rules of Engagement(ROE)":"交战规则","See Distribution":"见收件人清单","Space Command":"（美）太空司令部","Space Command(abbr.)":"SPC"
  ,"Space Force":"(美)太空军","Task Element":"特混支队","UN Charter":"联合国宪章","UN Children's Fund":"联合国儿童基金会","World Food Programme":"世界粮食计划署"
  ,"accommodate":"使适应, 顺应","accord":"使受到，给予（某种待遇）","active service":"现役","address":"称呼","addressee":"收信人；收件人","admiral":"（海军）上将"
  ,"air defense":"防空","air-to-air missile":"空空导弹；空战导弹","aircraft carrier":"航空母舰","airlift":"空运","airman":"空军士兵，飞行员","algorithm":"算法，运算法则"
  ,"allergy":"过敏；敏感","alleviate":"减轻，缓和","allowance":"津贴","alumni":"校友","ambivalence":"矛盾情绪；正反感情并存","ambush":"伏击","ammo":"弹药;军火"
  ,"ammo pouch":"弹药袋","amphibious":"两栖作战的；水陆两用的；两栖的","animosity":"仇恨，敌意","anti-personnel mine":"反步兵地雷；杀伤性地雷","anti-terrorism drill":"反恐演习"
  ,"area of responsibility":"责任区","arm":"兵种；武器；武装","armed escort":"武装护卫","armistice":"休战协议","armor":"装甲；装甲兵；装甲部队","arsenal":"武器库；军火库；兵工厂"
  ,"arterial":"动脉的","artificial intelligence":"人工智能","artillery":"炮兵；火炮","assault":"攻击或袭击（敌方阵地）","assault position":"冲锋出发阵地"
  ,"assessment":"评估，评价，评定","assign":"编入建制；委派；任命；指派","attachment":"配属部队","attack position":"进攻出发阵地","authorize":"授权，批准"
  ,"automated external defibrillator":"自动体外除颤器","aviation":"航空兵","band":"段；带，箍；带状物","bandage":"绷带","barbed wire":"铁丝网","barrel":"枪管；炮筒"
  ,"basic training":"新兵训练","battalion":"营","beam":"梁、横梁；（体操的）平衡木","big data":"大数据","blemish":"瑕疵","blockage":"堵塞，阻塞","bomber":"轰炸机"
  ,"boot camp":"新兵（训练）营；新兵训练中心","boulevard":"大街；（市区的）林荫大道","breakdown":"（机器的）故障","breastplate":"胸甲","brigade":"旅"
  ,"brigadier general":"（陆、空、海军陆战队）准将","brigadier general(abbr.)":"BG","buffer zone":"缓冲区：中立区","bulldozer":"推土机","bunker":"掩体；地堡；暗堡"
  ,"buttstock":"枪托","cadet":"（军校）学员","caliber":"（枪、炮等的）口径","callsign":"无线电通联呼号","camaraderie":"友情；情谊","camouflage":"迷彩"
  ,"cannon":"火炮；加农炮；机关炮","canteen":"水壶","captain":"（陆、空、海军陆战队）上尉；（海军）上校","captain(abbr.)":"CPT","carbon fiber":"碳纤维"
  ,"cardiac arrest":"心脏骤停","cardio":"有氧运动","cardiopulmonary resuscitation(CPR)":"心肺复苏术","cargo net":"绳网","casualty":"伤亡人员；（常用复数）伤亡人数"
  ,"casualty evacuation":"伤病员后送","catastrophe":"灾难","cavalry":"骑兵；高度机动的地面部队","ceasefire":"停火协议","ceiling":"升限；射高；（飞机）舱顶","chain mail":"锁子甲"
  ,"chain of command":"指挥系统；指挥关系；指挥链","checkpoint":"检查站，关卡","chest seal":"胸腔密封贴，胸封","chevron":"V形线条","chief of staff(COS)":"参谋长"
  ,"chow":"食物","chronological":"按发生时间顺序排列的","circulation":"血液循环","civilian":"平民，百姓；平民的","clammy":"湿粘的；湿冷的","classified":"列入密级的；保密的"
  ,"clear":"音质清晰","clearing mines or ordnance":"扫雷排爆","cliff":"悬崖","clip":"夹子","colonel":"（陆、空、海军陆战队）上校","colonel(abbr.)":"COL","coma":"昏迷"
  ,"combat arms":"作战部队","combat arms support":"作战支援部队","combat boots":"作战靴","combat order":"战斗命令","combat service support":"作战支援保障部队"
  ,"combat uniform":"作训服","combined training":"协同训练；联合训练","combined training exercise":"多国合成训练演习","command sergeant major":"（美陆军）一级军士长（指挥）"
  ,"commander":"（海军）中校","commanding officer":"指挥官；舰长；主官","compile":"收集，搜集（信息，资料）","complimentary close":"结尾客套语","comply":"服从,顺从"
  ,"compression":"胸部按压","compromise":"失密；泄密；暴露","concept of operations":"作战概念","confidential":"机密","configuration":"布局，构造；配置"
  ,"conscript":"义务兵；被征召入伍者；征召；招募","consent":"同意","consolidate":"巩固，加强","contingency":"突发事件","contingent troop":"维和分队","contour line":"等高线"
  ,"convoy":"车队；护送；护卫","coordinate":"使协调; 使调和","copies furnished":"提供的副本","corporal":"下士","corps":"军；军团；特殊兵种；部队","corpsman":"医护兵;卫生员"
  ,"corvette":"轻型护卫舰;轻巡洋舰","counterattack":"反击;反攻","covert":"隐密的","crane":"起重机","crossroad":"十字路口","cruiser":"巡洋舰","cryptology":"密码术"
  ,"curve":"弯道","cyber exercise":"网络演习","dead reckoning":"航位推算法","dearth":"缺乏","declassify":"解密","demining":"扫雷","demobilization":"复员，遣散"
  ,"demonstration":"示威","demote":"降衔（级）","depression":"洼地","deprivation":"贫困，匮乏，剥夺","destroyer":"驱逐舰","detachment":"分遣队","detect":"发现；探测"
  ,"deterioration":"恶化","digit":"（零到九中的任一）数字","director of staff":"参谋部主任","disarmament":"裁军；缴械","disaster relief":"减灾；赈灾"
  ,"discharge":"退伍；退役","discontent":"不满","discretion":"谨慎；慎重","disinformation":"虚假信息","dismount":"下车","dispatch":"派遣"
  ,"displacement":"（舰船）排水量","disposable":"一次性的","dispute":"争论，纠纷，争夺","disrupt":"扰乱;瓦解","distal pulse":"远端脉搏","distorted":"声音失真"
  ,"distress signal":"遇险求救信号；遇难信号","distribution of relief items":"分发救济品","ditch":"壕沟","division":"师","dog tag":"狗牌：美军脖子上的一块小金属牌刻有姓名编号"
  ,"draft":"征兵；(船的）吃水深度","draw":"山坳","dress uniform":"礼服","drill":"队列训练；操练","drone":"无人机","drought":"干旱；旱灾","dump truck":"自动倾卸卡车、翻斗车"
  ,"earthquake":"地震","electromagnetic spectrum":"电磁波谱","elevation":"海拔","elite":"尖子，精英","emergency medical assistance":"紧急医疗援助"
  ,"emplacement":"炮火掩体；炮位","enclosure":"附件","engagement":"参加，从事","engineer":"工兵","enlist":"征募；参军；入伍","enlisted":"士兵","ensign":"（海军）少尉"
  ,"entangle":"使某人缠绕","escort":"护送，陪同；护航舰；护卫队；护送者","estimated time of arrival":"预计到达时间","etiquette":"礼节","evacuate":"撤离；疏散"
  ,"excavator":"挖掘机","executive officer(XO)":"执行官；副舰长；副职指挥员","exoskeleton":"外骨骼","extract":"撤出（作战区域）；撤离","facsimile":"传真","fading":"信号变弱"
  ,"famine":"饥荒","feed":"进弹，装弹，送弹","fence":"栅栏","field training exercise":"野战训练演习","fighter":"战斗机；歼击机；斗士；战斗员","figure":"数字"
  ,"fire coordination exercise":"火力协调演习","fire team":"火力小组","first aid":"急救","first aid kit":"急救包","first sergeant":"（美陆军）二级军士长（指挥）"
  ,"flak vest":"防弹背心","flank":"翼侧;侧面","fleet":"舰队；（飞机的）机队","flight":"（飞行）小队；机群","flotilla":"（小）舰队；（小）船队；纵队","folding shovel":"折叠锹"
  ,"foot march":"徒步行军","fortification":"防御工事","foster":"培养","fracture":"断裂；骨折","fragmentary order":"补充命令","frigate":"护卫舰","gauze":"纱布；薄纱；"
  ,"general":"（陆、空、海军陆战队）上将","general(abbr.)":"GEN","geopolitics":"地缘政治","goggles":"护目镜","good":"信号好","grenade":"手雷；手榴弹；枪榴弹","grid":"坐标网格"
  ,"grip":"握把","group":"大队","guardian":"（美）太空军士兵","gunnery sergeant":"枪炮军士","halt":"停止；立定","handle":"手柄，把手","harass":"屡次袭扰（敌人）"
  ,"harassing attack":"扰乱攻击","hard duty":"重型负载","headquarters":"司令部；指挥部；总部","hedging strategy":"对冲策略","helicopter":"直升机","helmet":"头盔"
  ,"high-energy laser system":"高能激光系统","high-powered microwave system":"高功率微波系统","hill":"小山","hoist":"升降机；绞车","honor code":"行为准则"
  ,"horizontal":"水平的, 与地平线平行的","hornet":"大黄蜂","hostile":"敌对，敌方的；怀敌意的","howitzer":"榴弹炮","hull":"壳体（坦克、自行火炮、舰艇等的主要结构）"
  ,"humanitarian aid":"人道主义救援","humanitarian crisis":"人道主义危机","hurricane":"飓风","immunity":"免除，豁免","impartiality":"公正"
  ,"improved road":"铺装路面","inactivity":"不作为","individual training":"单兵训练","infiltration":"渗透；潜入","inflict":"使遭受;使承受"
  ,"infrared strobes":"红外线频闪灯","ingenuity":"聪明才智，巧妙","insignia":"勋章；佩章；徽章；标记；识别符号","instruction":"指令","insurgent":"叛乱","intelligence":"情报"
  ,"interference":"信号有干扰","interim":"暂时的；过渡的","intermediation":"调解，仲裁，调停","intermittent":"信号时有时无","intermittent stream":"间歇河流"
  ,"javelon":"标枪，投枪","joint exercise":"联合军演","joint force":"联合部队","joint operations":"联合作战","joint training":"联合训练；","junction":"岔路口"
  ,"k-i-a":"阵亡","khaki":"卡其色；卡其布","kit":"成套工具，成套设备；箱子","landmine":"地雷","landslide":"山体滑坡；塌方","lapel":"翻领","laser beam":"激光束"
  ,"latitude":"纬度","legend":"图例","legitimacy":"合法性，合理性","lethal":"致命的","lever":"杠杆，手柄","leverage":"利用","liaise":"联络，沟通","liaison":"联络"
  ,"lieutenant":"（陆、空、海军陆战队）中尉；（海军）上尉","lieutenant colonel":"（陆、空、海军陆战队）中校","lieutenant colonel(abbr.)":"LTC"
  ,"lieutenant commander":"(海军)少校","lieutenant general":"（陆、海、海军陆战队）中将","lieutenant general(abbr.)":"LG","lieutenant junior grade":"(海军)中尉"
  ,"lieutenant(abbr.)":"LT","line of departure":"起始线;出发线","litter":"担架","loader":"装载机","log":"圆木","logistics":"后勤；后勤学","long-sleeve":"长袖"
  ,"long-term food aid":"长期粮食援助","longitude":"经度","loud":"信号强","machinegun":"机枪；机关枪","magazine":"弹匣；弹仓","main battle tank(MBT)":"主战坦克"
  ,"main effort":"主攻部队","major":"（陆、空、海军陆战队）少校","major general":"（陆、海、海军陆战队）少将","major general(abbr.)":"MG","major(abbr.)":"MAJ"
  ,"man":"保卫（防御工事）","mandate":"授权，委托","map exercise":"地图推演","marine":"海军陆战队员；海上的；海事的","marine expeditionary brigade":"美国海军陆战队远征旅"
  ,"marksman":"射击能手；神枪手","marksmanship":"枪法；射击术","marsh":"湿地；沼泽","masquerade":"掩饰","master sergeant":"（美陆军）二级军士长（机关）","medal ribbon":"勋章授带"
  ,"mediation":"调解，仲裁","medical assistance":"医疗援助","medical evacuation":"医疗后送","memorandum":"备忘录","midday":"中午，正午"
  ,"military academy":"军事院校","military alphabet":"军用字母表","military observer":"军事观察员","mine clearance":"扫雷，排雷","misinterpretation":"曲解"
  ,"mission":"特派团","mobilization":"动员（尤指战时）","monitor":"监督，监控，监视","morale":"士气；民心；斗志","mortar":"迫击炮","multi-dimensional":"多层面"
  ,"muzzle":"枪口；炮口","name plate":"姓名牌","nasopharyngeal airway":"鼻咽导气管","negotiation":"谈判，协商，","neutrality":"中立"
  ,"neutralize":"（在军事或秘密行动中）消除威胁；摧毁","nomination":"提名","non-governmental organization":"非政府组织","nothing heard":"听不见","nylon":"尼龙"
  ,"obstacle course":"障碍训练（场）","onset":"（尤指某种坏事情的）开始；发作","operations order":"作战命令","oral rehydration salts":"口服补液盐","orchard":"果园"
  ,"order":"命令","ordnance":"军械","outreach":"外联","overrun":"占领","oversee":"监督；管理","pants":"裤子","patrol pack":"巡逻背包","payload":"战斗部"
  ,"peacekeeping":"维和","pentagon":"（美）国防部","petty officer":"海军士官；海军军士","physical training uniform":"体能服","pistol":"手枪","platoon":"排"
  ,"pleat":"褶皱，裤褶","plot":"绘制; 标出","point of contact":"联系人","polyester":"聚酯纤维，涤纶","precipitous":"险峻的, 陡峭的","prioritize":"优先","private":"列兵"
  ,"private first class":"上等兵","projectile":"弹丸；炮弹；射弹","promote":"晋升","propeller":"推进器","proportionate":"成比例的；相称的；适当的","propulsion":"推进"
  ,"providing medical assistance":"提供医疗救助","proword":"无线电通联规范用语","pull-up":"引体向上","push-up":"俯卧撑","quartermaster":"军需","radio check":"电台检查"
  ,"radio net":"无线电通信网络","raid":"突击","ramp":"斜坡，坡道","range":"射程；靶场；射击场","ration":"口粮；给养","re-establishing infrastructure":"重建基础设施"
  ,"readability":"信号音质","readable":"可以听清","rear admiral lower half":"（海军）准将","rear admiral upper half":"(海军)少将","recce":"侦察（非正式）"
  ,"reconciliation":"和解；复交","reconnaissance":"侦察（正式）","reconstruction":"重建","referendum":"全民投票","refugee":"难民，避难者","regime":"政权"
  ,"regiment":"团","rehabilitation":"复原；恢复；修复","reinforce":"增援","release point":"分进点","relief":"地形；（地形的）凹凸","relocation of victims":"灾民转移"
  ,"reporting point":"报告点","resilience":"弹性；韧性","ridge":"山脊","rifle":"来复枪；步枪；膛线","roadblock":"路障，障碍物","rocket launcher":"火箭炮；火箭发射器"
  ,"rod":"棒，杆","roger":"已收到，明白","rotate":"轮流；轮换；轮岗","round":"一发（弹），整发弹；一轮","roundabout":"环岛","rucksack":"帆布背包","saddle":"鞍部"
  ,"safety":"安全设备，保险装置","sailor":"海军士兵，水兵","salutation":"称呼；称谓","salute":"敬礼","sandstorm":"沙暴；沙尘暴","scout group/team":"侦察组"
  ,"second lieutenant":"（陆、空、海军陆战队）少尉","second lieutenant(abbr.)":"2LT","sensor":"传感器","sergeant":"军士；（美陆军、海军陆战队）中士"
  ,"sergeant first class":"(美陆军)三级军士长","sergeant major":"(美)陆军一级军士长（机关）","sergeant major of the army":"（美陆军）总军士长","serve":"服役"
  ,"service":"军种；服役","service cap":"军帽；大檐帽","shipment":"运送","short-sleeve":"短袖","shoulder badge":"肩章","shrapnel":"弹片；榴霰弹"
  ,"sideline":"边线；副业","sight":"瞄准具；观测器；瞄准","signal":"通信兵","signal strength":"信号强度","signpost":"指示牌","sit-up":"仰卧起坐"
  ,"situation report":"军情报告","situational awareness":"态势感知","situational exercise":"情景训练演习","small arms":"轻武器","snowstorm":"雪暴；暴风雪"
  ,"spasm":"痉挛，抽搐","special forces":"特种部队","specialist":"专业兵；专业军士","specification":"性能表，规格，规范","spill-over":"溢出 ; 外溢","splint":"（固定断骨的）夹板"
  ,"sprint":"冲刺、短跑","spur":"尖坡","squad":"班","squadron":"中队","staff":"参谋人员；参谋机构；参谋部","staff exercise":"参谋人员演习"
  ,"staff sergeant":"（美陆军、海军陆战队）上士；（美空军）中士","standard operating procedure":"标准作战程序；标准作业程序","start point":"出发点","stealth":"隐形"
  ,"strap":"带子；皮带","strip map":"带状图","stripe":"条纹","submarine":"潜艇","subordinate":"下级；下属","superior":"上级；长官","supervise":"指导，监督"
  ,"surface vessel":"水面舰艇","surface-to-air missile":"地对空导弹；舰对空导弹","surgical gloves":"外科手套；手术手套；医用手套","surveillance":"监视"
  ,"sustain":"作战保障；战斗保障","swamp":"沼泽（地）","swarm":"蜂群","synchronize":"同步；协调","synthetic aperture radar":"合成孔径雷达","table top exercise":"桌面推演"
  ,"tactic":"策略，战术","tandem":"串列的，串联的；（飞机）串座式的","team site":"观察员营地","template":"模板","temporize":"顺应时势,迎合潮流;拖延，耽搁","terminate":"终止；使停止"
  ,"terrain":"地形；地势","the 10th Mountain Division":"第十山地师","topographic":"地形的","tourniquet":"止血带","trajectory":"轨道；弹道"
  ,"transmit":"（无线电等信号的）播送，发送","trauma":"精神创伤，心理创伤；损伤，外伤","truce":"停战（或停火）","tsunami":"海啸","tuition":"学费","tunnel":"坑道","turret":"炮塔"
  ,"underbrush":"矮树丛","unpko":"联合国维和行动","valley":"山谷","vault":"跳跃，跃过","ventilator":"人工呼吸器","verify":"证实，证明，核实","vertical":"垂直的，直立的"
  ,"vice admiral":"（海军）中将","vigilance":"警戒；警惕","volunteer":"志愿兵；志愿军人","warrant officer":"文职人员","waypoint":"路径；路标","weak":"信号弱"
  ,"webbing":"背带，挂带","wield":"运用，使用","wildfire":"野火","wing":"空军联队；航空兵联队；侧翼部队","withdrawal":"撤退","woods":"树林","workout":"锻炼；训练"
  ,"(海军)中尉":"lieutenant junior grade","(海军)少将":"rear admiral upper half","(海军)少校":"lieutenant commander","(美)太空军":"Space Force"
  ,"(美)陆军一级军士长（机关）":"sergeant major","(美)陆军国民警卫队":"Army National Guard","(美)陆军预备役":"Army Reserve","(美陆军)三级军士长":"sergeant first class"
  ,"2LT":"second lieutenant(abbr.)","BG":"brigadier general(abbr.)","COL":"colonel(abbr.)","CPT":"captain(abbr.)"
  ,"DAF":"Department of the Air Force(abbr.)","DoW":"Department of War(abbr.)","GEN":"general(abbr.)","LG":"lieutenant general(abbr.)"
  ,"LT":"lieutenant(abbr.)","LTC":"lieutenant colonel(abbr.)","MAJ":"major(abbr.)","MG":"major general(abbr.)","SPC":"Space Command(abbr.)"
  ,"V形线条":"chevron","一发（弹），整发弹；一轮":"round","一次性的":"disposable","上等兵":"private first class","上级；长官":"superior","下士":"corporal"
  ,"下级；下属":"subordinate","下车":"dismount","不作为":"inactivity","不满":"discontent","专业兵；专业军士":"specialist","世界粮食计划署":"World Food Programme"
  ,"两栖作战的；水陆两用的；两栖的":"amphibious","中午，正午":"midday","中立":"neutrality","中队":"squadron","串列的，串联的；（飞机）串座式的":"tandem"
  ,"主战坦克":"main battle tank(MBT)","主攻部队":"main effort","义务兵；被征召入伍者；征召；招募":"conscript","争论，纠纷，争夺":"dispute"
  ,"交战规则":"Rules of Engagement(ROE)","人员装甲运输车":"Armored Personnel Carrier","人工呼吸器":"ventilator","人工智能":"artificial intelligence"
  ,"人道主义事务协调办公室":"Office for the Coordination of Humanitarian Affairs(OCHA)","人道主义危机":"humanitarian crisis","人道主义救援":"humanitarian aid"
  ,"仇恨，敌意":"animosity","仰卧起坐":"sit-up","伏击":"ambush","休战协议":"armistice","优先":"prioritize","传感器":"sensor","传真":"facsimile"
  ,"伤亡人员；（常用复数）伤亡人数":"casualty","伤病员后送":"casualty evacuation","体能服":"physical training uniform","体能测试":"Physical Fitness Test"
  ,"作战保障；战斗保障":"sustain","作战命令":"operations order","作战支援保障部队":"combat service support","作战支援部队":"combat arms support"
  ,"作战概念":"concept of operations","作战部队":"combat arms","作战靴":"combat boots","作训服":"combat uniform","使协调; 使调和":"coordinate"
  ,"使受到，给予（某种待遇）":"accord","使某人缠绕":"entangle","使适应, 顺应":"accommodate","使遭受;使承受":"inflict","侦察组":"scout group/team"
  ,"侦察（正式）":"reconnaissance","侦察（非正式）":"recce","保卫（防御工事）":"man","信号变弱":"fading","信号好":"good","信号弱":"weak","信号强":"loud"
  ,"信号强度":"signal strength","信号时有时无":"intermittent","信号有干扰":"interference","信号音质":"readability","俯卧撑":"push-up","停战（或停火）":"truce"
  ,"停止；立定":"halt","停火协议":"ceasefire","免除，豁免":"immunity","全民投票":"referendum","公正":"impartiality","兵种；武器；武装":"arm"
  ,"军事网格坐标":"Military Grid Reference System","军事观察员":"military observer","军事院校":"military academy","军士；（美陆军、海军陆战队）中士":"sergeant"
  ,"军官":"Commissioned Officer","军帽；大檐帽":"service cap","军情报告":"situation report","军械":"ordnance","军民合作":"Civil-Military Cooperation(CIMIC)"
  ,"军用字母表":"military alphabet","军种；服役":"service","军营超市":"Post Exchange","军需":"quartermaster","军；军团；特殊兵种；部队":"corps","冲刺、短跑":"sprint"
  ,"冲锋出发阵地":"assault position","净土-2023":"Pure Homeland-2023","减灾；赈灾":"disaster relief","减轻，缓和":"alleviate","出发点":"start point"
  ,"分发救济品":"distribution of relief items","分进点":"release point","分遣队":"detachment","列入密级的；保密的":"classified","列兵":"private","利用":"leverage"
  ,"副指挥官":"Deputy Commander","动员（尤指战时）":"mobilization","动脉的":"arterial","勋章授带":"medal ribbon","勋章；佩章；徽章；标记；识别符号":"insignia"
  ,"北大西洋公约组织（北约）":"North Atlantic Treaty Organization","医护兵;卫生员":"corpsman","医疗后送":"medical evacuation","医疗援助":"medical assistance"
  ,"十字路口":"crossroad","升降机；绞车":"hoist","升限；射高；（飞机）舱顶":"ceiling","协同训练；联合训练":"combined training","单兵训练":"individual training","占领":"overrun"
  ,"卡其色；卡其布":"khaki","参加，从事":"engagement","参谋人员演习":"staff exercise","参谋人员；参谋机构；参谋部":"staff","参谋部主任":"director of staff"
  ,"参谋长":"chief of staff(COS)","参谋长联席会议":"Joint Chiefs of Staff","友情；情谊":"camaraderie","反击;反攻":"counterattack"
  ,"反恐实兵演习-2023":"Counter-Terrorism Field Training Exercise-2023","反恐演习":"anti-terrorism drill","反步兵地雷；杀伤性地雷":"anti-personnel mine"
  ,"发现；探测":"detect","叛乱":"insurgent","口服补液盐":"oral rehydration salts","口粮；给养":"ration","可以听清":"readable","司令部；指挥部；总部":"headquarters"
  ,"合成孔径雷达":"synthetic aperture radar","合法性，合理性":"legitimacy","同意":"consent","同步；协调":"synchronize","后勤；后勤学":"logistics"
  ,"听不见":"nothing heard","命令":"order","和平天使-2023":"Peace Angel-2023","和解；复交":"reconciliation","团":"regiment","图例":"legend","圆木":"log"
  ,"地图推演":"map exercise","地对空导弹；舰对空导弹":"surface-to-air missile","地形的":"topographic","地形；地势":"terrain","地形；（地形的）凹凸":"relief"
  ,"地缘政治":"geopolitics","地雷":"landmine","地震":"earthquake","坐标网格":"grid","坑道":"tunnel","垂直的，直立的":"vertical","培养":"foster","堵塞，阻塞":"blockage"
  ,"增援":"reinforce","壕沟":"ditch","士兵":"enlisted","士官":"Non-Commissioned Officer","士气；民心；斗志":"morale","声音失真":"distorted"
  ,"壳体（坦克、自行火炮、舰艇等的主要结构）":"hull","备忘录":"memorandum","复原；恢复；修复":"rehabilitation","复员，遣散":"demobilization","外科手套；手术手套；医用手套":"surgical gloves"
  ,"外联":"outreach","外骨骼":"exoskeleton","多国合成训练演习":"combined training exercise","多层面":"multi-dimensional","大数据":"big data"
  ,"大街；（市区的）林荫大道":"boulevard","大队":"group","大黄蜂":"hornet","失密；泄密；暴露":"compromise","头盔":"helmet","夹子":"clip","如不能出席请务必回复":"Regrets Only"
  ,"姓名牌":"name plate","学费":"tuition","安全设备，保险装置":"safety","官方填写；仅供官方使用":"Official Use Only","定向能武器":"Directed Energy Weapon"
  ,"密件抄送；密送":"Blind Carbon Copy","密码术":"cryptology","对冲策略":"hedging strategy","射击能手；神枪手":"marksman","射程；靶场；射击场":"range","小山":"hill"
  ,"尖坡":"spur","尖子，精英":"elite","尼龙":"nylon","屡次袭扰（敌人）":"harass","山体滑坡；塌方":"landslide","山坳":"draw","山脊":"ridge","山谷":"valley"
  ,"岔路口":"junction","巡洋舰":"cruiser","巡逻背包":"patrol pack","工兵":"engineer","巩固，加强":"consolidate","已收到，明白":"roger","布局，构造；配置":"configuration"
  ,"帆布背包":"rucksack","师":"division","带子；皮带":"strap","带状图":"strip map","干旱；旱灾":"drought","平民，百姓；平民的":"civilian","平视显示器":"Head Up Display"
  ,"引体向上":"pull-up","弯道":"curve","弹丸；炮弹；射弹":"projectile","弹匣；弹仓":"magazine","弹性；韧性":"resilience","弹片；榴霰弹":"shrapnel","弹药;军火":"ammo"
  ,"弹药袋":"ammo pouch","征兵；(船的）吃水深度":"draft","征募；参军；入伍":"enlist","徒步行军":"foot march","心肺复苏术":"cardiopulmonary resuscitation(CPR)"
  ,"心脏骤停":"cardiac arrest","志愿兵；志愿军人":"volunteer","态势感知":"situational awareness","急救":"first aid","急救包":"first aid kit"
  ,"性能表，规格，规范":"specification","恶化":"deterioration","悬崖":"cliff","情报":"intelligence","情景训练演习":"situational exercise","成套工具，成套设备；箱子":"kit"
  ,"成比例的；相称的；适当的":"proportionate","战俘":"Enemy Prisoner of War","战斗命令":"combat order","战斗机；歼击机；斗士；战斗员":"fighter","战斗部":"payload"
  ,"手枪":"pistol","手柄，把手":"handle","手雷；手榴弹；枪榴弹":"grenade","执行官；副舰长；副职指挥员":"executive officer(XO)","扫雷":"demining"
  ,"扫雷排爆":"clearing mines or ordnance","扫雷，排雷":"mine clearance","扰乱;瓦解":"disrupt","扰乱攻击":"harassing attack"
  ,"抄送":"Carbon copy/ Courtesy copy","折叠锹":"folding shovel","护卫舰":"frigate","护目镜":"goggles","护送，陪同；护航舰；护卫队；护送者":"escort"
  ,"报告点":"reporting point","担架":"litter","指令":"instruction","指导，监督":"supervise","指挥官；舰长；主官":"commanding officer"
  ,"指挥所演习":"Command Post Exercise","指挥系统；指挥关系；指挥链":"chain of command","指示牌":"signpost","按发生时间顺序排列的":"chronological","挖掘机":"excavator"
  ,"授权，委托":"mandate","授权，批准":"authorize","排":"platoon","推土机":"bulldozer","推进":"propulsion","推进器":"propeller","掩体；地堡；暗堡":"bunker"
  ,"掩饰":"masquerade","提供医疗救助":"providing medical assistance","提供的副本":"copies furnished","提名":"nomination","握把":"grip"
  ,"撤出（作战区域）；撤离":"extract","撤离；疏散":"evacuate","撤退":"withdrawal","收信人；收件人":"addressee","收集，搜集（信息，资料）":"compile","攻击或袭击（敌方阵地）":"assault"
  ,"政权":"regime","敌对，敌方的；怀敌意的":"hostile","敬礼":"salute","数字":"figure","文职人员":"warrant officer","斜坡，坡道":"ramp","断裂；骨折":"fracture"
  ,"新兵训练":"basic training","新兵（训练）营；新兵训练中心":"boot camp","新闻处":"Public Information Office","旅":"brigade","无人机":"drone","无线电通信网络":"radio net"
  ,"无线电通联呼号":"callsign","无线电通联规范用语":"proword","昏迷":"coma","晋升":"promote","暂时的；过渡的":"interim","曲解":"misinterpretation","有氧运动":"cardio"
  ,"服从,顺从":"comply","服役":"serve","机密":"confidential","机枪；机关枪":"machinegun","杠杆，手柄":"lever","条纹":"stripe","来复枪；步枪；膛线":"rifle","果园":"orchard"
  ,"枪口；炮口":"muzzle","枪托":"buttstock","枪法；射击术":"marksmanship","枪炮军士":"gunnery sergeant","枪管；炮筒":"barrel","栅栏":"fence"
  ,"标准作战程序；标准作业程序":"standard operating procedure","标枪，投枪":"javelon","树林":"woods","校友":"alumni"
  ,"核生化污染":"Nuclear, Biological and Chemical Contamination","核生化防护":"Nuclear, biological and chemical (NBC) protection"
  ,"桌面推演":"table top exercise","梁、横梁；（体操的）平衡木":"beam","检查站，关卡":"checkpoint","棒，杆":"rod","榴弹炮":"howitzer","模板":"template","止血带":"tourniquet"
  ,"步兵战车":"Infantry Fighting Vehicle(IFV)","武器库；军火库；兵工厂":"arsenal","武装护卫":"armed escort","段；带，箍；带状物":"band","水壶":"canteen"
  ,"水平的, 与地平线平行的":"horizontal","水面舰艇":"surface vessel","沙暴；沙尘暴":"sandstorm","沼泽（地）":"swamp","津贴":"allowance","洼地":"depression"
  ,"派遣":"dispatch","海军":"Navy","海军士兵，水兵":"sailor","海军士官；海军军士":"petty officer","海军陆战队":"Marine Corps","海军陆战队员；海上的；海事的":"marine"
  ,"海啸":"tsunami","海岸警卫队":"Coast Guard","海拔":"elevation","渗透；潜入":"infiltration","湿地；沼泽":"marsh","湿粘的；湿冷的":"clammy","溢出 ; 外溢":"spill-over"
  ,"潜艇":"submarine","激光束":"laser beam","火力协调演习":"fire coordination exercise","火力小组":"fire team","火炮；加农炮；机关炮":"cannon"
  ,"火箭炮；火箭发射器":"rocket launcher","灾民转移":"relocation of victims","灾难":"catastrophe","炮兵；火炮":"artillery","炮塔":"turret"
  ,"炮火掩体；炮位":"emplacement","特派团":"mission","特混支队":"Task Element","特种部队":"special forces","狗牌：美军脖子上的一块小金属牌刻有姓名编号":"dog tag"
  ,"环岛":"roundabout","现役":"active service","班":"squad","瑕疵":"blemish","电台检查":"radio check","电磁波谱":"electromagnetic spectrum"
  ,"痉挛，抽搐":"spasm","监督，监控，监视":"monitor","监督；管理":"oversee","监视":"surveillance","直升机":"helicopter","直属单位":"Direct Reporting Unit"
  ,"瞄准具；观测器；瞄准":"sight","矛盾情绪；正反感情并存":"ambivalence","短袖":"short-sleeve","矮树丛":"underbrush","碳纤维":"carbon fiber","示威":"demonstration"
  ,"礼宾处处长":"Protocol Chief","礼服":"dress uniform","礼节":"etiquette","称呼":"address","称呼；称谓":"salutation","空军":"Air Force","空军士兵，飞行员":"airman"
  ,"空军联队；航空兵联队；侧翼部队":"wing","空空导弹；空战导弹":"air-to-air missile","空运":"airlift","突击":"raid","突发事件":"contingency"
  ,"第十山地师":"the 10th Mountain Division","等高线":"contour line","策略，战术":"tactic","算法，运算法则":"algorithm","精神创伤，心理创伤；损伤，外伤":"trauma"
  ,"紧急医疗援助":"emergency medical assistance","红外线频闪灯":"infrared strobes","纬度":"latitude","纱布；薄纱；":"gauze","终止；使停止":"terminate"
  ,"经度":"longitude","结尾客套语":"complimentary close","绘制; 标出":"plot","绳网":"cargo net","维和":"peacekeeping","维和分队":"contingent troop"
  ,"绷带":"bandage","缓冲区：中立区":"buffer zone","编入建制；委派；任命；指派":"assign","缺乏":"dearth","网络演习":"cyber exercise"
  ,"美国海军陆战队远征旅":"marine expeditionary brigade","翻领":"lapel","翼侧;侧面":"flank","联合作战":"joint operations"
  ,"联合作战指挥中心":"Joint Operations Command Center","联合军演":"joint exercise","联合参谋部":"Joint Staff Department(JSD)"
  ,"联合国儿童基金会":"UN Children's Fund","联合国宪章":"UN Charter","联合国维和行动":"unpko","联合训练；":"joint training","联合部队":"joint force"
  ,"联系人":"point of contact","联络":"liaison","联络，沟通":"liaise","聚酯纤维，涤纶":"polyester","聪明才智，巧妙":"ingenuity","肩章":"shoulder badge"
  ,"背带，挂带":"webbing","胸甲":"breastplate","胸腔密封贴，胸封":"chest seal","胸部按压":"compression","自动体外除颤器":"automated external defibrillator"
  ,"自动倾卸卡车、翻斗车":"dump truck","致命的":"lethal","航位推算法":"dead reckoning","航空兵":"aviation","航空母舰":"aircraft carrier","舰队；（飞机的）机队":"fleet"
  ,"营":"battalion","蓝剑-2023":"Blue Sword-2023","蓝色贝雷帽；维和人员":"Blue Beret","虚假信息":"disinformation","蜂群":"swarm","血液循环":"circulation"
  ,"行为准则":["honor code","Code of Conduct"],"补充命令":"fragmentary order","裁军；缴械":"disarmament","装甲；装甲兵；装甲部队":"armor","装载机":"loader"
  ,"裤子":"pants","褶皱，裤褶":"pleat","见收件人清单":"See Distribution","观察员营地":"team site","解密":"declassify","警戒；警惕":"vigilance","证实，证明，核实":"verify"
  ,"评估，评价，评定":"assessment","调解，仲裁":"mediation","调解，仲裁，调停":"intermediation","谈判，协商，":"negotiation","谨慎；慎重":"discretion"
  ,"责任区":"area of responsibility","贫困，匮乏，剥夺":"deprivation","起始线;出发线":"line of departure","起重机":"crane","路径；路标":"waypoint"
  ,"路障，障碍物":"roadblock","跳跃，跃过":"vault","车队；护送；护卫":"convoy","轨道；弹道":"trajectory","轮流；轮换；轮岗":"rotate","轰炸机":"bomber","轻型护卫舰;轻巡洋舰":"corvette"
  ,"轻武器":"small arms","边线；副业":"sideline","过敏；敏感":"allergy","运用，使用":"wield","运送":"shipment","进弹，装弹，送弹":"feed","进攻出发阵地":"attack position"
  ,"远端脉搏":"distal pulse","迫击炮":"mortar","迷彩":"camouflage","退伍；退役":"discharge","通信兵":"signal","遇险求救信号；遇难信号":"distress signal"
  ,"配属部队":"attachment","重型负载":"hard duty","重建":"reconstruction","重建基础设施":"re-establishing infrastructure"
  ,"野战训练演习":"field training exercise","野火":"wildfire","金色眼镜蛇-2024":"Cobra Gold-2024","铁丝网":"barbed wire","铺装路面":"improved road"
  ,"锁子甲":"chain mail","锻炼；训练":"workout","长期粮食援助":"long-term food aid","长袖":"long-sleeve","间歇河流":"intermittent stream","队列训练；操练":"drill"
  ,"防弹背心":"flak vest","防御工事":"fortification","防空":"air defense","阵亡":"k-i-a","附件":"enclosure","陆军（首字母常用大写）；军队；集团军":"Army","降衔（级）":"demote"
  ,"险峻的, 陡峭的":"precipitous","隐密的":"covert","隐形":"stealth","障碍训练（场）":"obstacle course","难民，避难者":"refugee","雄鹰突击-2024":"Eagle Strike-2024"
  ,"雪暴；暴风雪":"snowstorm","非政府组织":"non-governmental organization","鞍部":"saddle","音质清晰":"clear","顺应时势,迎合潮流;拖延，耽搁":"temporize"
  ,"预计到达时间":"estimated time of arrival","飓风":"hurricane","食物":"chow","饥荒":"famine","驱逐舰":"destroyer","骑兵；高度机动的地面部队":"cavalry"
  ,"高功率微波系统":"high-powered microwave system","高能激光系统":"high-energy laser system","鼻咽导气管":"nasopharyngeal airway","（军校）学员":"cadet"
  ,"（固定断骨的）夹板":"splint","（在军事或秘密行动中）消除威胁；摧毁":"neutralize","（小）舰队；（小）船队；纵队":"flotilla","（尤指某种坏事情的）开始；发作":"onset","（无线电等信号的）播送，发送":"transmit"
  ,"（机器的）故障":"breakdown","（枪、炮等的）口径":"caliber","（海军）上将":"admiral","（海军）中将":"vice admiral","（海军）中校":"commander"
  ,"（海军）准将":"rear admiral lower half","（海军）少尉":"ensign","（美陆军、海军陆战队）上士；（美空军）中士":"staff sergeant","（美陆军）一级军士长（指挥）":"command sergeant major"
  ,"（美陆军）二级军士长（指挥）":"first sergeant","（美陆军）二级军士长（机关）":"master sergeant","（美陆军）总军士长":"sergeant major of the army","（美）国防部":"pentagon"
  ,"（美）太空军士兵":"guardian","（美）太空司令部":"Space Command","（美）战争部":"Department of War","（舰船）排水量":"displacement"
  ,"（陆、海、海军陆战队）中将":"lieutenant general","（陆、海、海军陆战队）少将":"major general","（陆、空、海军陆战队）上将":"general","（陆、空、海军陆战队）上尉；（海军）上校":"captain"
  ,"（陆、空、海军陆战队）上校":"colonel","（陆、空、海军陆战队）中尉；（海军）上尉":"lieutenant","（陆、空、海军陆战队）中校":"lieutenant colonel","（陆、空、海军陆战队）准将":"brigadier general"
  ,"（陆、空、海军陆战队）少尉":"second lieutenant","（陆、空、海军陆战队）少校":"major","（零到九中的任一）数字":"digit","（飞行）小队；机群":"flight"
};

/* ================================================================
 * 模块 C — 内部命名空间 & 状态
 * ================================================================ */

var HS = {
    // v6.0: 双向词典
    cnToEn: null,       // Map: normalized Chinese → { answers: [...], exactSet: {...}, original: [...] }
    enToCn: null,       // Map: normalized English → { answers: [...], exactSet: {...}, original: [...] }

    _normCache: null,   // Map — normalizeText LRU 缓存
    lastQuestionText: "",
    lastQuestionType: "", // v6.0: 记录上次题型
    _processing: false,
    _observer: null,
    _retryGen: 0,
    _observeTarget: null,
    _pageVisible: true,
    _watchdogTimers: [],
    _retryTimers: [],
    _started: false,
    _lastDomFingerprint: "",
    _answerStats: null,

    // v5.0 反检测状态 (保留)
    _virtualMouse: { x: 0, y: 0 },
    _antiDetectTimers: [],
    _consecutiveFails: 0,
    _scrollJitterId: null,
    _typingActive: false,
    _answerCount: 0
};

/* ================================================================
 * 模块 D — 核心工具
 * ================================================================ */

function debug(msg) {
    if (CFG.DEBUG_LOG) console.log("[HS-TB]", msg);
}

function warn(msg) {
    console.warn("[HS-TB]", msg);
}

function $_q(sel) {
    try { return document.querySelector(sel); } catch (e) { return null; }
}

/* ================================================================
 * v5.0 保留 — 模块 AD1: 反检测随机延迟工具
 * ================================================================ */

function normalRandom(mean, stddev) {
    var u1, u2;
    do { u1 = Math.random(); } while (u1 === 0);
    u2 = Math.random();
    var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stddev;
}

function uniformRandom(min, max) {
    return min + Math.random() * (max - min);
}

function clampDelay(ms, min, max) {
    if (ms < min) return min;
    if (ms > max) return max;
    return Math.floor(ms);
}

function getProfileParams() {
    switch (CFG.SPEED_PROFILE) {
        case "speed":   return { mean: 80,  stddev: 40 };
        case "stealth": return { mean: 600, stddev: 250 };
        default:         return { mean: CFG.STEADY_DELAY_MEAN, stddev: CFG.STEADY_DELAY_STDDEV };
    }
}

function smartDelay() {
    var count = HS._answerCount;
    var burst = CFG.BURST_COUNT;
    var params = getProfileParams();

    if (count < burst) {
        var burstMean = params.mean * uniformRandom(0.05, 0.15);
        var raw = normalRandom(burstMean, params.stddev * 0.2);
        return clampDelay(raw, CFG.DELAY_MIN, params.mean * 0.3);
    }

    var raw = normalRandom(params.mean, params.stddev);
    return clampDelay(raw, CFG.DELAY_MIN, CFG.DELAY_MAX);
}

function betweenQuestionDelay() {
    return Math.floor(uniformRandom(CFG.BETWEEN_QUESTION_MIN, CFG.BETWEEN_QUESTION_MAX));
}

/* ================================================================
 * v5.0 保留 — 模块 AD2: 鼠标轨迹模拟
 * ================================================================ */

function cubicBezier(p0, p1, p2, p3, t) {
    var u = 1 - t;
    var uu = u * u;
    var tt = t * t;
    return {
        x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
        y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y
    };
}

function getElementCenter(el) {
    var rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function generateBezierPath(fromX, fromY, toX, toY, steps) {
    if (steps === undefined) steps = CFG.MOUSE_PATH_STEPS;
    var dx = toX - fromX, dy = toY - fromY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var spread = Math.max(60, dist * 0.35);

    var cp1x = fromX + dx * 0.25 + (Math.random() - 0.5) * spread;
    var cp1y = fromY + dy * 0.25 + (Math.random() - 0.5) * spread;
    var cp2x = fromX + dx * 0.75 + (Math.random() - 0.5) * spread;
    var cp2y = fromY + dy * 0.75 + (Math.random() - 0.5) * spread;

    var p0 = { x: fromX, y: fromY }, p1 = { x: cp1x, y: cp1y };
    var p2 = { x: cp2x, y: cp2y }, p3 = { x: toX, y: toY };

    var points = new Array(steps + 1);
    for (var i = 0; i <= steps; i++) {
        points[i] = cubicBezier(p0, p1, p2, p3, i / steps);
    }
    return points;
}

function dispatchMousePath(points, targetEl) {
    var len = points.length;
    if (len === 0) return;
    var i, p, evt;
    for (i = 0; i < len; i++) {
        p = points[i];
        evt = new MouseEvent("mousemove", {
            bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, view: window
        });
        document.dispatchEvent(evt);
    }
    var last = points[len - 1];
    HS._virtualMouse.x = last.x;
    HS._virtualMouse.y = last.y;
    if (targetEl) {
        targetEl.dispatchEvent(new MouseEvent("mouseover", {
            bubbles: true, cancelable: true, clientX: last.x, clientY: last.y, view: window
        }));
        targetEl.dispatchEvent(new MouseEvent("mouseenter", {
            bubbles: false, cancelable: true, clientX: last.x, clientY: last.y, view: window
        }));
    }
}

function simulateMouseClick(element, onComplete) {
    if (!CFG.ANTI_DETECT_ENABLED || !CFG.MOUSE_SIM_ENABLED) {
        element.click();
        if (onComplete) onComplete();
        return;
    }

    var center = getElementCenter(element);
    var toX = center.x + uniformRandom(-5, 5);
    var toY = center.y + uniformRandom(-3, 3);
    var fromX = HS._virtualMouse.x || toX;
    var fromY = HS._virtualMouse.y || (toY - 100);
    var dx = toX - fromX, dy = toY - fromY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < CFG.MOUSE_SKIP_DISTANCE) {
        HS._virtualMouse.x = toX;
        HS._virtualMouse.y = toY;
        element.dispatchEvent(new MouseEvent("mouseover", {
            bubbles: true, cancelable: true, clientX: toX, clientY: toY, view: window
        }));
        var skipDelay = clampDelay(normalRandom(40, 20), 15, 100);
        var sid = setTimeout(function () {
            var idx = HS._antiDetectTimers.indexOf(sid);
            if (idx !== -1) HS._antiDetectTimers.splice(idx, 1);
            try { element.click(); } catch (e) {}
            if (onComplete) onComplete();
        }, skipDelay);
        HS._antiDetectTimers.push(sid);
        return;
    }

    var points = generateBezierPath(fromX, fromY, toX, toY);
    dispatchMousePath(points, element);

    var clickDelay = smartDelay();
    debug("鼠标轨迹延迟 " + clickDelay + "ms 后点击");

    var tid = setTimeout(function () {
        var idx = HS._antiDetectTimers.indexOf(tid);
        if (idx !== -1) HS._antiDetectTimers.splice(idx, 1);
        try { element.click(); } catch (e) {
            warn("simulateMouseClick 点击失败: " + e.message);
        }
        if (onComplete) onComplete();
    }, clickDelay);

    HS._antiDetectTimers.push(tid);
}

/* ================================================================
 * v5.0 保留 — 模块 AD3: 逐字符输入模拟
 * ================================================================ */

function setNativeValue(el, value) {
    var vd = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    if (vd && vd.set) {
        vd.set.call(el, value);
    } else {
        el.value = value;
    }
}

function simulateTyping(inputEl, text, onComplete) {
    if (!CFG.ANTI_DETECT_ENABLED || !CFG.TYPE_SIM_ENABLED
        || (text && text.length < CFG.TYPE_SKIP_SHORT)) {
        setNativeValue(inputEl, text);
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
        if (onComplete) onComplete();
        return;
    }

    if (!inputEl || !text) {
        if (onComplete) onComplete();
        return;
    }

    HS._typingActive = true;
    try { inputEl.focus(); } catch (e) {}

    setNativeValue(inputEl, "");
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));

    var i = 0, len = text.length;

    function typeNextChar() {
        if (i >= len) {
            inputEl.dispatchEvent(new Event("change", { bubbles: true }));
            HS._typingActive = false;
            if (onComplete) onComplete();
            return;
        }

        var char = text.charAt(i);
        inputEl.dispatchEvent(new KeyboardEvent("keydown", {
            bubbles: true, cancelable: true, key: char, char: char
        }));
        setNativeValue(inputEl, inputEl.value + char);
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        inputEl.dispatchEvent(new KeyboardEvent("keyup", {
            bubbles: true, cancelable: true, key: char, char: char
        }));

        i++;
        var charDelay = Math.floor(uniformRandom(CFG.TYPE_DELAY_MIN, CFG.TYPE_DELAY_MAX));
        var tid = setTimeout(function () {
            var idx = HS._antiDetectTimers.indexOf(tid);
            if (idx !== -1) HS._antiDetectTimers.splice(idx, 1);
            typeNextChar();
        }, charDelay);
        HS._antiDetectTimers.push(tid);
    }

    var initDelay = uniformRandom(20, 80);
    var initTid = setTimeout(function () {
        var idx = HS._antiDetectTimers.indexOf(initTid);
        if (idx !== -1) HS._antiDetectTimers.splice(idx, 1);
        typeNextChar();
    }, initDelay);
    HS._antiDetectTimers.push(initTid);
}

/* ================================================================
 * v5.0 保留 — 模块 AD4: 滚动行为模拟
 * ================================================================ */

function performRandomScroll() {
    try {
        var currentY = window.scrollY || window.pageYOffset || 0;
        var maxScroll = Math.max(0, (document.body.scrollHeight || document.documentElement.scrollHeight) - window.innerHeight);
        if (maxScroll <= 0) return;
        var direction = Math.random() < 0.6 ? 1 : -1;
        var distance = uniformRandom(15, 80);
        var targetY = currentY + direction * distance;
        targetY = Math.max(0, Math.min(maxScroll, targetY));
        if (Math.random() < 0.2) {
            var overshoot = targetY + direction * uniformRandom(10, 35);
            overshoot = Math.max(0, Math.min(maxScroll, overshoot));
            window.scrollTo({ top: overshoot, behavior: "smooth" });
            var backTid = setTimeout(function () {
                var idx = HS._antiDetectTimers.indexOf(backTid);
                if (idx !== -1) HS._antiDetectTimers.splice(idx, 1);
                window.scrollTo({ top: targetY, behavior: "smooth" });
            }, uniformRandom(100, 350));
            HS._antiDetectTimers.push(backTid);
        } else {
            window.scrollTo({ top: targetY, behavior: "smooth" });
        }
        debug("滚动模拟: " + Math.round(currentY) + " → " + Math.round(targetY));
    } catch (e) {}
}

function startScrollJitter() {
    if (!CFG.ANTI_DETECT_ENABLED || !CFG.SCROLL_SIM_ENABLED) return;
    if (HS._scrollJitterId) return;
    function scheduleNext() {
        var interval = uniformRandom(CFG.SCROLL_INTERVAL_MIN, CFG.SCROLL_INTERVAL_MAX);
        HS._scrollJitterId = setTimeout(function () {
            HS._scrollJitterId = null;
            if (!HS._pageVisible) { scheduleNext(); return; }
            performRandomScroll();
            scheduleNext();
        }, interval);
    }
    scheduleNext();
    debug("滚动抖动已启动");
}

function stopScrollJitter() {
    if (HS._scrollJitterId) {
        clearTimeout(HS._scrollJitterId);
        HS._scrollJitterId = null;
    }
}

/* ================================================================
 * v5.0 保留 — 模块 AD5: 增强重试机制
 * ================================================================ */

function calcRetryDelay(attemptsUsed) {
    var base = CFG.RETRY_INTERVAL * Math.pow(CFG.RETRY_BACKOFF_MUL, attemptsUsed);
    if (CFG.ANTI_DETECT_ENABLED && CFG.RETRY_JITTER_ENABLED) {
        var jitter = uniformRandom(-base * 0.3, base * 0.3);
        base += jitter;
    }
    return Math.max(10, Math.floor(base));
}

function recordConsecutiveFail() {
    HS._consecutiveFails++;
    debug("连续失败计数: " + HS._consecutiveFails);
}

function recordSuccess() {
    if (HS._consecutiveFails > 0) {
        debug("连续失败已清零 (之前: " + HS._consecutiveFails + ")");
        HS._consecutiveFails = 0;
    }
}

function getLongPauseIfNeeded() {
    if (!CFG.ANTI_DETECT_ENABLED || !CFG.LONG_PAUSE_ENABLED) return 0;
    if (HS._consecutiveFails < CFG.MAX_CONSECUTIVE_FAILS) return 0;
    var pause = uniformRandom(CFG.LONG_PAUSE_MIN, CFG.LONG_PAUSE_MAX);
    warn("连续失败 " + HS._consecutiveFails + " 次，长暂停 " + Math.round(pause / 1000) + "s");
    HS._consecutiveFails = Math.floor(HS._consecutiveFails / 2);
    return Math.floor(pause);
}

/* ================================================================
 * v4.0 保留 — 字符串工具
 * ================================================================ */

function containsWord(text, word) {
    if (!text || !word) return false;
    if (text.indexOf(word) === -1) return false;
    var len = text.length, wLen = word.length, idx = text.indexOf(word);
    while (idx !== -1) {
        var beforeOk = idx === 0 || isWordBoundary(text.charCodeAt(idx - 1));
        var afterOk  = (idx + wLen >= len) || isWordBoundary(text.charCodeAt(idx + wLen));
        if (beforeOk && afterOk) return true;
        idx = text.indexOf(word, idx + 1);
    }
    return false;
}

function isWordBoundary(code) {
    if (code >= 97 && code <= 122) return false;
    if (code >= 65 && code <= 90) return false;
    if (code >= 48 && code <= 57) return false;
    return true;
}

/* ================================================================
 * 模块 E — normalizeText
 * ================================================================ */

var _chCls = new Uint8Array(128);
_chCls[9] = 1; _chCls[10] = 1; _chCls[11] = 1;
_chCls[12] = 1; _chCls[13] = 1; _chCls[32] = 1;
for (var _ci = 65; _ci <= 90; _ci++) _chCls[_ci] = 2;

function normalizeText(text) {
    if (!text) return "";
    var cached = HS._normCache.get(text);
    if (cached !== undefined) return cached;

    var len = text.length, chars = [], prevSpace = false, leading = true;
    var i, ch, code, ct, chLen = 0;

    for (i = 0; i < len; i++) {
        ch = text[i];
        code = ch.charCodeAt(0);

        if (code >= 0xFF01 && code <= 0xFF5E) {
            ch = String.fromCharCode(code - 0xFEE0);
            code = ch.charCodeAt(0);
        }

        if (code < 128) {
            ct = _chCls[code];
            if (ct === 1) {
                if (leading || prevSpace) continue;
                prevSpace = true;
                chars[chLen++] = " ";
                continue;
            }
            if (ct === 2) {
                prevSpace = false; leading = false;
                chars[chLen++] = String.fromCharCode(code + 32);
                continue;
            }
            prevSpace = false; leading = false;
            chars[chLen++] = ch;
            continue;
        }

        if ((code >= 0x200B && code <= 0x200F) || code === 0xFEFF || code === 0x00AD ||
            (code >= 0x2060 && code <= 0x2064)) continue;

        if (code === 0x3000 || code === 0xA0) {
            if (leading || prevSpace) continue;
            prevSpace = true;
            chars[chLen++] = " ";
            continue;
        }

        prevSpace = false; leading = false;
        chars[chLen++] = ch;
    }

    if (chLen > 0 && chars[chLen - 1] === " ") {
        chLen--;
        chars.length = chLen;
    }
    var out = chars.join("");

    HS._normCache.set(text, out);
    if (HS._normCache.size > CFG.NORM_CACHE_SIZE) {
        HS._normCache.delete(HS._normCache.keys().next().value);
    }
    return out;
}

/* ================================================================
 * 模块 F — v6.0: 构建双向词典 (cnToEn / enToCn)
 *
 * 思路：遍历原始 dict，判断 key/value 中哪边含中文，哪边是英文，
 *       分别填充 cnToEn 和 enToCn 两个映射表。
 *
 * isChineseChar(code): CJK Unified Ideographs U+4E00–U+9FFF
 * hasChinese(str): 检测字符串是否包含中文字符
 *
 * cnToEn: { normalizedChinese → { answers: [...], exactSet: {...}, original: [...] } }
 * enToCn: { normalizedEnglish → { answers: [...], exactSet: {...}, original: [...] } }
 * ================================================================ */

function isChineseChar(code) {
    return (code >= 0x3400 && code <= 0x4DBF)   // CJK Extension A
        || (code >= 0x4E00 && code <= 0x9FFF)   // CJK Unified Ideographs
        || (code >= 0xF900 && code <= 0xFAFF)   // CJK Compatibility Ideographs
        || (code >= 0x2F800 && code <= 0x2FA1F); // CJK Compatibility Supplement
}

function hasChinese(str) {
    if (!str) return false;
    for (var i = 0; i < str.length; i++) {
        if (isChineseChar(str.charCodeAt(i))) return true;
    }
    return false;
}

function buildBidirectionalDict() {
    HS.cnToEn = new Map();
    HS.enToCn = new Map();

    var keys = Object.keys(dict);
    var i, j, kLen = keys.length;

    function addToMap(map, keyNorm, valueNorm, valueOriginal) {
        var entry = map.get(keyNorm);
        if (!entry) {
            entry = { answers: [], exactSet: Object.create(null), original: [] };
            map.set(keyNorm, entry);
        }
        if (!entry.exactSet[valueNorm]) {
            entry.exactSet[valueNorm] = true;
            entry.answers.push(valueNorm);
            entry.original.push(valueOriginal);
        }
    }

    for (i = 0; i < kLen; i++) {
        var rawKey = keys[i];
        var rawValue = dict[rawKey];
        var values = Array.isArray(rawValue) ? rawValue : [rawValue];

        var keyHasCN = hasChinese(rawKey);
        var keyNorm = normalizeText(rawKey);

        for (j = 0; j < values.length; j++) {
            var val = values[j];
            var valHasCN = hasChinese(val);
            var valNorm = normalizeText(val);

            if (keyHasCN && !valHasCN) {
                // 中文 key → 英文 value: 释义选词 & 拼写题
                addToMap(HS.cnToEn, keyNorm, valNorm, val);
                // 同时反向: 英文 key → 中文 value: 选词释义
                addToMap(HS.enToCn, valNorm, keyNorm, rawKey);
            } else if (!keyHasCN && valHasCN) {
                // 英文 key → 中文 value: 选词释义
                addToMap(HS.enToCn, keyNorm, valNorm, val);
                // 同时反向: 中文 key → 英文 value: 释义选词 & 拼写题
                addToMap(HS.cnToEn, valNorm, keyNorm, rawKey);
            } else if (!keyHasCN && !valHasCN) {
                // 纯英文 key → 纯英文 value (缩写映射如 "2LT"→"second lieutenant(abbr.)")
                // 仅作为别名备用，两个方向都存
                addToMap(HS.enToCn, keyNorm, valNorm, val);
                addToMap(HS.enToCn, valNorm, keyNorm, rawKey);
            } else {
                // 都含中文 (罕见，如纯中文同义词)
                addToMap(HS.cnToEn, keyNorm, valNorm, val);
                addToMap(HS.cnToEn, valNorm, keyNorm, rawKey);
            }
        }
    }

    // 缓存预热
    for (i = 0; i < kLen; i++) {
        var rk = keys[i];
        normalizeText(rk);
        var rv = dict[rk];
        if (Array.isArray(rv)) {
            for (j = 0; j < rv.length; j++) normalizeText(rv[j]);
        } else {
            normalizeText(rv);
        }
    }

    console.log("[HS-TB] 双向词典已构建: cnToEn=" + HS.cnToEn.size + "项, enToCn=" + HS.enToCn.size + "项");
}

/* ================================================================
 * 模块 G — 竞态安全的原子锁
 * ================================================================ */

function acquireLock() {
    if (HS._processing) return false;
    HS._processing = true;
    HS._retryGen++;
    return true;
}

function releaseLock() {
    HS._processing = false;
    clearAllTimers();
}

function clearAllTimers() {
    var t;
    while (HS._watchdogTimers.length) { t = HS._watchdogTimers.pop(); clearTimeout(t); }
    while (HS._retryTimers.length) { t = HS._retryTimers.pop(); clearTimeout(t); }
    while (HS._antiDetectTimers.length) { t = HS._antiDetectTimers.pop(); clearTimeout(t); }
}

/* ================================================================
 * 模块 H — v6.0: team_battle 专用答题逻辑
 *
 * 三种题型:
 *   TYPE_DEF_TO_WORD ("释义选词"): 题目=中文释义 → 选项=英文词
 *   TYPE_WORD_TO_DEF ("选词释义"): 题目=英文词 → 选项=中文释义
 *   TYPE_SPELLING   ("拼写题"):   题目=中文释义 → 输入英文词 → 点击提交
 * ================================================================ */

function getQuestionText() {
    try {
        var el = $_q(CFG.QUESTION_TEXT_SELECTOR);
        return el ? el.textContent.trim() : null;
    } catch (e) { return null; }
}

function getQuestionType() {
    try {
        var el = $_q(CFG.QUESTION_TYPE_SELECTOR);
        if (!el) return "unknown";
        var t = el.textContent.trim();
        if (t === CFG.TYPE_DEF_TO_WORD) return "def_to_word";
        if (t === CFG.TYPE_WORD_TO_DEF) return "word_to_def";
        if (t === CFG.TYPE_SPELLING)   return "spelling";
        return "unknown";
    } catch (e) { return "unknown"; }
}

/**
 * getOptions() — 获取四个选项元素 #opt_0 ~ #opt_3
 * 返回 { options: [...], texts: [...] }
 * 调用方负责处理元素不存在的情况
 */
function getOptions() {
    var options = [];
    var texts = [];
    var sel, i;
    for (i = 0; i < 4; i++) {
        sel = CFG.OPTION_SELECTORS[i];
        var el = $_q(sel);
        options.push(el);
        texts.push(el ? el.textContent.trim() : "");
    }
    return { options: options, texts: texts };
}

/**
 * isSpellingInputVisible() — 拼写输入框是否可见且可用
 */
function isSpellingInputVisible() {
    try {
        var input = $_q(CFG.SPELLING_INPUT_SELECTOR);
        if (!input) return false;
        var style = window.getComputedStyle(input);
        return style.display !== "none" && style.visibility !== "hidden" && input.offsetParent !== null;
    } catch (e) { return false; }
}

/**
 * clickSpellingSubmit(onComplete) — 点击拼写提交按钮
 * v6.0: 使用 #spellingSubmitBtn
 */
function clickSpellingSubmit(onComplete) {
    try {
        var btn = $_q(CFG.SPELLING_SUBMIT_SELECTOR);
        if (btn && document.body.contains(btn)) {
            simulateMouseClick(btn, onComplete);
            return true;
        }
        if (onComplete) onComplete();
        return false;
    } catch (e) {
        if (onComplete) onComplete();
        return false;
    }
}

/**
 * lookupAnswerTeam(questionText, qType)
 * 根据题型从对应词典查找答案。
 *
 * 返回:
 *   { found: true, answers: [...], exactSet: {...}, originals: [...] }  匹配成功
 *   { found: false }                                                     未找到
 */
function lookupAnswerTeam(questionText, qType) {
    if (!questionText) return { found: false };

    var qNorm = normalizeText(questionText);
    if (!qNorm) return { found: false };

    var entry = null;

    if (qType === "def_to_word" || qType === "spelling") {
        // 中文 → 英文: 查 cnToEn
        entry = HS.cnToEn.get(qNorm);
        if (!entry) {
            // 模糊匹配: 检查 cnToEn 中哪个 key 包含/被包含于题目文本
            var keys = HS.cnToEn.keys();
            for (var k = keys.next(); !k.done; k = keys.next()) {
                var kn = k.value;
                if (kn && (kn.indexOf(qNorm) !== -1 || qNorm.indexOf(kn) !== -1)) {
                    entry = HS.cnToEn.get(kn);
                    debug("cnToEn 模糊匹配: " + kn + " ← " + qNorm);
                    break;
                }
            }
        }
    } else if (qType === "word_to_def") {
        // 英文 → 中文: 查 enToCn
        entry = HS.enToCn.get(qNorm);
        if (!entry) {
            var keys = HS.enToCn.keys();
            for (var k = keys.next(); !k.done; k = keys.next()) {
                var kn = k.value;
                if (kn && (containsWord(kn, qNorm) || containsWord(qNorm, kn) || kn.indexOf(qNorm) !== -1 || qNorm.indexOf(kn) !== -1)) {
                    entry = HS.enToCn.get(kn);
                    debug("enToCn 模糊匹配: " + kn + " ← " + qNorm);
                    break;
                }
            }
        }
    }

    if (entry && entry.answers && entry.answers.length > 0) {
        return {
            found: true,
            answers: entry.answers,
            exactSet: entry.exactSet,
            originals: entry.original
        };
    }
    return { found: false };
}

/**
 * answerChoiceTeam(lookupResult, qType, retriesLeft, onSuccess, startGen, onNotFound)
 *
 * 从 #opt_0 ~ #opt_3 中匹配 lookupResult 给出的正确答案，并点击。
 * 对于 def_to_word: 选项是英文，匹配 lookupResult.answers (英文)
 * 对于 word_to_def: 选项是中文，匹配 lookupResult.answers (中文)
 */
function answerChoiceTeam(lookupResult, qType, retriesLeft, onSuccess, startGen, onNotFound) {
    if (retriesLeft === undefined) retriesLeft = CFG.MAX_RETRIES;
    if (startGen === undefined) startGen = HS._retryGen;

    if (HS._retryGen !== startGen) {
        debug("answerChoiceTeam 代数过期，放弃重试");
        return false;
    }

    try {
        var correctAnswers = lookupResult.answers;
        var exactSet = lookupResult.exactSet;
        if (!correctAnswers || correctAnswers.length === 0) return false;

        // 获取选项
        var optInfo = getOptions();
        var optionEls = optInfo.options;
        var optionTexts = optInfo.texts;

        // 检查是否有选项加载
        var hasOptions = false;
        for (var ci = 0; ci < 4; ci++) {
            if (optionEls[ci] && optionTexts[ci]) {
                hasOptions = true;
                break;
            }
        }
        if (!hasOptions) {
            recordConsecutiveFail();
            if (retriesLeft > 0) { scheduleRetryTeam(lookupResult, qType, retriesLeft, onSuccess, startGen); }
            return false;
        }

        var foundIndex = -1;
        var i, k, optNorm, ansLen = correctAnswers.length;

        // Pass 1: 精确匹配
        for (i = 0; i < 4; i++) {
            if (!optionEls[i] || !optionTexts[i]) continue;
            optNorm = normalizeText(optionTexts[i]);
            if (exactSet[optNorm]) {
                foundIndex = i;
                break;
            }
        }

        // Pass 2: containsWord 词边界匹配
        if (foundIndex === -1) {
            for (i = 0; i < 4; i++) {
                if (!optionEls[i] || !optionTexts[i]) continue;
                optNorm = normalizeText(optionTexts[i]);
                for (k = 0; k < ansLen; k++) {
                    var ansNorm = correctAnswers[k];
                    if (containsWord(optNorm, ansNorm) || containsWord(ansNorm, optNorm)) {
                        foundIndex = i;
                        break;
                    }
                }
                if (foundIndex !== -1) break;
            }
        }

        // Pass 3: indexOf 子串匹配
        if (foundIndex === -1) {
            for (i = 0; i < 4; i++) {
                if (!optionEls[i] || !optionTexts[i]) continue;
                optNorm = normalizeText(optionTexts[i]);
                for (k = 0; k < ansLen; k++) {
                    var ansNorm2 = correctAnswers[k];
                    if (optNorm.indexOf(ansNorm2) !== -1 || ansNorm2.indexOf(optNorm) !== -1) {
                        foundIndex = i;
                        break;
                    }
                }
                if (foundIndex !== -1) break;
            }
        }

        if (foundIndex !== -1) {
            var targetEl = optionEls[foundIndex];
            if (!document.body.contains(targetEl)) {
                warn("目标选项已脱离 DOM，重新获取");
                recordConsecutiveFail();
                if (retriesLeft > 0) { scheduleRetryTeam(lookupResult, qType, retriesLeft, onSuccess, startGen); }
                return false;
            }

            simulateMouseClick(targetEl, function () {
                recordSuccess();
                if (onSuccess) onSuccess();
            });
            return true;
        }

        recordConsecutiveFail();
        if (retriesLeft > 0) {
            scheduleRetryTeam(lookupResult, qType, retriesLeft, onSuccess, startGen);
        }
        if (onNotFound) onNotFound();
        return false;

    } catch (e) {
        warn("answerChoiceTeam error: " + e.message);
        recordConsecutiveFail();
        return false;
    }
}

function scheduleRetryTeam(lookupResult, qType, retriesLeft, onSuccess, startGen) {
    var attemptsUsed = CFG.MAX_RETRIES - retriesLeft;
    var longPause = getLongPauseIfNeeded();
    var totalDelay = longPause > 0 ? longPause : calcRetryDelay(attemptsUsed);

    debug("answerChoiceTeam 重试 #" + (attemptsUsed + 1) + " after " + totalDelay + "ms" +
        (longPause > 0 ? " (长暂停)" : ""));

    var timerId = setTimeout(function () {
        var idx = HS._retryTimers.indexOf(timerId);
        if (idx !== -1) HS._retryTimers.splice(idx, 1);
        answerChoiceTeam(lookupResult, qType, retriesLeft - 1, onSuccess, startGen);
    }, totalDelay);

    HS._retryTimers.push(timerId);
}

/**
 * answerSpelling(lookupResult, onComplete)
 * 拼写题: 将答案填入 #spellingInput，然后点击 #spellingSubmitBtn
 */
function answerSpelling(lookupResult, onComplete) {
    try {
        var correctAnswers = (lookupResult.originals && lookupResult.originals.length > 0)
            ? lookupResult.originals
            : lookupResult.answers;
        if (!correctAnswers || correctAnswers.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        var chosen = correctAnswers[Math.floor(Math.random() * correctAnswers.length)];

        var input = $_q(CFG.SPELLING_INPUT_SELECTOR);
        if (!input) {
            if (onComplete) onComplete();
            return;
        }
        if (input.disabled || input.readOnly) {
            warn("拼写输入框被禁用/只读，跳过");
            if (onComplete) onComplete();
            return;
        }

        simulateTyping(input, chosen, function () {
            var postDelay = CFG.ANTI_DETECT_ENABLED
                ? clampDelay(normalRandom(60, 40), 20, 200)
                : 30;

            var tid = setTimeout(function () {
                var idx = HS._antiDetectTimers.indexOf(tid);
                if (idx !== -1) HS._antiDetectTimers.splice(idx, 1);

                clickSpellingSubmit(function () {
                    recordSuccess();
                    if (onComplete) onComplete();
                });
            }, postDelay);

            HS._antiDetectTimers.push(tid);
        });

    } catch (e) {
        warn("answerSpelling error: " + e.message);
        recordConsecutiveFail();
        if (onComplete) onComplete();
    }
}

/**
 * handleUnknownQuestionTeam(onComplete)
 * 未知题型：随机选择一个选项
 */
function handleUnknownQuestionTeam(onComplete) {
    if (!CFG.SKIP_UNKNOWN) {
        if (onComplete) onComplete();
        return;
    }

    recordConsecutiveFail();

    var delay = CFG.ANTI_DETECT_ENABLED ? clampDelay(normalRandom(60, 30), 20, 200) : 10;

    var preTid = setTimeout(function () {
        var idx = HS._antiDetectTimers.indexOf(preTid);
        if (idx !== -1) HS._antiDetectTimers.splice(idx, 1);

        var qType = getQuestionType();
        if (qType === "def_to_word" || qType === "word_to_def" || qType === "unknown") {
            var optInfo = getOptions();
            for (var i = 0; i < 4; i++) {
                if (optInfo.options[i] && optInfo.texts[i]) {
                    simulateMouseClick(optInfo.options[i], onComplete);
                    return;
                }
            }
        } else if (qType === "spelling" || (qType === "unknown" && isSpellingInputVisible())) {
            try {
                var input = $_q(CFG.SPELLING_INPUT_SELECTOR);
                if (input && !input.disabled && !input.readOnly) {
                    setNativeValue(input, "?");
                    input.dispatchEvent(new Event("input", { bubbles: true }));
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                    clickSpellingSubmit(onComplete);
                    return;
                }
            } catch (e) {}
        }
        if (onComplete) onComplete();
    }, delay);

    HS._antiDetectTimers.push(preTid);
}

/* ================================================================
 * 模块 I — processQuestion (v6.0 团队对战版)
 * ================================================================ */

function processQuestion() {
    if (!acquireLock()) return;

    var t0 = CFG.PERF_LOG ? performance.now() : 0;
    var currentGen = HS._retryGen;

    var watchdog = setTimeout(function () {
        if (HS._processing && HS._retryGen === currentGen) {
            warn("看门狗触发 (" + CFG.PROCESSING_TIMEOUT + "ms)，强制释放锁");
            releaseLock();
        }
    }, CFG.PROCESSING_TIMEOUT);
    HS._watchdogTimers.push(watchdog);

    function clearWatchdog() {
        var idx = HS._watchdogTimers.indexOf(watchdog);
        if (idx !== -1) {
            clearTimeout(HS._watchdogTimers[idx]);
            HS._watchdogTimers.splice(idx, 1);
        }
    }

    function finalizeQuestion(perfLabel) {
        clearWatchdog();
        releaseLock();
        if (CFG.PERF_LOG && perfLabel) {
            console.log("[HS-TB] PERF " + perfLabel + " " + (performance.now() - t0).toFixed(1) + "ms");
        }
    }

    try {
        var questionText = getQuestionText();
        if (!questionText) {
            finalizeQuestion();
            return;
        }

        var qType = getQuestionType();
        HS._lastDomFingerprint = qType + "|" + questionText;
        if (HS._answerStats) HS._answerStats.total++;
        HS._answerCount++;

        if (qType === "def_to_word" || qType === "word_to_def") {
            // 选择题：释义选词 或 选词释义
            var lookupResult = lookupAnswerTeam(questionText, qType);

            if (!lookupResult.found) {
                HS.lastQuestionText = questionText;
                HS.lastQuestionType = qType;
                if (HS._answerStats) HS._answerStats.unknown++;
                handleUnknownQuestionTeam(function () {
                    finalizeQuestion("未知选择");
                });
                return;
            }

            if (HS._answerStats) HS._answerStats.matched++;

            var onSuccess = function () {
                HS.lastQuestionText = questionText;
                HS.lastQuestionType = qType;
                finalizeQuestion("选择(重试后)");
            };

            var onNotFound = function () {
                var fallback = setTimeout(function () {
                    if (HS._processing && HS._retryGen === currentGen) {
                        warn("选择题重试兜底超时");
                        finalizeQuestion();
                    }
                }, calcRetryDelay(CFG.MAX_RETRIES + 1) + 500);
                HS._watchdogTimers.push(fallback);
            };

            var ok = answerChoiceTeam(lookupResult, qType, CFG.MAX_RETRIES, onSuccess, currentGen, onNotFound);
            if (ok) {
                HS.lastQuestionText = questionText;
                HS.lastQuestionType = qType;
                return;
            }
            return;

        } else if (qType === "spelling") {
            // 拼写题
            var lookupResult = lookupAnswerTeam(questionText, qType);

            if (!lookupResult.found) {
                HS.lastQuestionText = questionText;
                HS.lastQuestionType = qType;
                if (HS._answerStats) HS._answerStats.unknown++;
                handleUnknownQuestionTeam(function () {
                    finalizeQuestion("未知拼写");
                });
                return;
            }

            if (HS._answerStats) HS._answerStats.matched++;

            answerSpelling(lookupResult, function () {
                HS.lastQuestionText = questionText;
                HS.lastQuestionType = qType;
                finalizeQuestion("拼写");
            });
            return;

        } else {
            // 未知题型，尝试推断
            if (isSpellingInputVisible()) {
                var lookupResult = lookupAnswerTeam(questionText, "spelling");
                if (lookupResult.found) {
                    answerSpelling(lookupResult, function () {
                        HS.lastQuestionText = questionText;
                        HS.lastQuestionType = qType;
                        finalizeQuestion("推断拼写");
                    });
                    return;
                }
            }

            var optInfo = getOptions();
            var hasVisibleOpts = false;
            for (var oi = 0; oi < 4; oi++) {
                if (optInfo.options[oi] && optInfo.texts[oi]) { hasVisibleOpts = true; break; }
            }
            if (hasVisibleOpts) {
                var lookupResult2 = lookupAnswerTeam(questionText, "def_to_word");
                if (!lookupResult2.found) lookupResult2 = lookupAnswerTeam(questionText, "word_to_def");
                if (lookupResult2.found) {
                    answerChoiceTeam(lookupResult2, "def_to_word", CFG.MAX_RETRIES, function () {
                        HS.lastQuestionText = questionText;
                        HS.lastQuestionType = qType;
                        finalizeQuestion("推断选择");
                    }, currentGen, function () {
                        finalizeQuestion("推断选择超时");
                    });
                    return;
                }
            }

            finalizeQuestion();
        }

    } catch (e) {
        warn("processQuestion 严重错误: " + e.message);
        clearWatchdog();
        releaseLock();
    }
}

/* ================================================================
 * 模块 J — MutationObserver (v6.0 适配)
 *
 * 监视 questionText, questionTypeBadge, opt_0~opt_3, spellingInput,
 * spellingSubmitBtn 等关键元素的 DOM 变化
 * ================================================================ */

function findObserverTarget() {
    return $_q(CFG.QUESTION_TEXT_SELECTOR)
        || $_q(CFG.QUESTION_TYPE_SELECTOR)
        || $_q(CFG.OPTION_SELECTORS[0])
        || $_q(CFG.SPELLING_INPUT_SELECTOR)
        || $_q(CFG.SPELLING_SUBMIT_SELECTOR)
        || document.body;
}

function isRelevantMutation(mutations) {
    var relevantIds = {
        "questionText": true, "questionTypeBadge": true,
        "opt_0": true, "opt_1": true, "opt_2": true, "opt_3": true,
        "spellingInput": true, "spellingSubmitBtn": true
    };

    for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        var target = m.target;

        if (target.id && relevantIds[target.id]) return true;

        var parent = target.parentElement;
        while (parent) {
            if (parent.id && relevantIds[parent.id]) return true;
            parent = parent.parentElement;
        }
    }
    return false;
}

function setupObserver() {
    if (HS._observer) {
        try { HS._observer.disconnect(); } catch (e) {}
        HS._observer = null;
    }

    HS._observeTarget = findObserverTarget();
    var debounceTimer = null;

    var mutationHandler = function (mutations) {
        if (!HS._pageVisible) return;
        if (HS._processing) return;
        if (HS._typingActive) return;
        if (!isRelevantMutation(mutations)) return;

        if (HS._observeTarget && !document.body.contains(HS._observeTarget)) {
            debug("观测目标已移除，重连Observer");
            setupObserver();
            return;
        }

        // 题目未变且无结构变更则跳过 (自身点击反馈去重)
        var questionText = getQuestionText();
        if (questionText && questionText === HS.lastQuestionText) {
            var hasStructuralChange = false;
            for (var mi = 0; mi < mutations.length; mi++) {
                var mm = mutations[mi];
                if (mm.type === "childList" && (mm.addedNodes.length > 0 || mm.removedNodes.length > 0)) {
                    hasStructuralChange = true;
                    break;
                }
            }
            if (!hasStructuralChange) {
                debug("Observer: 题目未变且无结构变更，跳过");
                return;
            }
            debug("Observer: 题目未变但检测到结构变更，放行");
        }

        if (debounceTimer) clearTimeout(debounceTimer);

        var debounceMs = CFG.OBSERVER_DEBOUNCE;
        if (CFG.ANTI_DETECT_ENABLED) {
            debounceMs += betweenQuestionDelay();
            var jitter = uniformRandom(-debounceMs * 0.3, debounceMs * 0.3);
            debounceMs = Math.max(8, Math.floor(debounceMs + jitter));
        }

        debounceTimer = setTimeout(function () {
            debounceTimer = null;

            if (CFG.RAF_DOUBLE_FRAME) {
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        processQuestion();
                    });
                });
            } else {
                requestAnimationFrame(function () {
                    processQuestion();
                });
            }
        }, debounceMs);
    };

    HS._observer = new MutationObserver(mutationHandler);

    HS._observer.observe(HS._observeTarget, {
        childList: true,
        subtree: true,
        attributes: false
    });
}

/* ================================================================
 * 模块 K — 页面可见性感知
 * ================================================================ */

function setupVisibilityHandler() {
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            HS._pageVisible = false;
            clearAllTimers();
            HS._processing = false;
            HS._typingActive = false;
            stopScrollJitter();
            debug("页面隐藏，暂停所有操作");
        } else {
            HS._pageVisible = true;
            debug("页面可见，恢复操作");
            startScrollJitter();
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    if (getQuestionText() && getQuestionText() !== HS.lastQuestionText) {
                        processQuestion();
                    }
                });
            });
        }
    });

    HS._pageVisible = !document.hidden;
}

/* ================================================================
 * 模块 L — v6.0: 初始化
 * ================================================================ */

function initAutoAnswer(retriesLeft) {
    if (retriesLeft === undefined) retriesLeft = CFG.MAX_RETRIES;

    if (HS._started) return;
    HS._started = true;

    var questionEl = $_q(CFG.QUESTION_TEXT_SELECTOR);
    var typeEl = $_q(CFG.QUESTION_TYPE_SELECTOR);

    if (!questionEl && !typeEl) {
        if (retriesLeft > 0) {
            var initDelay = calcRetryDelay(CFG.MAX_RETRIES - retriesLeft);
            setTimeout(function () {
                initAutoAnswer(retriesLeft - 1);
            }, initDelay);
            return;
        }
        warn("初始化超时：未检测到答题区域");
        return;
    }

    if (CFG.SPEED_PROFILE === "stealth" && !CFG.SCROLL_SIM_ENABLED) {
        CFG.SCROLL_SIM_ENABLED = true;
    }

    console.log("[HS-TB] TeamBattle v6.0 已启动 (模式:" + CFG.SPEED_PROFILE + ")"
        + (CFG.ANTI_DETECT_ENABLED ? " [反检测ON]" : "")
        + (CFG.PERF_LOG ? " [PERF]" : "")
        + (CFG.DEBUG_LOG ? " [DEBUG]" : "")
        + " — 支持题型: 释义选词/选词释义/拼写题");

    HS._virtualMouse.x = window.innerWidth / 2;
    HS._virtualMouse.y = window.innerHeight / 2;

    setupVisibilityHandler();
    setupObserver();
    startScrollJitter();

    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            processQuestion();
        });
    });
}

/* ================================================================
 * GM 菜单命令 — 诊断工具
 * ================================================================ */

(function registerGMMenus() {
    try {
        if (typeof GM_registerMenuCommand === "function") {
            GM_registerMenuCommand("[TB] 查看诊断日志", function () {
                console.log("[HS-TB 诊断] ========== TeamBattle v6.0 ==========");
                console.log("[HS-TB 诊断] 状态: processing=" + HS._processing + ", retryGen=" + HS._retryGen);
                console.log("[HS-TB 诊断] 上次题目: " + HS.lastQuestionText);
                console.log("[HS-TB 诊断] 上次题型: " + HS.lastQuestionType);
                console.log("[HS-TB 诊断] DOM指纹: " + HS._lastDomFingerprint);
                console.log("[HS-TB 诊断] 页面可见: " + HS._pageVisible);
                console.log("[HS-TB 诊断] 已启动: " + HS._started);
                console.log("[HS-TB 诊断] Observer: " + (HS._observer ? "已连接" : "未连接"));
                console.log("[HS-TB 诊断] cnToEn 大小: " + (HS.cnToEn ? HS.cnToEn.size : 0));
                console.log("[HS-TB 诊断] enToCn 大小: " + (HS.enToCn ? HS.enToCn.size : 0));
                console.log("[HS-TB 诊断] LRU 缓存: " + (HS._normCache ? HS._normCache.size : 0));
                console.log("[HS-TB 诊断] 反检测: " + (CFG.ANTI_DETECT_ENABLED ? "ON" : "OFF"));
                console.log("[HS-TB 诊断] 虚拟鼠标: (" + Math.round(HS._virtualMouse.x) + ", " + Math.round(HS._virtualMouse.y) + ")");
                console.log("[HS-TB 诊断] 连续失败: " + HS._consecutiveFails);
                console.log("[HS-TB 诊断] 反检测定时器: " + HS._antiDetectTimers.length);
                if (HS._answerStats) {
                    console.log("[HS-TB 统计] 总答题: " + HS._answerStats.total);
                    console.log("[HS-TB 统计] 匹配: " + HS._answerStats.matched);
                    console.log("[HS-TB 统计] 未知: " + HS._answerStats.unknown);
                }
                console.log("[HS-TB 诊断] ============================================");
            });

            GM_registerMenuCommand("[TB] 导出答题统计", function () {
                console.log("[HS-TB 导出] ========== 答题统计 ==========");
                if (HS._answerStats) {
                    console.log(JSON.stringify(HS._answerStats, null, 2));
                    var total = HS._answerStats.total || 1;
                    var accuracy = ((HS._answerStats.matched / total) * 100).toFixed(1);
                    console.log("[HS-TB 导出] 匹配率: " + accuracy + "% ("
                        + HS._answerStats.matched + "/" + total + ")");
                } else {
                    console.log("[HS-TB 导出] 暂无统计数据");
                }
                console.log("[HS-TB 导出] ===============================");
            });
        }
    } catch (e) {}
})();

/* ================================================================
 * 入口
 * ================================================================ */

(function () {
    "use strict";

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function (cb) { return setTimeout(cb, 16); };
    }

    HS._normCache = new Map();
    HS._answerStats = { total: 0, matched: 0, unknown: 0 };

    buildBidirectionalDict();

    if (HS.cnToEn.size === 0 && HS.enToCn.size === 0) {
        warn("双向词典为空，脚本不会执行");
        return;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            initAutoAnswer();
        });
    } else {
        initAutoAnswer();
    }
})();

/* ================================================================
 * 更新日志
 * ================================================================
 *
 * v6.0.1 (2026-06-13) — Bugfix & Cleanup
 *
 * 修复:
 *   [Bug]   handleUnknownQuestionTeam 缺少 recordConsecutiveFail() 调用，连续失败统计不准确
 *   [Bug]   processQuestion 未知题型推断路径 answerChoiceTeam 缺少 onNotFound 回调，导致锁超时
 *   [Bug]   answerSpelling originals 为空时无回退，现已回退至 answers
 *   [Fix]   _lastDomFingerprint 现由 processQuestion 维护，诊断工具不再显示空值
 *   [Fix]   isChineseChar 扩展覆盖 CJK Extension A / Compatibility Ideographs 完整范围
 *   [Clean] 移除未使用的 HS._optCache, HS._lastAnswerTime 及 $_qa 函数
 *
 * v6.0.0 (2026-06-13) — 团队对战版
 *
 * 核心变更:
 *   [URL]   @match 限定为 https://175.178.248.67/game/team_battle/*
 *   [词典]  新增 buildBidirectionalDict() 构建 cnToEn / enToCn 双向映射
 *           基于 hasChinese() 自动识别 key/value 中的中文侧
 *           支持原始 dict 中英→中、中→英、中→[英] 三种格式
 *
 *   [题型]  三种题型全覆盖:
 *           - 释义选词 (def_to_word): 中文题目 → cnToEn 查找 → 匹配英文选项
 *           - 选词释义 (word_to_def): 英文题目 → enToCn 查找 → 匹配中文选项
 *           - 拼写题 (spelling):     中文题目 → cnToEn 查找 → 逐字符输入英文
 *
 *   [选择器] 适配 team_battle 页面:
 *           - 题目文本: #questionText
 *           - 题型标签: #questionTypeBadge (释义选词/选词释义/拼写题)
 *           - 选项:     #opt_0, #opt_1, #opt_2, #opt_3
 *           - 拼写输入: #spellingInput
 *           - 提交按钮: #spellingSubmitBtn
 *
 *   [查词]  lookupAnswerTeam() 根据题型选择对应词典方向查询
 *           支持精确匹配 + 模糊匹配 (indexOf / containsWord)
 *
 *   [保留]  全部 v5.x 反检测基础设施:
 *           - smartDelay / simulateMouseClick / simulateTyping
 *           - normalRandom / Box-Muller 正态分布延迟
 *           - 增强重试 + 长暂停 + 看门狗
 *           - MutationObserver 防抖 + rAF 双帧
 *           - 滚动模拟 / 页面可见性感知
 *           - GM 菜单诊断工具
 */
