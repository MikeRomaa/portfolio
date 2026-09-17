import { useCallback, useState } from "react";
import { out } from "../commands";
import type { ParsedCommand } from "../parseCommand";
import type { ScrollEntryInput } from "../types";
import { docUrlFor } from "./routing";

interface UseDocArgs {
	pushEntry: (entry: ScrollEntryInput) => void;
}

/** Everything to do with the windowed resume/doc viewer: its state, the
 *  command that opens it, its keyboard shortcut, and its slice of routing. */
export function useDoc({ pushEntry }: UseDocArgs) {
	const [docOpen, setDocOpen] = useState(false);

	const openDoc = useCallback(() => setDocOpen(true), []);
	const closeDoc = useCallback(() => setDocOpen(false), []);

	const tryRunCommand = useCallback(
		(cmd: ParsedCommand): boolean => {
			if (cmd.exe !== "resume") return false;
			pushEntry({ kind: "cmd", cmd: cmd.raw, out: out(cmd.raw) });
			openDoc();
			return true;
		},
		[pushEntry, openDoc],
	);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent): boolean => {
			if (!docOpen) return false;
			if (e.key === "q" || e.key === "Escape") {
				e.preventDefault();
				closeDoc();
			}
			return true;
		},
		[docOpen, closeDoc],
	);

	const applyRoute = useCallback(() => {
		pushEntry({ kind: "cmd", cmd: "resume", out: out("resume") });
		setDocOpen(true);
	}, [pushEntry]);

	const urlFor = useCallback(() => docUrlFor(docOpen), [docOpen]);

	return {
		docOpen,
		openDoc,
		closeDoc,
		tryRunCommand,
		handleKeyDown,
		applyRoute,
		urlFor,
	};
}

export type DocController = ReturnType<typeof useDoc>;
