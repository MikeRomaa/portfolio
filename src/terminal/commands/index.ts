import { type ParsedCommand, parseCommand } from "../parseCommand";
import type { Line } from "../types";
import { about } from "./about";
import * as eggs from "./easter-eggs";
import { help } from "./help";
import { catProject, projects } from "./projects";
import { resume } from "./resume";

export { BOOT, BOOT_BANNER, BOOT_PRE } from "./boot";
export { C } from "./shared";

type Handler = (cmd: ParsedCommand) => Line[];

/** One entry per executable — like a $PATH lookup. Each handler owns its own
 *  argument handling, so a known command never falls through to "not found"
 *  just because it got different (or no) arguments than expected. */
const COMMANDS: Record<string, Handler> = {
	help,
	about,
	projects,
	cat: catProject,
	resume,
	cd: () => [],
	ls: (cmd) => (cmd.args[0] === "projects" ? projects() : eggs.ls(cmd)),
	fortune: eggs.fortune,
	".fortune": eggs.fortune,
	sudo: eggs.sudo,
	rm: eggs.rm,
	snake: eggs.snake,
	".snake": eggs.snake,
	cowsay: eggs.cowsayCommand,
	".cowsay": eggs.cowsayCommand,
	".secrets": eggs.secrets,
	whoami: eggs.whoami,
};

/** Command output for everything except `photos`, which is handled live by
 *  the photos domain (and intercepted before this ever runs). */
export function out(cmdRaw: string): Line[] {
	const cmd = parseCommand(cmdRaw);
	if (!cmd) return [];
	const handler = COMMANDS[cmd.exe];
	return handler ? handler(cmd) : eggs.unknown(cmd);
}
