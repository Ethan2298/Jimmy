import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@milkdown/crepe/theme/common/style.css";
import "./app.css";
import "streamdown/styles.css";
import { normalizePlatform } from "../shared/platform";

document.documentElement.dataset.platform = normalizePlatform(window.api.platform);

createRoot(document.getElementById("root")!).render(<App />);
