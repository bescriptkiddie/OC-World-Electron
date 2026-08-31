export const starterOcStyles = [
  {
    id: "warm-soft",
    title: "温柔陪伴",
    tone: "轻一点、接住人",
  },
  {
    id: "modern-minimal",
    title: "清醒直接",
    tone: "短句、清楚、推进一步",
  },
  {
    id: "tech-utility",
    title: "冷静搭子",
    tone: "结构化、少废话",
  },
] as const;

export const personalityOptions = ["傲娇", "温柔", "毒舌", "元气", "慵懒", "知性"] as const;
export const appearanceOptions = ["水母", "猫系", "犬系", "精灵", "幽灵", "机械"] as const;
export const toneOptions = ["日语二次元", "东北话", "文言文", "英语", "程序员", "诗人"] as const;
export const anthropicModelLabels = {
  "claude-3-5-sonnet-latest": "Claude 3.5 Sonnet",
  "claude-3-7-sonnet-latest": "Claude 3.7 Sonnet",
  "claude-sonnet-4-0": "Claude Sonnet 4",
} as const;

export type StarterOcStyleId = (typeof starterOcStyles)[number]["id"];
