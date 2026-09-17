import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Terminal } from "./terminal/Terminal.tsx";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element not found");

createRoot(rootEl).render(
	<StrictMode>
		<Terminal />
	</StrictMode>,
);
