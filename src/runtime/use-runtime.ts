import { useContext } from "react";
import { RuntimeContext } from "./context";

export function useRuntime() {
  const value = useContext(RuntimeContext);
  if (!value) {
    throw new Error("RuntimeProvider is missing");
  }
  return value;
}
