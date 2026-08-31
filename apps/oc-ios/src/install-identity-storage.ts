import * as FileSystem from "expo-file-system/legacy";
import { createInstallIdentity, type InstallIdentity } from "./install-identity";

const installIdentityPath = `${FileSystem.documentDirectory || ""}install-identity.json`;

export async function loadInstallIdentity(): Promise<InstallIdentity> {
  if (!FileSystem.documentDirectory) {
    return createInstallIdentity();
  }

  const info = await FileSystem.getInfoAsync(installIdentityPath);
  if (info.exists) {
    const raw = await FileSystem.readAsStringAsync(installIdentityPath);
    return JSON.parse(raw) as InstallIdentity;
  }

  const identity = createInstallIdentity();
  await FileSystem.writeAsStringAsync(installIdentityPath, JSON.stringify(identity));
  return identity;
}
