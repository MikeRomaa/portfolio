import { useCallback, useState } from "react";
import { TRIPS } from "../frames";
import type { ParsedCommand } from "../parseCommand";
import type { Line, PhotoView, ScrollEntry, ScrollEntryInput } from "../types";
import { type PhotosRoute, photosUrlFor } from "./routing";

export interface OpenFrame {
	key: string;
	trip: string;
}

interface UsePhotosArgs {
	hist: ScrollEntry[];
	pushEntry: (entry: ScrollEntryInput) => void;
}

/** Everything to do with the photo browser — trip listing, per-trip gallery,
 *  and the fullscreen frame viewer: its state, the commands that drive it,
 *  its keyboard shortcuts, and its slice of URL routing. */
export function usePhotos({ hist, pushEntry }: UsePhotosArgs) {
	const [w7, setW7] = useState<OpenFrame | null>(null);
	const [hover, setHover] = useState<string | null>(null);

	// The photo browser (trip listing / gallery) is "active" only while the
	// most recent scrollback entry is a photos view — as soon as any other
	// command runs, it's just frozen history like everything else.
	const lastEntry = hist[hist.length - 1];
	const activeView: PhotoView | null =
		lastEntry?.kind === "photos" ? lastEntry.view : null;

	const pushCmd = useCallback(
		(rawCmd: string, lines: Line[]) =>
			pushEntry({ kind: "cmd", cmd: rawCmd, out: lines }),
		[pushEntry],
	);
	const pushPhotos = useCallback(
		(rawCmd: string, view: PhotoView) =>
			pushEntry({ kind: "photos", cmd: rawCmd, view }),
		[pushEntry],
	);

	const goTrip = useCallback(
		(dir: string) => pushPhotos(`ls photos/${TRIPS[dir].dir}`, dir),
		[pushPhotos],
	);
	const backToTrips = useCallback(
		() => pushPhotos("cd ..", "trips"),
		[pushPhotos],
	);
	const exitPhotos = useCallback(() => pushCmd("cd ~", []), [pushCmd]);

	const closeViewer = useCallback(() => setW7(null), []);
	const openFrame = useCallback(
		(key: string, trip: string) => setW7({ key, trip }),
		[],
	);

	const stepFrame = useCallback((dir: 1 | -1) => {
		setW7((current) => {
			if (!current) return current;
			const keys = TRIPS[current.trip].frameKeys;
			const idx = keys.indexOf(current.key);
			if (idx === -1) return current;
			const next = (idx + dir + keys.length) % keys.length;
			return { key: keys[next], trip: current.trip };
		});
	}, []);

	/** Tries to interpret a typed command as a photos command. Routes on the
	 *  executable (cd/ls/photos/a bare "photos/<dir>" path), letting each form
	 *  react to its own arguments instead of needing an exact whole-string
	 *  match. Returns true if it handled it (caller should stop dispatching
	 *  further). */
	const tryRunCommand = useCallback(
		(cmd: ParsedCommand): boolean => {
			const { exe, args, raw } = cmd;

			if (
				exe === "cd" &&
				(args.length === 0 || args[0] === "..") &&
				activeView
			) {
				if (activeView === "trips") pushCmd("cd ~", []);
				else pushPhotos("cd ..", "trips");
				return true;
			}

			if (exe === "photos" && args.length === 0) {
				pushPhotos(raw, "trips");
				return true;
			}
			if (exe === "ls" && args.length === 1 && args[0] === "photos") {
				pushPhotos(raw, "trips");
				return true;
			}

			// A trip path can arrive as the executable itself ("photos/italy-2026"),
			// or as the sole argument to `ls`/`cd`.
			const tripArg = exe === "ls" || exe === "cd" ? args[0] : exe;
			if (tripArg?.startsWith("photos/")) {
				const dir = tripArg.slice("photos/".length);
				if (TRIPS[dir]) {
					pushPhotos(raw, dir);
					return true;
				}
			}

			return false;
		},
		[activeView, pushCmd, pushPhotos],
	);

	/** Returns true if it consumed the key. `isTyping` gates only the
	 *  activeView q/Escape shortcut — the fullscreen-viewer shortcuts fire
	 *  regardless of where focus currently is. */
	const handleKeyDown = useCallback(
		(e: KeyboardEvent, isTyping: boolean): boolean => {
			if (w7) {
				if (e.key === "q" || e.key === "Escape") {
					e.preventDefault();
					closeViewer();
				} else if (e.key === "j" || e.key === "ArrowRight") {
					e.preventDefault();
					stepFrame(1);
				} else if (e.key === "k" || e.key === "ArrowLeft") {
					e.preventDefault();
					stepFrame(-1);
				}
				return true;
			}

			if (isTyping) return false;

			if (activeView && (e.key === "q" || e.key === "Escape")) {
				e.preventDefault();
				if (activeView === "trips") pushCmd("cd ~", []);
				else pushPhotos("cd ..", "trips");
				return true;
			}

			return false;
		},
		[w7, closeViewer, stepFrame, activeView, pushCmd, pushPhotos],
	);

	const applyRoute = useCallback(
		(parsed: PhotosRoute) => {
			pushPhotos(
				parsed.view === "trips" ? "photos" : `ls photos/${parsed.view}`,
				parsed.view,
			);
			setW7(parsed.frame);
		},
		[pushPhotos],
	);

	const urlFor = useCallback(
		() => photosUrlFor(activeView, w7),
		[activeView, w7],
	);

	return {
		activeView,
		w7,
		hover,
		setHover,
		goTrip,
		backToTrips,
		exitPhotos,
		openFrame,
		closeViewer,
		stepFrame,
		tryRunCommand,
		handleKeyDown,
		applyRoute,
		urlFor,
	};
}

export type PhotosController = ReturnType<typeof usePhotos>;
