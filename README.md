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

oc-data/                  # 本地数据存储
hermes-agent/             # Hermes Agent（子模块）
tests/                    # 测试
scripts/                  # 脚本工具
```

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
