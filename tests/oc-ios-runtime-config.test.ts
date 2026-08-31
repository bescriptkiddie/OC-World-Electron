import { describe, expect, it } from "vitest";
import { buildRuntimeConfig, resolveAppDisplayName } from "../apps/oc-ios/src/runtime-config-shared";

describe("ios runtime config", () => {
  it("requires a non-localhost gateway url for packaged builds", () => {
    const config = buildRuntimeConfig({
      gatewayBaseUrl: "https://staging.ocworld.app",
      bundleIdentifier: "ai.pika.ocios",
      appName: "OC World",
    });

    expect(config.gatewayBaseUrl).toBe("https://staging.ocworld.app");
    expect(resolveAppDisplayName(config)).toBe("OC World");
  });

  it("rejects localhost and loopback urls", () => {
    expect(() =>
      buildRuntimeConfig({
        gatewayBaseUrl: "http://127.0.0.1:8787",
        bundleIdentifier: "ai.pika.ocios",
        appName: "OC World",
      }),
    ).toThrow("must not point to localhost");
  });
});
