import {
	PHOTO_MANIFEST,
	type PhotoManifestEntry,
} from "./photo-manifest.generated";
import type { Frame, Trip } from "./types";

function formatDate(iso: string | null): string | null {
	if (!iso) return null;
	return new Date(iso)
		.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		})
		.toLowerCase();
}

// Builds a frame straight from the source photo's own EXIF (see
// vite-plugins/generate-photos.ts) — lens/focal/aperture/shutter/ISO for the
// technical line, the photo's own timestamp for `place`. No per-photo
// location is shown: the source photos' GPS isn't resolved to a place name
// (that's still TODO), and the trip's curated `places` list describes the
// trip as a whole, not any specific frame — showing it per-photo would be a
// fabricated guess, not real data.
function buildFrame(trip: Trip, entry: PhotoManifestEntry): Frame {
	const metaParts = [
		entry.lens,
		entry.focalLength ? `${entry.focalLength}mm` : null,
		entry.aperture ? `f/${entry.aperture}` : null,
		entry.shutterSpeed,
		entry.iso ? `ISO ${entry.iso}` : null,
	].filter((part): part is string => !!part);

	const date = formatDate(entry.takenAt) ?? trip.date;

	return {
		key: `${trip.dir}/${entry.slug}`,
		name: entry.filename,
		meta: metaParts.length ? metaParts.join(" · ") : "no exif data",
		place: date ?? "",
	};
}

const trips: Record<string, Trip> = {};
const frameMap: Record<string, Frame> = {};

for (const dir of Object.keys(PHOTO_MANIFEST).sort()) {
	const collection = PHOTO_MANIFEST[dir];
	const trip: Trip = {
		dir,
		label: `${collection.label}/`,
		frameCount: collection.frameCount,
		places: collection.places,
		date: collection.date,
		frameKeys: [],
	};
	collection.photos.forEach((entry) => {
		const frame = buildFrame(trip, entry);
		frameMap[frame.key] = frame;
		trip.frameKeys.push(frame.key);
	});
	trips[dir] = trip;
}

export const TRIPS: Record<string, Trip> = trips;
export const FRAME_MAP: Record<string, Frame> = frameMap;
