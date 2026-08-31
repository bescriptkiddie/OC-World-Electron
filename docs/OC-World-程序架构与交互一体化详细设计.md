# OC World 程序架构与交互一体化详细设计

## 第1章 总体说明

### 1.1 项目背景

OC World 当前是一套运行在 Electron 桌面壳中的陪伴式成长产品。现有项目已经具备聊天主链、角色配置、关系状态、成长时间线、长期记忆、AirJelly 上下文接入、Hermes 运行时、语音与图片外围能力，但这些能力还主要停留在“能跑通”的状态，尚未完全整理成一套可治理、可演进、可跨 runtime 复用的程序架构。

从现状看，系统已经具备以下基础：

- Electron 主进程、preload bridge、renderer React 应用三层分离
- 以 `chat-engine.ts` 为主的聊天编排主链
- 以 `context-snapshot.ts`、`unified-memory.ts`、`growth-pipeline.ts` 为核心的上下文与记忆骨架
- 以 `recall.ts`、`recall-service.ts` 为核心的轻量线索显露能力
- 以 `src/runtime/*` 为核心的 runtime adapter 收口方向

但当前也存在几个核心问题：

1. 聊天主链、记忆更新、growth distillation、reveal 显露、写回行为之间的治理层还不完整。
2. 平台边界虽然已有 runtime adapter 雏形，但 Electron transport 仍然是事实标准，browser fallback 与未来 iOS 铺路仍需靠统一契约约束。
3. 交互层虽有 chat-first、side-sheet、progressive disclosure 的方向文档，但缺少把“架构决策”和“交互验收标准”写在同一份设计里的统一口径。
4. 产品路线已经通过种子用户留存研究收束成一条主路径：`Day 1 先被理解 → Day 3 再被陪着行动 → Day 7 再共同看见变化`，程序架构必须服务这个路径，不能反向把产品做成高系统感、高打扰、高任务感的后台机器。

因此，本次详细设计的目标不是再单独写一份技术层重构清单，也不是只补一份 UI 交互说明，而是形成一份 **程序架构、产品体验、阶段验收三线合一的分阶段总方案**，用来指导本期落地和后续阶段演进。

### 1.2 设计思路

本次设计采用以下原则：

1. **先治理，再增强主动性**  
   在更强自动化和主动执行出现之前，优先补齐 session/event、writeback ledger、反思蒸馏候选态、drift guardrails、decision log。

2. **先保证聊天主舞台，再挂接记忆与成长**  
   所有记忆、reveal、recall、growth 能力都只能依附于主聊天链，不能取代聊天链成为新的“系统入口”。

3. **架构与交互一体化设计**  
   每个关键模块不仅要定义职责边界，还要定义它如何保障用户体验，例如：memory 为什么只能作为 side sheet、reveal 为什么只能从 receipt/discovery card/小纸条进入、关闭 drawer 后为什么必须回到同一聊天上下文。

4. **按阶段递进，而不是一次性铺开**  
   本方案按“本期可落地 + 下一阶段增强 + 后续演进边界”组织，避免把长期蓝图和当前落地混成一层。

5. **统一契约先于多端复用**  
   程序架构以业务能力契约为中心，以 `backend-interface.md` 和 runtime adapter 结构为跨平台边界，不把 Electron transport 细节继续扩散到业务层。

6. **产品路线约束架构优先级**  
   Day 1 先解决“被理解”，Day 3 再解决“被陪着行动”，Day 7 再解决“共同看见变化”。这意味着：
   - 阶段 1 架构重点必须压在 chat、context、memory、session governance 上
   - 阶段 2 再增强 reveal、growth、反馈校准
   - 阶段 3 才考虑更强的任务化与成长闭环

---

## 第2章 需求项目清单

| 编号 | 需求项 | 来源 | 阶段 | 优先级 | 设计响应 | 验收条目 |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-01 | 保持聊天作为唯一主入口 | `frontend-ux-apple-simple.md`、`frontend-interaction-benchmark.md` | 阶段1 | P0 | 3.1、3.6、3.7 | ACC-CHAT-01、ACC-CHAT-02 |
| REQ-02 | 将 Electron transport 收口在 runtime adapter 内 | `architecture-platform-boundaries.md`、`backend-interface.md` | 阶段1 | P0 | 3.1、3.3、3.4 | ACC-RUNTIME-01 |
| REQ-03 | 引入 session/event 治理层，追踪关键状态写回 | `OC-World-记忆层与架构改造详细设计.md` | 阶段1 | P0 | 3.2、3.3、3.9 | ACC-GOV-01 |
| REQ-04 | 统一记忆、growth、reveal 的 candidate/confirmed 边界 | `OC-World-记忆层与架构改造详细设计.md`、`OC-World-隐形成长系统设计.md` | 阶段1 | P0 | 3.5、3.6 | ACC-MEM-01 |
| REQ-05 | Memory 只能是 side sheet，不能替代 chat | `frontend-ux-apple-simple.md`、`frontend-interaction-benchmark.md` | 阶段1 | P0 | 3.7 | ACC-CHAT-01、ACC-A11Y-01 |
| REQ-06 | Pending / interrupt / follow-up 必须在聊天列内可见 | `frontend-interaction-benchmark.md` | 阶段1 | P0 | 3.7 | ACC-CHAT-02 |
| REQ-07 | Reveal 只能通过轻入口显露，并保留用户确认/稍后/修正权 | `OC-World-隐形成长系统设计.md`、`frontend-interaction-benchmark.md` | 阶段2 | P0 | 3.6、3.7 | ACC-REVEAL-01、ACC-REVEAL-02 |
| REQ-08 | Browser fallback 不崩，兼容无 bridge 环境 | `backend-interface.md`、`architecture-platform-boundaries.md` | 阶段1 | P1 | 3.4、3.8 | ACC-RUNTIME-01 |
| REQ-09 | AirJelly / Hermes 不可用时主聊天链仍可降级运行 | `backend-interface.md`、`README.md` | 阶段1 | P1 | 3.8 | ACC-FAIL-01 |
| REQ-10 | Day 1 以“被理解”作为首留主目标 | `02-journey-maps.md`、`06-findings-and-decisions.md` | 阶段1 | P0 | 3.2、3.7 | ACC-PROD-01 |
| REQ-11 | Day 3 轻动作建议不能滑向任务感 | `02-journey-maps.md`、`04-retention-experiments.md` | 阶段2 | P0 | 3.2、3.7 | ACC-PROD-02 |
| REQ-12 | Day 7 成长可见必须避免定义感与系统判定感 | `02-journey-maps.md`、`04-retention-experiments.md` | 阶段2 | P0 | 3.2、3.7 | ACC-PROD-03 |
| REQ-13 | 分阶段发布、灰度、回滚、验收必须明确 | 用户要求、现有架构文档 | 阶段1~3 | P0 | 5.1~5.6 | ACC-ROLL-01 |
| REQ-14 | 风险、可用性、可观测性、审计性必须前置设计 | 用户要求、现有治理文档 | 阶段1~3 | P0 | 6、7 | ACC-NFR-01 |

---

## 第3章 详细设计

### 3.1 总体架构/方案概览

程序架构按八层组织：

1. **Desktop Shell 层**  
   承载 Electron 启动、窗口生命周期、权限、资源加载、浮窗位置与拖拽等宿主能力。主要文件：
   - `electron/main.ts`
   - `electron/preload.ts`
   - `electron/ipc.ts`

2. **Bridge / Transport 层**  
   承载 `window.ocWorld` 暴露、IPC 通道、宿主能力桥接。该层只负责 transport，不承担业务语义。

3. **Runtime Adapter 层**  
   通过统一 client 收口 Electron bridge 与 browser fallback：
   - `src/runtime/electron-client.ts`
   - `src/runtime/browser-client.ts`
   - `src/runtime/context.tsx`
   - `src/runtime/use-runtime.ts`

4. **Chat Runtime 层**  
   承担一轮聊天的编排，包括上下文拼装、prompt 组装、LLM 调用、结果解析、关系更新、异步 growth 投递。主要文件：
   - `electron/services/chat-engine.ts`
   - `electron/services/llm.ts`
   - `electron/services/prompt-builder.ts`

5. **Context Intake 层**  
   将 AirJelly、聊天历史、关系状态、角色设定、长期记忆统一整理为 observation 与 `ContextSnapshot`。

6. **Memory & Growth 层**  
   承担 unified memory、awareness、growth insight、profile、evidence、work-item、project 的收敛与存储。

7. **Reveal & Recall 层**  
   承担 clue 评估、soft hint、discovery card、memory side sheet entry、确认/修正/拒绝后的状态流转。

8. **Session / Event Governance 层**  
   承担 sessionId / turnId、关键事件轨迹、writeback ledger、decision log、drift guardrails、debug/rollback 证据链。

这八层的目标不是把 OC World 抽象成一个重中台，而是确保：
- 主聊天链不散
- 记忆与成长不乱写
- reveal 不乱跳
- 多端边界不再耦死在 Electron

### 3.2 分阶段建设策略

#### 3.2.1 阶段 1：治理与主链稳定（最小可运行版本）

**目标**
- 保证聊天主舞台、runtime adapter 边界、session/event 证据链、memory candidate/confirmed 边界稳定
- 支撑 Day 1 的“被理解”体验
- 先落一版最小可运行版本，为后续真实数据埋点与功能验证提供基线

**范围**
- runtime client 与 Electron transport 收口
- chat 主链、pending、interrupt、receipt 基线稳定
- session-events / event-bus / session-store 设计与最小落地
- writeback ledger 最小落地版本
- browser fallback 可运行
- memory side sheet 的行为规范收口
- 关键交互埋点与治理埋点打通，作为后续功能调整依据

**非范围**
- 重度主动任务调度
- heartbeat 自动执行
- 强任务化闭环
- 多端正式接入
- 阶段 2 及之后的功能增强提前合并进本期

**阶段验收门槛**
- Electron 是唯一 blocking gate
- browser fallback 是兼容性验收面，不作为本期 blocking gate
- iOS/React Native/Swift 只写铺路边界，不列为 blocking gate
- 本期先通过最小可运行版本验收，再进入数据埋点观察与功能问题迭代

#### 3.2.2 阶段 2：轻量 reveal 与 growth 显露

**目标**
- 在不破坏 chat-first 的前提下，让 Day 3 / Day 7 对应的轻动作与成长线索开始可用

**范围**
- reveal candidate 队列
- discovery card / 小纸条入口
- confirm / 稍后 / 修正 / reject 流程
- growth profile confirmed 写入规范
- recall 与 reveal 优先级规则

**非范围**
- 自动任务分发
- 重度多项目编排

**阶段验收门槛**
- reveal 不打断主聊天
- side sheet 可关闭且返回原状态
- 成长线索必须可校准

#### 3.2.3 阶段 3：更强的任务与成长闭环

**目标**
- 在前两阶段稳定后，逐步引入更完整的 task-worthy、project-worthy、growth timeline 闭环

**范围**
- 更成熟的 work-item / project 归纳
- 更强的 growth 证据回放
- 多轮 relationship / growth 反馈积累

**非范围**
- 完整 Agent tool-use loop 重构
- 独立 HTTP 后端产品化

### 3.3 模块设计

#### 3.3.1 Shell / Bridge / Runtime

- `electron/main.ts`：负责宿主生命周期，不承载业务分支判断。
- `electron/preload.ts`：负责桥接暴露，不携带 renderer 业务状态。
- `electron/ipc.ts`：保持 channel 稳定，新增能力通过 IPC 暴露。
- `src/runtime/electron-client.ts`：将 `window.ocWorld` 包装为统一业务 client。
- `src/runtime/browser-client.ts`：提供无 bridge 场景的 fallback。
- `src/runtime/context.tsx` / `use-runtime.ts`：向 React 统一注入 runtime。

**边界要求**
- 业务层不直接依赖 `window.ocWorld`
- Electron transport 细节不得扩散到 `src/components/*` 与 `src/hooks/*`

#### 3.3.2 Chat Runtime

- `chat-engine.ts`：一轮对话总编排器
- `prompt-builder.ts`：仅负责 prompt 组装
- `llm.ts`：仅负责模型调用与结构化解析

**职责**
- 读取 `ContextSnapshot`
- 组装 prompt
- 调用 LLM
- 解析回复
- 更新 relationship / history
- 异步投递 `runGrowthPipeline()`

**不负责**
- 直接决定是否写入长期 growth profile
- 直接操作 renderer 交互状态

#### 3.3.3 Context Intake

- `context-snapshot.ts`：统一收口聊天、AirJelly、relationship、memory、character、growth profile
- `airjelly.ts`：提供结构化上下文来源

**边界要求**
- 上下文应先规范化为 observation，再提供给 chat 与 growth
- AirJelly 只是 observation 输入源，不是系统骨架

#### 3.3.4 Memory & Growth

- `unified-memory.ts`
- `growth-pipeline.ts`
- `work-items.ts`
- `projects.ts`

**职责**
- 长期记忆读写
- awareness 蒸馏
- latent insight / confirmed insight 管理
- work-item / project 聚合

**关键约束**
- confirmed 与 candidate 必须分离
- 未确认线索不得进入长期 profile
- growth evidence 必须可追踪

#### 3.3.5 Reveal / Recall

- `recall.ts`
- `recall-service.ts`
- renderer 中与 reveal 相关的 chat receipt、discovery card、MemoryView 入口

**职责**
- 生成 soft hint
- 维护 reveal candidate 队列
- 处理 dismiss / reject / confirm
- 与 growth state 刷新联动

**关键约束**
- reveal 只通过轻入口出现
- recall 与 reveal 不得堆叠打架
- 被 dismiss 的内容不能冒充 confirmed 成长

#### 3.3.6 Session / Event Governance

建议新增：
- `electron/services/session-events.ts`
- `electron/services/session-store.ts`
- `electron/services/event-bus.ts`
- `electron/services/writeback-ledger.ts`
- `electron/services/drift-evaluator.ts`

**职责**
- 为每一轮生成 sessionId / turnId
- 记录 context、LLM、writeback、reveal、feedback、rollback 事件
- 支持回放、审计、debug、回滚

### 3.4 接口设计

接口设计以 `backend-interface.md` 为准。

#### 3.4.1 当前统一业务契约

主要业务能力包括：
- chat
- character
- relationship
- memory
- timeline
- growth
- recall
- hermes
- airjelly
- tts/asr/imageGen

#### 3.4.2 接口边界要求

- Electron renderer 通过 runtime client 调用，不直接散落调用 `window.ocWorld.*`
- 普通浏览器场景下允许走 browser fallback
- 未来 iOS Web、React Native、Swift 必须复用同一组业务命名与 payload 结构
- 不允许外部前端直接调用大模型、TTS、ASR、Marswave、AirJelly 等第三方服务

### 3.5 数据模型/存储设计

本期重点对象：

- `Relationship`
- `GrowthProfile`
- `GrowthInsight`（latent / suggested / confirmed / rejected / archived）
- `GrowthEvidence`
- `RevealCandidate`
- `SessionEvent`
- `WritebackLedgerEntry`

**关键边界**
- `candidate`：仅表示系统观察到的线索
- `confirmed`：必须经过用户确认
- `dismissed`：仅表示暂不展开，不等于 rejected
- `rejected`：代表用户明确否定

### 3.6 状态流转/时序设计

一轮主时序：

1. 用户发送消息
2. renderer 清空 composer 并显示 pending
3. Chat Runtime 构造 `ContextSnapshot`
4. Prompt Builder 组装 prompt
5. LLM 返回回复
6. Chat Runtime 回写 history / relationship
7. 异步投递 growth pipeline
8. Growth Pipeline 生成 awareness / latent insight
9. Reveal Policy 判断是否生成 reveal candidate
10. renderer 显示 receipt / discovery card / 小纸条入口
11. 用户进行 confirm / 稍后 / 修正 / reject
12. 若 confirmed，则写入长期 growth profile 与 ledger

**失败路径**
- Hermes 不可用：走 mock/legacy fallback
- AirJelly 不可用：走 mock context
- Reveal 评估失败：不阻断主聊天
- Guardrail 拦住 writeback：保留候选，不写 confirmed

### 3.7 交互一体化设计

#### 3.7.1 主舞台规则

- 对话永远是主舞台
- memory 只能是 side sheet
- 打开 memory 时 chat thread 与 composer 状态不丢失
- 关闭 memory 时回到原聊天位置

#### 3.7.2 Reveal 入口规则

- reveal 入口只能通过 receipt / discovery card / 小纸条 / left rail 等轻入口出现
- 不允许用全局通知、强弹窗、系统判定页替代

#### 3.7.3 反馈规则

- pending 状态必须显示在聊天列内
- interrupt 必须在同一条路径中完成
- confirm / 稍后 / 修正 / reject 必须有局部即时反馈
- drawer 关闭后不残留在 accessibility tree 中

#### 3.7.4 与 Day 1 / Day 3 / Day 7 的映射

- Day 1：架构保障“被理解”，重点是 chat-first、context continuity、pending/receipt、low-presence companion
- Day 3：架构保障“被陪着行动”，重点是轻动作建议只在关系成立后出现
- Day 7：架构保障“共同看见变化”，重点是 reveal 线索式显露、用户校准权、confirmed 才沉淀

### 3.8 异常处理

| 场景 | 处理方式 | 用户可见结果 |
| --- | --- | --- |
| Hermes 不可用 | fallback 到 mock/legacy chat | 聊天可继续 |
| AirJelly 不可用 | fallback 到 mock context | 主聊天可继续 |
| Reveal 评估失败 | 仅跳过本轮 reveal | 不影响聊天 |
| writeback 被 guardrail 拦住 | 保留 candidate，不写 confirmed | 用户不会看到错误系统写入 |
| 无 bridge 浏览器 | 使用 browser-client | 页面不崩 |

### 3.9 日志、监控与告警

建议最小可观测集：

- session events
- context build log
- LLM request/response summary
- writeback ledger
- reveal decision log
- drift evaluator decision log
- renderer 关键交互事件：pending、interrupt、open memory、confirm/reject reveal

---

## 第4章 性能管理评估分析

本项目的性能重点不在高 QPS，而在“不要让治理层和 reveal/growth 异步链拖慢主聊天体验”。

### 4.1 关键指标

- `ContextSnapshot` 构建耗时
- 首回复 latency
- pending 可见时长
- interrupt 响应时间
- growth pipeline 异步耗时
- reveal candidate 评估时间
- drawer 打开/关闭恢复时间

### 4.2 瓶颈判断

- `context-snapshot.ts` 过重会拖慢 chat 首回复
- unified memory 读取与 JSON 增长会影响本地响应
- 异步 growth pipeline 若与主链耦合，会影响 Day 1 被理解体验
- recall/reveal 评估频率过高会造成系统感增强

### 4.3 结论

当前无需引入复杂性能中间件，但需要把：
- 主聊天链和异步 growth/reveal 分离
- 本地 JSON 增长可控
- 长耗时操作不阻断聊天响应

---

## 第5章 投产策略说明

### 5.1 阶段发布顺序

1. 阶段 1：治理与主链稳定
2. 阶段 2：轻量 reveal 与 growth 显露
3. 阶段 3：更强任务与成长闭环

### 5.2 发布依赖

- 现有 Electron 主壳可运行
- runtime adapter 结构稳定
- mock / browser fallback 保留
- 旧数据结构仍可兼容读取

### 5.3 本期投产检查项

- chat-first 不被破坏
- memory side sheet 不替代 chat
- runtime client 与 Electron bridge 边界清楚
- session/event 轨迹至少覆盖关键写回
- browser fallback 不崩
- session-events / writeback-ledger 以最小可运行版本落地
- 关键数据埋点可用，能够支持后续功能问题判断

### 5.4 灰度策略

- 以 feature flags 控 reveal/growth/governance 新能力
- 先放内部体验，再放用户可见入口
- confirmed writeback 比主动 reveal 更晚放量
- 本期优先上线最小可运行版本，先观察埋点，再决定功能层扩展顺序

### 5.5 回滚条件

出现以下任一情况立即回滚到上一阶段：
- chat 首回复明显变慢
- memory / reveal 打断主聊天
- confirmed profile 被错误写入
- browser fallback 崩溃
- 任务感 / 定义感明显增强

### 5.6 回滚步骤

- 关闭阶段 feature flag
- 停止新 reveal candidate 显露
- 暂停 confirmed writeback
- 保留 session events 与 ledger 供排查
- 恢复到上一阶段稳定 client / renderer 行为

---

## 第6章 关键风险点评估

| 风险点 | 触发条件 | 影响 | 缓解措施 | 回退策略 | 待确认 |
| --- | --- | --- | --- | --- | --- |
| 记忆污染 | candidate 直接落 confirmed | 用户被系统误判 | candidate/confirmed 分层、guardrail | 暂停 writeback | 否 |
| 多轮 drift | 反思蒸馏不断自我强化 | 系统方向偏移 | session events + evaluator log | 关闭蒸馏写回 | 否 |
| 定义感 | reveal 文案太满、太像标签 | 用户抗拒 | 线索式显露、校准权 | 关闭 reveal 入口 | 否 |
| 任务感 | 动作建议过多过重 | 用户觉得被管理 | Day 3 才开放轻动作 | 退回关系优先路径 | 否 |
| 系统感 | 侧栏/提醒脱离聊天上下文 | 用户觉得在操作系统功能 | receipt/discovery card/小纸条 轻入口 | 回退到 chat-only | 否 |
| runtime 耦合反弹 | renderer 重新直接依赖 bridge | 多端演进受阻 | 强制 runtime client 入口 | 回滚到 adapter 封装层 | 否 |
| fallback 失效 | 无 bridge 浏览器崩溃 | 兼容性失败 | browser-client 保底 | 关闭新能力 | 否 |

---

## 第7章 非功能性需求设计

### 7.1 安全与隐私

- 不让前端直连第三方模型与音视频服务
- 长期记忆、growth、session logs 存本地时要注意数据最小化
- confirmed 写入应可追踪、可回滚

### 7.2 可用性与降级

- 主聊天链必须优先可用
- Hermes / AirJelly / reveal 任一失败都不能让聊天不可用
- browser fallback 必须可进入基础聊天路径

### 7.3 可观测性

- session events
- writeback ledger
- drift evaluator log
- reveal decision log
- renderer interaction log
- 最小数据埋点集：首聊被理解感相关交互、Day 3 轻动作触发/拒绝、Day 7 成长线索展开/修正/拒绝
- 埋点优先服务后续功能判断，不在本期引入额外产品打扰

### 7.4 可审计性

- 每次 confirmed 写入必须能追溯到 session/turn/evidence
- 每次 reveal 决策必须有依据和状态

### 7.5 可维护性

- 模块职责单一
- transport 与业务分离
- candidate 与 confirmed 分层
- fallback 路径明确

### 7.6 兼容性与无障碍

- Electron 是主验收面
- browser fallback 是兼容性验收面
- hidden panel 不在 accessibility tree 中
- 控件有 labels / titles

---

## 第8章 待定问题

| 编号 | 问题 | 影响范围 | 当前建议 |
| --- | --- | --- | --- |
| TBD-01 | 阶段 2 reveal 是否和 growth profile confirmed 同步上线 | rollout 风险 | 建议 reveal 先于 confirmed 扩量 |

---

## 第9章 其他

### 9.1 名词表

- `ContextSnapshot`：一轮对话的统一上下文快照
- `candidate`：系统候选线索
- `confirmed`：用户确认后的长期信息
- `reveal`：轻量显露的理解邀请
- `writeback ledger`：所有影响后续行为的写回账本

### 9.2 关键引用文档

- `docs/OC-World-记忆层与架构改造详细设计.md`
- `docs/architecture-platform-boundaries.md`
- `docs/backend-interface.md`
- `docs/frontend-interaction-benchmark.md`
- `docs/frontend-ux-apple-simple.md`
- `docs/OC-World-隐形成长系统设计.md`
- `docs/OC-World-Open-Design-交互系统.md`
- `docs/research/2026-05-seed-retention/02-journey-maps.md`
- `docs/research/2026-05-seed-retention/04-retention-experiments.md`
- `docs/research/2026-05-seed-retention/06-findings-and-decisions.md`

### 9.3 验收执行模板

建议统一采用 `ACC-*` 编号：

- `ACC-CHAT-01`：memory 打开时 chat thread 与 composer 保持原状态，不切主路由
- `ACC-CHAT-02`：pending 在同一聊天列内可见，且可 interrupt
- `ACC-REVEAL-01`：reveal 入口只能通过轻入口出现
- `ACC-REVEAL-02`：确认 / 稍后 / 修正 / reject 均有局部反馈
- `ACC-A11Y-01`：关闭的 memory side sheet 不在 accessibility tree 中
- `ACC-RUNTIME-01`：无 `window.ocWorld` 时 browser fallback 不崩
- `ACC-GOV-01`：关键 writeback 可追踪到 session/turn/event
- `ACC-PROD-01`：Day 1 不出现建议先于理解的体验
- `ACC-PROD-02`：Day 3 动作建议不滑向任务感
- `ACC-PROD-03`：Day 7 成长显露不滑向定义感或系统感

### 9.4 本期硬门槛

本期 blocking gate 按 Electron 主验收执行，只锁以下四类：

- 主舞台：对话始终为主舞台，memory 不替代 chat
- 响应环：send / pending / interrupt / receipt 在同一聊天列内闭环
- 渐进显露：reveal 只能通过轻入口出现，且可校准
- 可访问性：side sheet 关闭后不残留在 accessibility tree 中

browser fallback 作为兼容性验收项记录，不作为本期 blocking gate。
