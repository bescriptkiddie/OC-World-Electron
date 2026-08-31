import { describe, expect, it } from "vitest";
import { safeParseAnthropicSettings } from "../apps/oc-ios/src/llm-config-parser";

describe("anthropic config parser", () => {
  it("returns valid settings from persisted json", () => {
    expect(
      safeParseAnthropicSettings(
        JSON.stringify({
          provider: "anthropic",
          apiKey: "sk-ant-test-fixture-do-not-use-0000000000",
          model: "claude-3-5-sonnet-latest",
        }),
      ),
    ).toEqual({
      provider: "anthropic",
      apiKey: "sk-ant-test-fixture-do-not-use-0000000000",
      model: "claude-3-5-sonnet-latest",
    });
  });

  it("returns null for malformed or invalid persisted settings", () => {
    expect(safeParseAnthropicSettings("not json")).toBeNull();
    expect(safeParseAnthropicSettings(JSON.stringify({ apiKey: "abc" }))).toBeNull();
  });
});
