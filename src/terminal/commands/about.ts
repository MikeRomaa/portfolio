import type { Line } from "../types";
import { sec } from "./shared";

export function about(): Line[] {
	return sec("~/about", [
		"Software engineer, three years at Bloomberg. Messaging",
		"systems, latency budgets, the unglamorous parts that",
		"have to be right.",
		"",
		"Off the clock: film cameras and an unreasonable number",
		"of dotfile commits.",
		"",
		{ t: "→ projects", link: "projects" },
	]);
}
