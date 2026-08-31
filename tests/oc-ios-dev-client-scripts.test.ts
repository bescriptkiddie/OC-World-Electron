import { describe, expect, it } from "vitest";
import appPackage from "../apps/oc-ios/package.json";

describe("expo dev client scripts", () => {
  it("exposes explicit dev-client launch scripts for iOS debugging", () => {
    expect(appPackage.scripts).toMatchObject({
      "start:dev-client": "expo start --dev-client --host localhost",
      "ios:build": "expo run:ios",
      "ios:dev": "expo start --dev-client --host localhost --ios",
    });
  });
});
