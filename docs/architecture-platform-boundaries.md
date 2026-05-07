# OC World 平台边界与 iOS 铺路

## 1. 当前项目的真实形态

OC World 现在是一个 Electron 桌面应用。

核心运行边界分五层：

1. **Desktop Shell**
   - `electron/main.ts`
   - 负责窗口生命周期、权限、资源加载、浮窗位置与拖拽
2. **Bridge / Transport**
   - `electron/preload.ts`
   - `electron/ipc.ts`
   - 负责把主进程能力暴露成 `window.ocWorld`
3. **Domain Services**
   - `electron/services/*`
   - 负责聊天、记忆、growth、recall、Hermes、TTS、ASR、图片生成
4. **Renderer App**
   - `src/*`
   - React 界面、交互状态、浏览器语音与本地退化逻辑
5. **Local Data / Runtime Assets**
   - `oc-data/*`
   - `hermes-agent/*`
   - 本地 JSON、mock 数据、Hermes 运行时资源

## 2. 当前为什么还不能叫 iOS 项目

仓库里没有任何 iOS 原生目标：

- 没有 `ios/`
- 没有 `*.xcodeproj` / `*.xcworkspace`
- 没有 `Podfile`
- 没有 `*.swift`
- 没有 React Native / Expo / Capacitor

所以这次工作的目标只能是 **iOS 铺路**，不是直接产出原生 iOS App。

## 3. 哪些层可以直接复用到未来 iOS

### 3.1 可复用的业务契约

这些能力应该保留统一接口，不跟 Electron 绑死：

- `chat`
- `character`
- `relationship`
- `memory`
- `timeline`
- `growth`
- `recall`
- `hermes`
- `airjelly`

现有契约来源：

- `docs/backend-interface.md`
- `src/types/index.ts`
- `electron/capabilities/facade.ts`

### 3.2 可复用的纯前端 UI

以下部分理论上可以继续服务未来 iOS 客户端，只要它们不再直接访问 `window.ocWorld`：

- `src/hooks/useChat.ts`
- `src/components/OcWorldApp.tsx`
- `src/components/CreateView.tsx`
- `src/components/ChatView.tsx`
- `src/components/MemoryView.tsx`
- `src/components/MyOcView.tsx`

### 3.3 可复用但应降级为 optional capability 的能力

这些能力未来在不同平台上实现方式会不同，不能直接写死在 renderer：

- `tts`
- `asr`
- `imageGen`
- `floatingOc`

其中：

- `floatingOc` 是明显的桌面专属能力
- `tts` / `asr` 在 iOS WebView、React Native、Swift 中的实现边界都不同
- `imageGen` 虽然是业务能力，但是否可用、调用时机、文件落地方式都会因平台不同而变化

## 4. 哪些层是桌面专属，不能直接搬去 iOS

### 4.1 Electron shell

以下能力与 iOS 无法直接复用：

- `BrowserWindow`
- preload 注入
- `ipcMain` / `ipcRenderer`
- 桌面透明浮窗
- 基于屏幕坐标的拖拽与吸附
- Electron 权限模型

关键文件：

- `electron/main.ts`
- `electron/preload.ts`
- `electron/ipc.ts`
- `src/components/FloatingOcWindow.tsx`

### 4.2 当前散落在 renderer 的 Electron 直连点

这些文件里仍然直接调用 `window.ocWorld`，是本轮必须收口的主要位置：

- `src/hooks/useChat.ts`
- `src/components/OcWorldApp.tsx`
- `src/components/CreateView.tsx`
- `src/components/FloatingOcWindow.tsx`
- `demos/oc-invisible-growth-v1.html`

## 5. 这次 iOS 铺路要完成什么

本轮只做三件事：

1. **把 renderer 改成依赖 runtime client，而不是依赖 `window.ocWorld`**
2. **把桌面专属能力改成可选 capability**
3. **保留浏览器无 bridge 时的退化路径**

这会带来两个直接结果：

- Electron 继续能跑
- 将来要接 iOS 客户端时，只需要补新的 adapter，不用再拆 React 业务层

## 6. 推荐的 runtime 重排方式

### 6.1 新的前端入口结构

建议在 `src/runtime/` 建立这一层：

- `client.ts`：定义跨平台业务 client 接口
- `platform-capabilities.ts`：定义 optional capability
- `electron-client.ts`：包装 `window.ocWorld`
- `browser-client.ts`：提供本地 demo / fallback
- `context.tsx`：向 React 注入 runtime
- `use-runtime.ts`：统一读取 runtime

### 6.2 业务层与平台层的责任划分

**业务层负责：**

- 聊天状态
- 角色状态
- 关系状态
- growth / recall 呈现
- 创建 OC 流程

**平台层负责：**

- 如何发起 chat 请求
- 如何拿角色/记忆数据
- 是否存在 TTS / ASR / 浮窗 / 图片生成
- 是否有本地 bridge

## 7. 后续真正做 iOS 时的接法

### 路线 A：iPhone / iPad Web

最省力。

前提：

- renderer 已不直接依赖 Electron
- browser adapter 可跑通核心聊天链
- 语音与图片能力允许降级或延迟接入

### 路线 B：React Native / Expo

前提：

- 复用 `src/types/index.ts` 的业务类型
- 用新的 native adapter 实现 `client.ts`
- 重新实现 `tts` / `asr` / 文件落地

### 路线 C：Swift 原生

前提：

- 继续沿用业务契约
- 把现在 Electron preload 暴露的方法改造成 HTTP / WebSocket / embedded bridge
- UI 需要重新实现，但业务接口边界可以复用

## 8. 当前里程碑的验收标准

这轮完成后，应满足：

- React 业务层不再直接依赖 `window.ocWorld`
- Electron adapter 与 browser adapter 都能工作
- 无 bridge 的普通浏览器里页面不崩
- `FloatingOcWindow` 被明确标成 desktop-only
- 文档能清楚回答“哪些代码未来可复用到 iOS，哪些不行”

## 9. 当前已知风险

- `src/hooks/useChat.ts` 既管聊天，又管 growth、recall、Hermes、语音，是当前最重的耦合点
- `src/lib/voice-input.ts` 直接依赖 `window.ocWorld.asr`，未来移动端差异最大
- `src/lib/tts.ts` 同时处理浏览器语音和远端语音，平台边界需要先收紧
- `demos/oc-invisible-growth-v1.html` 仍然直接依赖 preload bridge，本轮先不扩散修改范围

## 10. 本轮不做的事

- 不创建原生 iOS 工程
- 不引入 Expo / React Native / Capacitor
- 不重写 `electron/services/*`
- 不把 Electron bridge 立刻改成 HTTP API
- 不处理 App Store、签名、TestFlight、推送等发布问题
