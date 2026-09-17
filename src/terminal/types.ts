export interface Line {
	t: string;
	color?: string;
	pad?: string;
	link?: string;
}

/** `'trips'` (the top-level listing) or a trip's dir — see Trip.dir — while
 *  browsing that trip's gallery. Trips are whatever collections exist under
 *  fs/photos/ at build time, so this isn't a fixed union. */
export type PhotoView = "trips" | string;

export interface Frame {
	/** `<collection dir>/<photo slug>` — also the path under /photos/ its
	 *  generated tiers live at, e.g. `/photos/${key}.jpeg`. */
	key: string;
	name: string;
	meta: string;
	place: string;
}

export interface Trip {
	/** The collection's directory name under fs/photos/ — also its unique key
	 *  in TRIPS, and the URL/command path segment (`photos/<dir>`). */
	dir: string;
	label: string;
	frameCount: number;
	places: string;
	date: string;
	frameKeys: string[];
}

export type ScrollEntry =
	| { id: number; kind: "cmd"; cmd: string; out: Line[] }
	| { id: number; kind: "photos"; cmd: string; view: PhotoView };

/** What callers construct — `useTerminal`'s `pushEntry` stamps the `id`
 *  itself, since `hist` is capped to its last few entries (see pushEntry),
 *  which shifts array indices and makes those unsafe as React keys. */
export type ScrollEntryInput =
	| { kind: "cmd"; cmd: string; out: Line[] }
	| { kind: "photos"; cmd: string; view: PhotoView };
