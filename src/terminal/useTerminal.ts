import { useCallback, useEffect, useRef, useState } from "react";
import { BOOT, C, out } from "./commands";
import { parseDocPath } from "./doc/routing";
import { useDoc } from "./doc/useDoc";
import { parseCommand } from "./parseCommand";
import { parsePhotosPath } from "./photos/routing";
import { usePhotos } from "./photos/usePhotos";
import type { ScrollEntry, ScrollEntryInput } from "./types";

const TYPE_SPEED = 100;

/** The terminal harness: boot sequence, scrollback, the command prompt, and
 *  URL routing, all tying together the individual command domains (photos,
 *  doc, and the plain-text commands in ./commands) into one terminal. */
export function useTerminal() {
	const [bootLines, setBootLines] = useState<string[]>([]);
	const [booted, setBooted] = useState(false);
	const [hist, setHist] = useState<ScrollEntry[]>([]);
	const [cmd, setCmd] = useState("");

	const scrollRef = useRef<HTMLDivElement | null>(null);
	const bottomRef = useRef<HTMLDivElement | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);
	// Set right before a popstate-driven state update, so the URL-sync effect
	// below knows not to push a *new* history entry for a change the browser
	// itself already navigated to.
	const syncingFromPopState = useRef(false);
	// Flips true once the deep-link effect below has run (after boot). Until
	// then the URL-sync effect must stay a no-op: activeView/w7/docOpen all
	// start empty, and syncing that to the URL before the deep-link check gets
	// a chance to read window.location would stomp an incoming /photos/<dir>
	// link back to / — and in dev, StrictMode double-invokes effects on mount,
	// so a plain "skip the first run" flag doesn't survive that; this
	// condition does, since `booted` (and so the deep-link effect) only flips
	// well after that synchronous double-invoke burst finishes.
	const hydratedFromUrl = useRef(false);
	// Stamped onto every entry so `hist.map` has a stable React key even
	// though `.slice(-6)` below shifts array indices as old entries roll off.
	const nextEntryId = useRef(0);

	const pushEntry = useCallback((entry: ScrollEntryInput) => {
		const withId: ScrollEntry = { ...entry, id: nextEntryId.current++ };
		setHist((h) => [...h, withId].slice(-6));
	}, []);

	const photos = usePhotos({ hist, pushEntry });
	const doc = useDoc({ pushEntry });

	// The two overlays are mutually exclusive — opening one (however it
	// happened: command, click, or a route landing straight on it) closes the
	// other, by reacting to the state change rather than wiring every open
	// call site by hand.
	useEffect(() => {
		if (photos.activeView || photos.w7) doc.closeDoc();
	}, [photos.activeView, photos.w7, doc.closeDoc]);
	useEffect(() => {
		if (doc.docOpen) photos.closeViewer();
	}, [doc.docOpen, photos.closeViewer]);

	// Tries each domain's route parser in turn and applies the first match.
	const applyRoute = useCallback(
		(pathname: string): boolean => {
			if (parseDocPath(pathname)) {
				doc.applyRoute();
				return true;
			}
			const photosRoute = parsePhotosPath(pathname);
			if (photosRoute) {
				photos.applyRoute(photosRoute);
				return true;
			}
			return false;
		},
		[doc.applyRoute, photos.applyRoute],
	);

	// Boot sequence — skipped entirely (no lines printed, not even instantly)
	// when arriving via a deep link, so a shared /photos/... URL opens
	// straight into that view instead of making the visitor sit through it.
	useEffect(() => {
		if (window.location.pathname !== "/") {
			setBooted(true);
			return;
		}
		const reduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reduced) {
			setBootLines(BOOT);
			setBooted(true);
			return;
		}
		let i = 0;
		const id = window.setInterval(() => {
			i += 1;
			setBootLines(BOOT.slice(0, i));
			if (i >= BOOT.length) {
				window.clearInterval(id);
				setBooted(true);
			}
		}, TYPE_SPEED);
		return () => window.clearInterval(id);
	}, []);

	const skipBoot = useCallback(() => {
		setBootLines(BOOT);
		setBooted(true);
	}, []);

	// Auto-scroll to the latest content. hist/photos.w7 aren't read in the
	// body — they're deliberately here only to trigger a re-scroll whenever
	// new content lands or the frame viewer opens/closes. Needs protecting
	// with an ignore: an exhaustive-deps autofix has silently stripped these
	// "trigger-only" deps back down to [] before, which breaks auto-scroll.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above — hist and photos.w7 are intentionally unread triggers, not missing deps
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ block: "end" });
	}, [hist, photos.w7]);

	const run = useCallback(
		(rawCmd: string) => {
			const parsed = parseCommand(rawCmd);
			if (!parsed) return;

			if (parsed.exe === "clear") {
				setHist([]);
				setCmd("");
				return;
			}

			if (photos.tryRunCommand(parsed)) {
				setCmd("");
				return;
			}

			if (doc.tryRunCommand(parsed)) {
				setCmd("");
				return;
			}

			pushEntry({ kind: "cmd", cmd: rawCmd, out: out(rawCmd) });
			setCmd("");
		},
		[photos.tryRunCommand, doc.tryRunCommand, pushEntry],
	);

	// Keep the URL in sync with the app: /doc/resume with the resume viewer
	// open, /photos at the trip listing, /photos/<dir> in a gallery,
	// /photos/<dir>/<slug> with a frame open, / otherwise. Runs for every
	// cause of a change (typing, clicking, stepping through frames with j/k,
	// "cd ~", running an unrelated command) since they all funnel through the
	// two domains' own urlFor().
	useEffect(() => {
		if (!hydratedFromUrl.current) return;
		if (syncingFromPopState.current) {
			syncingFromPopState.current = false;
			return;
		}
		const target = doc.urlFor() ?? photos.urlFor() ?? "/";
		if (window.location.pathname !== target) {
			window.history.pushState(null, "", target);
		}
	}, [doc.urlFor, photos.urlFor]);

	// Deep-link on first load: seeds the equivalent scrollback entry (and open
	// frame/doc, if the link pointed at one) once the boot sequence finishes,
	// same as if it had been typed/clicked. An unrecognized path just boots
	// normally. This also flips hydratedFromUrl, which is what lets the sync
	// effect above start acting — see the comment on that ref.
	useEffect(() => {
		if (!booted) return;
		hydratedFromUrl.current = true;
		applyRoute(window.location.pathname);
		// Deliberately only on `booted` flipping true, not on every dep change.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [booted, applyRoute]);

	// Back/forward: re-derive app state from the URL the browser navigated to,
	// without pushing yet another history entry for it.
	useEffect(() => {
		function onPopState() {
			syncingFromPopState.current = true;
			const handled = applyRoute(window.location.pathname);
			if (!handled) {
				photos.closeViewer();
				doc.closeDoc();
				pushEntry({ kind: "cmd", cmd: "cd ~", out: [] });
			}
		}
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, [applyRoute, photos.closeViewer, doc.closeDoc, pushEntry]);

	// Global keyboard shortcuts, plus: any keystroke skips the boot animation
	// and typing anywhere refocuses the prompt input.
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (!booted) {
				skipBoot();
			}

			const target = e.target as HTMLElement | null;
			const isTyping =
				target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

			if (photos.handleKeyDown(e, isTyping)) return;
			if (doc.handleKeyDown(e)) return;
			if (isTyping) return;

			// Any other printable-ish keystroke lands on the prompt.
			if (!e.metaKey && !e.ctrlKey && !e.altKey && inputRef.current) {
				inputRef.current.focus();
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [booted, skipBoot, photos.handleKeyDown, doc.handleKeyDown]);

	return {
		bootLines,
		booted,
		skipBoot,
		hist,
		cmd,
		setCmd,
		scrollRef,
		bottomRef,
		inputRef,
		run,
		photos,
		doc,
		colors: C,
	};
}

export type TerminalController = ReturnType<typeof useTerminal>;
