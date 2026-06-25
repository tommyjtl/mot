import { createRoot } from "react-dom/client";
import "@/assets/styles/globals.css";
import "./library-speak.css";
import "./library-word.css";
import { App } from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Library root element not found.");
}

createRoot(rootElement).render(<App />);
