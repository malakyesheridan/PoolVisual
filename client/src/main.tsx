import { createRoot } from "react-dom/client";
import { initSentry } from "./lib/sentry";
import App from "./App";
import "./index.css";
import "./styles/app-shell.css";

// Initialize Sentry before rendering app
initSentry();

createRoot(document.getElementById("root")!).render(<App />);
