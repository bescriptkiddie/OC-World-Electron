# OC World

> 你的 AI 分身替你冒险、替你社交、替你完成任务——你以为你在玩游戏，其实你在升级人生。

OC World 是一个 Electron 桌面应用，打造你的 AI 分身（OC）。不是聊天工具，是**人生游戏引擎**——OC 陪你聊天、懂你情绪、记你说过的话、感知你的真实生活，最终派往 Agent 世界协作完成任务。

## 三幕架构

**OC 分身** → 培养另一个自己。有情绪、有记忆、亲密关系从陌生人到灵魂伴侣逐步解锁。

**AirJelly 感知** → OC 知道你在用什么 App、今天的工作节奏，将数字生活上下文注入每一次对话。

**Agent 世界** → 把 OC 派往任务经济系统，无数 OC 在交流、协作、组队、创造。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面运行时 | Electron 35 |
| 前端 | React 18 · TypeScript 5.8 · Vite 6 |
| LLM | Hermes Agent（本地）+ BigModel/Anthropic API |
| 语音 | StepFun StepAudio 2.5 TTS/ASR + 浏览器语音合成兜底 |
| 图像 | Marswave API |
| 上下文感知 | AirJelly SDK |
| 数据 | 本地 JSON 持久化 |
| 测试 | Vitest |

## 快速开始

```bash
git clone https://github.com/bescriptkiddie/OC-World-Electron.git
cd OC-World-Electron

# 安装主项目依赖
npm install

# 准备环境变量
cp .env.example .env

# 启动开发模式
npm run dev
```

`npm run dev` 会先执行 `npm run prepare:hermes-source`。如果本地没有 `hermes-agent/`，脚本会自动从 GitHub 下载最新 Hermes Agent 源码到项目根目录。

如果只是想先看 UI 和基础流程，可以在 `.env` 里打开 mock：

```bash
OC_DEMO_FORCE_MOCK_LLM=1
OC_DEMO_FORCE_MOCK_AIRJELLY=1
```

这样即使没有配置大模型、AirJelly、TTS、ASR、图片生成 key，应用也能先跑起来。

## 语音能力

项目后端语音默认接入阶跃星辰 StepAudio：

- TTS：`POST https://api.stepfun.com/v1/audio/speech`，默认模型 `stepaudio-2.5-tts`。
- ASR：`POST https://api.stepfun.com/v1/audio/asr/sse`，默认模型 `stepaudio-2.5-asr`。

`.env` 里配置同一个 `STEPFUN_API_KEY` 即可启用 TTS 和 ASR。TTS 默认音色是 `cixingnansheng`，可以通过 `STEPFUN_TTS_VOICE` 调整；ASR 会把前端麦克风采集的 16 kHz / 16-bit / mono PCM 音频提交给 StepFun SSE 接口。

如果没有配置 `STEPFUN_API_KEY`，TTS 会回退到浏览器 `speechSynthesis`；ASR 会显示为未配置，语音输入不可用。

## 没有 AirJelly 怎么办

AirJelly 不是必需项。项目里 `@airjelly/sdk` 是 optional dependency，运行时也有兜底逻辑：

1. 如果 `.env` 里设置 `OC_DEMO_FORCE_MOCK_AIRJELLY=1`，直接使用 mock 上下文。
2. 如果 AirJelly SDK 不存在、未登录、服务不可用或调用失败，会自动 fallback 到 mock 上下文。
3. mock 数据优先读取 `oc-data/mock/airjelly-context.json`；这个文件也没有时，会使用代码内置默认上下文。

无 AirJelly 模式推荐配置：

```bash
OC_DEMO_FORCE_MOCK_AIRJELLY=1
```

需要自定义上下文时，改 `oc-data/mock/airjelly-context.json`：

```json
{
  "source": "mock",
  "events": [
    {
      "title": "整理项目方案",
      "appName": "VS Code",
      "durationSeconds": 3600,
      "timestamp": 1777023244485
    }
  ],
  "tasks": [
    {
      "title": "跑通 OC World",
      "progressSummary": "进行中"
    }
  ],
  "appUsage": [
    {
      "appName": "VS Code",
      "totalSeconds": 7200
    }
  ]
}
```

如果后续要接真实 AirJelly，再把 `OC_DEMO_FORCE_MOCK_AIRJELLY=0`，并确保 `@airjelly/sdk` 安装成功、AirJelly 本地/账号环境可用即可。

## 完整 Hermes Agent 模式

`hermes-agent/` 不提交到本仓库，它是外部运行时依赖。首次 clone 后，源码下载和完整运行时准备分两层：

```bash
# 只下载 hermes-agent 源码，npm run dev 会自动做这一步
npm run prepare:hermes-source

# 准备完整 Hermes runtime：Python venv、pip install、Hermes Node 依赖、browser runtime、standalone Hermes
npm run prepare:hermes-runtime
```

完整 Hermes runtime 需要：

- Git
- Node.js 22 或更高版本
- Python 3.11 或更高版本
- 可以访问 `https://github.com/NousResearch/hermes-agent.git`

默认下载来源：

```bash
HERMES_AGENT_REPO=https://github.com/NousResearch/hermes-agent.git
HERMES_AGENT_REF=main
```

如果要用自己的 Hermes fork 或固定分支，可以在 `.env` 或 shell 里改这两个变量。

Hermes 启动相关默认配置在 `.env.example` 里：

```bash
OC_CHAT_PROVIDER=hermes
HERMES_AUTOSTART=1
HERMES_BASE_URL=http://127.0.0.1:8642
HERMES_API_KEY=oc-world-local-key
API_SERVER_KEY=oc-world-local-key
```

配置好后运行：

```bash
npm run dev
```

Electron 启动时会自动启动 Hermes gateway。如果 Hermes 没启动成功，界面仍然可以打开，聊天会按当前代码走 mock/fallback；此时先检查 `npm run prepare:hermes-runtime` 是否完成、Python 版本是否满足、`.env` 里的模型/API 配置是否有效。

默认界面使用 `demos/oc-invisible-growth-v1.html`，这是当前 OC World 的隐形成长系统前端。它会直接通过 Electron preload 调用 `window.ocWorld.chat`，不是 iframe 或 webview。需要临时回到 Vite React 旧前端时，在 `.env` 里设置：

```bash
OC_WORLD_USE_VITE_RENDERER=1
```

默认大模型配置使用小米 MiMo Anthropic 兼容接口：

```bash
HERMES_MODEL=mimo-v2.5-pro
HERMES_API_MODE=anthropic_messages
CUSTOM_BASE_URL=https://token-plan-cn.xiaomimimo.com/anthropic
ANTHROPIC_BASE_URL=https://token-plan-cn.xiaomimimo.com/anthropic
ANTHROPIC_DEFAULT_HAIKU_MODEL=mimo-v2.5-pro
```

本机运行时把同一个小米 Token Plan key 写入 `OPENAI_API_KEY` 和 `ANTHROPIC_AUTH_TOKEN` 即可；不要把真实 key 提交到仓库。

## 平台边界与 iOS 铺路

当前仓库仍然是 Electron 桌面应用，不包含原生 iOS 工程。接下来要做的是把 renderer 对 `window.ocWorld` 的业务直连收口成 runtime client，让 React 业务层和桌面桥接解耦。

边界说明见：

- `docs/architecture-platform-boundaries.md`
- `docs/backend-interface.md`
- `demos/oc-current-architecture-map.html`

## 常用命令

```bash
# 下载 hermes-agent 源码
npm run prepare:hermes-source

# 准备完整 Hermes runtime
npm run prepare:hermes-runtime

# 开发模式
npm run dev

# 运行测试
npm run test

# 构建前端/Electron
npm run build

# 打包
npm run dist:app
```

## CLI 命令

当前已提供第一批核心能力命令面，默认通过 `tsx` 本地运行：

```bash
npm run cli -- chat --user user-001 --character char-001 --message "你好"
npm run cli -- chat greet --user user-001 --character char-001
npm run cli -- memory history --user user-001 --limit 5
npm run cli -- memory summaries --user user-001 --weeks 3
npm run cli -- hermes status
npm run cli -- airjelly context
npm run cli -- tts status
npm run cli -- tts synthesize --text "你好"
npm run cli -- image generate --prompt "anime avatar"
```

如需构建 CLI 输出：

```bash
npm run build:cli
```

## 项目结构

```text
electron/
├── main.ts               # 应用生命周期
├── preload.ts            # IPC 桥接
├── ipc.ts                # 通道注册
├── capabilities/         # transport-neutral 能力入口
└── services/
    ├── chat-engine.ts    # 聊天编排
    ├── llm.ts            # LLM 双提供者
    ├── prompt-builder.ts # 系统提示构建
    ├── relationship.ts   # 亲密关系计算
    ├── memory.ts         # JSON 持久化
    ├── hermes-manager.ts # Agent 生命周期
    ├── airjelly.ts       # 生活上下文
    ├── tts.ts            # 语音合成
    └── image-gen.ts      # 图像生成

cli/                      # CLI 路由与入口
src/
├── components/           # UI 组件
├── hooks/                # React hooks
├── pages/                # 页面
├── types/                # 类型定义
└── lib/                  # 工具函数

oc-data/                 # 本地数据存储
tests/                   # 测试
scripts/                 # 脚本工具
```

## 对外接入文档

后端能力当前通过 Electron preload 暴露给 renderer，不是传统 HTTP REST API。给外部前端或 Agent 接入时，先看：

- `docs/backend-interface.md`

## 脚本命令

```bash
npm run dev                  # 开发
npm run build                # 构建
npm run build:cli            # 构建 CLI
npm run test                 # 测试
npm run cli -- hermes status # 运行 CLI
npm run seed:demo            # 填充演示数据
npm run parse:wx             # 解析微信聊天记录
npm run generate:summaries   # 生成记忆摘要
```

## License

Private
