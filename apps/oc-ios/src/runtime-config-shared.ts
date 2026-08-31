type RuntimeConfigInput = {
  gatewayBaseUrl: string;
  bundleIdentifier: string;
  appName: string;
};

export type RuntimeConfig = RuntimeConfigInput;

function isLocalhostUrl(value: string) {
  return /^(https?:\/\/)?(127\.0\.0\.1|localhost|0\.0\.0\.0)(:\d+)?/i.test(value);
}

export function buildRuntimeConfig(input: RuntimeConfigInput): RuntimeConfig {
  if (isLocalhostUrl(input.gatewayBaseUrl)) {
    throw new Error("gatewayBaseUrl must not point to localhost");
  }

  return {
    gatewayBaseUrl: input.gatewayBaseUrl.replace(/\/$/, ""),
    bundleIdentifier: input.bundleIdentifier,
    appName: input.appName,
  };
}

export function resolveAppDisplayName(config: RuntimeConfig) {
  return config.appName;
}
