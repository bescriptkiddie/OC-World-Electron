import { describe, expect, it } from "vitest";
import { createIosScreenModel } from "../apps/oc-ios/src/screen-model";

describe("ios screen model", () => {
  it("starts in onboarding when there is no character yet", () => {
    const result = createIosScreenModel({
      hasCharacter: false,
      memoryOpen: false,
      settingsOpen: false,
      currentRoute: "chat",
    });

    expect(result.homeRoute).toBe("onboarding");
    expect(result.overlay).toBeNull();
  });

  it("keeps chat as the base route when memory opens", () => {
    const result = createIosScreenModel({
      hasCharacter: true,
      memoryOpen: true,
      settingsOpen: false,
      currentRoute: "rewind",
    });

    expect(result.homeRoute).toBe("rewind");
    expect(result.baseRoute).toBe("chat");
    expect(result.overlay).toBe("memory");
  });

  it("prioritizes settings sheet over memory sheet", () => {
    const result = createIosScreenModel({
      hasCharacter: true,
      memoryOpen: true,
      settingsOpen: true,
      currentRoute: "chat",
    });

    expect(result.overlay).toBe("settings");
  });
});
