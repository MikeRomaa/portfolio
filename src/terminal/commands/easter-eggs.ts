import type { ParsedCommand } from "../parseCommand";
import type { Line } from "../types";
import { sec } from "./shared";

function cowsay(msg: string): Line[] {
	const top = `  ${"_".repeat(msg.length + 2)}`;
	const bottom = `  ${"-".repeat(msg.length + 2)}`;
	return sec("", [
		top,
		` < ${msg} >`,
		bottom,
		"         \\   ^__^",
		"          \\  (oo)\\_______",
		"             (__)\\       )",
		"                 ||----w |",
		"                 ||     ||",
	]);
}

export function ls(cmd: ParsedCommand): Line[] {
	const base = ["about  projects  photos  resume  guestbook"];
	if (cmd.args.includes("-a")) base.push(".secrets  .snake  .fortune  .cowsay");
	return sec("~", base);
}

export function fortune(): Line[] {
	return sec("", ['"It works on my machine" — attributed to everyone']);
}

export function sudo(): Line[] {
	return sec("", [
		"guest is not in the sudoers file.",
		"This incident has been reported. (it hasn’t)",
	]);
}

export function rm(cmd: ParsedCommand): Line[] {
	const { args } = cmd;
	if (args.includes("--help")) {
		return sec("Usage: rm [OPTION]... [FILE]...", [
			"Remove (unlink) the FILE(s).",
			"",
			"  -f, --force     ignore nonexistent files, never prompt",
			"  -r, -R           remove directories and their contents recursively",
		]);
	}
	if (args.length === 0) {
		return sec("", [
			"rm: missing operand",
			"Try 'rm --help' for more information.",
		]);
	}
	const forceRecursive =
		args.includes("-rf") ||
		args.includes("-fr") ||
		(args.includes("-r") && args.includes("-f"));
	const targetsRoot = args.includes("/") || args.includes("/*");
	if (forceRecursive && targetsRoot) {
		return sec("", [
			"rm: cannot remove ‘/’: nice try",
			"rm: 1 point awarded for curiosity",
		]);
	}
	const target = args[args.length - 1];
	return sec("", [`rm: cannot remove '${target}': No such file or directory`]);
}

export function snake(): Line[] {
	return sec("snake — arrows to move, q to quit", [
		"┌──────────────────────┐",
		"│        ooo●          │",
		"│                 *    │",
		"└──────────────────────┘",
		"score 30",
	]);
}

export function cowsayCommand(cmd: ParsedCommand): Line[] {
	return cowsay(cmd.rest || "hire me");
}

export function secrets(): Line[] {
	return sec("", ["You found it. There is nothing here except respect."]);
}

export function whoami(): Line[] {
	return sec("", ["guest — but you could be a recruiter, who knows"]);
}

export function unknown(cmd: ParsedCommand): Line[] {
	return sec("", [`${cmd.exe}: command not found. try \`help\`.`]);
}
