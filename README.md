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
| 语音 | 火山引擎 TTS + 浏览器语音合成 |
| 图像 | Marswave API |
| 上下文感知 | AirJelly SDK |
| 数据 | 本地 JSON 持久化 |
| 测试 | Vitest |

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 API keys

# 开发模式
npm run dev

# 运行测试
npm run test

# 打包
npm run dist:app
```

## Hermes Agent 依赖

`hermes-agent/` 是外部运行时依赖，不提交到本仓库。首次启动开发模式或打包前，脚本会自动下载最新 Hermes Agent 源码：

```bash
npm run prepare:hermes-source
```

默认来源是 `https://github.com/NousResearch/hermes-agent.git` 的 `main` 分支。需要固定来源或分支时，可以设置：

```bash
HERMES_AGENT_REPO=https://github.com/NousResearch/hermes-agent.git
HERMES_AGENT_REF=main
```

## 项目结构

```
electron/
├── main.ts              # 应用生命周期
├── preload.ts           # IPC 桥接
├── ipc.ts               # 通道注册
└── services/
    ├── chat-engine.ts   # 聊天编排
    ├── llm.ts           # LLM 双提供者
    ├── prompt-builder.ts # 系统提示构建
    ├── relationship.ts  # 亲密关系计算
    ├── memory.ts        # JSON 持久化
    ├── hermes-manager.ts # Agent 生命周期
    ├── airjelly.ts      # 生活上下文
    ├── tts.ts           # 语音合成
    └── image-gen.ts     # 图像生成

src/
├── components/          # UI 组件
├── hooks/               # React hooks
├── pages/               # 页面
├── types/               # 类型定义
└── lib/                 # 工具函数

oc-data/                 # 本地数据存储
tests/                   # 测试
scripts/                 # 脚本工具
```

## 对外接入文档

后端能力当前通过 Electron preload 暴露给 renderer，不是传统 HTTP REST API。给外部前端或 Agent 接入时，先看：

- `docs/backend-interface.md`

## 脚本命令

```bash
npm run dev              # 开发
npm run build            # 构建
npm run test             # 测试
npm run seed:demo        # 填充演示数据
npm run parse:wx         # 解析微信聊天记录
npm run generate:summaries  # 生成记忆摘要
```

## License

Private
