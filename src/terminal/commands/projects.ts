import type { ParsedCommand } from "../parseCommand";
import type { Line } from "../types";
import { C, sec } from "./shared";

export function projects(): Line[] {
	return sec("~/projects", [
		{ t: "tape/           append-only log · rust · 2.4k ★", link: "cat tape" },
		{ t: "latency-lab/    honest p99.9 histograms", link: "cat latency-lab" },
		{ t: "dotfiles/       this site’s ancestor", link: "cat dotfiles" },
		"",
		"cat any of them for the README.",
	]);
}

export function catProject(cmd: ParsedCommand): Line[] {
	const name = cmd.args[0];
	if (!name) {
		return sec("", [
			"cat: missing operand",
			"Try 'cat tape' or 'cat latency-lab'.",
		]);
	}
	if (name === "tape") {
		return sec("# tape", [
			"An append-only log for teams who keep reaching for Kafka",
			"and regretting it. Single binary, no coordinator, io_uring",
			"on the write path. Was my only pager for a year.",
			"",
			{ t: "git clone git@github.com:you/tape.git", color: C.norm },
		]);
	}
	return sec(`# ${name}`, ["README pending. Ask me in the guestbook."]);
}
