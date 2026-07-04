# 产品规格说明书 V1

# 产品概述 \(Product Overview\)

## 产品愿景 \(Product Vision\)

构建一个可在本地安全运行的轻量级运行时系统（Runtime）。在此运行时中，个人健康数据（Personal Data）、AI就绪数据集（AI Ready Datasets）以及高可信的智能体（Trustworthy Agents）能够在完整的运行时审计机制下安全协作。

## 产品定位 \(Product Position\)

本项目定位为 个人可信数据空间运行时 \(Personal Trusted Data Space Runtime, 简称 PTDS Runtime\)，而非单一的

GLP\-1 问答应用。 GLP\-1 仅作为在该 Runtime 上运行的第一个示范性业务智能体（Business Agent）。该 Runtime

在设计上具备高扩展性，**未来可无缝接入【冻结部分，仅作示意】：**

- **药物管理智能体 \(Medication Agent\)**

- **保险理赔智能体 \(Insurance Agent\)**

- **体能训练智能体 \(Physical Training Agent\)**

- **睡眠管理智能体 \(Sleep Agent\)**

- **膳食营养智能体 \(Nutrition Agent\)**

## 核心设计原则 \(Core Principles\)

1. 个人数据不出域 \(Personal data never leaves PTDS\)：所有原始个人数据仅存储在本地 PTDS 内部，外部 Agent只能通过受控的本地查询接口获取脱敏或关联结果，严禁向外发送原始数据。

2. 凡答必有据 \(Every AI answer must be supported by evidence\)：Agent 产生的所有结论与决策，必须追溯到具体的本地数据源或规则条目，生成不可篡改的证据链。

3. 凡行必审计 \(Every Agent action must be auditable\)：Agent 的每一步推理、工具调用、数据查询均由 Runtime 捕获并记录审计日志。

4. Agent 与平台解耦 \(GLP\-1 is only the first business Agent\)：Runtime 仅提供数据隔离、工具调用、审计和存证等基础能力，业务逻辑由上层 Agent 决定。

# 架构冻结与演示范围 \(Architecture Freeze \& Demo Scope\)

为确保在 5 天内交付，架构设计已冻结。只实现以下最小闭环演示流程，不进行任何非必要的视觉设计、重构或功能扩张。

![image\.png](图片和附件/image%201.png)

## 系统架构 \(System Architecture\)



![image\.png](图片和附件/image%204.png)

### 系统职责说明

|系统名称|系统职责|关键设计约束|
|---|---|---|
|**PTDS System \(PTDS系统\)**|提供本地安全隔离的结构化存储。管理用户个人的基本健康指标（如体重、血糖、历史处方等）。|仅支持本地 SQLite 实例，不连接任何外部云端数据库。|
|**AI Ready Dataset System \(AI就绪数据集系统\)**|提供静态只读的标准医学/临床参考数据集（如 GLP\-1 适应症规则、禁忌症标准、剂量推荐表）。|作为 SQLite 字典表导入或作为本地只读 JSON 数据存在。|
|**Agent Runtime System \(智能体运行时系统\)**|负责管理 Agent 生命周期，协调 Text2SQL 执行、本地 SQLite 库访问、规则过滤器校验，并触发审计与存证。|作为调度核心，所有数据交互流经此处时需进行格式规范。|
|**Runtime Audit System \(运行时审计系统\)**|实时捕获 Agent 执行链路上的每个关键事件（SQL 生成、查询结果、规则比对结果、决策输出）。|格式化为标准审计事件，写入本地审计追踪日志。|
|**Evidence Ledger System \(凭证账本系统\)**|接收审计日志并生成基于哈希关联的数据凭证（Evidence Ledger Entry），确保不可篡改性。|模拟链上或不可篡改账本行为，生成本地加密哈希文件。|
|**Business Agent System \(业务智能体系统\)**|挂载具体的业务逻辑。首期实现 **GLP\-1 Agent**，负责评估用户是否适合使用 GLP\-1 类药物，并输出依据。|必须为纯声明式、基于 Prompts \+ Tools 的 Agent，不包含硬编码的业务规则。|
|**UI System \(UI系统\)**|单页面应用（SPA），提供直观的对话、PTDS 数据库浏览器、运行时审计面板、凭证账本追踪面板。|无状态设计，全部通过标准 JSON 接口与 Agent Runtime 交互。|

## 功能分解 \(Functional Decomposition\)

### PTDS System \(PTDS 系统\)

|子功能|目的|输入|输出|依赖|负责人|优先级|
|---|---|---|---|---|---|---|
|**PTDS\.Init**|初始化本地 SQLite 数据库并导入用户基础健康数据模板|用户基础特征、健康指标数据|成功/失败状态码|SQLite 驱动|Developer A|P0|
|**PTDS\.Query**|接收 SQL 并在本地执行，返回结构化数据集|SQL 语句|JSON 格式的查询结果集|SQLite 驱动|Developer A|P0|

### AI Ready Dataset System \(AI 就绪数据集系统\)

|子功能|目的|输入|输出|依赖|负责人|优先级|
|---|---|---|---|---|---|---|
|**Dataset\.Load**|加载内置的 GLP\-1 临床指标、禁忌症标准数据到只读表|无|只读表加载完成信号|SQLite / JSON Parser|Developer A|P0|

### Agent Runtime System \(智能体运行时系统\)

|子功能|目的|输入|输出|依赖|负责人|优先级|
|---|---|---|---|---|---|---|
|**Runtime\.Text2SQL**|将用户自然语言转换为标准 SQLite 查询语句|自然语言 \(NL\)|标准 SQL 字符串|LLM API|Developer B|P0|
|**Runtime\.ExecRule**|将数据库查询结果与临床标准（AI就绪数据）进行逻辑对比|SQL查询结果, 临床规则|规则比对通过/拒绝矩阵（JSON）|无|Developer B|P0|
|**Runtime\.Dispatch**|调度 GLP\-1 Agent 进行最终推理并整合上下文|规则对比矩阵, 历史对话|最终 Agent 文本回答|LLM API|Developer B|P0|

### Runtime Audit System \(运行时审计系统\)

|子功能|目的|输入|输出|依赖|负责人|优先级|
|---|---|---|---|---|---|---|
|**Audit\.Record**|记录流程中的每一步，生成不可变的 JSON 审计日志|事件源, 动作, 输入, 输出, 状态|审计日志条目 \(Audit Entry\)|无|Developer C|P0|

### Evidence Ledger System \(凭证账本系统\)

|子功能|目的|输入|输出|依赖|负责人|优先级|
|---|---|---|---|---|---|---|
|**Ledger\.Commit**|为审计日志生成防篡改证据链，并对其计算 SHA\-256 哈希|审计日志条目 \(Audit Entry\)|凭证收据 \(Receipt JSON\)|SHA\-256 算法|Developer C|P0|

### Business Agent System \(业务智能体系统\)

|子功能|目的|输入|输出|依赖|负责人|优先级|
|---|---|---|---|---|---|---|
|**Agent\.GLP1Decision**|评估用户当前生理状态是否符合 GLP\-1 处方/用药标准|用户体征指标, 规则比对矩阵|处方建议, 循证依据（引用数据）|LLM API|Developer B|P0|

### UI System \(UI 系统\)

|子功能|目的|输入|输出|依赖|负责人|优先级|
|---|---|---|---|---|---|---|
|**UI\.RenderAll**|渲染一站式 Dashboard：包含对话、PTDS 数据库视图、审计链路与凭证账本|后端 API 返回的系统状态、Chat 响应、审计树|用户可见的交互页面|React / Tailwind CSS|Developer D|P0|

## 运行时流程 \(Runtime Flow\)

演示流程中各个步骤的具体流转定义：

![image\.png](图片和附件/image%202.png)

## 页面规范 \(Page Specification\)

系统采用单页面仪表盘（Single\-Page Dashboard）设计，分为五个核心逻辑区块：

![image\.png](图片和附件/image.png)

### Landing \& PTDS Initialization \(落页与 PTDS 初始化区\)

- 目的：供演示者配置、生成初始的本地个人健康数据库，并加载只读医学数据集。

- 组件：

    - 体征输入项（体重、身高、HbA1c）。

    - 禁忌症勾选框（甲状腺髓样癌病史、胰腺炎病史）。

    - 「初始化并挂载 PTDS」按钮。

- 交互：点击按钮后，向后端发送初始化请求，成功后前端点亮“PTDS已挂载”状态，并显示 SQLite 数据库浏览表格。

- 输出：触发初始化 API，并在 UI 侧更新“区块 B”的表格数据。

### PTDS Data Browser \(数据空间状态浏览器

- 目的：直观展示“数据不出域”原则，用户能亲眼看到数据保存在本地 SQLite。

- 组件：

    - 表名切换下拉框（user\_biometrics 与只读的 glp1\_clinical\_rules）。

    - 动态数据表格。

- 交互：无状态，仅展示。当在对话区更新个人数据时，此处会刷新数据。

### Trustworthy Chat Panel \(可信问答交互区\)

- 目的：演示主要的自然语言交互流。

- 组件：

    - 对话历史展示区。

    - 用户文本输入框、发送按钮。

- 交互：发送提问后显示 Loading 状态，流式或一次性显示 AI 回复，同时回复中必须包含 「证据标签 \(Evidence Tag\)」，鼠标 hover 时显示支撑此判断的数据库实际数值及临床规则。

### Runtime Audit Panel \(运行时审计面板\)



- 目的：展示“凡行必审计”原则，实时可视化展示智能体在后台的动作路径。

- 组件：

    - 树状时间轴（Timeline / Tree\-view）。

    - 步骤详情卡片（可展开，查看生成的 SQL 语句、数据库返回的原始 JSON、规则引擎计算矩阵）。

- 交互：随 Chat 请求的生命周期实时、按步骤追加并展示。

### Evidence Ledger Panel \(凭证账本面板\)

- 目的：展示“凡答必有据”原则的防篡改证明。

- 组件：

    - 凭证卡片流。

    - 哈希链条关系连线图。

    - JSON 格式的区块原始数据查看器。

- 交互：每次对话及决策完成后，新增一个证据卡片，展示当前哈希及前序哈希，并显示校验成功的绿色徽标（Verified）。

## 智能体规范 \(Agent Specification\)

本系统包含两个内部功能性 Agent/转换器，以及一个核心业务 Agent。

### Text2SQL Converter \(结构化数据转换智能体\)

- 职责：将用户输入的自然语言转化为对 SQLite 数据库的精确只读 SELECT 语句。

- 输入：

    - user\_query \(String\): 用户的聊天提问。

    - database\_schema \(String\): SQLite 的 DDL 语句定义。

- 输出：仅包含 SELECT 查询的 SQL 字符串。

- 工具：无。

- Prompt 职责：

    - 明确要求输出纯 SQL 代码，禁止包含任何 Markdown 标记或额外解释。

    - 强制限制：只能生成 SELECT 语句，严禁生成 INSERT, UPDATE, DELETE, DROP 等写操作语句。

- 防止幻觉策略：

    - 如果用户提问与 DDL 中的表或字段无任何关联，必须输出空字符串或指定错误标志。

    - 严格限定只对已知的表名和列名进行匹配，严禁捏造不存在的列。

### Rule Evaluation Agent \(规则匹配器 \- 逻辑引擎\)

- 职责：对 SQLite 查询结果与内置标准（AI Ready Dataset）进行匹配。

- 输入：

    - query\_results \(JSON\): 从 PTDS 查出的用户体征。

    - rules\_metadata \(JSON\): 临床用药指征/禁忌症规则集。

- 输出：

    - evaluation\_matrix \(JSON\): 规则比对矩阵，明确标示各项指标是 PASS 还是 FAIL。

- 工具：无。

- Prompt 职责 / 逻辑规范：

    - 该部分使用声明式的 Prompt，让 LLM 做精准匹配，或直接通过轻量级 Python Rule Matcher 模块运行。

    - 若使用 LLM 进行对比，Prompt 必须指定：严格执行数学区间对比（例如：BMI \\ge 27\.0 为 PASS），严禁泛化。

### GLP\-1 Business Agent \(核心业务决策智能体\)

- 职责：根据数据匹配结果，撰写给用户的最终评估报告。

- 输入：

    - evaluation\_matrix \(JSON\): 规则校验结果。

    - user\_biometrics \(JSON\): 用户的真实体征指标。

    - user\_query \(String\): 用户原始问题。

- 输出：

    - final\_response \(String\): 评估意见。

    - citations \(List\[Citation\]\): 引用来源列表（标明具体引用的数据库字段值与规则条目）。

- 工具：无。

- Prompt 职责：

    - 必须仅根据输入的 evaluation\_matrix 和 user\_biometrics 进行判断。

    - 必须在最终回答中以 \[Evidence \#N\] 的格式对事实性数据和规则进行引用。

- 防幻觉策略 \(Never Hallucinate Policy\)：

    - 如果 user\_biometrics

    为空或不包含判断所需的字段，必须回答：“由于本地数据空间缺少关键健康指标（如体重/血糖），无法做出用药评估，请先完善本地数据空间配置。”

    - 严禁臆造任何不在输入上下文中的生理指标或医学规则。

## 数据规范 \(Data Specification\)

### SQLite Schema \(本地个人数据空间 Schema\)

SQLite 包含两张表：

1. user\_biometrics（用户个人健康体征表，动态）

2. glp1\_clinical\_rules（GLP\-1 用药指征与禁忌症规则表，AI就绪静态数据集）

    

\-\- 用户生理指标表

CREATE TABLE user\_biometrics \(

id INTEGER PRIMARY KEY AUTOINCREMENT,

updated\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,

weight\_kg REAL NOT NULL,

height\_cm REAL NOT NULL,

bmi REAL NOT NULL,

hba1c\_percent REAL NOT NULL,                    \-\- 糖化血红蛋白比例

thyroid\_medullary\_cancer\_history INTEGER NOT NULL, \-\- 0=无, 1=有 \(甲状腺髓样癌病史\)

pancreatitis\_history INTEGER NOT NULL            \-\- 0=无, 1=有 \(胰腺炎病史\)

\);



\-\- GLP\-1 临床用药标准表 \(静态只读\)

CREATE TABLE glp1\_clinical\_rules \(

rule\_id TEXT PRIMARY KEY,

rule\_name TEXT NOT NULL,

rule\_type TEXT NOT NULL,                         \-\- INDICATION \(适应症\) 或 CONTRAINDICATION \(禁忌症\)

target\_field TEXT NOT NULL,                      \-\- 校验的数据库字段

condition\_operator TEXT NOT NULL,                \-\- 操作符: \>=, ==, \!= 等

threshold\_value REAL NOT NULL,                   \-\- 阈值

error\_message TEXT NOT NULL                      \-\- 规则未通过时的提示语

\);



### Evidence Schema \(凭证规格\)

每次决策产生的凭证文件格式：



\{

"$schema": "http://ptds\-runtime\.org/schemas/evidence\.json",

"evidence\_id": "ev\_01j7y21x890a9b\.\.\.",

"timestamp": 1780286400,

"data\_context\_hash": "2ef7bde608ce5404e97d5f042f95f89f1c232871",

"rules\_context\_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e46",

"agent\_decision\_hash": "f2ca1bb6c7e907d06dafe4687e579fce76b377aa",

"previous\_evidence\_hash": "a89c3b87612d1b\.\.\.",

"proof": \{

"signature\_algorithm": "SHA\-256",

"hash\_value": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"

\}

\}



### Audit Event Schema \(审计事件规格\)

审计事件在执行中被逐条捕获：



\{

"event\_id": "aud\_01j7y21y11029c\.\.\.",

"step": "TEXT2SQL\_GEN",

"timestamp": 1780286401,

"component": "AgentRuntime\.Text2SQL",

"input": \{

"user\_query": "我可以使用司美格鲁肽吗？"

\},

"output": \{

"generated\_sql": "SELECT bmi, hba1c\_percent, thyroid\_medullary\_cancer\_history FROM user\_biometrics ORDER BY id DESC LIMIT 1;"

\},

"status": "SUCCESS"

\}



### Dataset Metadata \(数据集元数据\)



\{

"dataset\_id": "glp1\_ready\_v1",

"name": "GLP\-1 Clinical Guidelines Matrix",

"version": "1\.0\.0",

"publisher": "Clinical Guidelines Consortium",

"hash": "d5a89f921a4bc5c\.\.\.",

"schema\_type": "SQLite\-Relation"

\}



### Runtime Context JSON Contract \(运行时上下文交互合约\)

此合约对象在 Agent Runtime 内存中流转，并在最后作为响应发送给 UI。



\{

"session\_id": "sess\_01j7y\.\.\.",

"user\_query": "我可以使用司美格鲁肽吗？",

"pipeline\_stages": \{

"text2sql": \{

"sql": "SELECT weight\_kg, bmi, hba1c\_percent, thyroid\_medullary\_cancer\_history, pancreatitis\_history FROM user\_biometrics ORDER BY id DESC LIMIT 1;",

"duration\_ms": 120

\},

"db\_query": \{

"raw\_data": \{

"weight\_kg": 85\.0,

"bmi": 29\.4,

"hba1c\_percent": 6\.8,

"thyroid\_medullary\_cancer\_history": 0,

"pancreatitis\_history": 0

\}

\},

"rule\_evaluation": \{

"evaluated\_rules": \[

\{ "rule\_id": "R01", "name": "BMI \>= 27", "status": "PASS", "value": 29\.4 \},

\{ "rule\_id": "R02", "name": "No Thyroid Cancer", "status": "PASS", "value": 0 \}

\]

\},

"agent\_decision": \{

"response": "根据您的生理指标（BMI: 29\.4, 糖化血红蛋白: 6\.8%）且无相关禁忌症，您符合司美格鲁肽的临床用药指征。",

"citations": \[

\{ "source": "user\_biometrics\.bmi", "value": "29\.4" \},

\{ "source": "glp1\_clinical\_rules\.R01", "rule\_name": "BMI \>= 27" \}

\]

\}

\},

"audit\_trail\_id": "aud\_01j7y\.\.\.",

"evidence\_ledger\_receipt": \{

"block\_height": 12,

"proof\_hash": "9f86d081884c7d65\.\.\."

\}

\}



### 接口规范 \(Interface Specification\)

接口设计严格遵循单向数据流原则，各接口协议已冻结。



\[UI System\] ──\(1\) POST /api/ptds/init ──\> \[PTDS System\]

\[UI System\] ──\(2\) POST /api/agent/chat ──\> \[Agent Runtime\]

│

├──\(3\) Execute SQL ──\> \[PTDS SQLite\]

├──\(4\) Write Log ────\> \[Runtime Audit\]

└──\(5\) Commit Proof ──\> \[Evidence Ledger\]



#### PTDS 初始化接口 \(Interface Freeze\)

- 路径：POST /api/ptds/init

- 依赖：UI \-\> PTDS System

- 请求格式 \(JSON\)：

    

\{

"weight": 85\.0,

"height": 170\.0,

"hba1c": 6\.8,

"thyroid\_cancer\_history": 0,

"pancreatitis\_history": 0

\}



- 响应格式 \(JSON\)：

    

\{

"status": "success",

"message": "PTDS initialized successfully\.",

"db\_file": "\./local\_ptds\.db",

"records\_inserted": 1

\}



#### 对话与推理管线接口 \(Interface Freeze\)

- 路径：POST /api/agent/chat

- 依赖：UI \-\> Agent Runtime System

- 请求格式 \(JSON\)：

    

\{

"session\_id": "sess\_01j7y\.\.\.",

"message": "我可以用司美格鲁肽吗？"

\}



- 响应格式 \(JSON\)： 返回完整的 Runtime Context JSON Contract（详见第 6\.5 节）。

    

## 迭代待办列表 \(Sprint Backlog\)

项目总开发周期 5 天，以下为每日任务拆解。

### 任务矩阵 \(Task Matrix\)

|系统名称|功能模块|任务描述|负责人|优先级|依赖项|验收标准 \(Acceptance Criteria\)|
|---|---|---|---|---|---|---|
|**PTDS**|Init \& Base|**Task 101**: 编写 SQLite 初始化脚本，建表并预置 GLP\-1 临床规则数据。|Dev A|P0|无|运行脚本后本地生成可查询的 `.db` 文件，包含静态规则数据。|
|**PTDS**|Local API|**Task 102**: 实现 `POST /api/ptds/init` 接口。|Dev A|P0|Task 101|接口接收生理数据，插入 `user_biometrics` 表，返回成功。|
|**Agent**|Text2SQL|**Task 201**: 封装 LLM Prompt，实现自然语言到 SQLite `SELECT` 的精准转换。|Dev B|P0|无|输入“我的BMI是多少”能返回格式完备且无 Markdown 标记的 SQL。|
|**Agent**|Logic Engine|**Task 202**: 编写轻量级比对逻辑，将 SQL 查询结果与 `glp1_clinical_rules` 数据表做对比。|Dev B|P0|Task 101|输入查询结果与规则，输出合规结果矩阵 JSON。|
|**Agent**|Host \& Orchestrate|**Task 203**: 实现 `POST /api/agent/chat` 控制流整合。|Dev B|P0|Task 102, 201, 202|整合整个管线逻辑，实现完整链路流转。|
|**Audit**|Logging|**Task 301**: 编写审计日志监听与收集模块，记录执行上下文。|Dev C|P0|Task 203|每次 Chat 结束，均在本地追加写入一条 JSON 审计日志。|
|**Ledger**|Hash Chain|**Task 401**: 实现哈希链式计算与虚拟签名生成器。|Dev C|P0|Task 301|输入审计日志，产出包含 `previous_hash` 和当前 `hash_value` 的凭证文件。|
|**UI**|Chat \& Dashboard|**Task 501**: 实现单页面 React 控制台，开发配置表单与对话窗口。|Dev D|P0|无|静态页面就绪，表单和 Chat 交互界面布局完成。|
|**UI**|Audit Panel|**Task 502**: 开发可视化的运行时审计面板与凭证账本组件。|Dev D|P0|Task 501|能够动态展示来自后端 API 响应中的审计树和账本哈希。|
|**UI**|Integration|**Task 503**: 前后端联调，打通整体演示闭环。|Dev D|P1|Task 203, 301, 401, 502|完整演示流成功跑通。|



## 完成定义 \(Definition of Done \- DoD\)

所有功能模块必须严格满足以下五项标准，否则状态统一记为 Not Done：

### Runnable \(可运行\)

- 所有后端代码必须能够在本地环境中通过单一指令（如 npm run dev 或 python main\.py）拉起。

- 数据库完全运行在本地，不产生任何外部数据库连接依赖。

### Demo Ready \(演示就绪\)

- 前端界面能在 Chrome 浏览器中稳定呈现。

- 提供一键重置（Reset）按钮，方便在演示过程中随时清除数据库与状态，重新进行完整链路演示。

### Auditable \(可审计\)

- 运行过程中，每一个后台决策阶段必须向审计系统注册事件。

- 审计日志输出必须能够无缝在前端“运行时审计面板”展示，不可缺失任何一个决策关键步骤。

### Evidence Generated \(凭证生成\)

- 最后的推理建议输出后，本地必须生成对应的 Evidence Ledger JSON 文件。

- 该文件必须包含上一区块哈希与当前区块哈希，且能通过本地哈希完整性校验。

### No Blocking \(无阻碍缺陷\)

- 不得存在破坏核心流程（初始化 \-\> 提问 \-\> 查询 \-\> 规则过滤 \-\> 最终回答 \-\> 审计/存证）的 Bug。

- 任何在演示流程（Demo Scope）外的多余功能、高保真视觉打磨、未声明的第三方库引入，均视作违反 DoD 约束。

# 智能体集群协同与关键流程衔接说明

为了支持未来多智能体（如 Medication Agent、Insurance Agent 等）的横向扩展，并确保当前 Demo 架构的健壮性，本节补充**智能体集群协同机制（Multi\-Agent Collaboration）及关键流程衔接（Workflow Handshake）**的详细设计。

## 智能体集群协同架构 \(Multi\-Agent Collaboration Architecture\)

在 PTDS Runtime 中，智能体不再是孤立的问答对，而是作为拓扑协同集群运行。运行时通过一个轻量级的\*\*管道协调器（Pipeline Coordinator）\*\*进行非阻塞式调度。

集群内预定义三类角色智能体：

1. 数据提取智能体 \(Data Extraction Agent \- e\.g\., Text2SQL\)：负责将非结构化意图安全转化为受控的本地 SQL 指令。

2. 合规审计智能体 \(Compliance \& Rule Agent \- e\.g\., Rule Evaluator\)：负责将提取的数据与只读医学共识进行物理区间比对，充当决策沙盒。

3. 业务决策智能体 \(Business Agent \- e\.g\., GLP\-1, Medication\)：负责基于沙盒输出的安全矩阵，面向用户输出最终可读决策。

### 集群协同拓扑图

![image\.png](图片和附件/image%203.png)

## 关键流程衔接与握手协议 \(Key Workflow Handshake Contracts\)

为确保各智能体在单次请求生命周期内能够无缝衔接且不发生上下文丢失，系统定义了三个关键的握手协议（Handshake Contracts）。

### 握手 1：数据提取与库检索衔接 \(Text2SQL \-\> PTDS Engine\)

- 目的：将自然语言翻译结果安全地传递给 SQLite 执行引擎。

- 规约协议：

    

\{

"source\_agent": "Text2SQLAgent",

"target\_system": "PTDS\_SQLite\_Engine",

"handshake\_payload": \{

"sanitized\_sql": "SELECT bmi, hba1c\_percent, thyroid\_medullary\_cancer\_history FROM user\_biometrics ORDER BY id DESC LIMIT 1;",

"read\_only\_verification": true,

"allowed\_tables": \["user\_biometrics"\]

\}

\}



- 异常处理：若 read\_only\_verification 为 false（检测到非 SELECT 动作），PTDS 引擎立即阻断执行，并向审计系统抛出SECURITY\_BREACH\_ATTEMPT 事件。



### 握手 2：数据就绪与合规校验衔接 \(PTDS Engine \-\> Rule Evaluator\)

- 目的：将提取的用户生理指标输入给规则引擎，与 AI Ready 临床规则进行匹配。

- 规约协议：

    

\{

"source\_system": "PTDS\_SQLite\_Engine",

"target\_agent": "RuleEvaluationAgent",

"handshake\_payload": \{

"biometric\_snapshot": \{

"bmi": 29\.4,

"hba1c\_percent": 6\.8,

"thyroid\_medullary\_cancer\_history": 0

\},

"active\_ruleset": "glp1\_indications\_rules\_v1"

\}

\}



### 握手 3：合规矩阵与业务决策衔接 \(Rule Evaluator \-\> Business Agent\)

- 目的：将严格计算出的 PASS/FAIL 边界矩阵交付给具体的业务决策智能体（如 GLP\-1 Agent），进行最终拟人化回复生成。

- 规约协议：

    

\{

"source\_agent": "RuleEvaluationAgent",

"target\_agent": "GLP1BusinessAgent",

"handshake\_payload": \{

"original\_query": "我可以使用司美格鲁肽吗？",

"evaluation\_matrix": \{

"Rule\_BMI\_Check": \{ "status": "PASS", "value": 29\.4, "threshold": "\>=27\.0" \},

"Rule\_Cancer\_Check": \{ "status": "PASS", "value": 0, "threshold": "==0" \}

\},

"evidence\_hash\_chain": "sha256\-d5a89f921a4bc5c\.\.\."

\}

\}



## 集群可扩展性设计：挂载新智能体 \(Extensibility: Registering Future Agents\)**【冻结，仅作示意】**

当未来引入 Insurance Agent \(保险理赔智能体\) 时，无需重构 Runtime 核心。新智能体只需实现标准的输入输出合约，即可接入集群：



\+\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\+

\|  Runtime Pipeline Coordinator      \|

\+\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\+

\|

\+\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\+\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\+

\| 路由分发 \(Route Dispatch\)                        \|

v                                                 v

\[意图 = GLP\-1 咨询\]                                  \[意图 = 保险理赔\]

\|                                                 \|

v                                                 v

\[调用 GLP\-1 Agent\]                                \[调用 Insurance Agent\]

- 依赖: glp1\_clinical\_rules                        \- 依赖: insurance\_policy\_rules

- 输出: 临床评估意见                                \- 输出: 理赔比例及免赔额计算

    

1. 配置注册：在系统中添加新的规则表（如 insurance\_policy\_rules）到本地 SQLite。

2. 意图路由：管道协调器根据用户输入的语义特征，将 Rule Evaluation Matrix 路由给注册的 InsuranceAgent。

3. 通用存证：新 Agent 产生的所有决策数据同样通过标准 Runtime Context 合约直接导入 Runtime Audit 与 Evidence

Ledger 写入本地，保持平台底层的通用性。

