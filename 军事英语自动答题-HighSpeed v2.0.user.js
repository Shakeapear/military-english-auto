// ==UserScript==
// @name         军事英语自动答题助手-HighSpeed v2.0
// @namespace    https://github.com/Shakeapear/military-english-auto
// @version      2.0.0
// @description  军事英语词汇自动答题脚本 — 高速版 2.0：鲁棒架构 / 竞态安全 / 自适应时序 / 页面可见性感知 / 观测器自愈，响应速度保持 ~60ms/题
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
 * This file is part of version 2.0 (HighSpeed).
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
    DEBUG_LOG: false,           // 详细调试日志

    ALIAS_MATCH_ENABLED: true   // v4.0 backport: 启用别名/缩写索引匹配
};

/* ================================================================
 * 模块 B — 题库字典（与原版完全一致）
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
  ,"地形":["relief","terrain"],"侦察":["reconnaissance","recce"],"（美陆军）二级军士长":["first sergeant","master sergeant"]
  ,"（美陆军）一级军士长":["command sergeant major","sergeant major"],"command sergeant major(CSM)":"（美陆军）一级军士长（指挥）"
  ,"sergeant major(SGM)":"(美)陆军一级军士长（机关）","commissioned officer(CO)":"军官","non-commissioned officer(NCO)":"士官"
  ,"sergeant first class(SFC)":"(美陆军)三级军士长","Space Command(SPC)":"（美）太空司令部","staff sergeant(SSG)":"（美陆军、海军陆战队）上士；（美空军）中士"
  ,"vice admiral (VADM)":"（海军）中将"
};

/* ================================================================
 * 模块 C — 内部命名空间 & 状态
 * 所有私有状态收敛到 HS 对象上，避免全局污染
 * ================================================================ */

var HS = {
    normalizedDict: null,
    lastQuestionText: "",
    _processing: false,
    _observer: null,
    _retryGen: 0,         // 重试代数：每次新题目 +1，旧重试检测到落后即自废
    _normCache: Object.create(null),
    _normCacheKeys: [],
    _observeTarget: null,
    _pageVisible: true,
    _watchdogTimers: [],
    _retryTimers: [],
    _started: false,
    _aliasIndex: null       // v4.0 backport: Map — alias/abbreviation index
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
 * 模块 E — 优化 ①：单次遍历 + LRU缓存的 normalizeText
 *
 * 继承 v2 的单次字符遍历核心，新增最近 64 条结果的 LRU 缓存。
 * 因为题目文本和按钮文本在短时间内大量重复，缓存命中率极高，
 * 可将热路径上的 normalizeText 开销接近归零。
 * ================================================================ */

function normalizeText(text) {
    if (!text) return "";

    // LRU 缓存查找
    var cached = HS._normCache[text];
    if (cached !== undefined) return cached;

    var len = text.length;
    var out = "";
    var prevSpace = false;
    var leading = true;
    var i, ch, code;

    for (i = 0; i < len; i++) {
        ch = text[i];
        code = ch.charCodeAt(0);

        if (code >= 0xFF01 && code <= 0xFF5E) {
            ch = String.fromCharCode(code - 0xFEE0);
            code = ch.charCodeAt(0);
        }

        if ((code >= 0x200B && code <= 0x200F) ||
            code === 0xFEFF || code === 0x00AD ||
            (code >= 0x2060 && code <= 0x2064)) {
            continue;
        }

        if (code === 0x20 || code === 0x09 || code === 0x0A ||
            code === 0x0D || code === 0x0C || code === 0x0B ||
            code === 0x3000 || code === 0xA0) {
            if (leading || prevSpace) continue;
            prevSpace = true;
            out += " ";
            continue;
        }

        prevSpace = false;
        leading = false;

        if (code >= 65 && code <= 90) {
            out += String.fromCharCode(code + 32);
        } else {
            out += ch;
        }
    }

    // 去除尾部空格
    var outLen = out.length;
    if (outLen > 0 && out[outLen - 1] === " ") {
        out = out.slice(0, -1);
    }

    // 写入缓存 + LRU 淘汰
    if (HS._normCacheKeys.length >= CFG.NORM_CACHE_SIZE) {
        delete HS._normCache[HS._normCacheKeys.shift()];
    }
    HS._normCache[text] = out;
    HS._normCacheKeys.push(text);

    return out;
}

/* ================================================================
 * 模块 F — 优化 ②：预规范化 dict + 按值反查索引
 *
 * 除 Key→Values 映射外，额外构建 Values→Keys 反向索引，
 * 使填空题（需要知道填写哪个选项）可以直接通过规范化
 * 答案值反查 key，免去遍历。
 * ================================================================ */

function buildNormalizedDict() {
    HS.normalizedDict = Object.create(null);
    HS._aliasIndex = Object.create(null);
    var keys = Object.keys(dict);
    var i, j, kLen = keys.length;
    var rawKey, normKey, rawValue, values, vLen, normVal;
    var entry;

    // 临时 Set 用于去重，比 indexOf O(n²) 更高效
    var tmpSet = Object.create(null);

    for (i = 0; i < kLen; i++) {
        rawKey = keys[i];
        normKey = normalizeText(rawKey);
        if (!normKey) continue;  // 防御：key 规范化后为空则跳过

        rawValue = dict[rawKey];
        values = Array.isArray(rawValue) ? rawValue : [rawValue];
        vLen = values.length;

        if (!HS.normalizedDict[normKey]) {
            HS.normalizedDict[normKey] = [];
        }
        entry = HS.normalizedDict[normKey];

        for (j = 0; j < vLen; j++) {
            normVal = normalizeText(values[j]);
            if (!normVal) continue;
            if (!tmpSet[normVal]) {
                tmpSet[normVal] = true;
                entry.push(normVal);
            }
        }

        // 清理临时去重 Set（复用对象，只清对应 key）
        for (j = 0; j < vLen; j++) {
            normVal = normalizeText(values[j]);
            if (normVal) tmpSet[normVal] = false;
        }
    }

    // v4.0 backport: 构建 _aliasIndex 别名/缩写索引
    for (i = 0; i < kLen; i++) {
        rawKey = keys[i];
        normKey = normalizeText(rawKey);

        var keyParen = rawKey.match(/\(([A-Z]{2,6})\)/);
        if (keyParen) {
            var abbrKey = keyParen[1];
            if (HS.normalizedDict[normKey]) {
                HS._aliasIndex[abbrKey] = normKey;
            }
        }

        rawValue = dict[rawKey];
        values = Array.isArray(rawValue) ? rawValue : [rawValue];
        for (j = 0; j < values.length; j++) {
            var val = values[j];
            var valParen = val.match(/\(([A-Z]{2,6})\)/);
            if (valParen) {
                var abbrVal = valParen[1];
                if (HS.normalizedDict[normKey]) {
                    HS._aliasIndex[abbrVal] = normKey;
                }
            }
            var standaloneMatch = val.match(/^([A-Z]{2,6})$/);
            if (standaloneMatch) {
                var saAbbr = standaloneMatch[1];
                if (HS.normalizedDict[normKey]) {
                    HS._aliasIndex[saAbbr] = normKey;
                }
            }
        }

        if (rawKey.length >= 2 && rawKey.length <= 6 && /^[A-Z]+$/.test(rawKey)) {
            if (HS.normalizedDict[normKey]) {
                HS._aliasIndex[rawKey] = normKey;
            }
        }
    }

    tmpSet = null; // 释放引用
}

/* ================================================================
 * 模块 G — 竞态安全的原子锁
 *
 * 使用代数（generation）机制防范竞态：
 * — 每次 processQuestion 进入时递增 _retryGen
 * — 所有异步回调（setTimeout/rAF/MutationObserver）在执行前
 *   校验当前 gen 是否与触发时一致，不一致则自废
 * — 解决了 v2 中旧重试在题目已切换后仍可能点击错误按钮的 Bug
 * ================================================================ */

function acquireLock() {
    if (HS._processing) return false;
    HS._processing = true;
    HS._retryGen++;
    return true;
}

function releaseLock() {
    HS._processing = false;
    // 清理所有残留的看门狗和重试定时器
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
 * 模块 H — 优化 ③：带代数校验的 O(1) 精确匹配 answerChoice
 *
 * 保留 v2 的 exactSet 精确匹配 + 模糊回退。
 * 新增：
 *   — 代数校验：重试前检查 gen 是否过期
 *   — 按钮 DOM 依附校验：点击前确认按钮仍在 DOM 中
 *   — 指数退避重试间隔
 * ================================================================ */

function getQuestionText() {
    try {
        var el = $_q(CFG.QUESTION_SELECTOR) || $_q("#battleQuestionText");
        return el ? el.textContent.trim() : null;
    } catch (e) { return null; }
}

function lookupAnswer(question) {
    if (!question) return null;

    // Tier 1: 精确规范化键匹配
    var q = normalizeText(question);
    var entry = (HS.normalizedDict && HS.normalizedDict[q]) || null;
    if (entry) return entry;

    // v4.0 backport Tier 2: 别名/缩写索引匹配
    if (CFG.ALIAS_MATCH_ENABLED && HS._aliasIndex) {
        var words = question.split(/\s+/);
        var wLen = words.length;
        var wi, w;
        for (wi = 0; wi < wLen; wi++) {
            w = words[wi];
            if (w.length >= 2 && w.length <= 6 && /^[A-Z]+$/.test(w)) {
                var aliasKey = HS._aliasIndex[w];
                if (aliasKey && HS.normalizedDict[aliasKey]) {
                    warn("别名匹配: " + w + " → " + aliasKey);
                    return HS.normalizedDict[aliasKey];
                }
            }
        }
    }

    return null;
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

function answerChoice(correctAnswers, retriesLeft, onSuccess, startGen) {
    if (retriesLeft === undefined) retriesLeft = CFG.MAX_RETRIES;
    if (startGen === undefined) startGen = HS._retryGen;

    // 代数校验：题目已切换则放弃旧重试链
    if (HS._retryGen !== startGen) {
        debug("answerChoice 代数过期，放弃重试 (gen=" + startGen + ", current=" + HS._retryGen + ")");
        return false;
    }

    try {
        if (!correctAnswers || correctAnswers.length === 0) return false;

        // 构建 O(1) 精确查找对象
        var exactSet = Object.create(null);
        var a, ansLen = correctAnswers.length;
        for (a = 0; a < ansLen; a++) {
            exactSet[correctAnswers[a]] = true;
        }

            var grid = $_q(CFG.OPTIONS_GRID_SELECTOR) || $_q("#battleOptionsGrid");
        if (!grid) {
            if (retriesLeft > 0) { scheduleRetry(correctAnswers, retriesLeft, onSuccess, startGen); }
            return false;
        }

        var buttons = grid.querySelectorAll("button");
        if (buttons.length === 0) {
            if (retriesLeft > 0) { scheduleRetry(correctAnswers, retriesLeft, onSuccess, startGen); }
            return false;
        }

        var foundIndex = -1;
        var i, k, bLen = buttons.length;
        var btnText, btnNorm;

        for (i = 0; i < bLen; i++) {
            btnText = buttons[i].textContent;
            btnNorm = normalizeText(btnText);

            // O(1) 精确匹配
            if (exactSet[btnNorm]) {
                foundIndex = i;
                break;
            }

            // 模糊包含匹配
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
            var targetBtn = buttons[foundIndex];

            // 防御：点击前确认按钮仍在 DOM 中
            if (!document.body.contains(targetBtn)) {
                warn("目标按钮已脱离 DOM，重新查找");
                if (retriesLeft > 0) { scheduleRetry(correctAnswers, retriesLeft, onSuccess, startGen); }
                return false;
            }

            targetBtn.dispatchEvent(new MouseEvent("click", {
                bubbles: true, cancelable: true, view: window, button: 0
            }));

            if (onSuccess && retriesLeft < CFG.MAX_RETRIES) onSuccess();
            return true;
        }

        if (retriesLeft > 0) {
            scheduleRetry(correctAnswers, retriesLeft, onSuccess, startGen);
        }
        return false;

    } catch (e) {
        warn("answerChoice error: " + e.message);
        return false;
    }
}

function scheduleRetry(correctAnswers, retriesLeft, onSuccess, startGen) {
    // 指数退避：首重试 50ms，第二次 90ms，第三次 162ms
    var attemptsUsed = CFG.MAX_RETRIES - retriesLeft;
    var delay = CFG.RETRY_INTERVAL * Math.pow(CFG.RETRY_BACKOFF_MUL, attemptsUsed);
    delay = Math.floor(delay);

    debug("answerChoice 重试 #" + (attemptsUsed + 1) + " after " + delay + "ms");

    var timerId = setTimeout(function () {
        // 移除已触发的定时器
        var idx = HS._retryTimers.indexOf(timerId);
        if (idx !== -1) HS._retryTimers.splice(idx, 1);

        answerChoice(correctAnswers, retriesLeft - 1, onSuccess, startGen);
    }, delay);

    HS._retryTimers.push(timerId);
}

/* ================================================================
 * 模块 I — 优化 ④：带输入状态校验的 answerFill
 *
 * v2 的即时填充基础上增加：
 *   — 输入框 disabled/readonly 检测
 *   — 填写后二次校验值确实已设定
 *   — 提交按钮存在性检查
 *   — 代数校验防止过时操作
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

function answerFill(correctAnswers) {
    try {
        if (!correctAnswers || correctAnswers.length === 0) return;

        var chosen = correctAnswers[Math.floor(Math.random() * correctAnswers.length)];

        var input = $_q(CFG.FILL_INPUT_SELECTOR);
        if (!input) return;

        // 防御：检查输入框状态
        if (input.disabled || input.readOnly) {
            warn("填空输入框被禁用/只读，跳过");
            return;
        }

        // 绕过框架 getter/setter
        var valueDescriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
        if (valueDescriptor && valueDescriptor.set) {
            valueDescriptor.set.call(input, chosen);
        } else {
            input.value = chosen;
        }

        // 校验值确实已设定
        if (input.value !== chosen) {
            input.value = chosen;
        }

        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));

        // 同步点击提交
        if (!clickNextButton()) {
            debug("answerFill: 提交按钮不可用");
        }
    } catch (e) {
        warn("answerFill error: " + e.message);
    }
}

/* ================================================================
 * 模块 J — 优化 ⑤：统一的 processQuestion 主线
 *
 * 结构化改进：
 *   — 原子锁 acquireLock() / releaseLock() 替代裸露的 isProcessing
 *   — 看门狗收归 releaseLock 统一清理
 *   — 未知题/填空题不再有多余 setTimeout 链
 *   — 所有路径统一调用 releaseLock() 确保锁释放
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
                buttons[ri].dispatchEvent(new MouseEvent("click", {
                    bubbles: true, cancelable: true, view: window, button: 0
                }));
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

    // 看门狗
    var watchdog = setTimeout(function () {
        if (HS._processing && HS._retryGen === currentGen) {
            warn("看门狗触发 (" + CFG.PROCESSING_TIMEOUT + "ms)，强制释放锁");
            releaseLock();
        }
    }, CFG.PROCESSING_TIMEOUT);
    HS._watchdogTimers.push(watchdog);

    // 清理已触发的看门狗
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

        var answers = lookupAnswer(questionText);
        if (!answers || answers.length === 0) {
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

            var ok = answerChoice(answers, CFG.MAX_RETRIES, onSuccess, currentGen);
            if (ok) {
                HS.lastQuestionText = questionText;
                clearWatchdog();
                releaseLock();
                if (CFG.PERF_LOG) console.log("[HS] PERF 选择 " + (performance.now() - t0).toFixed(1) + "ms");
                return;
            }

            // 仍在重试中 → 超时兜底
            var fallback = setTimeout(function () {
                if (HS._processing && HS._retryGen === currentGen) {
                    warn("选择题重试兜底超时");
                    clearWatchdog();
                    releaseLock();
                }
            }, CFG.RETRY_INTERVAL * Math.pow(CFG.RETRY_BACKOFF_MUL, CFG.MAX_RETRIES + 1) + 500);
            HS._watchdogTimers.push(fallback);

        } else if (qType === "fill") {
            answerFill(answers);
            HS.lastQuestionText = questionText;
            clearWatchdog();
            releaseLock();
            if (CFG.PERF_LOG) console.log("[HS] PERF 填空 " + (performance.now() - t0).toFixed(1) + "ms");

        } else {
            if (isFillInputVisible()) {
                answerFill(answers);
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
 * 模块 K — 优化 ⑥：自适应 rAF + 可见性感知的 MutationObserver
 *
 * v2 的双帧 rAF + 30ms 防抖基础上增加：
 *   — 页面可见性 API：hidden 时暂停 Observer 回调，visible 时
 *     立即触发一次处理（防止标签页后台期间累积状态）
 *   — 观测目标自愈：如果 targetNode 被移除，自动寻找新目标
 *   — mutation 过滤：仅对问题/选项相关的 DOM 变动做出反应，
 *     忽略无关的文本变化
 * ================================================================ */

function findObserverTarget() {
    return $_q(CFG.OPTIONS_GRID_SELECTOR)
        || $_q("#battleOptionsGrid")
        || $_q(CFG.QUESTION_SELECTOR)
        || document.body;
}

function isRelevantMutation(mutations) {
    if (!CFG.DEBUG_LOG) return true; // 生产模式不过滤，避免误判

    for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        var target = m.target;

        // 快速检查目标节点是否与题目/选项相关
        if (target.id === "questionText" || target.id === "optionsGrid" ||
            target.id === "questionType" || target.id === "spellingInput" ||
            target.id === "battleQuestionType" || target.id === "battleOptionsGrid" ||
            target.id === "battleQuestionText") {
            return true;
        }

        // 检查父级
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
        // 页面隐藏时不处理
        if (!HS._pageVisible) return;
        // 正在处理中
        if (HS._processing) return;
        // 可选过滤
        if (!isRelevantMutation(mutations)) return;

        // 自愈：检查观测目标是否仍在 DOM 中
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

    HS._observer.observe(HS._observeTarget, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: false
    });
}

/* ================================================================
 * 模块 L — 页面可见性感知
 *
 * 监听 visibilitychange 事件：
 *   — hidden → 清除所有待处理的重试/防抖/看门狗
 *   — visible → 主动探测一次题目（防止后台期间页面变了）
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
            // 主动探测：页面可能已切换到新题目
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

    console.log("[HS] HighSpeed v2.0 已启动"
        + (CFG.PERF_LOG ? " (PERF日志ON)" : "")
        + (CFG.DEBUG_LOG ? " (DEBUG日志ON)" : ""));

    setupVisibilityHandler();
    setupObserver();

    // 首题使用双帧 rAF
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

    // 防御：rAF polyfill (极老浏览器)
    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function (cb) { return setTimeout(cb, 16); };
    }

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

