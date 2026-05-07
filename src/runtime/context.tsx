import { createContext } from "react";
import type { OcWorldClient } from "./client";
import type { PlatformCapabilities } from "./platform-capabilities";

export interface RuntimeContextValue {
  client: OcWorldClient;
  capabilities: PlatformCapabilities;
}

export const RuntimeContext = createContext<RuntimeContextValue | null>(null);

export const RuntimeProvider = RuntimeContext.Provider;
