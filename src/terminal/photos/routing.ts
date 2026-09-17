import { FRAME_MAP, TRIPS } from "../frames";
import type { PhotoView } from "../types";
import type { OpenFrame } from "./usePhotos";

export interface PhotosRoute {
	view: PhotoView;
	frame: OpenFrame | null;
}

/** Parses /photos, /photos/<dir>, and /photos/<dir>/<slug> — only resolves if
 *  it actually matches a known trip/frame, so a stale or bogus link just
 *  falls through to a normal boot instead of a dead view. */
export function parsePhotosPath(pathname: string): PhotosRoute | null {
	if (pathname === "/photos") return { view: "trips", frame: null };
	if (!pathname.startsWith("/photos/")) return null;

	const rest = decodeURIComponent(pathname.slice("/photos/".length)).replace(
		/\/$/,
		"",
	);
	const slashIdx = rest.indexOf("/");
	if (slashIdx === -1) {
		return TRIPS[rest] ? { view: rest, frame: null } : null;
	}

	const dir = rest.slice(0, slashIdx);
	const slug = rest.slice(slashIdx + 1);
	if (!TRIPS[dir]) return null;
	const key = `${dir}/${slug}`;
	if (!FRAME_MAP[key]) return null;
	return { view: dir, frame: { key, trip: dir } };
}

export function photosUrlFor(
	view: PhotoView | null,
	frame: OpenFrame | null,
): string | null {
	if (frame) return `/photos/${frame.key}`;
	if (!view) return null;
	return view === "trips" ? "/photos" : `/photos/${view}`;
}
