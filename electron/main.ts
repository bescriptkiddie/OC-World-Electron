import { app, BrowserWindow, ipcMain, screen, session, type IpcMainEvent } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerIpcHandlers, unregisterIpcHandlers } from "./ipc";
import { loadLocalEnv } from "./services/env";
import { hermesManager } from "./services/hermes-manager";
import { prepareHermesRuntime } from "./services/hermes-runtime";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadLocalEnv({
  files: [
    process.env.OC_WORLD_ENV_FILE,
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../.env"),
    path.resolve(__dirname, "../../.env"),
  ],
});

let quitting = false;
let mainWindow: BrowserWindow | null = null;
let floatingOcWindow: BrowserWindow | null = null;
let floatingOcDragState: {
  startScreenX: number;
  startScreenY: number;
  startWindowX: number;
  startWindowY: number;
} | null = null;

const floatingOcChannels = {
  show: "floating-oc:show",
  close: "floating-oc:close",
  toggle: "floating-oc:toggle",
  getState: "floating-oc:get-state",
  focusMain: "floating-oc:focus-main",
  dragStart: "floating-oc:drag-start",
  dragMove: "floating-oc:drag-move",
  dragEnd: "floating-oc:drag-end",
} as const;

type FloatingOcDragPoint = {
  screenX: number;
  screenY: number;
};

function isTrustedRendererOrigin(rawUrl: string | undefined) {
  if (!rawUrl) {
    return false;
  }

  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === "file:" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "localhost" ||
      url.hostname === "::1"
    );
  } catch {
    return false;
  }
}

function configureLocalStaticPermissions() {
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => (
    permission === "media" && isTrustedRendererOrigin(requestingOrigin)
  ));

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const mediaTypes = details && "mediaTypes" in details ? details.mediaTypes ?? [] : [];
    const wantsAudio = mediaTypes.length === 0 || mediaTypes.includes("audio");
    const requestUrl = details && "requestingUrl" in details ? details.requestingUrl : webContents.getURL();
    callback(permission === "media" && wantsAudio && isTrustedRendererOrigin(requestUrl));
  });
}

function withRendererSurface(rawUrl: string, surface: "main" | "floating-oc") {
  if (surface === "main") {
    return rawUrl;
  }

  const url = new URL(rawUrl);
  url.searchParams.set("surface", surface);
  return url.toString();
}

function loadBuiltRenderer(window: BrowserWindow, surface: "main" | "floating-oc") {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || (!app.isPackaged ? "http://127.0.0.1:5173/" : "");

  if (devServerUrl) {
    window.loadURL(withRendererSurface(devServerUrl, surface));
    if (surface === "main" || process.env.OC_WORLD_OPEN_DEVTOOLS === "1") {
      window.webContents.openDevTools({ mode: "detach" });
    }
    return;
  }

  if (surface === "main") {
    window.loadFile(path.join(__dirname, "../dist/index.html"));
    return;
  }

  window.loadFile(path.join(__dirname, "../dist/index.html"), { query: { surface } });
}

function loadRenderer(window: BrowserWindow, surface: "main" | "floating-oc" = "main") {
  const rendererUrl = process.env.OC_WORLD_RENDERER_URL;
  const rendererFile = process.env.OC_WORLD_RENDERER_FILE;
  const defaultRendererFiles = [
    path.resolve(process.cwd(), "demos/oc-invisible-growth-v1.html"),
    path.resolve(__dirname, "../demos/oc-invisible-growth-v1.html"),
  ];

  if (rendererUrl) {
    window.loadURL(withRendererSurface(rendererUrl, surface));
    if (process.env.OC_WORLD_OPEN_DEVTOOLS === "1") {
      window.webContents.openDevTools({ mode: "detach" });
    }
    return;
  }

  if (surface === "main" && rendererFile) {
    window.loadFile(path.resolve(rendererFile));
    if (process.env.OC_WORLD_OPEN_DEVTOOLS === "1") {
      window.webContents.openDevTools({ mode: "detach" });
    }
    return;
  }

  if (surface === "main" && process.env.OC_WORLD_USE_STATIC_DEMO === "1") {
    const defaultRendererFile = defaultRendererFiles.find((candidate) => fs.existsSync(candidate));

    if (defaultRendererFile) {
      window.loadFile(defaultRendererFile);
      if (process.env.OC_WORLD_OPEN_DEVTOOLS === "1") {
        window.webContents.openDevTools({ mode: "detach" });
      }
      return;
    }
  }

  loadBuiltRenderer(window, surface);
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadRenderer(window);
  mainWindow = window;
  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
}

function getFloatingOcState() {
  return {
    open: Boolean(floatingOcWindow && !floatingOcWindow.isDestroyed()),
  };
}

function readFloatingOcDragPoint(value: unknown): FloatingOcDragPoint | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const point = value as Partial<FloatingOcDragPoint>;
  const screenX = point.screenX;
  const screenY = point.screenY;
  if (typeof screenX !== "number" || typeof screenY !== "number" || !Number.isFinite(screenX) || !Number.isFinite(screenY)) {
    return null;
  }

  return {
    screenX,
    screenY,
  };
}

function isFloatingOcSender(event: IpcMainEvent) {
  return Boolean(
    floatingOcWindow &&
      !floatingOcWindow.isDestroyed() &&
      event.sender.id === floatingOcWindow.webContents.id,
  );
}

function clampFloatingOcPosition(x: number, y: number) {
  if (!floatingOcWindow || floatingOcWindow.isDestroyed()) {
    return { x, y };
  }

  const bounds = floatingOcWindow.getBounds();
  const workArea = screen.getDisplayNearestPoint({ x, y }).workArea;
  return {
    x: Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - bounds.width),
    y: Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - bounds.height),
  };
}

function handleFloatingOcDragStart(event: IpcMainEvent, rawPoint: unknown) {
  if (!isFloatingOcSender(event) || !floatingOcWindow || floatingOcWindow.isDestroyed()) {
    return;
  }

  const point = readFloatingOcDragPoint(rawPoint);
  if (!point) {
    return;
  }

  const bounds = floatingOcWindow.getBounds();
  floatingOcDragState = {
    startScreenX: point.screenX,
    startScreenY: point.screenY,
    startWindowX: bounds.x,
    startWindowY: bounds.y,
  };
}

function handleFloatingOcDragMove(event: IpcMainEvent, rawPoint: unknown) {
  if (!isFloatingOcSender(event) || !floatingOcWindow || floatingOcWindow.isDestroyed() || !floatingOcDragState) {
    return;
  }

  const point = readFloatingOcDragPoint(rawPoint);
  if (!point) {
    return;
  }

  const next = clampFloatingOcPosition(
    Math.round(floatingOcDragState.startWindowX + point.screenX - floatingOcDragState.startScreenX),
    Math.round(floatingOcDragState.startWindowY + point.screenY - floatingOcDragState.startScreenY),
  );
  floatingOcWindow.setPosition(next.x, next.y, false);
}

function handleFloatingOcDragEnd(event: IpcMainEvent) {
  if (!isFloatingOcSender(event)) {
    return;
  }

  floatingOcDragState = null;
}

function createFloatingOcWindow() {
  if (floatingOcWindow && !floatingOcWindow.isDestroyed()) {
    floatingOcWindow.show();
    floatingOcWindow.moveTop();
    return floatingOcWindow;
  }

  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const width = 224;
  const height = 260;
  const x = Math.round(workArea.x + workArea.width - width - 28);
  const y = Math.round(workArea.y + workArea.height - height - 28);

  const window = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    acceptFirstMouse: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.setBackgroundColor("#00000000");
  window.setAlwaysOnTop(true, "floating");
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.setContentProtection(false);
  loadRenderer(window, "floating-oc");

  floatingOcWindow = window;
  window.on("closed", () => {
    if (floatingOcWindow === window) {
      floatingOcWindow = null;
    }
  });

  return window;
}

function closeFloatingOcWindow() {
  if (!floatingOcWindow || floatingOcWindow.isDestroyed()) {
    floatingOcWindow = null;
    floatingOcDragState = null;
    return getFloatingOcState();
  }

  floatingOcWindow.close();
  floatingOcWindow = null;
  floatingOcDragState = null;
  return getFloatingOcState();
}

function registerWindowIpcHandlers() {
  ipcMain.handle(floatingOcChannels.show, () => {
    createFloatingOcWindow();
    return getFloatingOcState();
  });
  ipcMain.handle(floatingOcChannels.close, () => closeFloatingOcWindow());
  ipcMain.handle(floatingOcChannels.toggle, () => {
    if (floatingOcWindow && !floatingOcWindow.isDestroyed()) {
      return closeFloatingOcWindow();
    }

    createFloatingOcWindow();
    return getFloatingOcState();
  });
  ipcMain.handle(floatingOcChannels.getState, () => getFloatingOcState());
  ipcMain.handle(floatingOcChannels.focusMain, () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
    }
    mainWindow?.show();
    mainWindow?.focus();
    return true;
  });
  ipcMain.on(floatingOcChannels.dragStart, handleFloatingOcDragStart);
  ipcMain.on(floatingOcChannels.dragMove, handleFloatingOcDragMove);
  ipcMain.on(floatingOcChannels.dragEnd, handleFloatingOcDragEnd);
}

function unregisterWindowIpcHandlers() {
  ipcMain.removeHandler(floatingOcChannels.show);
  ipcMain.removeHandler(floatingOcChannels.close);
  ipcMain.removeHandler(floatingOcChannels.toggle);
  ipcMain.removeHandler(floatingOcChannels.getState);
  ipcMain.removeHandler(floatingOcChannels.focusMain);
  ipcMain.removeListener(floatingOcChannels.dragStart, handleFloatingOcDragStart);
  ipcMain.removeListener(floatingOcChannels.dragMove, handleFloatingOcDragMove);
  ipcMain.removeListener(floatingOcChannels.dragEnd, handleFloatingOcDragEnd);
}

app.whenReady().then(() => {
  configureLocalStaticPermissions();
  prepareHermesRuntime({
    userDataPath: app.getPath("userData"),
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    cwd: process.cwd(),
    isPackaged: app.isPackaged,
  });
  registerIpcHandlers();
  registerWindowIpcHandlers();
  void hermesManager.start();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", (event) => {
  if (quitting) {
    return;
  }

  quitting = true;
  event.preventDefault();
  closeFloatingOcWindow();
  unregisterWindowIpcHandlers();
  unregisterIpcHandlers();
  void hermesManager.stop().finally(() => {
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
