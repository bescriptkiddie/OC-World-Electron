import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

const initialOcSurface = new URLSearchParams(window.location.search).get("surface") === "floating-oc"
  ? "floating-oc"
  : "main";
document.documentElement.dataset.ocSurface = initialOcSurface;
document.body.dataset.ocSurface = initialOcSurface;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
