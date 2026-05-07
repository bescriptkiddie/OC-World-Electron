import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { RuntimeProvider } from "./runtime/context";
import { createElectronClient } from "./runtime/electron-client";
import { createBrowserClient } from "./runtime/browser-client";

const runtime = window.ocWorld ? createElectronClient() : createBrowserClient();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RuntimeProvider value={runtime}>
      <App />
    </RuntimeProvider>
  </React.StrictMode>,
);
