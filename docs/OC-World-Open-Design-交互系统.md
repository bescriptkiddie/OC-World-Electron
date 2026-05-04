# OC World Open Design 交互系统

这版把 Open Design 的方向选择方法和 Codex pet 的图集机制合在一起：OC 不是一张头像，而是一个常驻桌面的轻量生命体。视觉上像 pet，产品行为上遵循“先接住，再判断，最后给动作”。

## 设计原则

1. 低存在感，高相关性
   OC 默认常驻但不抢屏；只有线索足够相关时才冒泡。

2. 微小变化，长期累积
   每次互动只改变一个状态、一个线索或一个下一步，不把成长系统一次性摊开。

3. 先关系，再系统
   用户先看到“TA 在陪我”，再逐步看到记忆、回溯、洞察和任务。

4. Pet-like，而不是头像面板
   每个 OC 都需要有 9 个动画状态，对应 Codex pet 的 8x9 atlas：单格 192x208，总图 1536x1872。

## 交互回路

| 阶段 | 用户感受 | OC 行为 | Pet 状态 |
| --- | --- | --- | --- |
| 常驻 | 桌面边上有一个小生命 | 不打扰，只呼吸或轻微摆动 | Idle / Waiting |
| 接住 | 我说的话先被听见 | 先回应情绪和语境 | Waving |
| 沉淀 | 它在背后理解我 | 归纳重复出现的目标、偏好、卡点 | Review |
| 冒泡 | 它给我一个有用提示 | 只在高相关时给发现或下一步 | Jumping / Running |
| 卡住 | 需要我处理 | 引导回主窗口处理授权或运行状态 | Failed |

## 入口设计

- 创建 OC：先选 Open Design 视觉方向，再生成 pet-like 角色设定和 9 行状态规格。
- 我的 OC：展示完整 pet 状态机，让用户能看到 TA 不是头像，而是可行动的桌面 OC。
- 左侧陪伴卡：不展示复杂系统，默认显示当前交互时刻和一句能接住用户的话。
- 桌面浮窗：透明、常驻、可拖拽，状态由同一套 interaction moment 驱动。

## 状态映射

- Idle：安静常驻
- Waiting：低打扰等待
- Waving：先接住
- Review：背后判断
- Jumping：小发现冒泡
- Running：执行下一步
- Run right：靠近任务
- Run left：回到陪伴
- Failed：需要处理

## 实现入口

- `src/components/OcInteractionSystem.tsx`：交互时刻模型、pet 状态映射、四阶段回路组件。
- `src/components/OcSpriteStage.tsx`：支持被 interaction moment 控制具体动画状态。
- `src/components/FloatingOcWindow.tsx`：桌面浮窗使用同一套状态机。
- `src/components/CreateView.tsx`：创建流中展示视觉方向、atlas 规格和交互回路。
- `src/components/MyOcView.tsx` / `src/components/OcProfileCard.tsx`：主界面和左侧陪伴卡复用同一套交互语言。
