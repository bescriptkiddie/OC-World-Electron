import { app, BrowserWindow } from "electron";
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

function loadRenderer(window: BrowserWindow) {
  const rendererUrl = process.env.OC_WORLD_RENDERER_URL;
  const rendererFile = process.env.OC_WORLD_RENDERER_FILE;

  if (rendererUrl) {
    window.loadURL(rendererUrl);
    if (process.env.OC_WORLD_OPEN_DEVTOOLS === "1") {
      window.webContents.openDevTools({ mode: "detach" });
    }
    return;
  }

  if (rendererFile) {
    window.loadFile(path.resolve(rendererFile));
    if (process.env.OC_WORLD_OPEN_DEVTOOLS === "1") {
      window.webContents.openDevTools({ mode: "detach" });
    }
    return;
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  window.loadFile(path.join(__dirname, "../dist/index.html"));
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
}

app.whenReady().then(() => {
  prepareHermesRuntime({
    userDataPath: app.getPath("userData"),
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    cwd: process.cwd(),
    isPackaged: app.isPackaged,
  });
  registerIpcHandlers();
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
