import Constants from "expo-constants";
import { buildRuntimeConfig, type RuntimeConfig } from "./runtime-config-shared";

export function readRuntimeConfig(): RuntimeConfig {
  const expoConfig = Constants.expoConfig;
  const gatewayBaseUrl = String(expoConfig?.extra?.gatewayBaseUrl || "");
  const bundleIdentifier = String(expoConfig?.ios?.bundleIdentifier || "");
  const appName = String(expoConfig?.extra?.appName || expoConfig?.name || "OC World");

  return buildRuntimeConfig({
    gatewayBaseUrl,
    bundleIdentifier,
    appName,
  });
}
