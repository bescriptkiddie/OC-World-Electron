import "./ocworld.css";
import { useEffect } from "react";
import { FloatingOcWindow } from "./components/FloatingOcWindow";
import { OcWorldApp } from "./components/OcWorldApp";

export function App() {
  const surface = new URLSearchParams(window.location.search).get("surface");

  useEffect(() => {
    document.body.dataset.ocSurface = surface === "floating-oc" ? "floating-oc" : "main";
    return () => {
      delete document.body.dataset.ocSurface;
    };
  }, [surface]);

  if (surface === "floating-oc") {
    return <FloatingOcWindow />;
  }

  return <OcWorldApp />;
}
