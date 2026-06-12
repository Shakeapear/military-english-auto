// ==UserScript==
// @name         军事英语自动答题助手-Performance v3.0
// @namespace    https://github.com/Shakeapear/military-english-auto
// @version      3.0.0
// @description  军事英语词汇自动答题脚本 — 性能版 3.0：~30ms/题，P0-P2 全量优化
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
 * This file is part of version 3.0 (Performance).
 */

"use strict";

/* ================================================================
 * 模块 A — 用户可配置区域
 * ================================================================ */

var CFG = {
    QUESTION_SELECTOR:      "#questionText",
    QUESTION_TYPE_SELECTOR: "#questionType",
    OPTIONS_GRID_SELECTOR:  "#optionsGrid",
    FILL_INPUT_SELECTOR:    "#spellingInput",
    NEXT_BUTTON_SELECTOR:   "#optionsGrid > button",

    MAX_RETRIES:        3,
    RETRY_INTERVAL:     50,     // ms
    RETRY_BACKOFF_MUL:  1.8,    // 重试间隔指数退避倍率
    SKIP_UNKNOWN:       true,
    PROCESSING_TIMEOUT: 4000,   // ms — 看门狗超时

    OBSERVER_DEBOUNCE:  25,     // ms — MutationObserver 防抖
    RAF_DOUBLE_FRAME:   true,   // true=双帧rAF确保布局完成, false=单帧

    NORM_CACHE_SIZE:    64,     // normalizeText LRU 缓存容量

    PERF_LOG: false,            // 每道题耗时至控制台
    DEBUG_LOG: false            // 详细调试日志
};

/* ================================================================
 * 模块 B — 题库字典
 * ================================================================ */

var dict = {"active service":"现役","air defense":"防空","Air Force":"空军","aircraft carrier":"航空母舰","airlift":"空运","airman":"空军士兵，飞行员","amphibious":"两栖作战的；水陆两用的；两栖的","arm":"兵种；武器；武装"
  ,"armor":"装甲；装甲兵；装甲部队","Army":"陆军（首字母常用大写）；军队；集团军","Army National Guard":"(美)陆军国民警卫队","Army Reserve":"(美)陆军预备役","arsenal":"武器库；军火库；兵工厂","artillery":"炮兵；火炮","aviation":"航空兵","bomber":"轰炸机"
  ,"cavalry":"骑兵；高度机动的地面部队","Coast Guard":"海岸警卫队","combat arms":"作战部队","combat arms support":"作战支援部队","combat service support":"作战支援保障部队","corps":"军；军团；特殊兵种；部队","Department of War":"（美）战争部"
  ,"drone":"无人机","engineer":"工兵","fleet":"舰队；（飞机的）机队","guardian":"（美）太空军士兵","helicopter":"直升机","intelligence":"情报","joint force":"联合部队","joint operations":"联合作战","logistics":"后勤；后勤学"
  ,"marine":"海军陆战队员；海上的；海事的","Marine Corps":"海军陆战队","Navy":"海军","ordnance":"军械","propulsion":"推进","quartermaster":"军需","reconnaissance":"侦察（正式）","sailor":"海军士兵，水兵","sensor":"传感器","service":"军种；服役"
  ,"signal":"通信兵","Space Command":"（美）太空司令部","Space Force":"(美)太空军","special forces":"特种部队","squadron":"中队","stealth":"隐形","submarine":"潜艇","surveillance":"监视","address":"称呼","admiral":"（海军）上将"
  ,"brigadier general":"（陆、空、海军陆战队）准将","captain":"（陆、空、海军陆战队）上尉；（海军）上校","colonel":"（陆、空、海军陆战队）上校","command sergeant major":"（美陆军）一级军士长（指挥）","commander":"（海军）中校","Commissioned Officer":"军官"
  ,"corporal":"下士","enlisted":"士兵","ensign":"（海军）少尉","etiquette":"礼节","first sergeant":"（美陆军）二级军士长（指挥）","general":"（陆、空、海军陆战队）上将","lieutenant":"（陆、空、海军陆战队）中尉；（海军）上尉"
  ,"lieutenant colonel":"（陆、空、海军陆战队）中校","lieutenant commander":"(海军)少校","lieutenant general":"（陆、海、海军陆战队）中将","lieutenant junior grade":"(海军)中尉","major":"（陆、空、海军陆战队）少校"
  ,"major general":"（陆、海、海军陆战队）少将","master sergeant":"（美陆军）二级军士长（机关）","Non-Commissioned Officer":"士官","private":"列兵","private first class":"上等兵","promote":"晋升","rear admiral lower half":"（海军）准将"
  ,"rear admiral upper half":"(海军)少将","salute":"敬礼","second lieutenant":"（陆、空、海军陆战队）少尉","sergeant":"军士；（美陆军、海军陆战队）中士","sergeant first class":"(美陆军)三级军士长","sergeant major":"(美)陆军一级军士长（机关）"
  ,"sergeant major of the army":"（美陆军）总军士长","serve":"服役","specialist":"专业兵；专业军士","staff sergeant":"（美陆军、海军陆战队）上士；（美空军）中士","subordinate":"下级；下属","superior":"上级；长官","vice admiral":"（海军）中将"
  ,"warrant officer":"文职人员","allowance":"津贴","authorize":"授权，批准","breastplate":"胸甲","camaraderie":"友情；情谊","camouflage":"迷彩","chain mail":"锁子甲","chevron":"V形线条","combat uniform":"作训服"
  ,"dress uniform":"礼服","helmet":"头盔","insignia":"勋章；佩章；徽章；标记；识别符号","khaki":"卡其色；卡其布","lapel":"翻领","long-sleeve":"长袖","marksman":"射击能手；神枪手","marksmanship":"枪法；射击术","medal ribbon":"勋章授带"
  ,"morale":"士气；民心；斗志","name plate":"姓名牌","nylon":"尼龙","pants":"裤子","petty officer":"海军士官；海军军士","physical training uniform":"体能服","pleat":"褶皱，裤褶","polyester":"聚酯纤维，涤纶","service cap":"军帽；大檐帽"
  ,"short-sleeve":"短袖","shoulder badge":"肩章","stripe":"条纹","battalion":"营","brigade":"旅","chain of command":"指挥系统；指挥关系；指挥链","chief of staff(COS)":"参谋长","division":"师","flight":"（飞行）小队；机群"
  ,"flotilla":"（小）舰队；（小）船队；纵队","group":"大队","Joint Chiefs of Staff":"参谋长联席会议","marine expeditionary brigade":"美国海军陆战队远征旅","pentagon":"（美）国防部","platoon":"排","regiment":"团","squad":"班"
  ,"staff":"参谋人员；参谋机构；参谋部","Task Element":"特混支队","wing":"空军联队；航空兵联队；侧翼部队","Civil-Military Cooperation(CIMIC)":"军民合作","commanding officer":"指挥官；舰长；主官","Direct Reporting Unit":"直属单位"
  ,"director of staff":"参谋部主任","executive officer(XO)":"执行官；副舰长；副职指挥员","headquarters":"司令部；指挥部；总部","Joint Operations Command Center":"联合作战指挥中心","Joint Staff Department(JSD)":"联合参谋部","liaison":"联络"
  ,"North Atlantic Treaty Organization":"北大西洋公约组织（北约）","Protocol Chief":"礼宾处处长","Public Information Office":"新闻处","addressee":"收信人；收件人","Blind Carbon Copy":"密件抄送；密送","boulevard":"大街；（市区的）林荫大道"
  ,"Carbon copy/ Courtesy copy":"抄送","classified":"列入密级的；保密的","complimentary close":"结尾客套语","confidential":"机密","copies furnished":"提供的副本","cryptology":"密码术","declassify":"解密","enclosure":"附件"
  ,"facsimile":"传真","interim":"暂时的；过渡的","memorandum":"备忘录","mobilization":"动员（尤指战时）","Official Use Only":"官方填写；仅供官方使用","point of contact":"联系人","Regrets Only":"如不能出席请务必回复","salutation":"称呼；称谓"
  ,"See Distribution":"见收件人清单","template":"模板","terminate":"终止；使停止","air-to-air missile":"空空导弹；空战导弹","barrel":"枪管；炮筒","buttstock":"枪托","caliber":"（枪、炮等的）口径","cannon":"火炮；加农炮；机关炮"
  ,"ceiling":"升限；射高；（飞机）舱顶","combat boots":"作战靴","corvette":"轻型护卫舰;轻巡洋舰","cruiser":"巡洋舰","destroyer":"驱逐舰","displacement":"（舰船）排水量","draft":"征兵；(船的）吃水深度","exoskeleton":"外骨骼","feed":"进弹，装弹，送弹"
  ,"fighter":"战斗机；歼击机；斗士；战斗员","frigate":"护卫舰","goggles":"护目镜","grenade":"手雷；手榴弹；枪榴弹","grip":"握把","handle":"手柄，把手","howitzer":"榴弹炮","hull":"壳体（坦克、自行火炮、舰艇等的主要结构）"
  ,"Infantry Fighting Vehicle(IFV)":"步兵战车","javelon":"标枪，投枪","lever":"杠杆，手柄","machinegun":"机枪；机关枪","magazine":"弹匣；弹仓","main battle tank(MBT)":"主战坦克","mortar":"迫击炮","muzzle":"枪口；炮口","pistol":"手枪"
  ,"projectile":"弹丸；炮弹；射弹","range":"射程；靶场；射击场","rifle":"来复枪；步枪；膛线","rocket launcher":"火箭炮；火箭发射器","round":"一发（弹），整发弹；一轮","safety":"安全设备，保险装置","sight":"瞄准具；观测器；瞄准","small arms":"轻武器"
  ,"specification":"性能表，规格，规范","surface vessel":"水面舰艇","surface-to-air missile":"地对空导弹；舰对空导弹","tandem":"串列的，串联的；（飞机）串座式的","trajectory":"轨道；弹道","algorithm":"算法，运算法则"
  ,"artificial intelligence":"人工智能","big data":"大数据","carbon fiber":"碳纤维","Directed Energy Weapon":"定向能武器","electromagnetic spectrum":"电磁波谱","Head Up Display":"平视显示器"
  ,"high-energy laser system":"高能激光系统","high-powered microwave system":"高功率微波系统","hornet":"大黄蜂","laser beam":"激光束","payload":"战斗部","propeller":"推进器","rucksack":"帆布背包"
  ,"situational awareness":"态势感知","swarm":"蜂群","synthetic aperture radar":"合成孔径雷达","trauma":"精神创伤，心理创伤；损伤，外伤","turret":"炮塔","alumni":"校友","assign":"编入建制；委派；任命；指派","cadet":"（军校）学员"
  ,"conscript":"义务兵；被征召入伍者；征召；招募","demote":"降衔（级）","discharge":"退伍；退役","drill":"队列训练；操练","elite":"尖子，精英","enlist":"征募；参军；入伍","foster":"培养","honor code":"行为准则","lethal":"致命的"
  ,"military academy":"军事院校","nomination":"提名","tuition":"学费","volunteer":"志愿兵；志愿军人","wield":"运用，使用","anti-personnel mine":"反步兵地雷；杀伤性地雷","barbed wire":"铁丝网","basic training":"新兵训练"
  ,"beam":"梁、横梁；（体操的）平衡木","boot camp":"新兵（训练）营；新兵训练中心","cardio":"有氧运动","cargo net":"绳网","casualty":"伤亡人员；（常用复数）伤亡人数","combined training":"协同训练；联合训练","ditch":"壕沟","fence":"栅栏","foot march":"徒步行军"
  ,"individual training":"单兵训练","infiltration":"渗透；潜入","joint training":"联合训练；","log":"圆木","Nuclear, biological and chemical (NBC) protection":"核生化防护","obstacle course":"障碍训练（场）"
  ,"Physical Fitness Test":"体能测试","pull-up":"引体向上","push-up":"俯卧撑","ramp":"斜坡，坡道","resilience":"弹性；韧性","sit-up":"仰卧起坐","sprint":"冲刺、短跑","tunnel":"坑道","vault":"跳跃，跃过","workout":"锻炼；训练"
  ,"accommodate":"使适应, 顺应","cliff":"悬崖","contour line":"等高线","coordinate":"使协调; 使调和","depression":"洼地","draw":"山坳","elevation":"海拔","entangle":"使某人缠绕","hard duty":"重型负载","hill":"小山"
  ,"horizontal":"水平的, 与地平线平行的","improved road":"铺装路面","intermittent stream":"间歇河流","latitude":"纬度","legend":"图例","longitude":"经度","marsh":"湿地；沼泽","Military Grid Reference System":"军事网格坐标"
  ,"orchard":"果园","plot":"绘制; 标出","precipitous":"险峻的, 陡峭的","relief":"地形；（地形的）凹凸","ridge":"山脊","saddle":"鞍部","spur":"尖坡","swamp":"沼泽（地）","temporize":"顺应时势,迎合潮流;拖延，耽搁","terrain":"地形；地势"
  ,"topographic":"地形的","valley":"山谷","vertical":"垂直的，直立的","woods":"树林","callsign":"无线电通联呼号","chronological":"按发生时间顺序排列的","clear":"音质清晰","comply":"服从,顺从","digit":"（零到九中的任一）数字","dismount":"下车"
  ,"distorted":"声音失真","dog tag":"狗牌：美军脖子上的一块小金属牌刻有姓名编号","fading":"信号变弱","figure":"数字","good":"信号好","grid":"坐标网格","interference":"信号有干扰","intermittent":"信号时有时无","k-i-a":"阵亡","loud":"信号强"
  ,"midday":"中午，正午","military alphabet":"军用字母表","misinterpretation":"曲解","nothing heard":"听不见","proword":"无线电通联规范用语","radio check":"电台检查","readability":"信号音质","readable":"可以听清","recce":"侦察（非正式）"
  ,"roger":"已收到，明白","signal strength":"信号强度","situation report":"军情报告","transmit":"（无线电等信号的）播送，发送","waypoint":"路径；路标","weak":"信号弱","ambush":"伏击","ammo":"弹药;军火","assault position":"冲锋出发阵地"
  ,"attachment":"配属部队","attack position":"进攻出发阵地","chow":"食物","combat order":"战斗命令","concept of operations":"作战概念","consolidate":"巩固，加强","corpsman":"医护兵;卫生员","counterattack":"反击;反攻"
  ,"detachment":"分遣队","disrupt":"扰乱;瓦解","Enemy Prisoner of War":"战俘","fire team":"火力小组","flank":"翼侧;侧面","fragmentary order":"补充命令","gunnery sergeant":"枪炮军士","harassing attack":"扰乱攻击"
  ,"inflict":"使遭受;使承受","instruction":"指令","insurgent":"叛乱","line of departure":"起始线;出发线","main effort":"主攻部队","operations order":"作战命令","order":"命令","allergy":"过敏；敏感","arterial":"动脉的"
  ,"automated external defibrillator":"自动体外除颤器","band":"段；带，箍；带状物","bandage":"绷带","blockage":"堵塞，阻塞","cardiac arrest":"心脏骤停","cardiopulmonary resuscitation(CPR)":"心肺复苏术"
  ,"casualty evacuation":"伤病员后送","chest seal":"胸腔密封贴，胸封","circulation":"血液循环","clammy":"湿粘的；湿冷的","clip":"夹子","coma":"昏迷","compression":"胸部按压","deprivation":"贫困，匮乏，剥夺","deterioration":"恶化"
  ,"disposable":"一次性的","distal pulse":"远端脉搏","evacuate":"撤离；疏散","first aid":"急救","fracture":"断裂；骨折","gauze":"纱布；薄纱；","hoist":"升降机；绞车","infrared strobes":"红外线频闪灯","kit":"成套工具，成套设备；箱子"
  ,"medical evacuation":"医疗后送","nasopharyngeal airway":"鼻咽导气管","Nuclear, Biological and Chemical Contamination":"核生化污染","onset":"（尤指某种坏事情的）开始；发作","oral rehydration salts":"口服补液盐","rod":"棒，杆"
  ,"shrapnel":"弹片；榴霰弹","spasm":"痉挛，抽搐","splint":"（固定断骨的）夹板","standard operating procedure":"标准作战程序；标准作业程序","strap":"带子；皮带","surgical gloves":"外科手套；手术手套；医用手套","tourniquet":"止血带","underbrush":"矮树丛"
  ,"ventilator":"人工呼吸器","ammo pouch":"弹药袋","assault":"攻击或袭击（敌方阵地）","breakdown":"（机器的）故障","bunker":"掩体；地堡；暗堡","canteen":"水壶","compromise":"失密；泄密；暴露","covert":"隐密的","dead reckoning":"航位推算法"
  ,"detect":"发现；探测","discretion":"谨慎；慎重","dispatch":"派遣","distress signal":"遇险求救信号；遇难信号","emplacement":"炮火掩体；炮位","extract":"撤出（作战区域）；撤离","first aid kit":"急救包","flak vest":"防弹背心"
  ,"folding shovel":"折叠锹","fortification":"防御工事","harass":"屡次袭扰（敌人）","litter":"担架","man":"保卫（防御工事）","neutralize":"（在军事或秘密行动中）消除威胁；摧毁","overrun":"占领","oversee":"监督；管理","patrol pack":"巡逻背包"
  ,"raid":"突击","ration":"口粮；给养","reinforce":"增援","rotate":"轮流；轮换；轮岗","sustain":"作战保障；战斗保障","synchronize":"同步；协调","vigilance":"警戒；警惕","webbing":"背带，挂带","Armored Personnel Carrier":"人员装甲运输车"
  ,"checkpoint":"检查站，关卡","civilian":"平民，百姓；平民的","contingency":"突发事件","convoy":"车队；护送；护卫","crossroad":"十字路口","curve":"弯道","Deputy Commander":"副指挥官","escort":"护送，陪同；护航舰；护卫队；护送者"
  ,"estimated time of arrival":"预计到达时间","halt":"停止；立定","hostile":"敌对，敌方的；怀敌意的","humanitarian aid":"人道主义救援","junction":"岔路口","release point":"分进点","reporting point":"报告点","roundabout":"环岛"
  ,"scout group/team":"侦察组","shipment":"运送","signpost":"指示牌","start point":"出发点","strip map":"带状图","tactic":"策略，战术","anti-terrorism drill":"反恐演习","Blue Sword-2023":"蓝剑-2023","catastrophe":"灾难"
  ,"Cobra Gold-2024":"金色眼镜蛇-2024","combined training exercise":"多国合成训练演习","Command Post Exercise":"指挥所演习","Counter-Terrorism Field Training Exercise-2023":"反恐实兵演习-2023","cyber exercise":"网络演习"
  ,"Eagle Strike-2024":"雄鹰突击-2024","field training exercise":"野战训练演习","fire coordination exercise":"火力协调演习","hedging strategy":"对冲策略","joint exercise":"联合军演","map exercise":"地图推演"
  ,"masquerade":"掩饰","Peace Angel-2023":"和平天使-2023","prioritize":"优先","Pure Homeland-2023":"净土-2023","situational exercise":"情景训练演习","staff exercise":"参谋人员演习","table top exercise":"桌面推演"
  ,"the 10th Mountain Division":"第十山地师","bulldozer":"推土机","clearing mines or ordnance":"扫雷排爆","crane":"起重机","disaster relief":"减灾；赈灾","distribution of relief items":"分发救济品","drought":"干旱；旱灾"
  ,"dump truck":"自动倾卸卡车、翻斗车","earthquake":"地震","emergency medical assistance":"紧急医疗援助","excavator":"挖掘机","famine":"饥荒","humanitarian crisis":"人道主义危机","hurricane":"飓风","landslide":"山体滑坡；塌方"
  ,"loader":"装载机","long-term food aid":"长期粮食援助","medical assistance":"医疗援助","non-governmental organization":"非政府组织","Office for the Coordination of Humanitarian Affairs(OCHA)":"人道主义事务协调办公室"
  ,"providing medical assistance":"提供医疗救助","re-establishing infrastructure":"重建基础设施","reconstruction":"重建","relocation of victims":"灾民转移","sandstorm":"沙暴；沙尘暴","snowstorm":"雪暴；暴风雪","tsunami":"海啸"
  ,"UN Children's Fund":"联合国儿童基金会","wildfire":"野火","World Food Programme":"世界粮食计划署","alleviate":"减轻，缓和","ambivalence":"矛盾情绪；正反感情并存","armistice":"休战协议","blemish":"瑕疵","Blue Beret":"蓝色贝雷帽；维和人员"
  ,"buffer zone":"缓冲区：中立区","ceasefire":"停火协议","configuration":"布局，构造；配置","consent":"同意","dearth":"缺乏","demining":"扫雷","disarmament":"裁军；缴械","disinformation":"虚假信息","geopolitics":"地缘政治"
  ,"impartiality":"公正","inactivity":"不作为","landmine":"地雷","legitimacy":"合法性，合理性","leverage":"利用","mandate":"授权，委托","mediation":"调解，仲裁","mine clearance":"扫雷，排雷","mission":"特派团"
  ,"multi-dimensional":"多层面","neutrality":"中立","peacekeeping":"维和","proportionate":"成比例的；相称的；适当的","reconciliation":"和解；复交","referendum":"全民投票","refugee":"难民，避难者","regime":"政权"
  ,"rehabilitation":"复原；恢复；修复","Rules of Engagement(ROE)":"交战规则","sideline":"边线；副业","spill-over":"溢出 ; 外溢","supervise":"指导，监督","truce":"停战（或停火）","UN Charter":"联合国宪章","unpko":"联合国维和行动"
  ,"withdrawal":"撤退","accord":"使受到，给予（某种待遇）","animosity":"仇恨，敌意","area of responsibility":"责任区","armed escort":"武装护卫","assessment":"评估，评价，评定","Code of Conduct":"行为准则","compile":"收集，搜集（信息，资料）"
  ,"contingent troop":"维和分队","demobilization":"复员，遣散","demonstration":"示威","discontent":"不满","dispute":"争论，纠纷，争夺","engagement":"参加，从事","immunity":"免除，豁免","ingenuity":"聪明才智，巧妙"
  ,"intermediation":"调解，仲裁，调停","liaise":"联络，沟通","military observer":"军事观察员","monitor":"监督，监控，监视","negotiation":"谈判，协商，","outreach":"外联","Post Exchange":"军营超市","radio net":"无线电通信网络"
  ,"roadblock":"路障，障碍物","team site":"观察员营地","verify":"证实，证明，核实","brigadier general(abbr.)":"BG","captain(abbr.)":"CPT","colonel(abbr.)":"COL","Department of the Air Force(abbr.)":"DAF"
  ,"Department of War(abbr.)":"DoW","general(abbr.)":"GEN","lieutenant colonel(abbr.)":"LTC","lieutenant general(abbr.)":"LG","lieutenant(abbr.)":"LT","major general(abbr.)":"MG"
  ,"major(abbr.)":"MAJ","second lieutenant(abbr.)":"2LT","Space Command(abbr.)":"SPC","(海军)少将":"rear admiral upper half","(海军)少校":"lieutenant commander","(海军)中尉":"lieutenant junior grade"
  ,"(美)陆军国民警卫队":"Army National Guard","(美)陆军一级军士长（机关）":"sergeant major","(美)陆军预备役":"Army Reserve","(美)太空军":"Space Force","(美陆军)三级军士长":"sergeant first class","（飞行）小队；机群":"flight"
  ,"（固定断骨的）夹板":"splint","（海军）上将":"admiral","（海军）少尉":"ensign","（海军）中将":"vice admiral","（海军）中校":"commander","（海军）准将":"rear admiral lower half","（机器的）故障":"breakdown","（舰船）排水量":"displacement"
  ,"（军校）学员":"cadet","（零到九中的任一）数字":"digit","（陆、海、海军陆战队）少将":"major general","（陆、海、海军陆战队）中将":"lieutenant general","（陆、空、海军陆战队）上将":"general","（陆、空、海军陆战队）上尉；（海军）上校":"captain","（陆、空、海军陆战队）上校":"colonel"
  ,"（陆、空、海军陆战队）少尉":"second lieutenant","（陆、空、海军陆战队）少校":"major","（陆、空、海军陆战队）中尉；（海军）上尉":"lieutenant","（陆、空、海军陆战队）中校":"lieutenant colonel","（陆、空、海军陆战队）准将":"brigadier general","（美）国防部":"pentagon"
  ,"（美）太空军士兵":"guardian","（美）太空司令部":"Space Command","（美）战争部":"Department of War","（美陆军、海军陆战队）上士；（美空军）中士":"staff sergeant","（美陆军）二级军士长（机关）":"master sergeant","（美陆军）二级军士长（指挥）":"first sergeant"
  ,"（美陆军）一级军士长（指挥）":"command sergeant major","（美陆军）总军士长":"sergeant major of the army","（枪、炮等的）口径":"caliber","（无线电等信号的）播送，发送":"transmit","（小）舰队；（小）船队；纵队":"flotilla","（尤指某种坏事情的）开始；发作":"onset"
  ,"（在军事或秘密行动中）消除威胁；摧毁":"neutralize","2LT":"second lieutenant(abbr.)","矮树丛":"underbrush","安全设备，保险装置":"safety","鞍部":"saddle","按发生时间顺序排列的":"chronological","班":"squad","棒，杆":"rod","保卫（防御工事）":"man"
  ,"报告点":"reporting point","北大西洋公约组织（北约）":"North Atlantic Treaty Organization","备忘录":"memorandum","背带，挂带":"webbing","绷带":"bandage","鼻咽导气管":"nasopharyngeal airway","边线；副业":"sideline"
  ,"编入建制；委派；任命；指派":"assign","标枪，投枪":"javelon","标准作战程序；标准作业程序":"standard operating procedure","兵种；武器；武装":"arm","补充命令":"fragmentary order","不满":"discontent","不作为":"inactivity"
  ,"布局，构造；配置":"configuration","步兵战车":"Infantry Fighting Vehicle(IFV)","裁军；缴械":"disarmament","参加，从事":"engagement","参谋部主任":"director of staff","参谋人员；参谋机构；参谋部":"staff","参谋人员演习":"staff exercise"
  ,"参谋长":"chief of staff(COS)","参谋长联席会议":"Joint Chiefs of Staff","策略，战术":"tactic","岔路口":"junction","抄送":"Carbon copy/ Courtesy copy","车队；护送；护卫":"convoy","撤出（作战区域）；撤离":"extract","撤离；疏散":"evacuate"
  ,"撤退":"withdrawal","称呼":"address","称呼；称谓":"salutation","成比例的；相称的；适当的":"proportionate","成套工具，成套设备；箱子":"kit","冲刺、短跑":"sprint","冲锋出发阵地":"assault position","仇恨，敌意":"animosity","出发点":"start point"
  ,"传感器":"sensor","传真":"facsimile","串列的，串联的；（飞机）串座式的":"tandem","垂直的，直立的":"vertical","聪明才智，巧妙":"ingenuity","大队":"group","大黄蜂":"hornet","大街；（市区的）林荫大道":"boulevard","大数据":"big data","带状图":"strip map"
  ,"带子；皮带":"strap","单兵训练":"individual training","担架":"litter","弹片；榴霰弹":"shrapnel","弹丸；炮弹；射弹":"projectile","弹匣；弹仓":"magazine","弹性；韧性":"resilience","弹药;军火":"ammo","弹药袋":"ammo pouch"
  ,"地对空导弹；舰对空导弹":"surface-to-air missile","地雷":"landmine","地图推演":"map exercise","地形；（地形的）凹凸":"relief","地形；地势":"terrain","地形的":"topographic","地缘政治":"geopolitics","地震":"earthquake"
  ,"等高线":"contour line","敌对，敌方的；怀敌意的":"hostile","第十山地师":"the 10th Mountain Division","电磁波谱":"electromagnetic spectrum","电台检查":"radio check","调解，仲裁":"mediation","调解，仲裁，调停":"intermediation"
  ,"定向能武器":"Directed Energy Weapon","动脉的":"arterial","动员（尤指战时）":"mobilization","堵塞，阻塞":"blockage","短袖":"short-sleeve","段；带，箍；带状物":"band","断裂；骨折":"fracture","锻炼；训练":"workout","队列训练；操练":"drill"
  ,"对冲策略":"hedging strategy","多层面":"multi-dimensional","多国合成训练演习":"combined training exercise","恶化":"deterioration","发现；探测":"detect","帆布背包":"rucksack","翻领":"lapel"
  ,"反步兵地雷；杀伤性地雷":"anti-personnel mine","反击;反攻":"counterattack","反恐实兵演习-2023":"Counter-Terrorism Field Training Exercise-2023","反恐演习":"anti-terrorism drill","防弹背心":"flak vest","防空":"air defense"
  ,"防御工事":"fortification","非政府组织":"non-governmental organization","分发救济品":"distribution of relief items","分进点":"release point","分遣队":"detachment","蜂群":"swarm","伏击":"ambush","服从,顺从":"comply"
  ,"服役":"serve","俯卧撑":"push-up","附件":"enclosure","复员，遣散":"demobilization","复原；恢复；修复":"rehabilitation","副指挥官":"Deputy Commander","干旱；旱灾":"drought","杠杆，手柄":"lever"
  ,"高功率微波系统":"high-powered microwave system","高能激光系统":"high-energy laser system","工兵":"engineer","公正":"impartiality","攻击或袭击（敌方阵地）":"assault","巩固，加强":"consolidate","狗牌：美军脖子上的一块小金属牌刻有姓名编号":"dog tag"
  ,"观察员营地":"team site","官方填写；仅供官方使用":"Official Use Only","轨道；弹道":"trajectory","果园":"orchard","过敏；敏感":"allergy","海岸警卫队":"Coast Guard","海拔":"elevation","海军":"Navy","海军陆战队":"Marine Corps"
  ,"海军陆战队员；海上的；海事的":"marine","海军士兵，水兵":"sailor","海军士官；海军军士":"petty officer","海啸":"tsunami","航空兵":"aviation","航空母舰":"aircraft carrier","航位推算法":"dead reckoning","壕沟":"ditch"
  ,"合成孔径雷达":"synthetic aperture radar","合法性，合理性":"legitimacy","和解；复交":"reconciliation","和平天使-2023":"Peace Angel-2023","核生化防护":"Nuclear, biological and chemical (NBC) protection"
  ,"核生化污染":"Nuclear, Biological and Chemical Contamination","轰炸机":"bomber","红外线频闪灯":"infrared strobes","后勤；后勤学":"logistics","护目镜":"goggles","护送，陪同；护航舰；护卫队；护送者":"escort","护卫舰":"frigate"
  ,"环岛":"roundabout","缓冲区：中立区":"buffer zone","绘制; 标出":"plot","昏迷":"coma","火箭炮；火箭发射器":"rocket launcher","火力小组":"fire team","火力协调演习":"fire coordination exercise","火炮；加农炮；机关炮":"cannon","饥荒":"famine"
  ,"机密":"confidential","机枪；机关枪":"machinegun","激光束":"laser beam","急救":"first aid","急救包":"first aid kit","夹子":"clip","尖坡":"spur","尖子，精英":"elite","间歇河流":"intermittent stream","肩章":"shoulder badge"
  ,"监督，监控，监视":"monitor","监督；管理":"oversee","监视":"surveillance","减轻，缓和":"alleviate","减灾；赈灾":"disaster relief","检查站，关卡":"checkpoint","见收件人清单":"See Distribution","舰队；（飞机的）机队":"fleet","降衔（级）":"demote"
  ,"交战规则":"Rules of Engagement(ROE)","结尾客套语":"complimentary close","解密":"declassify","金色眼镜蛇-2024":"Cobra Gold-2024","津贴":"allowance","紧急医疗援助":"emergency medical assistance","谨慎；慎重":"discretion"
  ,"进弹，装弹，送弹":"feed","进攻出发阵地":"attack position","晋升":"promote","经度":"longitude","精神创伤，心理创伤；损伤，外伤":"trauma","警戒；警惕":"vigilance","净土-2023":"Pure Homeland-2023","痉挛，抽搐":"spasm","敬礼":"salute"
  ,"飓风":"hurricane","聚酯纤维，涤纶":"polyester","军；军团；特殊兵种；部队":"corps","军官":"Commissioned Officer","军帽；大檐帽":"service cap","军民合作":"Civil-Military Cooperation(CIMIC)","军情报告":"situation report"
  ,"军士；（美陆军、海军陆战队）中士":"sergeant","军事观察员":"military observer","军事网格坐标":"Military Grid Reference System","军事院校":"military academy","军械":"ordnance","军需":"quartermaster","军营超市":"Post Exchange"
  ,"军用字母表":"military alphabet","军种；服役":"service","卡其色；卡其布":"khaki","壳体（坦克、自行火炮、舰艇等的主要结构）":"hull","可以听清":"readable","坑道":"tunnel","空军":"Air Force","空军联队；航空兵联队；侧翼部队":"wing","空军士兵，飞行员":"airman"
  ,"空空导弹；空战导弹":"air-to-air missile","空运":"airlift","口服补液盐":"oral rehydration salts","口粮；给养":"ration","裤子":"pants","来复枪；步枪；膛线":"rifle","蓝剑-2023":"Blue Sword-2023","蓝色贝雷帽；维和人员":"Blue Beret"
  ,"礼宾处处长":"Protocol Chief","礼服":"dress uniform","礼节":"etiquette","利用":"leverage","联合部队":"joint force","联合参谋部":"Joint Staff Department(JSD)","联合国儿童基金会":"UN Children's Fund","联合国维和行动":"unpko"
  ,"联合国宪章":"UN Charter","联合军演":"joint exercise","联合训练；":"joint training","联合作战":"joint operations","联合作战指挥中心":"Joint Operations Command Center","联络":"liaison","联络，沟通":"liaise"
  ,"联系人":"point of contact","梁、横梁；（体操的）平衡木":"beam","两栖作战的；水陆两用的；两栖的":"amphibious","列兵":"private","列入密级的；保密的":"classified","榴弹炮":"howitzer","陆军（首字母常用大写）；军队；集团军":"Army","路径；路标":"waypoint"
  ,"路障，障碍物":"roadblock","旅":"brigade","屡次袭扰（敌人）":"harass","轮流；轮换；轮岗":"rotate","矛盾情绪；正反感情并存":"ambivalence","美国海军陆战队远征旅":"marine expeditionary brigade","迷彩":"camouflage"
  ,"密件抄送；密送":"Blind Carbon Copy","密码术":"cryptology","免除，豁免":"immunity","瞄准具；观测器；瞄准":"sight","命令":"order","模板":"template","难民，避难者":"refugee","尼龙":"nylon","排":"platoon","派遣":"dispatch"
  ,"叛乱":"insurgent","炮兵；火炮":"artillery","炮火掩体；炮位":"emplacement","炮塔":"turret","培养":"foster","配属部队":"attachment","贫困，匮乏，剥夺":"deprivation","平民，百姓；平民的":"civilian","平视显示器":"Head Up Display"
  ,"评估，评价，评定":"assessment","迫击炮":"mortar","铺装路面":"improved road","骑兵；高度机动的地面部队":"cavalry","起始线;出发线":"line of departure","起重机":"crane","潜艇":"submarine","枪法；射击术":"marksmanship","枪管；炮筒":"barrel"
  ,"枪口；炮口":"muzzle","枪炮军士":"gunnery sergeant","枪托":"buttstock","轻武器":"small arms","轻型护卫舰;轻巡洋舰":"corvette","情报":"intelligence","情景训练演习":"situational exercise","曲解":"misinterpretation"
  ,"驱逐舰":"destroyer","全民投票":"referendum","缺乏":"dearth","扰乱;瓦解":"disrupt","扰乱攻击":"harassing attack","人道主义救援":"humanitarian aid"
  ,"人道主义事务协调办公室":"Office for the Coordination of Humanitarian Affairs(OCHA)","人道主义危机":"humanitarian crisis","人工呼吸器":"ventilator","人工智能":"artificial intelligence"
  ,"人员装甲运输车":"Armored Personnel Carrier","如不能出席请务必回复":"Regrets Only","扫雷":"demining","扫雷，排雷":"mine clearance","扫雷排爆":"clearing mines or ordnance","沙暴；沙尘暴":"sandstorm","纱布；薄纱；":"gauze","山坳":"draw"
  ,"山谷":"valley","山脊":"ridge","山体滑坡；塌方":"landslide","伤病员后送":"casualty evacuation","伤亡人员；（常用复数）伤亡人数":"casualty","上等兵":"private first class","上级；长官":"superior","射程；靶场；射击场":"range"
  ,"射击能手；神枪手":"marksman","渗透；潜入":"infiltration","升降机；绞车":"hoist","升限；射高；（飞机）舱顶":"ceiling","声音失真":"distorted","绳网":"cargo net","失密；泄密；暴露":"compromise","师":"division","湿地；沼泽":"marsh"
  ,"湿粘的；湿冷的":"clammy","十字路口":"crossroad","食物":"chow","使某人缠绕":"entangle","使适应, 顺应":"accommodate","使受到，给予（某种待遇）":"accord","使协调; 使调和":"coordinate","使遭受;使承受":"inflict","士兵":"enlisted"
  ,"士官":"Non-Commissioned Officer","士气；民心；斗志":"morale","世界粮食计划署":"World Food Programme","示威":"demonstration","收集，搜集（信息，资料）":"compile","收信人；收件人":"addressee","手柄，把手":"handle","手雷；手榴弹；枪榴弹":"grenade"
  ,"手枪":"pistol","授权，批准":"authorize","授权，委托":"mandate","树林":"woods","数字":"figure","水壶":"canteen","水面舰艇":"surface vessel","水平的, 与地平线平行的":"horizontal","顺应时势,迎合潮流;拖延，耽搁":"temporize"
  ,"司令部；指挥部；总部":"headquarters","算法，运算法则":"algorithm","锁子甲":"chain mail","态势感知":"situational awareness","谈判，协商，":"negotiation","碳纤维":"carbon fiber","特混支队":"Task Element","特派团":"mission"
  ,"特种部队":"special forces","提供的副本":"copies furnished","提供医疗救助":"providing medical assistance","提名":"nomination","体能测试":"Physical Fitness Test","体能服":"physical training uniform","条纹":"stripe"
  ,"跳跃，跃过":"vault","铁丝网":"barbed wire","听不见":"nothing heard","停火协议":"ceasefire","停战（或停火）":"truce","停止；立定":"halt","通信兵":"signal","同步；协调":"synchronize","同意":"consent","头盔":"helmet"
  ,"突发事件":"contingency","突击":"raid","图例":"legend","徒步行军":"foot march","团":"regiment","推进":"propulsion","推进器":"propeller","推土机":"bulldozer","退伍；退役":"discharge","挖掘机":"excavator","洼地":"depression"
  ,"外骨骼":"exoskeleton","外科手套；手术手套；医用手套":"surgical gloves","外联":"outreach","弯道":"curve","网络演习":"cyber exercise","维和":"peacekeeping","维和分队":"contingent troop","纬度":"latitude"
  ,"文职人员":"warrant officer","握把":"grip","无人机":"drone","无线电通联规范用语":"proword","无线电通联呼号":"callsign","无线电通信网络":"radio net","武器库；军火库；兵工厂":"arsenal","武装护卫":"armed escort","瑕疵":"blemish","下车":"dismount"
  ,"下级；下属":"subordinate","下士":"corporal","险峻的, 陡峭的":"precipitous","现役":"active service","小山":"hill","校友":"alumni","协同训练；联合训练":"combined training","斜坡，坡道":"ramp"
  ,"心肺复苏术":"cardiopulmonary resuscitation(CPR)","心脏骤停":"cardiac arrest","新兵（训练）营；新兵训练中心":"boot camp","新兵训练":"basic training","新闻处":"Public Information Office","信号变弱":"fading","信号好":"good"
  ,"信号强":"loud","信号强度":"signal strength","信号弱":"weak","信号时有时无":"intermittent","信号音质":"readability","信号有干扰":"interference","行为准则": ["honor code", "Code of Conduct"],"姓名牌":"name plate"
  ,"性能表，规格，规范":"specification","胸部按压":"compression","胸甲":"breastplate","胸腔密封贴，胸封":"chest seal","雄鹰突击-2024":"Eagle Strike-2024","休战协议":"armistice","虚假信息":"disinformation","悬崖":"cliff"
  ,"学费":"tuition","雪暴；暴风雪":"snowstorm","血液循环":"circulation","勋章；佩章；徽章；标记；识别符号":"insignia","勋章授带":"medal ribbon","巡逻背包":"patrol pack","巡洋舰":"cruiser","掩饰":"masquerade","掩体；地堡；暗堡":"bunker"
  ,"仰卧起坐":"sit-up","野火":"wildfire","野战训练演习":"field training exercise","一次性的":"disposable","一发（弹），整发弹；一轮":"round","医护兵;卫生员":"corpsman","医疗后送":"medical evacuation","医疗援助":"medical assistance"
  ,"已收到，明白":"roger","义务兵；被征召入伍者；征召；招募":"conscript","溢出 ; 外溢":"spill-over","翼侧;侧面":"flank","音质清晰":"clear","引体向上":"pull-up","隐密的":"covert","隐形":"stealth","营":"battalion","优先":"prioritize"
  ,"友情；情谊":"camaraderie","有氧运动":"cardio","预计到达时间":"estimated time of arrival","遇险求救信号；遇难信号":"distress signal","圆木":"log","远端脉搏":"distal pulse","运送":"shipment","运用，使用":"wield"
  ,"灾民转移":"relocation of victims","灾难":"catastrophe","暂时的；过渡的":"interim","责任区":"area of responsibility","增援":"reinforce","栅栏":"fence","占领":"overrun","战斗部":"payload","战斗机；歼击机；斗士；战斗员":"fighter"
  ,"战斗命令":"combat order","战俘":"Enemy Prisoner of War","长期粮食援助":"long-term food aid","长袖":"long-sleeve","障碍训练（场）":"obstacle course","沼泽（地）":"swamp","折叠锹":"folding shovel","褶皱，裤褶":"pleat"
  ,"侦察（非正式）":"recce","侦察（正式）":"reconnaissance","侦察组":"scout group/team","阵亡":"k-i-a","争论，纠纷，争夺":"dispute","征兵；(船的）吃水深度":"draft","征募；参军；入伍":"enlist","证实，证明，核实":"verify","政权":"regime"
  ,"执行官；副舰长；副职指挥员":"executive officer(XO)","直升机":"helicopter","直属单位":"Direct Reporting Unit","止血带":"tourniquet","指导，监督":"supervise","指挥官；舰长；主官":"commanding officer","指挥所演习":"Command Post Exercise"
  ,"指挥系统；指挥关系；指挥链":"chain of command","指令":"instruction","指示牌":"signpost","志愿兵；志愿军人":"volunteer","致命的":"lethal","中队":"squadron","中立":"neutrality","中午，正午":"midday","终止；使停止":"terminate"
  ,"重建":"reconstruction","重建基础设施":"re-establishing infrastructure","重型负载":"hard duty","主攻部队":"main effort","主战坦克":"main battle tank(MBT)","专业兵；专业军士":"specialist","装甲；装甲兵；装甲部队":"armor"
  ,"装载机":"loader","桌面推演":"table top exercise","自动倾卸卡车、翻斗车":"dump truck","自动体外除颤器":"automated external defibrillator","作训服":"combat uniform","作战保障；战斗保障":"sustain","作战部队":"combat arms"
  ,"作战概念":"concept of operations","作战命令":"operations order","作战靴":"combat boots","作战支援保障部队":"combat service support","作战支援部队":"combat arms support","坐标网格":"grid","BG":"brigadier general(abbr.)"
  ,"COL":"colonel(abbr.)","CPT":"captain(abbr.)","DAF":"Department of the Air Force(abbr.)","DoW":"Department of War(abbr.)","GEN":"general(abbr.)","LG":"lieutenant general(abbr.)"
  ,"LT":"lieutenant(abbr.)","LTC":"lieutenant colonel(abbr.)","MAJ":"major(abbr.)","MG":"major general(abbr.)","SPC":"Space Command(abbr.)","V形线条":"chevron"
};

/* ================================================================
 * 模块 C — 内部命名空间 & 状态
 * ================================================================ */

var HS = {
    normalizedDict: null,
    lastQuestionText: "",
    _processing: false,
    _observer: null,
    _retryGen: 0,
    _normCache: null,       // Map — 改用 Map 实现 LRU (P2-7)
    _observeTarget: null,
    _pageVisible: true,
    _watchdogTimers: [],
    _retryTimers: [],
    _started: false,
    _btnCache: null         // P1-4: [{el, norm}] 按钮文本缓存
};

/* ================================================================
 * 模块 D — 核心工具
 * ================================================================ */

function debug(msg) {
    if (CFG.DEBUG_LOG) console.log("[HS-DBG]", msg);
}

function warn(msg) {
    console.warn("[HS]", msg);
}

function $_q(sel) {
    try { return document.querySelector(sel); } catch (e) { return null; }
}

function $_qa(sel) {
    try { return document.querySelectorAll(sel); } catch (e) { return []; }
}

/* ================================================================
 * P1-3: ASCII 字符分类速查表
 * 0=普通字符, 1=空白字符, 2=大写字母(A-Z)
 * 覆盖 0-127 ASCII，替代循环内多重 if (code >= X && code <= Y)
 * ================================================================ */

var _chCls = new Uint8Array(128);
_chCls[9] = 1;   _chCls[10] = 1;  _chCls[11] = 1;
_chCls[12] = 1;  _chCls[13] = 1;  _chCls[32] = 1;
for (var _ci = 65; _ci <= 90; _ci++) _chCls[_ci] = 2;

/* ================================================================
 * 模块 E — 优化 normalizeText
 *
 * P0-1: 数组收集 + join("") 替代 out += ch 字符串拼接
 * P1-3: Uint8Array(128) 速查表替代多重范围判断
 * P2-7: Map 实现 LRU 缓存，map.delete(map.keys().next().value) O(1) 淘汰
 * ================================================================ */

function normalizeText(text) {
    if (!text) return "";

    var cached = HS._normCache.get(text);
    if (cached !== undefined) return cached;

    var len = text.length;
    var chars = [];
    var prevSpace = false;
    var leading = true;
    var i, ch, code, ct;
    var chLen = 0;

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
                prevSpace = false;
                leading = false;
                chars[chLen++] = String.fromCharCode(code + 32);
                continue;
            }
            prevSpace = false;
            leading = false;
            chars[chLen++] = ch;
            continue;
        }

        if ((code >= 0x200B && code <= 0x200F) ||
            code === 0xFEFF || code === 0x00AD ||
            (code >= 0x2060 && code <= 0x2064)) {
            continue;
        }

        if (code === 0x3000 || code === 0xA0) {
            if (leading || prevSpace) continue;
            prevSpace = true;
            chars[chLen++] = " ";
            continue;
        }

        prevSpace = false;
        leading = false;
        chars[chLen++] = ch;
    }

    if (chLen > 0 && chars[chLen - 1] === " ") {
        chLen--;
        chars.length = chLen;
    }
    var out = chars.join("");

    // Map LRU (P2-7): O(1) 淘汰最旧条目
    HS._normCache.set(text, out);
    if (HS._normCache.size > CFG.NORM_CACHE_SIZE) {
        HS._normCache.delete(HS._normCache.keys().next().value);
    }

    return out;
}

/* ================================================================
 * 模块 F — buildNormalizedDict
 *
 * P0-2: 结构从 {key: [values]} 升级为 {key: {answers: [...], exactSet: {}}}
 *       在构建时预建 exactSet，answerChoice 直接引用免去每次重建
 * P2-8: 末尾缓存预热，遍历全部 dict key/value 调用 normalizeText
 * ================================================================ */

function buildNormalizedDict() {
    HS.normalizedDict = Object.create(null);
    var keys = Object.keys(dict);
    var i, j, kLen = keys.length;
    var rawKey, normKey, rawValue, values, vLen, normVal;
    var entry;
    var tmpSet = Object.create(null);

    for (i = 0; i < kLen; i++) {
        rawKey = keys[i];
        normKey = normalizeText(rawKey);
        if (!normKey) continue;

        rawValue = dict[rawKey];
        values = Array.isArray(rawValue) ? rawValue : [rawValue];
        vLen = values.length;

        if (!HS.normalizedDict[normKey]) {
            HS.normalizedDict[normKey] = { answers: [], exactSet: Object.create(null), originalAnswers: [] };
        }
        entry = HS.normalizedDict[normKey];

        for (j = 0; j < vLen; j++) {
            normVal = normalizeText(values[j]);
            if (!normVal) continue;
            if (!tmpSet[normVal]) {
                tmpSet[normVal] = true;
                entry.answers.push(normVal);
                entry.exactSet[normVal] = true;
                entry.originalAnswers.push(values[j]);
            }
        }

        for (j = 0; j < vLen; j++) {
            normVal = normalizeText(values[j]);
            if (normVal) tmpSet[normVal] = false;
        }
    }

    tmpSet = null;

    // P2-8: 缓存预热 — 遍历全部 key/value 调用 normalizeText，提前填满 LRU
    for (i = 0; i < kLen; i++) {
        rawKey = keys[i];
        normalizeText(rawKey);
        rawValue = dict[rawKey];
        if (Array.isArray(rawValue)) {
            for (j = 0; j < rawValue.length; j++) normalizeText(rawValue[j]);
        } else {
            normalizeText(rawValue);
        }
    }
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
    while (HS._watchdogTimers.length) {
        t = HS._watchdogTimers.pop();
        clearTimeout(t);
    }
    while (HS._retryTimers.length) {
        t = HS._retryTimers.pop();
        clearTimeout(t);
    }
}

/* ================================================================
 * 模块 H — answerChoice 优化
 *
 * P0-2: 直接引用 entry.exactSet 免去每次重建
 * P1-4: _btnCache 缓存按钮 el+norm，首次查询缓存，重试复用
 * P1-5: 使用 .click() 替代 dispatchEvent(new MouseEvent(...))
 * ================================================================ */

function getQuestionText() {
    try {
        var el = $_q(CFG.QUESTION_SELECTOR) || $_q("#battleQuestionText");
        return el ? el.textContent.trim() : null;
    } catch (e) { return null; }
}

function lookupAnswer(question) {
    if (!question) return null;
    var q = normalizeText(question);
    return (HS.normalizedDict && HS.normalizedDict[q]) || null;
}

function getQuestionType() {
    try {
        var typeEl = $_q(CFG.QUESTION_TYPE_SELECTOR) || $_q("#battleQuestionType");
        if (!typeEl) return "unknown";
        var t = typeEl.textContent.trim();
        if (t.indexOf("拼写单词") !== -1) return "fill";
        if (t.indexOf("选择正确单词") !== -1 || t.indexOf("选择正确释义") !== -1) return "choice";
        return "unknown";
    } catch (e) { return "unknown"; }
}

function isFillInputVisible() {
    try {
        var input = $_q(CFG.FILL_INPUT_SELECTOR);
        if (!input) return false;
        var style = window.getComputedStyle(input);
        return style.display !== "none" && style.visibility !== "hidden" && input.offsetParent !== null;
    } catch (e) { return false; }
}

function answerChoice(dictEntry, retriesLeft, onSuccess, startGen) {
    if (retriesLeft === undefined) retriesLeft = CFG.MAX_RETRIES;
    if (startGen === undefined) startGen = HS._retryGen;

    if (HS._retryGen !== startGen) {
        debug("answerChoice 代数过期，放弃重试 (gen=" + startGen + ", current=" + HS._retryGen + ")");
        return false;
    }

    try {
        var correctAnswers = dictEntry.answers;
        var exactSet = dictEntry.exactSet;
        if (!correctAnswers || correctAnswers.length === 0) return false;

        var grid, buttons, bLen, cache;

        // P1-4: 按钮文本缓存 — 首次构建，重试复用
        if (HS._btnCache) {
            cache = HS._btnCache;
        } else {
            grid = $_q(CFG.OPTIONS_GRID_SELECTOR) || $_q("#battleOptionsGrid");
            if (!grid) {
                if (retriesLeft > 0) { scheduleRetry(dictEntry, retriesLeft, onSuccess, startGen); }
                return false;
            }
            buttons = grid.querySelectorAll("button");
            bLen = buttons.length;
            if (bLen === 0) {
                if (retriesLeft > 0) { scheduleRetry(dictEntry, retriesLeft, onSuccess, startGen); }
                return false;
            }
            cache = new Array(bLen);
            for (var ci = 0; ci < bLen; ci++) {
                cache[ci] = { el: buttons[ci], norm: normalizeText(buttons[ci].textContent) };
            }
            HS._btnCache = cache;
        }

        var foundIndex = -1;
        var i, k, btnNorm;
        var ansLen = correctAnswers.length;
        bLen = cache.length;

        for (i = 0; i < bLen; i++) {
            btnNorm = cache[i].norm;

            // P0-2: O(1) 精确匹配 — 直接引用预建的 exactSet
            if (exactSet[btnNorm]) {
                foundIndex = i;
                break;
            }

            for (k = 0; k < ansLen; k++) {
                var ansNorm = correctAnswers[k];
                if (btnNorm.indexOf(ansNorm) !== -1 || ansNorm.indexOf(btnNorm) !== -1) {
                    foundIndex = i;
                    break;
                }
            }
            if (foundIndex !== -1) break;
        }

        if (foundIndex !== -1) {
            var targetBtn = cache[foundIndex].el;

            if (!document.body.contains(targetBtn)) {
                warn("目标按钮已脱离 DOM，重新查找");
                HS._btnCache = null;
                if (retriesLeft > 0) { scheduleRetry(dictEntry, retriesLeft, onSuccess, startGen); }
                return false;
            }

            // P1-5: 使用 .click() 替代 dispatchEvent(new MouseEvent(...))
            targetBtn.click();

            if (onSuccess && retriesLeft < CFG.MAX_RETRIES) onSuccess();
            return true;
        }

        if (retriesLeft > 0) {
            scheduleRetry(dictEntry, retriesLeft, onSuccess, startGen);
        }
        return false;

    } catch (e) {
        warn("answerChoice error: " + e.message);
        return false;
    }
}

function scheduleRetry(dictEntry, retriesLeft, onSuccess, startGen) {
    var attemptsUsed = CFG.MAX_RETRIES - retriesLeft;
    var delay = CFG.RETRY_INTERVAL * Math.pow(CFG.RETRY_BACKOFF_MUL, attemptsUsed);
    delay = Math.floor(delay);

    debug("answerChoice 重试 #" + (attemptsUsed + 1) + " after " + delay + "ms");

    var timerId = setTimeout(function () {
        var idx = HS._retryTimers.indexOf(timerId);
        if (idx !== -1) HS._retryTimers.splice(idx, 1);
        answerChoice(dictEntry, retriesLeft - 1, onSuccess, startGen);
    }, delay);

    HS._retryTimers.push(timerId);
}

/* ================================================================
 * 模块 I — answerFill
 * ================================================================ */

function clickNextButton() {
    try {
        var btn = $_q(CFG.NEXT_BUTTON_SELECTOR) || $_q("#battleOptionsGrid > button");
        if (btn && document.body.contains(btn)) {
            btn.click();
            return true;
        }
        return false;
    } catch (e) { return false; }
}

function answerFill(dictEntry) {
    try {
        var correctAnswers = (dictEntry.originalAnswers && dictEntry.originalAnswers.length > 0)
            ? dictEntry.originalAnswers
            : dictEntry.answers;
        if (!correctAnswers || correctAnswers.length === 0) return;

        var chosen = correctAnswers[Math.floor(Math.random() * correctAnswers.length)];

        var input = $_q(CFG.FILL_INPUT_SELECTOR);
        if (!input) return;

        if (input.disabled || input.readOnly) {
            warn("填空输入框被禁用/只读，跳过");
            return;
        }

        var valueDescriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
        if (valueDescriptor && valueDescriptor.set) {
            valueDescriptor.set.call(input, chosen);
        } else {
            input.value = chosen;
        }

        if (input.value !== chosen) {
            input.value = chosen;
        }

        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));

        if (!clickNextButton()) {
            debug("answerFill: 提交按钮不可用");
        }
    } catch (e) {
        warn("answerFill error: " + e.message);
    }
}

/* ================================================================
 * 模块 J — processQuestion
 * ================================================================ */

function handleUnknownQuestion() {
    if (!CFG.SKIP_UNKNOWN) return;

    var qType = getQuestionType();
    if (qType === "choice") {
        try {
            var grid = $_q(CFG.OPTIONS_GRID_SELECTOR) || $_q("#battleOptionsGrid");
            if (!grid) return;
            var buttons = grid.querySelectorAll("button");
            if (buttons.length > 0) {
                var ri = Math.floor(Math.random() * buttons.length);
                // P1-5: .click() 替代 dispatchEvent(new MouseEvent(...))
                buttons[ri].click();
            }
        } catch (e) {}
    } else if (qType === "fill" || (qType === "unknown" && isFillInputVisible())) {
        try {
            var input = $_q(CFG.FILL_INPUT_SELECTOR);
            if (input && !input.disabled && !input.readOnly) {
                var vd = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
                if (vd && vd.set) { vd.set.call(input, "?"); }
                else { input.value = "?"; }
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
                clickNextButton();
            }
        } catch (e) {}
    }
}

function processQuestion() {
    if (!acquireLock()) return;

    var t0 = CFG.PERF_LOG ? performance.now() : 0;
    var currentGen = HS._retryGen;

    // P1-4: 新题清空按钮缓存
    HS._btnCache = null;

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

    try {
        var questionText = getQuestionText();
        if (!questionText) {
            clearWatchdog();
            releaseLock();
            return;
        }

        var entry = lookupAnswer(questionText);
        if (!entry || !entry.answers || entry.answers.length === 0) {
            HS.lastQuestionText = questionText;
            handleUnknownQuestion();
            clearWatchdog();
            releaseLock();
            if (CFG.PERF_LOG) console.log("[HS] PERF 未知 " + (performance.now() - t0).toFixed(1) + "ms");
            return;
        }

        var qType = getQuestionType();

        if (qType === "choice") {
            var onSuccess = function () {
                clearWatchdog();
                releaseLock();
                if (CFG.PERF_LOG) console.log("[HS] PERF 选择(重试后) " + (performance.now() - t0).toFixed(1) + "ms");
            };

            var ok = answerChoice(entry, CFG.MAX_RETRIES, onSuccess, currentGen);
            if (ok) {
                HS.lastQuestionText = questionText;
                clearWatchdog();
                releaseLock();
                if (CFG.PERF_LOG) console.log("[HS] PERF 选择 " + (performance.now() - t0).toFixed(1) + "ms");
                return;
            }

            var fallback = setTimeout(function () {
                if (HS._processing && HS._retryGen === currentGen) {
                    warn("选择题重试兜底超时");
                    clearWatchdog();
                    releaseLock();
                }
            }, CFG.RETRY_INTERVAL * Math.pow(CFG.RETRY_BACKOFF_MUL, CFG.MAX_RETRIES + 1) + 500);
            HS._watchdogTimers.push(fallback);

        } else if (qType === "fill") {
            answerFill(entry);
            HS.lastQuestionText = questionText;
            clearWatchdog();
            releaseLock();
            if (CFG.PERF_LOG) console.log("[HS] PERF 填空 " + (performance.now() - t0).toFixed(1) + "ms");

        } else {
            if (isFillInputVisible()) {
                answerFill(entry);
                HS.lastQuestionText = questionText;
                clearWatchdog();
                releaseLock();
                if (CFG.PERF_LOG) console.log("[HS] PERF 推断填空 " + (performance.now() - t0).toFixed(1) + "ms");
            } else {
                clearWatchdog();
                releaseLock();
            }
        }

    } catch (e) {
        warn("processQuestion 严重错误: " + e.message);
        clearWatchdog();
        releaseLock();
    }
}

/* ================================================================
 * 模块 K — MutationObserver
 *
 * P2-6: observe 配置移除 characterData，只保留 childList + subtree
 * ================================================================ */

function findObserverTarget() {
    return $_q(CFG.OPTIONS_GRID_SELECTOR)
        || $_q("#battleOptionsGrid")
        || $_q(CFG.QUESTION_SELECTOR)
        || document.body;
}

function isRelevantMutation(mutations) {
    if (!CFG.DEBUG_LOG) return true;

    for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        var target = m.target;

        if (target.id === "questionText" || target.id === "optionsGrid" ||
            target.id === "questionType" || target.id === "spellingInput" ||
            target.id === "battleQuestionType" || target.id === "battleOptionsGrid" ||
            target.id === "battleQuestionText") {
            return true;
        }

        var parent = target.parentElement;
        while (parent) {
            if (parent.id === "optionsGrid" || parent.id === "battleOptionsGrid"
                || parent.id === "questionText" || parent.id === "battleQuestionText") return true;
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
        if (!isRelevantMutation(mutations)) return;

        if (HS._observeTarget && !document.body.contains(HS._observeTarget)) {
            debug("观测目标已移除，重连Observer");
            setupObserver();
            return;
        }

        if (debounceTimer) clearTimeout(debounceTimer);

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
        }, CFG.OBSERVER_DEBOUNCE);
    };

    HS._observer = new MutationObserver(mutationHandler);

    // P2-6: 移除 characterData: true
    HS._observer.observe(HS._observeTarget, {
        childList: true,
        subtree: true,
        attributes: false
    });
}

/* ================================================================
 * 模块 L — 页面可见性感知
 * ================================================================ */

function setupVisibilityHandler() {
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            HS._pageVisible = false;
            clearAllTimers();
            HS._processing = false;
            debug("页面隐藏，暂停所有操作");
        } else {
            HS._pageVisible = true;
            debug("页面可见，恢复操作");
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
 * 模块 M — 初始化 & 优雅降级
 * ================================================================ */

function initAutoAnswer(retriesLeft) {
    if (retriesLeft === undefined) retriesLeft = CFG.MAX_RETRIES;

    if (HS._started) return;
    HS._started = true;

    var questionEl = $_q(CFG.QUESTION_SELECTOR) || $_q("#battleQuestionText");
    var typeEl = $_q(CFG.QUESTION_TYPE_SELECTOR) || $_q("#battleQuestionType");

    if (!questionEl && !typeEl) {
        if (retriesLeft > 0) {
            setTimeout(function () {
                initAutoAnswer(retriesLeft - 1);
            }, CFG.RETRY_INTERVAL);
            return;
        }
        warn("初始化超时：未检测到答题区域");
        return;
    }

    console.log("[HS] Performance v3.0 已启动"
        + (CFG.PERF_LOG ? " (PERF日志ON)" : "")
        + (CFG.DEBUG_LOG ? " (DEBUG日志ON)" : ""));

    setupVisibilityHandler();
    setupObserver();

    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            processQuestion();
        });
    });
}

/* ================================================================
 * 入口
 * ================================================================ */

(function () {
    "use strict";

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function (cb) { return setTimeout(cb, 16); };
    }

    // P2-7: _normCache 改用 Map 实现
    HS._normCache = new Map();

    buildNormalizedDict();

    if (!dict || Object.keys(dict).length === 0) {
        warn("题库 dict 为空，脚本不会执行");
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

