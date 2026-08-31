# Electron OC Pet Runtime 升级执行文档

## 背景

我们要把 Electron 端的 OC 形象从“头像或固定 atlas 展示”升级成更像桌面生命体的流程。参考方向来自 `Jane-xiaoer/xiaoer-hammerspoon-pet`，但只吸收它的 pet 流程，不引入 Hammerspoon/Lua 运行时。

当前项目已经具备基础能力：

- Electron 透明常驻浮窗：`electron/main.ts`
- 浮窗交互与拖拽：`src/components/FloatingOcWindow.tsx`
- OC 状态机与交互时刻：`src/components/OcInteractionSystem.tsx`
- spritesheet 渲染：`src/components/OcSpriteStage.tsx`
- 现有 pet 资产：`public/pets/*/pet.json` + `spritesheet.webp`

## 核心判断

可以借 Xiaoer 的流程，但实现应保持 Electron-native。

要借的是：

- 一个 OC 形象就是一个 pet 包。
- 每个 pet 包声明自己的状态动画。
- 状态由用户事件、系统事件和 OC 关系事件驱动。
- 拖拽、等待、工作、提醒、完成、报错都有明确视觉状态。

不借的是：

- 不引入 Hammerspoon。
- 不迁移 Lua panel、Lua timer、Lua state file。
- 不做系统级自动化脚本。
- 不把当前 Electron 主窗口、IPC、记忆层架构推倒重来。

## 产品目标

1. 让 OC 形象从静态头像升级为可行动的桌面 pet。
2. 让每个 OC 可以有自己的动画资产包。
3. 让浮窗中的 OC 根据真实交互状态切换动画。
4. 保持实现低入侵：优先改渲染层、资产协议、状态映射。

## 非目标

- 暂不做完整番茄钟、待办、喝水、吃饭、睡觉提醒系统。
- 暂不做跨 App 全局热键。
- 暂不做 Hammerspoon 式独立控制面板。
- 暂不接入第三方 pet 切换器。
- 暂不把 OC 资产生成流程做成完整编辑器。

## 最小方案

### 1. 扩展 pet 资产协议

现有协议：

```json
{
  "id": "oc-avatar-pet",
  "displayName": "Red Pilot",
  "description": "A compact pixel-style OC desktop pet.",
  "spritesheetPath": "spritesheet.webp"
}
```

新增兼容协议：

```json
{
  "id": "my-oc",
  "displayName": "My OC",
  "description": "Electron-native OC pet.",
  "renderer": "frames",
  "frameRoot": ".",
  "frameWidth": 192,
  "frameHeight": 208,
  "states": {
    "idle": { "path": "idle", "frames": 6, "fps": 6 },
    "working": { "path": "working", "frames": 6, "fps": 6 },
    "waving": { "path": "waving", "frames": 4, "fps": 6 },
    "jumping": { "path": "jumping", "frames": 5, "fps": 7 },
    "failed": { "path": "failed", "frames": 8, "fps": 7 },
    "running-left": { "path": "running-left", "frames": 8, "fps": 8 },
    "running-right": { "path": "running-right", "frames": 8, "fps": 8 }
  }
}
```

兼容原则：

- 有 `spritesheetPath` 时继续走现有 atlas 渲染。
- 有 `renderer: "frames"` 时走连续 PNG 帧渲染。
- 两者都存在时，优先使用 `renderer` 指定的格式。
- 旧 pet 包无需迁移也能继续使用。

### 2. 扩展 OC 状态集合

现有状态保留：

- `idle`
- `waiting`
- `waving`
- `review`
- `jumping`
- `running`
- `running-left`
- `running-right`
- `failed`

新增可选状态：

- `working`：聊天生成、执行任务、专注处理。
- `eating`：未来吃饭提醒。
- `drinking`：未来喝水提醒。
- `sleeping`：未来睡觉提醒。
- `rowing` / `yoga`：未来 idle 轮播动作。

第一版只要求 pet 包至少有这些状态：

- `idle`
- `waving`
- `waiting`
- `review`
- `jumping`
- `failed`
- `running-left`
- `running-right`

缺失状态时回退：

| 请求状态 | 回退状态 |
| --- | --- |
| `working` | `review` |
| `eating` | `waving` |
| `drinking` | `waving` |
| `sleeping` | `waiting` |
| `rowing` / `yoga` | `idle` |
| 任意未知状态 | `idle` |

### 3. 只改渲染层

主要修改 `src/components/OcSpriteStage.tsx`：

- 读取 `visualProfile.spritesheetPath` 时维持现状。
- 新增 `visualProfile.frameAnimations` 或等价结构。
- 新增 `FrameSequenceSprite` 组件。
- 用统一的 `stateId` 选择 atlas 行或 PNG 帧目录。
- 保持 `OcSpriteStage` 对外 props 基本不变。

这样 `ChatView`、`MyOcView`、`OcProfileCard`、`FloatingOcWindow` 不需要大范围改动。

### 4. 只在浮窗做状态映射

主要修改 `src/components/FloatingOcWindow.tsx`：

| Electron 事件 | OC 状态 |
| --- | --- |
| 默认常驻 | `idle` |
| hover | `waiting` |
| pointer down | `waving` |
| 拖拽向左 | `running-left` |
| 拖拽向右 | `running-right` |
| 释放 | `jumping` |
| 新关系/记忆信号 | `review` / `jumping` |
| 错误或 IPC 不可用 | `failed` |
| 聊天生成中 | `working`，缺失时回退 `review` |

第一版先不接番茄钟和提醒，只预留状态。

## 实施阶段

### Phase 1：资产协议与类型

目标：让项目能表达 atlas 和 frame-folder 两种 pet 包。

改动范围：

- `src/types/index.ts`
- `electron/services/schemas.ts`
- `public/pets/*/pet.json` 示例
- 可选新增 `docs/pet-package-spec.md`

验收：

- 旧 `spritesheet.webp` pet 仍能渲染。
- 新 `frames` pet 配置能被类型接受。

### Phase 2：FrameSequenceSprite 渲染

目标：`OcSpriteStage` 支持 `idle/00.png` 这种目录帧。

改动范围：

- `src/components/OcSpriteStage.tsx`
- `src/ocworld.css`
- `tests/shared.test.ts` 或新增 sprite 相关测试

验收：

- atlas pet 正常。
- frame pet 正常轮播。
- 切换 `stateId` 时从第 0 帧重新开始。
- 缺失状态时回退到 `idle`。

### Phase 3：浮窗状态映射升级

目标：浮窗使用更完整的 pet 状态，不把动画逻辑散落到多个地方。

改动范围：

- `src/components/FloatingOcWindow.tsx`
- `src/components/OcInteractionSystem.tsx`

验收：

- 拖拽方向仍然准确。
- hover、grab、release 状态不闪烁。
- 错误态显示 `failed`。
- 新关系信号能触发 `review` 或 `jumping`。

### Phase 4：导入一个最小 frame pet 示例

目标：放入一个很小的 demo 包，用于验证新流程。

建议目录：

```text
public/pets/demo-frame-oc/
  pet.json
  idle/00.png
  idle/01.png
  waving/00.png
  waiting/00.png
  review/00.png
  jumping/00.png
  failed/00.png
  running-left/00.png
  running-right/00.png
```

验收：

- demo 包可以在主界面和浮窗中渲染。
- 包体不要过大。
- 不直接拷贝第三方素材，除非保留 MIT license attribution 并确认资产也在该许可范围内。

## 文件改动边界

第一轮建议只动这些文件：

- `docs/electron-oc-pet-runtime-upgrade.md`
- `src/types/index.ts`
- `electron/services/schemas.ts`
- `src/components/OcSpriteStage.tsx`
- `src/components/FloatingOcWindow.tsx`
- `src/components/OcInteractionSystem.tsx`
- `src/ocworld.css`
- `tests/*`
- `public/pets/demo-frame-oc/*`

不动：

- 记忆层服务
- Hermes runtime
- LLM provider
- 主窗口整体布局
- Electron 打包配置
- `oc-data/`

## 验证清单

每阶段至少跑：

```bash
npm test
npm run build
```

若改动浮窗或 CSS，需要再做一次本地视觉验证：

```bash
npm run dev
```

重点检查：

- 主窗口不受影响。
- 浮窗透明背景仍然正确。
- pet 不被裁切。
- 拖拽时窗口跟手。
- 状态切换没有明显跳变。
- 旧 pet 包没有回归。

## 对齐问题

需要我们先确认这几件事：

1. 第一版是否只做 frame-folder 渲染，不做提醒/待办？
2. 新 pet 包的最小必需状态，是 8 个还是直接按 Xiaoer 的 15 个目录？
3. 现有 `spritesheet.webp` 是否继续作为默认生产格式？
4. demo frame pet 用我们自己的 OC 素材，还是临时用占位图？
5. `working/eating/drinking/sleeping` 是否先只预留状态，不在 UI 暴露入口？

## 推荐决策

第一版采用最小闭环：

1. 保留 atlas。
2. 新增 frame-folder。
3. 浮窗接入 `working` 状态。
4. 不做提醒系统。
5. 用一个小型 demo frame pet 验证流程。

这样改动面小，后续可以自然扩展到提醒、待办、专注和 pet 切换。
