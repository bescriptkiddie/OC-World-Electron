import type { StarterOcStyleId } from "./data";

export type OnboardingStep = "llm" | "name" | "customize" | "preview";

export type OnboardingState = {
  step: OnboardingStep;
  oc: {
    name: string;
    selectedStyle: StarterOcStyleId;
    selectedTone: string;
    selectedPersonality: string[];
    selectedAppearance: string[];
    prompt: string;
  };
};

export function createInitialOnboardingState(): OnboardingState {
  return {
    step: "llm",
    oc: {
      name: "",
      selectedStyle: "warm-soft",
      selectedTone: "",
      selectedPersonality: [],
      selectedAppearance: [],
      prompt: "",
    },
  };
}

export function advanceOnboardingStep(step: OnboardingStep): OnboardingStep {
  if (step === "llm") return "name";
  if (step === "name") return "customize";
  if (step === "customize") return "preview";
  return "preview";
}

export function retreatOnboardingStep(step: OnboardingStep): OnboardingStep {
  if (step === "preview") return "customize";
  if (step === "customize") return "name";
  if (step === "name") return "llm";
  return "llm";
}

export function resetToLlmStep(_step: OnboardingStep): OnboardingStep {
  return "llm";
}
