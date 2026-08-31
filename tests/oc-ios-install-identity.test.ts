import { describe, expect, it } from "vitest";
import { createInstallIdentity, isValidInstallIdentity } from "../apps/oc-ios/src/install-identity";

describe("install identity", () => {
  it("creates a unique per-install user id", () => {
    const identity = createInstallIdentity();

    expect(identity.userId.startsWith("ios-user-")).toBe(true);
    expect(isValidInstallIdentity(identity)).toBe(true);
  });
});
