import "./ocworld.css";
import { useLayoutEffect } from "react";
import { FloatingOcWindow } from "./components/FloatingOcWindow";
import { OcWorldApp } from "./components/OcWorldApp";

export function App() {
  const surface = new URLSearchParams(window.location.search).get("surface");

  useLayoutEffect(() => {
    const ocSurface = surface === "floating-oc" ? "floating-oc" : "main";
    document.documentElement.dataset.ocSurface = ocSurface;
    document.body.dataset.ocSurface = ocSurface;

    return () => {
      delete document.documentElement.dataset.ocSurface;
      delete document.body.dataset.ocSurface;
    };
  }, [surface]);

  if (surface === "floating-oc") {
    return <FloatingOcWindow />;
  }

  return <OcWorldApp />;
}
