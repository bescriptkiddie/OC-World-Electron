export type IosRoute = "onboarding" | "chat" | "rewind";
export type IosOverlay = "memory" | "settings" | null;

export function createIosScreenModel(input: {
  hasCharacter: boolean;
  memoryOpen: boolean;
  settingsOpen: boolean;
  currentRoute: "chat" | "rewind";
}) {
  const homeRoute: IosRoute = input.hasCharacter ? input.currentRoute : "onboarding";
  const baseRoute = input.memoryOpen ? "chat" : homeRoute;
  const overlay: IosOverlay = input.settingsOpen ? "settings" : input.memoryOpen ? "memory" : null;

  return {
    homeRoute,
    baseRoute,
    overlay,
  };
}
