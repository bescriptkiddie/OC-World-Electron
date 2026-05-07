import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { RuntimeProvider } from "./runtime/context";
import { createElectronClient } from "./runtime/electron-client";
import { createBrowserClient } from "./runtime/browser-client";

const runtime = window.ocWorld ? createElectronClient() : createBrowserClient();
const initialOcSurface = new URLSearchParams(window.location.search).get("surface") === "floating-oc"
  ? "floating-oc"
  : "main";
document.documentElement.dataset.ocSurface = initialOcSurface;
document.body.dataset.ocSurface = initialOcSurface;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RuntimeProvider value={runtime}>
      <App />
    </RuntimeProvider>
  </React.StrictMode>,
);
