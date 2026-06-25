import { createRoot } from "react-dom/client";
import "@/assets/styles/globals.css";
import { App } from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Options root element not found.");
}

createRoot(rootElement).render(<App />);
