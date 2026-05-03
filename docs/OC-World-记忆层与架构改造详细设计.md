# OC World 记忆层与架构改造详细设计

> 适用仓库：`/Users/pika/ai-pika/oc-world`
> 
> 当前结论：**OC World 已经落地 ContextSnapshot、统一记忆仓骨架、growth pipeline、work-item/project 与轻量 recall；下一步重点不是继续堆主动性，而是补 session/event stream、writeback ledger、LLM 反思蒸馏与 drift governance。**
> 
> 关键依据：
> - 聊天主链：`electron/services/chat-engine.ts`
> - AirJelly 上下文接入：`electron/services/airjelly.ts`
> - Prompt 组装：`electron/services/prompt-builder.ts`
> - 现有本地记忆：`electron/services/memory.ts`
> - 类型定义：`src/types/index.ts`
> - IPC 边界：`electron/ipc.ts`
> - 当前统一记忆仓：`electron/services/unified-memory.ts`
> - 当前上下文快照：`electron/services/context-snapshot.ts`
> - 当前成长流水线：`electron/services/growth-pipeline.ts`
> - 当前 recall：`electron/services/recall.ts`、`electron/services/recall-service.ts`
> - 外部启发：LISA 的 agent event loop / reflection pattern
> - 风险修正：Agent 系统性飘移治理要求 event、memory writeback、evaluator、guardrail 全链路可观测

# 第1章 总体说明

## 1.1 项目背景

OC World 当前已经具备以下能力：

- Electron 桌面壳运行
- 基于 React + Electron 的前后端分层
- 聊天主链已经跑通
- 已接入 Hermes Runtime；当前在聊天主链中主要作为 OpenAI-compatible 模型/API 网关与独立运行时，不是主 agent 的 tool-use loop
- 已接入 AirJelly SDK 读取 `events / tasks / appUsage`
- 已接入微信摘要记忆、关系状态、角色设定、本地聊天历史
- 已落地 `ContextSnapshot`、`RetrievedMemoryBundle`、awareness、work-item、project、recall candidate / polling
- 已接入语音、图片生成、ASR 等外围能力

现有链路的核心特点是：

1. **主入口是聊天，而不是桌面观察**
2. **AirJelly 当前只是上下文来源，不是系统骨架**
3. **记忆数据以 JSON 文件形式保存在 `oc-data/` 下**
4. **统一记忆仓骨架已落地，但治理层还没落地**

当前代码表现如下：

- `chat-engine.ts` 当前每轮先构造 `ContextSnapshot`，再交给 `prompt-builder.ts` 渲染 prompt，调用 LLM 后回写 relationship / history，并异步投递 `runGrowthPipeline()`。
- `airjelly.ts` 当前只拉取 AirJelly 的 `events / openTasks / dailyAppUsage`。
- `memory.ts` 当前只维护三类本地 JSON：微信摘要、OC 聊天历史、关系状态、角色配置。
- `unified-memory.ts` 当前负责 user-scoped 长期记忆、awareness、projects、recall 状态与旧全局数据 fallback。
- `work-items.ts` / `projects.ts` 当前只从明确 goal insight 聚合成长事项，避免 task/project 噪声扩散。
- `recall.ts` / `recall-service.ts` 当前按重复信号 + cooldown 生成带上下文细节的 soft hint，并支持 polling。
- `llm.ts` 当前只是一次 chat completions 调用与结构化响应解析，没有 tool schema、tool result 回填、turn loop。
- 当前缺少 session/event bus，无法完整回答“本轮哪些状态被写回、为什么写回、会不会导致下轮更偏”。

这意味着 OC World 现在更像：

**陪伴式聊天产品 + 多源上下文拼接**

它还不是：

**拥有统一 event → context → memory → writeback ledger → recall/task 的可治理成长型 Agent OS**

这次改造的目标，不是把 OC World 直接改成 AirJelly 或 LISA 的复制品，而是让它在不打散现有产品链路的前提下，升级成：

**以 Cola 式记忆架构为骨架，吸收 AirJelly 式现实上下文输入，借鉴 LISA 式事件流与反思蒸馏，同时具备写回治理与漂移防护的陪伴型成长 Agent。**

## 1.2 设计思路

本次改造采用四条原则：

### 原则零：先治理，再主动

Agent 真正危险的不是单轮答错，而是多轮闭环中目标、记忆、工具、评估信号逐步偏移，最终形成“局部看似合理、全局已经错误”的系统性飘移。

因此本次架构优先补：

- session / event stream
- 状态写回账本
- LLM 反思蒸馏的候选态与确认态
- drift guardrails 与可观测信号

在这些能力稳定之前，不提前把 heartbeat / 自动执行做重。

### 原则一：先收拢记忆，再扩张能力

当前 `oc-data/` 下的记忆是分散的：

- `memories/wechat/*.json`
- `memories/oc_conversations/*.json`
- `relationships/*.json`
- `characters/*.json`
- `mock/airjelly-context.json`

这些数据能用，但不是统一记忆系统。

第一步必须先做统一记忆层，把关系、社交、对话、项目、角色偏好收拢到一套可持续演进的数据结构中。

### 原则二：保留聊天主入口，不把产品改散

当前 OC World 的价值表达是“搭档式陪伴”，不是纯桌面观察工具。

所以主入口仍然保持：

`用户对话 → 角色回应 → 关系变化 → 记忆更新`

而不是直接切成：

`桌面采集 → 自动理解 → 自动提醒 → 自动执行`

AirJelly 的观察链很强，但它更像操作系统层。OC World 当前还不适合直接用那套做主骨架。

### 原则三：外部项目只吸收最值钱的机制

不是全盘照搬。

本次只吸收三块：

1. **结构化现实上下文输入**
   把 AirJelly 的 `events / tasks / appUsage` 从“拼 prompt 的文本”升级成“统一 observation 输入源”。

2. **Session event stream 与反思蒸馏**
   借鉴 LISA 的 event loop 和 `reflect.ts` 反思模式，但输出 OC 专用的 awareness / candidate memory / voice hint / work-item 结构。

3. **轻量 recall / task worthy 能力**
   让系统开始识别“哪些事值得记住”“哪些信号值得提醒”“哪些状态值得升级成任务”。

不做的部分：

- 不直接复刻 AirJelly 的 screenshot pipeline
- 不直接引入 LanceDB
- 不直接做重度主动执行调度器 / heartbeat
- 不直接做 case / procedure 提炼

本次改造聚焦在：

**session event stream + 统一记忆仓 + LLM 反思蒸馏 + 写回治理 + 轻量 recall + 成长任务骨架**

---

# 第2章 需求项目清单

| 编号 | 需求项 | 来源 | 优先级 | 设计响应 |
| --- | --- | --- | --- | --- |
| R01 | 统一现有本地记忆结构 | 现有 `oc-data` 分散存储 | P0 | 3.3.1、3.5 |
| R02 | 保持现有聊天主链不被破坏 | 现有产品主入口 | P0 | 3.2.1、3.3.2 |
| R03 | 将 AirJelly 上下文从纯 prompt 文本升级为结构化 observation 输入 | 当前 `airjelly.ts` 过于轻量 | P0 | 3.2.2、3.3.3 |
| R04 | 引入 Cola 式长期记忆主文件与 voice 记忆 | 需要统一人格与关系记忆 | P0 | 3.3.1、3.5 |
| R05 | 引入 awareness 蒸馏中间层 | 需要把聊天/社交/上下文提炼成长期记忆 | P0 | 3.2.3、3.3.4 |
| R06 | 保留并升级 relationship 状态，而不是废弃 | 当前已有 intimacy/stage | P0 | 3.3.5、3.5 |
| R07 | 引入 work-item / project 结构，支撑成长型任务画像 | 现有系统没有统一工作画像层 | P1 | 3.2.4、3.3.6、3.5 |
| R08 | 增加轻量 recall 机制 | 希望从被动聊天走向适时提醒 | P1 | 3.2.5、3.3.7 |
| R09 | 增加 task-worthy 判定 | 从记忆走向任务成长 | P1 | 3.2.4、3.3.6 |
| R10 | 保证现有 IPC 与 UI 可以平滑兼容 | 当前 renderer 已依赖现有 IPC | P0 | 3.4、5 |
| R11 | 保证本地数据可迁移、可回滚 | 当前用户数据已存在 | P0 | 3.5、5 |
| R12 | 保持现有 Hermes / TTS / ASR / 图片生成功能不受影响 | 现有外围能力已可用 | P0 | 3.1、3.7、5 |
| R13 | 保留 mock / demo 能力 | 当前有 demo fallback | P1 | 3.3.3、3.7 |
| R14 | 后续可继续向 AirJelly 型成长 Agent 演进 | 产品长期目标 | P1 | 3.1、3.8、8 |
| R15 | 增加 session/event stream，记录每轮关键状态变化 | 防止 Agent 黑盒化与系统性飘移 | P0 | 3.1.2、3.2.6、3.3.9、3.4、3.9 |
| R16 | 增加状态写回账本，所有影响下轮行为的写入可追溯、可回滚 | memory / voice / relationship / work-item 写入会改变后续行为 | P0 | 3.2.7、3.3.10、3.5.10 |
| R17 | 将规则蒸馏升级为 LLM 反思蒸馏，但默认只产候选 | 现有 distillation 只做窄规则提取 | P0 | 3.2.3、3.3.4 |
| R18 | 增加 drift guardrails 和 evaluator decision log | 防止目标漂移、记忆污染、评估失真 | P0 | 3.2.8、3.3.11、6、7 |
| R19 | heartbeat / 自动执行延后到治理层稳定后 | 自动执行会放大漂移 | P2 | 3.3.12、5.1、8 |

---

# 第3章 详细设计

## 3.1 总体架构/方案概览

本次改造后的 OC World 架构分为八层。新增的核心不是“更主动”，而是“可治理”：先让系统能解释自己每一轮如何构造上下文、如何调用模型、如何写回状态、如何避免记忆污染，再逐步增加主动性。

### 3.1.1 Desktop Shell 层

职责：

- Electron 启动
- Window 生命周期管理
- Preload 与 IPC 桥接
- 权限与本地资源加载

现有承载：

- `electron/main.ts`
- `electron/preload.ts`
- `electron/ipc.ts`

本层本次不做重构，只要求新增能力通过 IPC 暴露，不破坏现有窗口与启动顺序。

### 3.1.2 Session / Event Governance 层

职责：

- 为每一轮会话创建 `sessionId / turnId`
- 记录关键事件：context、LLM、relationship、distillation、writeback、recall
- 给 renderer 推送可见事件流
- 给后续 reflection / drift evaluator 提供真实轨迹
- 为 debug、回滚、评估提供统一证据链

建议新增承载：

- `electron/services/session-events.ts`
- `electron/services/session-store.ts`
- `electron/services/event-bus.ts`

本层是新增 P0。没有本层，LLM 反思蒸馏和 heartbeat 都会变成黑盒。

### 3.1.3 Chat Runtime 层

职责：

- 聊天请求调度
- 历史会话读取
- 系统 prompt 组装
- LLM 调用
- 回复回写
- 关系状态更新

现有承载：

- `electron/services/chat-engine.ts`
- `electron/services/llm.ts`
- `electron/services/prompt-builder.ts`

本层继续保留为主入口。

重要边界：

- 当前 OC 主链不是 LISA 那种 agent tool-use loop。
- `chat-engine.ts` 仍然是一轮编排器：构造 context、调用 LLM、解析回复、更新状态。
- Hermes 当前在聊天主链中是模型/API 网关与独立运行时，不应在架构描述中误写成“主 agent 工具执行层”。

### 3.1.4 Context Intake 层

职责：

- 采集外部上下文来源
- 统一规范化为 observation
- 给聊天与记忆层同时消费

输入源包括：

- AirJelly SDK 上下文：`events / tasks / appUsage`
- 微信摘要：`memories/wechat/*.json`
- 最近对话历史：`memories/oc_conversations/*.json`
- 关系状态：`relationships/*.json`
- 角色设定：`characters/*.json`

本次改造后，这些输入不再是孤立读取，而是统一归并为一份 `ContextSnapshot`。

### 3.1.5 Memory / Reflection Engine 层

职责：

- 维护长期结构化记忆
- 维护 voice 风格记忆
- 产出 awareness 蒸馏中间层
- 将 observation / conversation / relationship change 提炼成候选记忆
- 运行 LLM 反思蒸馏
- 只产候选，不直接污染长期记忆
- 通过 writeback ledger 决定哪些候选可进入长期状态

这是本次新增的核心层。

### 3.1.6 Writeback / Drift Governance 层

职责：

- 管理所有会影响下轮行为的状态写回
- 记录写回来源、证据、置信度、目标文件、审批状态
- 管理 merged / deferred / discarded / expired / reverted 状态
- 提供 drift signal：目标漂移、记忆污染、过期事实、冲突写入、低置信度写回

建议新增承载：

- `electron/services/writeback-ledger.ts`
- `electron/services/drift-guardrails.ts`
- `electron/services/evaluator-log.ts`

这是从 demo 走向 production 的关键治理层。

### 3.1.7 Growth / Work Layer

职责：

- 管理 work-item
- 聚合 project
- 从聊天与上下文中识别 task-worthy 事项
- 为后续 recall / proactive growth 留接口

这是从“会聊天”走向“陪你成长”的关键层。

### 3.1.8 Media / Provider Runtime 层

职责：

- Hermes Runtime / OpenAI-compatible chat completions provider
- TTS
- ASR
- Image Gen

现有承载：

- `hermes-manager.ts`
- `tts.ts`
- `stepfun-asr.ts`
- `image-gen.ts`

本次不改主结构，只要求其异常不污染记忆链。后续如要把 Hermes 的工具能力纳入 OC 主链，需要单独设计 agent tool-use loop，不能在现有 chat completions 调用上默认假设已经具备。

### 3.1.9 改造后主链

改造后的主链如下：

`用户消息 → session/turn opened → ContextSnapshot built → event:context_built → Chat Runtime → LLM call → event:llm_finished → 回复 → 写入会话 → relationship update → event:state_write_proposed → LLM reflection distillation → awareness / candidates → writeback ledger → merged / deferred / discarded → long-term memory / voice / work-item / project`

可选的次链：

`AirJelly context refresh → observation normalization → event:context_refreshed → recall evaluator → drift guardrails → UI soft hint`

这条次链是本次预留，不做重度自动化执行。

heartbeat / 自动执行的后续主链必须在上述事件与写回治理稳定后再上：

`heartbeat task → event:heartbeat_started → bounded context → reflection / action proposal → writeback ledger → 用户可见结果或 silent internal note`

---

## 3.2 业务流程

### 3.2.1 对话主流程

当前流程保留，但插入统一上下文与蒸馏步骤。

改造后流程：

1. Renderer 通过 IPC 发起 `chat:send-message`
2. Session/Event 层创建 `sessionId / turnId`，记录 `turn_started`
3. Chat Runtime 读取用户输入
4. 读取 `ContextSnapshot`，记录 `context_built`
5. 读取最近会话上下文
6. 读取 `memory.md / voice.md / relationship / relevant work-items`
7. 组装 system prompt，记录 `prompt_built`
8. 调用 LLM，记录 `llm_started / llm_finished / llm_failed`
9. 返回结构化 JSON 回复
10. 写入聊天历史，记录 `history_appended`
11. 更新 relationship，但通过 writeback ledger 记录写回来源
12. 投递 LLM 反思蒸馏任务，记录 `distillation_queued`
13. 必要时产生 recall candidate / task-worthy candidate
14. 所有候选写回进入 `merged / deferred / discarded / expired / reverted` 状态

与当前的区别：

- 现在是“多份数据并行读取后直接拼 prompt”
- 改造后是“先构造统一 snapshot，再由 prompt builder 使用”
- 新增后是“每一步都可追踪，所有影响下轮行为的状态写回都可审计”

### 3.2.2 上下文采集与规范化流程

本次新增 `ContextSnapshotBuilder`。

流程：

1. 从 `getAirJellyContext()` 读取桌面现实上下文
2. 从微信摘要文件读取社交记忆摘要
3. 从聊天历史读取近期互动
4. 从 relationship 读取当前关系状态
5. 从 character 读取角色设定
6. 对这些来源做规范化，形成统一结构：
   - realtimeContext
   - socialMemory
   - relationshipState
   - conversationState
   - characterState
7. 当前不写入持久 snapshot cache；chat 与 growth pipeline 在同一轮内复用同一份 snapshot，recall polling 会重新构造 snapshot

### 3.2.3 LLM 反思蒸馏流程

本次新增 Cola 式 `awareness` 层，并将当前规则蒸馏升级为 LLM 反思蒸馏。借鉴 LISA 的 `reflect.ts` 模式，但不照搬 soul / sovereignty；OC 的反思结果必须服务于用户可确认、可纠正、可回滚的成长陪伴体验。

触发时机：

- 每轮对话完成后
- relationship 发生显著变化后
- 检测到高价值 AirJelly 上下文更新时
- 手动触发 daily distill 时

流程：

1. 收集当前轮消息、关联 snapshot、relationship delta、session event trace
2. LLM 生成一份 reflection payload
3. payload 必须包含：
   - summary
   - awareness
   - memoryCandidates
   - voiceHints
   - relationshipDelta
   - workItems
   - recallSeeds
   - confidence
   - needsUserConfirmation
4. 生成一份 awareness episode
5. 产出四段结构：
   - Key Moments
   - Behavior Signals
   - Candidate Memory Updates
   - Open Threads
6. 将候选项分类：
   - 稳定事实 → `memory.md`
   - 沟通偏好 / 在意点 / 风格约束 → `voice.md`
   - 关系事件 → `relationship` 与 `timeline`
   - 成长型事项 → `work-items`
7. 所有候选默认进入 writeback ledger，不直接改长期记忆
8. 若证据不足，保留在 `Open Threads`
9. 只有满足规则或用户确认后，才进入 `memory.md / voice.md / relationship / work-items`

反思蒸馏的硬性规则：

- 反思不能把单轮情绪当成长期事实
- 反思不能把用户玩笑、临时状态、未确认假设直接写入长期记忆
- 低置信度候选只能 deferred
- 与现有长期记忆冲突的候选必须进入 conflict 状态
- 被用户否定过的候选不得再次自动写入

### 3.2.4 成长任务流程

本次新增轻量 task-worthy 流程。

目的不是复制 AirJelly 的 task engine，而是先做成长任务骨架。

流程：

1. 从对话内容、growthEvent、AirJelly task、微信摘要里识别 task-worthy 信号
2. 若匹配已有 work-item，则更新其 summary / status / notes
3. 若不匹配，则创建新 work-item
4. 周期性按 work-item 聚合成 project
5. prompt 层只读取 relevant project/work-item 摘要，不直接扫全部历史

### 3.2.5 Recall 流程

本次只做轻量 recall，不做重度打扰。

流程：

1. 每次刷新 AirJelly context 时提取 signals：
   - appName
   - event title keywords
   - open task title
2. 滑动窗口确认连续重复出现的信号
3. 召回相关 memory / work-item / relationship key moment
4. 用规则判断是否值得提示
5. 若值得，则通过 IPC 推送轻量 UI 提示

V1 不做：

- 自动执行
- 浮动角色强打断
- 长链路 proactive workflow

### 3.2.6 Session Event Stream 流程

目标是让 OC 能回答：

- 本轮为什么朝这个方向优化
- 哪些状态被写回了
- 哪些候选被丢弃或延期了
- 哪一层可能开始漂移
- 下轮会引用哪些状态

事件类型建议：

```ts
type SessionEventType =
  | "turn_started"
  | "context_built"
  | "prompt_built"
  | "llm_started"
  | "llm_finished"
  | "llm_failed"
  | "response_parsed"
  | "history_appended"
  | "relationship_update_proposed"
  | "relationship_updated"
  | "distillation_queued"
  | "distillation_started"
  | "distillation_finished"
  | "writeback_proposed"
  | "writeback_merged"
  | "writeback_deferred"
  | "writeback_discarded"
  | "recall_candidate_created"
  | "drift_signal_detected";
```

事件记录原则：

- 事件必须有 `sessionId / turnId / createdAt`
- 事件 payload 不直接记录密钥、完整隐私原文或大段 prompt
- 对 prompt / context 可记录 hash、摘要、引用文件、token 估算
- LLM 原始输出可保留本地调试版，但 UI 默认只展示摘要
- 事件失败不能阻断聊天主链

### 3.2.7 State Writeback Ledger 流程

凡是会影响下轮行为的写入，都必须经过账本：

- `memory.md`
- `voice.md`
- `relationship`
- `growthProfile`
- `work-items`
- `projects`
- `recall/events`
- `system-reminders`

流程：

1. distillation / relationship / recall 产生写回 proposal
2. 写入 ledger，状态为 `proposed`
3. guardrail 做校验：证据、置信度、冲突、过期、敏感性
4. 满足自动合并规则则 `merged`
5. 需要用户确认则 `deferred`
6. 明显不可靠则 `discarded`
7. 用户否定或后续发现错误则 `reverted`

### 3.2.8 Drift Guardrail 流程

每轮结束后至少做轻量 drift 检查：

1. 目标是否从用户原始目标漂移
2. 写入是否把候选当成事实
3. relationship 是否被单轮情绪过度拉动
4. recall 是否因为重复信号过度触发
5. evaluator / reveal 是否只追求“看起来完成”
6. prompt 是否塞入过多长期记忆导致角色失真

V1 可以先做规则 + 日志，不需要复杂模型：

- 低置信度写回计数
- 单轮新增长期记忆数量
- relationship delta 上限
- 同类 recall 频率
- memory conflict count
- deferred backlog count

---

## 3.3 模块设计

### 3.3.1 Unified Memory Repository

当前已落地统一记忆仓骨架，由 `electron/services/unified-memory.ts` 承载。它不替代 `memory.ts` 的历史/关系读写，而是在其上增加长期记忆、awareness、work-item/project、recall 的统一读写入口。

当前目录：

```text
oc-data/
  memory/
    users/
      <userId>/
        memory.md
        voice.md
        system-reminders.md
    scopes/
      default/
        system-reminders.md     # legacy fallback
  awareness/
    users/
      <userId>/
        episodes/
        notes/
    episodes/                   # legacy fallback
  session-events/
  writeback-ledger/
  drift/
  work-items/
  projects/
    users/
      <userId>/
        projects.json
    projects.json               # legacy fallback
  recall/
    users/
      <userId>/
        events.json
        signals.json
    events.json                 # legacy fallback
    signals.json                # legacy fallback
  memories/
    wechat/
    oc_conversations/
  relationships/
  characters/
  raw/
  mock/
```

说明：

- 保留当前 `memories/`、`relationships/`、`characters/` 不动
- 已新增统一层 `memory/`、`awareness/`、`work-items/`、`projects/`、`recall/`
- `memory / awareness / projects / recall` 已按 `userId` 分路径
- `work-items` 仍以全局目录存放，但 id 带 `userId` hash，读取时按 `userId` 过滤
- 旧全局 `memory.md / voice.md` 只迁给 legacy 用户，默认 `user-001`；可用 `OC_LEGACY_MEMORY_USER_ID` 指定
- 治理层 `session-events/`、`writeback-ledger/`、`drift/` 仍是下一阶段目标

职责：

- 读写 `memory.md`
- 读写 `voice.md`
- 读写 `system-reminders.md`
- 提供 memory patch merge
- 读写 awareness episode / merge note
- 读写 user-scoped projects / recall events / recall signal states
- 兼容旧全局路径，但新写入进入 user-scoped 路径
- 暂未提供 writeback proposal、ledger 查询、event trace 落盘入口

### 3.3.2 Chat Orchestrator 改造

改造 `chat-engine.ts`。

当前已落地：

- `chat-engine.ts` 每轮只构造一次 `ContextSnapshot`
- `prompt-builder.ts` 通过 snapshot + confirmed profile summary 渲染 prompt
- LLM 返回后回写 relationship / history
- growth pipeline 异步运行，消费同一份 snapshot
- `chat-engine.ts` 不直接执行 memory merge / project 聚合 / recall 判断

下一步目标：

- 抽出 `openSessionTurn() / emitSessionEvent()`
- 抽出 `enqueueReflectionDistillation()`
- 把 relationship / memory / work-item 等影响后续行为的写入纳入 writeback ledger

当前职责：

- 只编排一轮 chat
- 构造 snapshot、调用 LLM、保存关系与历史、投递 growth pipeline

边界：

- `chat-engine.ts` 不负责记忆合并策略
- `chat-engine.ts` 不负责 project 聚合
- `chat-engine.ts` 不负责 recall 判断

### 3.3.3 Context Snapshot Builder

已落地模块：`electron/services/context-snapshot.ts`

职责：

- 统一封装以下输入：
  - AirJellyContext
  - MemorySummary[]
  - ChatHistoryEntry[]
  - Relationship
  - CharacterConfig
- 输出单一快照对象
- 在 unified memory 开启时初始化 `unified-memory.ts`
- 加载 `RetrievedMemoryBundle`
- 当前没有持久 snapshot cache；后续如引入 cache，必须在 relationship/history/memory 写回后明确失效

建议类型：

```ts
interface ContextSnapshot {
  builtAt: number;
  airjellyCtx: AirJellyContext;
  wxMemories: MemorySummary[];
  recentChat: ChatHistoryEntry[];
  relationship: Relationship;
  character: CharacterConfig;
  growthProfile: GrowthProfile;
  latentInsights: GrowthInsight[];
  retrievedMemoryBundle: RetrievedMemoryBundle;
  realtimeContext: {
    events: AppEvent[];
    tasks: TaskSummary[];
    appUsage: AppUsage[];
    source: "mock" | "airjelly";
  };
  socialMemory: MemorySummary[];
  conversationState: {
    recentChat: ChatHistoryEntry[];
  };
  relationshipState: Relationship;
  characterState: CharacterConfig;
}
```

价值：

- prompt builder 只消费 snapshot
- distiller 也消费同一份 snapshot
- recall evaluator 也消费同一份 snapshot

### 3.3.4 Distillation Engine

已落地模块：

- `electron/services/distillation.ts`
- `electron/services/memory-merge.ts`
- `electron/services/growth-pipeline.ts`

职责：

- 从对话与 snapshot 中按规则提取 awareness / evidence / insight
- 将 confirmed insight 写入 user-scoped `memory.md / voice.md`
- 低置信或未确认 insight 默认 deferred
- 生成 awareness episode 与 merge note

当前边界：

- 现在仍是规则蒸馏，不是 LLM reflection distillation
- 现在还没有 writeback ledger，`memory-merge.ts` 直接产出 `merged / deferred / discarded`
- 下一阶段要把 LLM reflection payload 作为 proposal 输入，再交给 writeback ledger 决策

V1 蒸馏目标：

- 用户长期偏好
- 关系阶段特征
- 在意点 / 触发器 / 不喜欢的沟通方式
- 最近关键事件
- 成长中的项目/困扰/关注对象
- 与本轮目标相关的 drift signal

目标 payload：

```ts
interface ReflectionDistillationPayload {
  summary: string;
  awareness: AwarenessEpisode;
  memoryCandidates: WritebackProposal[];
  voiceHints: WritebackProposal[];
  relationshipDelta: WritebackProposal | null;
  workItems: WritebackProposal[];
  recallSeeds: WritebackProposal[];
  confidence: number;
  needsUserConfirmation: boolean;
}
```

合并规则：

- 默认 `proposed`
- 低置信度 `deferred`
- 冲突候选 `deferred + conflict`
- 用户确认后 `merged`
- 用户否定后 `discarded`

V1 不做：

- case 抽取
- procedure 抽取
- 多实体图谱融合

### 3.3.5 Relationship State Adapter

当前 `relationship` 不能删，要保留并升级。

原因：

- 现有 UI 和 prompt 已直接依赖 `intimacy / stage / keyMoments / moodBaseline`
- 这是 OC World 作为“搭档”最核心的一层体验变量

改造思路：

- `relationship` 继续作为短中期互动状态
- `memory.md / voice.md` 作为更长期的认知层
- 两者职责分开：
  - relationship = 当前关系温度计
  - memory/voice = 长期理解与说话方式

### 3.3.6 Growth Task Service

已落地模块：

- `electron/services/work-items.ts`
- `electron/services/projects.ts`

职责：

- 管理 work-item
- 聚合 projects
- 给 prompt / recall 提供结构化成长任务摘要

当前 work-item 来源：

- 用户明确表达的目标/焦虑/推进项
- 实现上只从 `type === "goal"` 且未 rejected / archived 的 insight 创建或更新 work-item

暂不作为 work-item 来源：

- 单次 `growthEvent`
- 高频但未确认的对话主题
- AirJelly open task

这样做是为了控制 task/project 噪声。

建议 work-item 字段：

- id
- userId
- title
- description
- status
- source
- relatedSignals[]
- notes[]
- summary
- createdAt
- updatedAt

project 字段：

- id
- userId
- title
- description
- workItemIds[]
- confidence
- rationale
- updatedAt

### 3.3.7 Recall Evaluator

已落地模块：

- `electron/services/recall.ts`
- `electron/services/recall-service.ts`

职责：

- 从 `ContextSnapshot` 提取 task/event/appUsage 信号
- 检测重复信号
- 生成带上下文细节的 recall candidate
- 支持 `evaluateNow` 与 polling
- 通过 IPC 推送 `recall:hint`

V1 规则：

- 连续 3 次 context refresh 出现同类 app/task keyword，才触发候选 recall
- 同一类 recall 30 分钟内只提示一次
- 只发 soft hint，不直接插嘴到聊天中
- renderer 只接收当前 `activeUserId` 的 hint

### 3.3.8 Prompt Builder 改造

当前 `prompt-builder.ts` 的问题不是不能用，而是职责过重。

要改成：

- 输入只接受 `ContextSnapshot + RetrievedMemoryBundle`
- 不自己负责读取数据
- 不自己负责排序逻辑

新增一个 `RetrievedMemoryBundle`：

- longTermFacts
- voiceHints
- activeProjects
- relevantWorkItems
- recentAwarenessHighlights

这样 prompt builder 就只负责渲染，不负责数据决策。

### 3.3.9 Session Event Bus

新增模块：

- `electron/services/session-events.ts`
- `electron/services/session-store.ts`
- `electron/services/event-bus.ts`

职责：

- 创建 session / turn
- 记录事件
- 供 IPC 查询历史事件
- 向 renderer 推送当前 turn 事件
- 给 distillation / drift evaluator 提供可读 trace

建议事件模型：

```ts
interface SessionEvent {
  id: string;
  sessionId: string;
  turnId: string;
  type: SessionEventType;
  createdAt: number;
  source: "renderer" | "chat" | "llm" | "memory" | "growth" | "recall" | "system";
  summary: string;
  payload?: Record<string, unknown>;
  redaction: {
    hasRawPrompt: boolean;
    hasRawLlmOutput: boolean;
    containsSensitiveInput: boolean;
  };
}
```

落盘建议：

```text
oc-data/
  session-events/
    sessions.json
    turns/
      <sessionId>/
        <turnId>.jsonl
```

### 3.3.10 Writeback Ledger

新增模块：

- `electron/services/writeback-ledger.ts`

职责：

- 记录所有影响后续行为的写回 proposal
- 管理候选状态
- 记录证据链和回滚信息
- 支持 UI 展示“OC 这次想记住什么”

建议模型：

```ts
interface WritebackProposal {
  id: string;
  userId: string;
  turnId: string;
  target:
    | "memory"
    | "voice"
    | "relationship"
    | "growthProfile"
    | "workItem"
    | "project"
    | "recall"
    | "systemReminder";
  operation: "append" | "patch" | "replace" | "create" | "archive";
  text: string;
  evidenceEventIds: string[];
  evidenceSummary: string;
  confidence: number;
  status: "proposed" | "merged" | "deferred" | "discarded" | "expired" | "reverted";
  reason: string;
  requiresUserConfirmation: boolean;
  createdAt: number;
  decidedAt?: number;
  revertedAt?: number;
}
```

自动合并门槛：

- `confidence >= 0.75`
- 不是敏感事实
- 不与已有长期记忆冲突
- 至少有本轮事件证据
- 不是单轮临时情绪

### 3.3.11 Drift Guardrails / Evaluator Log

新增模块：

- `electron/services/drift-guardrails.ts`
- `electron/services/evaluator-log.ts`

职责：

- 检查目标漂移
- 检查记忆污染
- 检查 relationship 过度更新
- 检查 recall 误触发
- 检查 evaluator / reveal 是否只追求“看起来完成”

建议 drift signal：

```ts
interface DriftSignal {
  id: string;
  userId: string;
  turnId: string;
  type:
    | "goal_drift"
    | "memory_pollution"
    | "stale_context"
    | "writeback_conflict"
    | "relationship_overfit"
    | "recall_noise"
    | "evaluator_mismatch";
  severity: "info" | "warning" | "critical";
  summary: string;
  evidenceEventIds: string[];
  recommendedAction: "observe" | "defer_writeback" | "pause_distillation" | "ask_user" | "revert";
  createdAt: number;
}
```

### 3.3.12 Heartbeat / Proactive Runner（延后）

heartbeat 不作为当前 P0。

只有满足以下条件后再进入：

- session event stream 已稳定
- writeback ledger 已可查
- LLM 反思蒸馏默认候选化
- drift guardrails 已能阻止高风险写回
- UI 能解释“为什么主动提醒”

V1 heartbeat 只能做低打扰：

- 默认 silent
- 不自动执行高风险工具
- 只生成 soft hint 或内部整理
- 所有写回仍走 ledger

---

## 3.4 接口设计

本次改造不引入公网 API，继续使用 Electron IPC。

### 3.4.1 保留的 IPC

以下 IPC 保持兼容：

- `chat:send-message`
- `chat:get-greeting`
- `memory:summaries`
- `memory:history`
- `relationship:get`
- `relationship:save`
- `timeline:list`
- `airjelly:get-context`

### 3.4.2 新增 IPC

已落地：

| IPC 名称 | 输入 | 输出 | 用途 |
| --- | --- | --- | --- |
| `memory:get-long-term` | userId | memory sections | 读取长期记忆 |
| `memory:get-voice` | userId | voice sections | 读取 voice 记忆 |
| `awareness:list` | userId, limit | episode[] | 浏览蒸馏结果 |
| `work-items:list` | userId | workItem[] | 展示成长任务 |
| `projects:list` | userId | project[] | 展示成长项目 |
| `recall:list-recent` | userId | recall events | UI 提示列表 |
| `recall:evaluate-now` | userId, characterId? | recall events | 立即评估当前上下文 recall |
| `recall:start-polling` | userId, characterId? | boolean | 启动当前用户 recall 轮询 |
| `recall:stop-polling` | userId, characterId? | boolean | 停止当前用户 recall 轮询 |
| `recall:hint` | event push | RecallHintEvent | main process 向 renderer 推送 recall hint |
| `memory:run-distill` | userId | ok | 手动触发蒸馏 |

下一阶段建议新增：

| IPC 名称 | 输入 | 输出 | 用途 |
| --- | --- | --- | --- |
| `session-events:list` | sessionId / turnId | event[] | 查看会话事件 |
| `session-events:subscribe` | sessionId / turnId | event stream | renderer 监听当前 turn 事件 |
| `writeback:list` | userId, status | proposal[] | 查看写回候选与历史 |
| `writeback:approve` | proposalId | proposal | 用户确认写回 |
| `writeback:reject` | proposalId, feedback? | proposal | 用户拒绝写回 |
| `writeback:revert` | proposalId | proposal | 回滚已合并写回 |
| `drift:list-signals` | userId, limit | driftSignal[] | 查看漂移风险信号 |

边界：

- IPC 返回只给 renderer 可读数据
- 文件系统路径不直接暴露给 renderer
- 所有写入动作由 main process 代理
- recall polling payload 必须带 `userId`，renderer 侧只接收当前用户 hint
- 订阅事件只推送摘要和安全 payload，不默认推送完整 prompt / 原始隐私输入
- `writeback:approve/reject/revert` 必须由 main process 校验 proposal 状态

---

## 3.5 数据模型/表结构设计

### 3.5.1 现有数据结构保留

当前已存在：

- `oc-data/memories/wechat/*.json`
- `oc-data/memories/oc_conversations/*.json`
- `oc-data/relationships/*.json`
- `oc-data/characters/*.json`
- `oc-data/mock/airjelly-context.json`

这些文件全部保留。

### 3.5.2 新增目录结构

```text
oc-data/
  memory/
    users/
      <userId>/
        memory.md
        voice.md
        system-reminders.md
    memory.md              # legacy fallback，仅迁给 OC_LEGACY_MEMORY_USER_ID，默认 user-001
    voice.md               # legacy fallback，仅迁给 OC_LEGACY_MEMORY_USER_ID，默认 user-001
    scopes/
      default/
        system-reminders.md # legacy fallback
  awareness/
    users/
      <userId>/
        episodes/
          YYYY-MM-DD_<episodeId>_<title>.md
        notes/
          YYYY-MM-DD_<episodeId>.md
    episodes/              # legacy fallback
  session-events/
    sessions.json
    turns/
      <sessionId>/
        <turnId>.jsonl
  writeback-ledger/
    proposals.jsonl
  drift/
    signals.jsonl
  work-items/
    work_<ts>_<id>.json
  projects/
    users/
      <userId>/
        projects.json
    projects.json          # legacy fallback
  recall/
    users/
      <userId>/
        events.json
        signals.json
    events.json            # legacy fallback
    signals.json           # legacy fallback
```

### 3.5.3 `memory.md`

当前路径：

`oc-data/memory/users/<userId>/memory.md`

建议结构：

- Person
- Relationship
- Growth Focus
- Work / Projects
- Preferences
- Triggers
- Recent

### 3.5.4 `voice.md`

当前路径：

`oc-data/memory/users/<userId>/voice.md`

建议结构：

- 适合的语气
- 不适合的表达方式
- 何时主动关心
- 何时应克制
- 什么内容可以直说
- 什么内容要轻一点

### 3.5.5 awareness episode

当前路径：

`oc-data/awareness/users/<userId>/episodes/YYYY-MM-DD_<episodeId>_<title>.md`

每个文件采用固定四段：

- Key Moments
- Behavior Signals
- Candidate Memory Updates
- Open Threads

### 3.5.6 work-item JSON

建议结构：

```json
{
  "id": "work_...",
  "userId": "user-001",
  "title": "xxx",
  "description": "xxx",
  "status": "pending|in_progress|completed|blocked",
  "source": "chat|airjelly|manual|distillation",
  "relatedSignals": [],
  "notes": [],
  "summary": "",
  "createdAt": 0,
  "updatedAt": 0
}
```

### 3.5.7 projects.json

当前路径：

`oc-data/projects/users/<userId>/projects.json`

建议结构：

```json
{
  "version": 1,
  "generatedAt": 0,
  "userId": "user-001",
  "projects": []
}
```

### 3.5.8 recall events / signals

当前路径：

- `oc-data/recall/users/<userId>/events.json`
- `oc-data/recall/users/<userId>/signals.json`

`events.json` 记录已生成的 recall candidate：

```json
{
  "id": "recall-...",
  "userId": "user-001",
  "signal": "跑通 Chat 主链路",
  "text": "AirJelly 反复出现“跑通 Chat 主链路”：待办：跑通 Chat 主链路，进度：进行中。已经连续出现 3 次，可以轻轻提醒。",
  "source": "airjelly",
  "status": "candidate",
  "createdAt": 0
}
```

`signals.json` 记录连续出现次数和 cooldown：

```json
{
  "userId": "user-001",
  "signal": "跑通 Chat 主链路",
  "count": 2,
  "firstSeenAt": 0,
  "lastSeenAt": 0,
  "lastTriggeredAt": 0
}
```

### 3.5.9 session event JSONL

每个 turn 一个 JSONL 文件：

```json
{
  "id": "evt_...",
  "sessionId": "session_...",
  "turnId": "turn_...",
  "type": "context_built",
  "createdAt": 0,
  "source": "chat",
  "summary": "已构建 ContextSnapshot，包含 3 条最近聊天、2 条微信摘要、5 个 AirJelly events。",
  "payload": {
    "contextHash": "sha256...",
    "recentChatCount": 3,
    "memorySummaryCount": 2
  },
  "redaction": {
    "hasRawPrompt": false,
    "hasRawLlmOutput": false,
    "containsSensitiveInput": true
  }
}
```

### 3.5.10 writeback proposal JSONL

```json
{
  "id": "wb_...",
  "userId": "user-001",
  "turnId": "turn_...",
  "target": "memory",
  "operation": "append",
  "text": "用户正在推进一个 OC World 架构治理方向。",
  "evidenceEventIds": ["evt_1", "evt_2"],
  "evidenceSummary": "来自本轮用户明确指令和上下文讨论。",
  "confidence": 0.82,
  "status": "deferred",
  "reason": "影响长期记忆，等待用户确认。",
  "requiresUserConfirmation": true,
  "createdAt": 0
}
```

### 3.5.11 drift signal JSONL

```json
{
  "id": "drift_...",
  "userId": "user-001",
  "turnId": "turn_...",
  "type": "memory_pollution",
  "severity": "warning",
  "summary": "低置信度候选试图写入长期记忆。",
  "evidenceEventIds": ["evt_3"],
  "recommendedAction": "defer_writeback",
  "createdAt": 0
}
```

---

## 3.6 状态流转/时序设计

### 3.6.1 Session / Turn 状态

`session opened → turn started → context built → prompt built → llm started → llm finished → response parsed → state writeback proposed → turn closed`

### 3.6.2 对话状态

`message received → context built → llm called → response parsed → history appended → relationship update proposed → relationship updated / deferred → distillation queued`

### 3.6.3 记忆状态

`raw signals → awareness draft → reflection payload → writeback proposal → merged / deferred / discarded / expired / reverted`

### 3.6.4 关系状态

`chat turn → intimacy delta → relationship proposal → guardrail check → relationship next state → timeline update`

### 3.6.5 work-item 状态

`pending → in_progress → completed`

扩展：

- `blocked`
- `cancelled`

### 3.6.6 recall 状态

`signal detected → repeated confirm → memory retrieved → cooldown check → UI hint fired`

### 3.6.7 drift signal 状态

`signal detected → logged → recommended action → writeback deferred / user confirmation / revert / observe`

---

## 3.7 异常处理

| 场景 | 处理策略 |
| --- | --- |
| AirJelly SDK 调用失败 | 回退到 mock context，不阻断聊天 |
| 长期记忆文件不存在 | 自动创建模板文件 |
| awareness 写入失败 | 写日志，不影响当前轮回复 |
| work-item 聚合失败 | 保留当前 user-scoped projects 状态 |
| relationship 写入失败 | 当前轮提示失败并记录日志 |
| prompt builder 读取长期记忆失败 | 降级为只使用 relationship + recentChat |
| recall 服务失败 | 只禁用提示，不影响主聊天链 |
| distillation 失败 | 可手动重试，不覆盖旧记忆 |
| Hermes / TTS / ASR 失败 | 只影响对应能力，不污染 memory chain |
| session event 写入失败 | 记录内存级 fallback，不阻断聊天 |
| writeback ledger 写入失败 | 禁止合并长期记忆，当前轮只保留回复 |
| drift guardrail 报错 | 默认采取保守策略：defer writeback |
| LLM 反思输出不可解析 | 保存 raw 摘要到事件，不执行任何写回 |
| 用户拒绝写回 | proposal 标记 discarded，并把反馈作为后续 guardrail 证据 |

---

## 3.8 权限与安全控制

### 3.8.1 本地文件边界

- Renderer 不直接读写 `oc-data`
- 所有记忆文件写入统一走 main process
- 角色、关系、记忆、项目都通过 service 层写入

### 3.8.2 环境变量与密钥

当前 LLM 走环境变量配置，保持不变。

要求：

- 不把密钥写进 `oc-data`
- 不把密钥放进角色/记忆文件
- 后续如上正式版，可切换到系统 Keychain

### 3.8.3 用户隐私

- 微信摘要属于高敏感输入
- AirJelly context 属于现实行为输入
- awareness 文件属于高密度认知产物

因此必须保证：

- 所有数据默认只保存在本地
- 不对外同步
- 未来若做导出，必须让用户明确确认

### 3.8.4 写回治理与回滚

- 长期记忆写回必须有 proposal 记录
- 用户可查看、拒绝、确认、回滚写回
- 敏感事实、身份判断、长期偏好默认需要确认
- 单轮情绪和未经证实的推断不得自动写入长期记忆
- relationship 的单轮变化要设置上限，避免情绪过拟合

### 3.8.5 Drift 安全边界

以下情况必须保守处理：

- 目标从用户原始需求偏向“看起来完成”
- evaluator 只给高分但缺少证据
- 记忆候选与现有长期记忆冲突
- recall 频繁提示同类事项
- prompt 中长期记忆占比过高，导致角色输出像报告

---

## 3.9 日志、监控与告警

建议新增本地日志与审计产物：

- `chat.log`：聊天链路日志
- `distillation.log`：蒸馏与 memory merge 日志
- `recall.log`：recall 评估与触发日志
- `session-events/*.jsonl`：每轮事件轨迹
- `writeback-ledger/proposals.jsonl`：状态写回账本
- `drift/signals.jsonl`：漂移信号与处置建议

关键指标：

| 指标 | 说明 |
| --- | --- |
| chat_round_latency | 单轮聊天耗时 |
| context_build_latency | ContextSnapshot 构建耗时 |
| distill_success_rate | 蒸馏成功率 |
| memory_merge_conflict_count | 记忆冲突次数 |
| recall_trigger_count | recall 触发次数 |
| work_item_create_count | 新增长期任务数 |
| event_write_success_rate | session event 写入成功率 |
| writeback_deferred_count | 延期写回数量 |
| writeback_revert_count | 回滚写回数量 |
| low_confidence_writeback_count | 低置信度写回候选数量 |
| drift_signal_count | drift 信号数量 |
| prompt_memory_ratio | prompt 中长期记忆占比 |

V1 不需要接远程监控平台，本地日志足够。

---

# 第4章 性能管理评估分析

本次改造对性能的压力，主要来自三个点：

1. 聊天前上下文组装
2. 对话后蒸馏
3. 轻量 recall 检测

### 4.1 预期规模

- 单用户本地应用
- 聊天历史：每用户 20~5000 条
- 微信摘要：每用户几十到几百条摘要
- awareness：按天累积，数十到数百个文件
- work-item：每用户数十到数百条

### 4.2 性能目标

| 场景 | 目标 |
| --- | --- |
| 上下文构建 | < 150ms（不含 LLM） |
| 聊天主链额外开销 | < 200ms |
| 单次蒸馏 | 异步，< 5s |
| recall 评估 | < 100ms |
| work-item/project 聚合 | < 1s |

### 4.3 主要瓶颈

- `oc_conversations/*.json` 继续增长时，按文件全量读取会变慢
- `memory.md` 与 `voice.md` 若无分段控制，会影响 prompt 组装
- `awareness/episodes` 文件数持续增长后，若每次全扫会拖慢蒸馏与浏览

### 4.4 缓解措施

- 限制最近聊天窗口大小
- ContextSnapshot 暂不做持久缓存；后续若引入缓存，必须绑定 relationship/history/memory 写回失效
- 长期记忆只读取命中 section
- awareness 读取只看最近窗口
- project 聚合只扫摘要，不扫全文历史

本次改造没有高并发压力。当前 UI 仍是默认单用户入口，但存储层已经按 `userId` 做隔离，为后续多用户入口预留。

---

# 第5章 投产策略说明

## 5.1 改造阶段划分

| 阶段 | 状态 | 目标 | 产出 |
| --- | --- | --- | --- |
| Phase 0 | 下一步 | 建 session/event 与 writeback ledger 治理底座 | `session-events/`、`writeback-ledger/`、事件 IPC |
| Phase 1 | 已落地 | 建统一记忆仓骨架 | `unified-memory.ts`、user-scoped `memory/awareness/projects/recall`、旧路径 fallback |
| Phase 2 | 已落地一半 | 改 chat-engine / prompt-builder | `ContextSnapshot` 接入，聊天主链兼容；事件可观测未落地 |
| Phase 3 | 部分落地 | 上反思蒸馏 | 当前为规则 distillation + awareness + merge decision；LLM reflection payload 未落地 |
| Phase 4 | 下一步 | 上 drift guardrails / approval UI | deferred / merged / discarded / reverted 可见 |
| Phase 5 | 已落地 V1 | 上 growth task | goal insight → work-item → project，task-worthy 已收紧 |
| Phase 6 | 已落地 V1 | 上轻量 recall | repeat-count + cooldown + context-rich soft hint + polling |
| Phase 7 | 延后 | 评估低打扰 heartbeat | silent runner、soft hint、所有写回走 ledger |

## 5.2 发布前检查

| 检查项 | 要求 |
| --- | --- |
| 现有聊天能正常回复 | 必须通过 |
| relationship 不丢失 | 必须通过 |
| AirJelly context 可正常读取或正常 fallback | 必须通过 |
| 长期记忆文件可自动初始化 | 必须通过 |
| awareness 写入失败不影响聊天 | 必须通过 |
| 老数据目录不被破坏 | 必须通过 |
| session event 可记录本轮主要节点 | 必须通过 |
| writeback proposal 不会绕过 ledger 直接写长期记忆 | 必须通过 |
| 低置信度反思候选默认 deferred | 必须通过 |
| drift guardrail 失败时默认保守处理 | 必须通过 |

## 5.3 灰度策略

- 当前默认启用 unified memory、distillation、recall、recall polling
- 下一阶段先开启 session event 和 writeback ledger
- LLM reflection distillation 必须在 writeback ledger 之后启用
- drift guardrails 在 LLM reflection 之前至少要有规则版
- heartbeat 默认继续关闭

当前已实现开关：

- `OC_ENABLE_UNIFIED_MEMORY=1`
- `OC_ENABLE_DISTILLATION=1`
- `OC_ENABLE_RECALL=1`
- `OC_ENABLE_RECALL_POLLING=1`
- `OC_LEGACY_MEMORY_USER_ID=user-001`

下一阶段建议新增开关：

- `OC_ENABLE_SESSION_EVENTS=1`
- `OC_ENABLE_WRITEBACK_LEDGER=1`
- `OC_ENABLE_LLM_REFLECTION_DISTILLATION=0`
- `OC_ENABLE_DRIFT_GUARDRAILS=1`
- `OC_ENABLE_HEARTBEAT=0`

## 5.4 回滚条件

出现以下情况必须回滚：

- 聊天主链不可用
- relationship 文件被破坏
- prompt builder 因新 memory 层报错导致大面积失败
- 新增文件写入污染旧目录
- session event 或 ledger 写入导致聊天主链阻塞
- LLM 反思蒸馏直接污染长期记忆
- drift signal 暴增且无法解释

## 5.5 回滚步骤

1. 关闭新 feature flags
2. 恢复旧 `chat-engine + prompt-builder + memory.ts` 读写逻辑
3. 保留已生成的 `memory/awareness/work-items/projects/recall` 文件，但不再读取
4. 保留 `session-events/writeback-ledger/drift` 文件用于事后诊断，但不再驱动主链
5. 验证现有聊天与 relationship 正常工作

## 5.6 上线后验证

- 发一轮聊天，看是否正常回应
- 检查 `oc_conversations` 是否追加成功
- 检查 `relationship` 是否更新成功
- 检查是否生成 awareness 文件
- 检查是否生成 session event trace
- 检查是否生成 writeback proposal
- 检查低置信度候选是否 deferred
- 检查是否写入长期记忆或 work-item
- 检查 recall 是否未误触发

---

# 第6章 关键风险点评估

| 风险点 | 触发条件 | 影响 | 缓解措施 | 负责人/待确认 |
| --- | --- | --- | --- | --- |
| 记忆层过早做重 | 一次性引入太多 AirJelly 机制 | 产品主链被拖慢 | 只做 Cola 骨架 + 轻量吸收 AirJelly | 开发 |
| prompt 污染 | memory/voice 拼接过多 | 回答失真、太像报告 | prompt 只读 relevant bundle，不读全量 | 开发 |
| relationship 与 long-term memory 职责冲突 | 两套状态互相覆盖 | 角色行为混乱 | 明确 relationship=短中期，memory=长期 | 开发 |
| work-item 泛滥 | task-worthy 判定太松 | 用户界面噪声太大 | 首版只接 growthEvent 和明确目标 | 开发 |
| recall 误触发 | 规则太敏感 | 打扰感强 | 连续出现确认 + cooldown | 开发 |
| awareness 写入质量低 | 蒸馏规则过粗 | 长期记忆污染 | 先写 candidate，再 merge | 开发 |
| 旧数据迁移出错 | 直接改旧文件结构 | 现有 demo 数据损坏 | 并存迁移，不覆盖旧路径 | 开发 |
| 过度依赖 AirJelly | SDK 异常或无数据 | 产品主链不可用 | 永远保留 mock / fallback | 开发 |
| 系统性飘移 | 多轮写回目标、记忆、评估逐步偏移 | 局部正确、全局错误 | event trace + writeback ledger + drift guardrails | 开发 |
| LLM 反思过度自信 | 单轮对话被总结成长期事实 | OC 错误理解用户 | 默认候选化、低置信 deferred、用户确认 | 开发 |
| 事件层泄露敏感内容 | 原始 prompt / 隐私输入直接展示给 renderer | 隐私风险 | event payload 默认摘要化与 redaction | 开发 |
| heartbeat 放大错误 | 治理层未稳定就后台自动执行 | 错误主动性 | heartbeat 延后，默认关闭 | 开发 |

---

# 第7章 非功能性需求设计

| 类别 | 要求 | 设计方案 |
| --- | --- | --- |
| 安全性 | 本地高敏感记忆不可随意暴露 | renderer 不直读文件，main process 代理 |
| 可靠性 | 新记忆链失败不能拖垮聊天主链 | 蒸馏、recall、project 聚合全部异步/降级 |
| 可用性 | AirJelly 不可用时也能聊天 | mock / fallback 保留 |
| 可维护性 | 现有服务职责更清晰 | snapshot / distillation / recall / work-item 拆模块 |
| 可审计性 | 记忆变化要能回看 | awareness 作为中间产物保留 |
| 可治理性 | 能解释每轮为什么优化、写回什么、如何防漂移 | session event + writeback ledger + drift signal |
| 可扩展性 | 未来能演进到成长型 Agent | 预留 observation、recall、task 接口 |
| 兼容性 | 老 UI 和 IPC 不大改 | 保持现有 IPC，新增而不破坏 |
| 隐私性 | 微信摘要、关系状态、本地行为默认不出本机 | 不做云同步，不上报外部服务 |

---

# 第8章 待定问题

| 编号 | 待定问题 | 当前状态 |
| --- | --- | --- |
| Q01 | 长期记忆是否按 userId 分文件，还是先全局单文件 | 已定：`memory/users/<userId>/memory.md`；旧全局只迁给 `OC_LEGACY_MEMORY_USER_ID` |
| Q02 | awareness 是否每天合并一份，还是按会话一份 | 已定 V1：按 episode 独立 markdown，路径在 `awareness/users/<userId>/episodes/` |
| Q03 | work-item 是否需要 UI 编辑能力 | 待补充 |
| Q04 | recall 提示展示在聊天区、toast，还是角色气泡 | 已定 V1：聊天区 soft hint |
| Q05 | prompt 层是否需要显式区分“成长记忆”和“社交记忆” | 待补充 |
| Q06 | `memory.md` 是否允许用户手工编辑 | 待补充 |
| Q07 | 第二阶段是否引入 SQLite 替代部分 JSON 历史存储 | 待补充 |
| Q08 | 后续是否接入向量检索层，而不是纯文件检索 | 建议延后 |
| Q09 | session event 是否需要 UI 全量展示，还是只展示当前 turn 摘要 | 待补充 |
| Q10 | 哪些 writeback target 必须用户确认 | 待补充 |
| Q11 | drift signal 的阈值是否允许用户调节 | 待补充 |
| Q12 | heartbeat 是否需要独立的权限与静音策略 | 建议延后 |
| Q13 | ContextSnapshot 是否做缓存 | 当前不做持久 cache；若后续加入，必须在 relationship/history/memory 写回后失效 |
| Q14 | 多用户是否正式产品化 | 当前存储层已 user-scoped；UI 主流程仍是默认单用户 `user-001` |
| Q15 | task-worthy 是否继续扩张到 AirJelly open task | 当前不扩张；先保持 goal insight gate，避免 task/project 噪声 |

---

# 第9章 其他

## 9.1 关键改造入口文件

已落地关键文件：

- `electron/services/memory.ts`
- `electron/services/chat-engine.ts`
- `electron/services/prompt-builder.ts`
- `electron/services/airjelly.ts`
- `src/types/index.ts`
- `electron/ipc.ts`
- `electron/services/context-snapshot.ts`
- `electron/services/distillation.ts`
- `electron/services/growth-pipeline.ts`
- `electron/services/memory-merge.ts`
- `electron/services/unified-memory.ts`
- `electron/services/work-items.ts`
- `electron/services/projects.ts`
- `electron/services/recall.ts`
- `electron/services/recall-service.ts`

下一阶段建议新增文件：

- `electron/services/session-events.ts`
- `electron/services/session-store.ts`
- `electron/services/event-bus.ts`
- `electron/services/writeback-ledger.ts`
- `electron/services/drift-guardrails.ts`
- `electron/services/evaluator-log.ts`

## 9.2 名词说明

| 名词 | 说明 |
| --- | --- |
| ContextSnapshot | 当前一轮聊天可用的统一上下文快照 |
| Long-term Memory | 长期结构化记忆 |
| Voice Memory | 沟通风格与在意点记忆 |
| Awareness | 蒸馏中间层 |
| Session Event | 当前会话 / 当前轮次产生的可审计事件 |
| Writeback Ledger | 记录所有影响后续行为状态写回的账本 |
| Drift Signal | 表示目标、记忆、关系、评估、recall 可能开始偏移的治理信号 |
| Work Item | 成长任务单元 |
| Project | 多个成长任务的聚合画像 |
| Recall | 基于现实上下文的轻量提醒 |

## 9.3 推荐实施顺序

推荐按以下顺序继续实施：

1. 新建 `session-events/writeback-ledger/drift` 治理目录与基础类型
2. 在 `chat-engine` 周围接入 session / turn / event bus
3. 新建 `writeback-ledger`，让 relationship / memory / work-item / recall 写回先能入账
4. 把现有 `memory-merge.ts` 的 direct merge 改成 proposal → decision → merge
5. 把现有规则 distillation 包成 reflection proposal payload
6. 再接 LLM reflection distillation，但默认只产候选
7. 上 drift guardrails，先覆盖低置信写回、单轮过拟合、多用户污染、recall 频率
8. 为 writeback / recall / awareness 增加 UI 可解释入口
9. 评估是否需要 snapshot cache；如需要，先设计失效规则
10. 最后评估 heartbeat / proactive runner

## 9.4 结论

这次改造不该把 OC World 拉成另一个 AirJelly。

正确方向是：

**产品骨架继续走 Cola，现实上下文输入借 AirJelly，反思蒸馏借 LISA，但生产化底座必须先走 event stream + writeback ledger + drift governance。**

只有当 OC 能清楚回答：

- 它为什么朝这个方向理解用户
- 它哪些状态被写回了
- 哪些候选只是暂存
- 哪些记忆可能污染后续判断
- 它如何保证下一轮不会更偏

它才真正从“陪聊角色”升级成“可治理的成长搭档”。
