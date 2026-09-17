export interface ParsedCommand {
	/** Exact text as typed/submitted. */
	raw: string;
	/** The program name — first whitespace-delimited token, lowercased. */
	exe: string;
	/** Remaining tokens, whitespace-split. */
	args: string[];
	/** Everything after the executable, original spacing/case preserved. */
	rest: string;
}

/** Splits a typed command into an executable and its arguments, the way a
 *  shell would — so dispatch happens on *what's being run*, and each command
 *  decides for itself how to react to the arguments it got, instead of every
 *  argument variation needing its own exact-string match at the top level. */
export function parseCommand(rawCmd: string): ParsedCommand | null {
	const trimmed = rawCmd.trim();
	if (!trimmed) return null;
	const spaceIdx = trimmed.search(/\s/);
	if (spaceIdx === -1)
		return { raw: rawCmd, exe: trimmed.toLowerCase(), args: [], rest: "" };
	const exe = trimmed.slice(0, spaceIdx).toLowerCase();
	const rest = trimmed.slice(spaceIdx + 1).trim();
	const args = rest.split(/\s+/).filter(Boolean);
	return { raw: rawCmd, exe, args, rest };
}
