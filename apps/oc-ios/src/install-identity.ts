export type InstallIdentity = {
  userId: string;
  createdAt: number;
};

export function createInstallIdentity(now = Date.now()): InstallIdentity {
  return {
    userId: `ios-user-${now}-${Math.random().toString(16).slice(2, 10)}`,
    createdAt: now,
  };
}

export function isValidInstallIdentity(value: InstallIdentity) {
  return Boolean(value.userId.startsWith("ios-user-") && Number.isFinite(value.createdAt));
}
