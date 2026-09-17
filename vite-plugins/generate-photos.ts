// Vite plugin that builds public/ assets from fs/, the "real" filesystem
// this project's terminal fiction is modeled on:
//
//   fs/photos/<collection>/<photo>.jpeg  ->  public/photos/<collection>/...
//   fs/doc/<file>                        ->  public/doc/<file>
//   fs/portrait.jpeg                     ->  public/portrait.jpeg, portrait-1bit.png
//
// For each source photo this generates three tiers: a small preview (the
// gallery grid + hover-reveal), a 1-bit-styled dithered overlay, and a
// full-resolution copy loaded only when a frame is opened in the viewer.
// The portrait gets the same preview + dither treatment (no full tier —
// there's no fullscreen viewer for it).
//
// It also writes src/terminal/photo-manifest.generated.ts, a plain list of
// which collections/photos exist — frames.ts reads that to build the
// gallery's frame list, so dropping a new photo into fs/photos/<collection>/
// is the only step needed; nothing to hand-edit.
//
// Runs on buildStart, which Vite calls for both `vite dev` and `vite build`,
// so no separate pre-script is needed. In dev it also watches fs/ and
// regenerates on any change, reloading the browser afterward.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
	copyFile,
	mkdir,
	readdir,
	readFile,
	stat,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import exifr from "exifr";
import sharp, { type Sharp } from "sharp";
import type { Plugin, ViteDevServer } from "vite";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FS_DIR = path.join(ROOT, "fs");
const PHOTOS_SRC = path.join(FS_DIR, "photos");
const DOC_SRC = path.join(FS_DIR, "doc");
const PORTRAIT_SRC = path.join(FS_DIR, "portrait.jpeg");
const PHOTOS_OUT = path.join(ROOT, "public", "photos");
const DOC_OUT = path.join(ROOT, "public", "doc");
const PORTRAIT_PREVIEW_OUT = path.join(ROOT, "public", "portrait.jpeg");
const PORTRAIT_DITHER_OUT = path.join(ROOT, "public", "portrait-1bit.png");
const MANIFEST_PATH = path.join(
	ROOT,
	"src",
	"terminal",
	"photo-manifest.generated.ts",
);
const CACHE_PATH = path.join(
	ROOT,
	"node_modules",
	".cache",
	"generate-photos.json",
);

const IMAGE_RE = /\.(jpe?g|png)$/i;

// Gallery grid thumbnail + the hover-reveal color image.
const PREVIEW_MAX = 900;
// Loaded only when a frame is opened in the fullscreen viewer.
const FULL_MAX = 2400;
// The dithered CRT overlay — kept small since it's upscaled with
// image-rendering:pixelated for a chunky, low-res look.
const DITHER_MAX = 256;

// Dither tone curve: contrast is pushed up around the midtones (true black
// and true white both stay reachable — only the middle gets compressed
// toward the extremes), then quantized to a fixed 7-step palette (black + 5
// mid grays + white) with an ORDERED dither, not error diffusion.
//
// The threshold tile is a 5x5 "plus growth" matrix: cell (2,2) — the tile
// center — has the lowest threshold, then its 4-connected neighbors, then
// the next ring out, and finally the diagonals/corners last. That ordering
// means a single isolated highlight against a dark field lights up as a
// small "+" (center + one ring of arms) rather than a lone dot or a random
// speckle, and only blooms toward a filled square as the local tone climbs
// toward white — matching the reference dithers' plus-shaped speckle.
const DITHER_LEVELS = 7;
const DITHER_CONTRAST = 1.55;
const DITHER_TILE = 3;

function buildPlusGrowthMatrix(): number[][] {
	const center = 2;
	const cells: [number, number][] = [];
	for (let r = 0; r < DITHER_TILE; r++) {
		for (let c = 0; c < DITHER_TILE; c++) cells.push([r, c]);
	}
	// Sort by "plus-ness": orthogonal (4-connected) distance first, ties
	// broken toward axis-aligned cells over diagonal ones, so the ring fills
	// as arms before corners.
	cells.sort((a, b) => {
		const da = Math.abs(a[0] - center) + Math.abs(a[1] - center);
		const db = Math.abs(b[0] - center) + Math.abs(b[1] - center);
		if (da !== db) return da - db;
		const diagA = Math.abs(a[0] - center) === Math.abs(a[1] - center) ? 1 : 0;
		const diagB = Math.abs(b[0] - center) === Math.abs(b[1] - center) ? 1 : 0;
		return diagA - diagB;
	});
	const matrix = Array.from({ length: DITHER_TILE }, () =>
		new Array(DITHER_TILE).fill(0),
	);
	const n = DITHER_TILE * DITHER_TILE;
	cells.forEach(([r, c], priority) => {
		// Centered in [-0.5, 0.5), scaled to one palette step later.
		matrix[r][c] = (priority + 0.5) / n - 0.5;
	});
	return matrix;
}

const PLUS_MATRIX = buildPlusGrowthMatrix();

function quantize(value: number): number {
	const step = 255 / (DITHER_LEVELS - 1);
	const level = Math.max(
		0,
		Math.min(DITHER_LEVELS - 1, Math.round(value / step)),
	);
	return level * step;
}

async function makeDither(image: Sharp, outPath: string): Promise<void> {
	const { data, info } = await image
		.clone()
		.resize({
			width: DITHER_MAX,
			height: DITHER_MAX,
			fit: "inside",
			withoutEnlargement: true,
		})
		.grayscale()
		.raw()
		.toBuffer({ resolveWithObject: true });

	const { width, height } = info;
	const step = 255 / (DITHER_LEVELS - 1);
	const out = Buffer.alloc(data.length);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const idx = y * width + x;
			let v = (data[idx] - 128) * DITHER_CONTRAST + 128;
			v = Math.max(0, Math.min(255, v));
			const offset = PLUS_MATRIX[y % DITHER_TILE][x % DITHER_TILE] * step;
			out[idx] = quantize(v + offset);
		}
	}

	await sharp(out, { raw: { width, height, channels: 1 } })
		.png()
		.toFile(outPath);
}

type Cache = Record<string, string>;

async function loadCache(): Promise<Cache> {
	try {
		return JSON.parse(await readFile(CACHE_PATH, "utf8"));
	} catch {
		return {};
	}
}

async function saveCache(cache: Cache): Promise<void> {
	await mkdir(path.dirname(CACHE_PATH), { recursive: true });
	await writeFile(CACHE_PATH, JSON.stringify(cache));
}

async function hashFile(filePath: string): Promise<string> {
	return createHash("sha1")
		.update(await readFile(filePath))
		.digest("hex");
}

interface Freshness {
	fresh: boolean;
	key?: string;
	hash?: string;
}

// Freshness is keyed on the *content* of the source file, not its mtime —
// a source can carry an old mtime (e.g. preserved from the original photo's
// export date) that predates a previously generated output, which would
// make a plain mtime comparison wrongly skip regenerating it forever.
async function isFresh(
	cache: Cache,
	srcPath: string,
	outPaths: string[],
): Promise<Freshness> {
	if (!outPaths.every(existsSync)) return { fresh: false };
	const key = path.relative(ROOT, srcPath);
	const hash = await hashFile(srcPath);
	return { fresh: cache[key] === hash, key, hash };
}

export interface PhotoExif {
	filename: string;
	takenAt: string | null;
	lens: string | null;
	focalLength: number | null;
	shutterSpeed: string | null;
	iso: number | null;
	// Most of these Leica shots carry only ApertureValue (an APEX log2 value
	// reported by the meter off a manual, non-electronically-coupled lens),
	// not a discrete FNumber tag — so the f-number is *computed*
	// (2 ^ (ApertureValue / 2)), hence "estimated" rather than exact.
	aperture: number | null;
	// Raw GPS fix, or null if the photo carries none (e.g. the Leica has no
	// built-in GPS). Not resolved to a place name here — kept as-is for
	// whatever does that resolution.
	gps: { lat: number; lon: number } | null;
}

async function readExif(srcPath: string, filename: string): Promise<PhotoExif> {
	let exif: Record<string, unknown> | null = null;
	try {
		exif = await exifr.parse(srcPath, { gps: true });
	} catch {
		exif = null;
	}

	const takenAt =
		exif?.DateTimeOriginal instanceof Date
			? exif.DateTimeOriginal.toISOString()
			: null;
	const lens =
		(typeof exif?.LensModel === "string" && exif.LensModel) ||
		(typeof exif?.Lens === "string" && exif.Lens) ||
		null;
	const focalLength =
		typeof exif?.FocalLength === "number" ? Math.round(exif.FocalLength) : null;

	let shutterSpeed: string | null = null;
	if (typeof exif?.ExposureTime === "number" && exif.ExposureTime > 0) {
		shutterSpeed =
			exif.ExposureTime < 1
				? `1/${Math.round(1 / exif.ExposureTime)}`
				: `${exif.ExposureTime}s`;
	}

	const iso = typeof exif?.ISO === "number" ? exif.ISO : null;

	let aperture: number | null = null;
	if (typeof exif?.FNumber === "number") {
		aperture = Math.round(exif.FNumber * 10) / 10;
	} else if (typeof exif?.ApertureValue === "number") {
		aperture = Math.round(2 ** (exif.ApertureValue / 2) * 10) / 10;
	}

	const gps =
		typeof exif?.latitude === "number" && typeof exif?.longitude === "number"
			? { lat: exif.latitude, lon: exif.longitude }
			: null;

	return {
		filename,
		takenAt,
		lens,
		focalLength,
		shutterSpeed,
		iso,
		aperture,
		gps,
	};
}

async function generatePhoto(
	cache: Cache,
	collection: string,
	file: string,
): Promise<{ collection: string; slug: string; generated: boolean }> {
	const slug = path.parse(file).name;
	const srcPath = path.join(PHOTOS_SRC, collection, file);
	const outDir = path.join(PHOTOS_OUT, collection);
	await mkdir(outDir, { recursive: true });

	const previewPath = path.join(outDir, `${slug}.jpeg`);
	const fullPath = path.join(outDir, `${slug}-full.jpeg`);
	const ditherPath = path.join(outDir, `${slug}-1bit.png`);

	const fresh = await isFresh(cache, srcPath, [
		previewPath,
		fullPath,
		ditherPath,
	]);
	if (fresh.fresh) return { collection, slug, generated: false };

	const image = sharp(srcPath).rotate(); // bake in EXIF orientation

	await image
		.clone()
		.resize({
			width: PREVIEW_MAX,
			height: PREVIEW_MAX,
			fit: "inside",
			withoutEnlargement: true,
		})
		.jpeg({ quality: 82, mozjpeg: true })
		.toFile(previewPath);

	await image
		.clone()
		.resize({
			width: FULL_MAX,
			height: FULL_MAX,
			fit: "inside",
			withoutEnlargement: true,
		})
		.jpeg({ quality: 88, mozjpeg: true })
		.toFile(fullPath);

	await makeDither(image, ditherPath);
	if (fresh.key) cache[fresh.key] = fresh.hash as string;

	return { collection, slug, generated: true };
}

async function generatePortrait(
	cache: Cache,
): Promise<{ found: boolean; generated: boolean }> {
	if (!existsSync(PORTRAIT_SRC)) return { found: false, generated: false };

	const fresh = await isFresh(cache, PORTRAIT_SRC, [
		PORTRAIT_PREVIEW_OUT,
		PORTRAIT_DITHER_OUT,
	]);
	if (fresh.fresh) return { found: true, generated: false };

	const image = sharp(PORTRAIT_SRC).rotate();

	await image
		.clone()
		.resize({
			width: PREVIEW_MAX,
			height: PREVIEW_MAX,
			fit: "inside",
			withoutEnlargement: true,
		})
		.jpeg({ quality: 82, mozjpeg: true })
		.toFile(PORTRAIT_PREVIEW_OUT);

	await makeDither(image, PORTRAIT_DITHER_OUT);
	if (fresh.key) cache[fresh.key] = fresh.hash as string;

	return { found: true, generated: true };
}

async function copyDoc(cache: Cache): Promise<void> {
	if (!existsSync(DOC_SRC)) return;
	await mkdir(DOC_OUT, { recursive: true });
	const files = await readdir(DOC_SRC);
	for (const file of files) {
		const srcPath = path.join(DOC_SRC, file);
		if ((await stat(srcPath)).isDirectory()) continue;
		const outPath = path.join(DOC_OUT, file);
		const fresh = await isFresh(cache, srcPath, [outPath]);
		if (fresh.fresh) continue;
		await copyFile(srcPath, outPath);
		if (fresh.key) cache[fresh.key] = fresh.hash as string;
		console.log(`  doc/${file}`);
	}
}

interface CollectionMeta {
	label: string;
	places: string;
	date: string;
	frameCount: number;
}

// Optional fs/photos/<collection>/collection.json carries the fictional
// flavor text for that trip (display label, where it was shot, when, and a
// fictional total frame count for the "[ scroll for N more ]" narrative).
// Everything in it is optional — a collection with no file at all still
// works, just with generic defaults.
async function readCollectionMeta(
	collection: string,
	realCount: number,
): Promise<CollectionMeta> {
	const metaPath = path.join(PHOTOS_SRC, collection, "collection.json");
	const defaults: CollectionMeta = {
		label: collection,
		places: "",
		date: "",
		frameCount: realCount,
	};
	if (!existsSync(metaPath)) return defaults;
	try {
		const parsed = JSON.parse(await readFile(metaPath, "utf8"));
		return { ...defaults, ...parsed };
	} catch (err) {
		console.warn(
			`  warning: couldn't parse ${path.relative(ROOT, metaPath)}: ${(err as Error).message}`,
		);
		return defaults;
	}
}

interface PhotoManifestEntry extends PhotoExif {
	slug: string;
}

async function writeManifest(
	manifest: Record<string, CollectionMeta & { photos: PhotoManifestEntry[] }>,
): Promise<void> {
	const body = JSON.stringify(manifest, null, 2);
	const contents = `// AUTO-GENERATED by vite-plugins/generate-photos.ts from fs/photos/ — do not edit by hand.
export interface PhotoManifestEntry {
  slug: string
  filename: string
  takenAt: string | null
  lens: string | null
  focalLength: number | null
  shutterSpeed: string | null
  iso: number | null
  aperture: number | null
  gps: { lat: number; lon: number } | null
}
export interface PhotoCollectionManifest {
  label: string
  places: string
  date: string
  frameCount: number
  photos: PhotoManifestEntry[]
}
export const PHOTO_MANIFEST: Record<string, PhotoCollectionManifest> = ${body}
`;
	const existing = existsSync(MANIFEST_PATH)
		? await readFile(MANIFEST_PATH, "utf8")
		: null;
	if (existing === contents) return;
	await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
	await writeFile(MANIFEST_PATH, contents);
}

async function runGenerate(): Promise<void> {
	const cache = await loadCache();

	if (existsSync(PHOTOS_SRC)) {
		const collections = (await readdir(PHOTOS_SRC, { withFileTypes: true }))
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			.sort();

		const manifest: Record<
			string,
			CollectionMeta & { photos: PhotoManifestEntry[] }
		> = {};
		let generatedCount = 0;
		let totalCount = 0;

		for (const collection of collections) {
			const files = (await readdir(path.join(PHOTOS_SRC, collection)))
				.filter((f) => IMAGE_RE.test(f))
				.sort();

			const photos: PhotoManifestEntry[] = [];
			for (const file of files) {
				totalCount += 1;
				const slug = path.parse(file).name;
				const srcPath = path.join(PHOTOS_SRC, collection, file);
				const exif = await readExif(srcPath, file);
				photos.push({ slug, ...exif });

				const result = await generatePhoto(cache, collection, file);
				if (result.generated) {
					generatedCount += 1;
					console.log(`  ${collection}/${result.slug}`);
				}
			}

			const meta = await readCollectionMeta(collection, photos.length);
			manifest[collection] = { ...meta, photos };
		}

		await writeManifest(manifest);

		console.log(
			`fs/photos/: ${collections.length} collection(s), ${totalCount} photo(s), ${generatedCount} generated (rest up to date).`,
		);
	} else {
		console.log(
			`fs/photos/ not found (looked at ${PHOTOS_SRC}) — skipping photo generation.`,
		);
	}

	await copyDoc(cache);

	const portrait = await generatePortrait(cache);
	if (portrait.generated) console.log("  portrait");
	else if (!portrait.found)
		console.log(
			`fs/portrait.jpeg not found (looked at ${PORTRAIT_SRC}) — skipping.`,
		);

	await saveCache(cache);
}

export function generatePhotosPlugin(): Plugin {
	let regenerating: Promise<void> | null = null;
	let pendingTimer: ReturnType<typeof setTimeout> | null = null;

	// Coalesces bursts of fs events (a directory of photos dropped in at
	// once) into a single regenerate pass, and never overlaps two passes.
	function scheduleRegenerate(server?: ViteDevServer) {
		if (pendingTimer) clearTimeout(pendingTimer);
		pendingTimer = setTimeout(() => {
			pendingTimer = null;
			regenerating = (regenerating ?? Promise.resolve())
				.then(() => runGenerate())
				.then(() => {
					server?.ws.send({ type: "full-reload" });
				})
				.catch((err) => {
					console.error("[generate-photos]", err);
				});
		}, 150);
	}

	return {
		name: "generate-photos",
		// Runs for both `vite dev` and `vite build` — no separate pre-script.
		async buildStart() {
			await runGenerate();
		},
		configureServer(server) {
			server.watcher.add(FS_DIR);
			const onFsChange = (file: string) => {
				if (path.resolve(file).startsWith(FS_DIR)) scheduleRegenerate(server);
			};
			server.watcher.on("add", onFsChange);
			server.watcher.on("change", onFsChange);
			server.watcher.on("unlink", onFsChange);
		},
	};
}
