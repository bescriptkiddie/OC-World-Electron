import { describe, expect, it } from "vitest";
import {
  createInitialOnboardingState,
  advanceOnboardingStep,
  retreatOnboardingStep,
  resetToLlmStep,
} from "../apps/oc-ios/src/onboarding-state";

describe("ios onboarding state", () => {
  it("starts from llm setup before create-oc flow", () => {
    const state = createInitialOnboardingState();

    expect(state.step).toBe("llm");
    expect(state.oc.name).toBe("");
  });

  it("advances through llm -> name -> customize -> preview", () => {
    let step = createInitialOnboardingState().step;
    step = advanceOnboardingStep(step);
    expect(step).toBe("name");
    step = advanceOnboardingStep(step);
    expect(step).toBe("customize");
    step = advanceOnboardingStep(step);
    expect(step).toBe("preview");
    expect(retreatOnboardingStep(step)).toBe("customize");
  });

  it("can reset the flow back to llm setup", () => {
    expect(resetToLlmStep("preview")).toBe("llm");
  });
});
