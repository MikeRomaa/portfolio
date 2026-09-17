import { FRAME_MAP, TRIPS } from "../frames";
import type { PhotosController } from "./usePhotos";

function GalleryCell({
	frameKey,
	wide,
	onOpen,
	onHover,
	onHoverOut,
}: {
	frameKey: string;
	wide?: boolean;
	onOpen: (key: string) => void;
	onHover: (key: string) => void;
	onHoverOut: () => void;
}) {
	const frame = FRAME_MAP[frameKey];
	return (
		<button
			type="button"
			className={`term-cell${wide ? " term-cell--wide" : ""}`}
			onClick={() => onOpen(frameKey)}
			onMouseEnter={() => onHover(frameKey)}
			onMouseLeave={onHoverOut}
		>
			<img
				src={`/photos/${frame.key}.jpeg`}
				alt=""
				className="term-cell-photo"
				loading="lazy"
			/>
			<img
				src={`/photos/${frame.key}-1bit.png`}
				alt=""
				className="term-cell-dither"
			/>
		</button>
	);
}

function TripRow({
	dir,
	photos,
	isMobile,
}: {
	dir: string;
	photos: PhotosController;
	isMobile: boolean;
}) {
	const trip = TRIPS[dir];
	return (
		<button
			type="button"
			className="term-trip-row term-trip-row--link"
			onClick={() => photos.goTrip(dir)}
		>
			{!isMobile && <span className="term-dim">drwxr-xr-x</span>}
			{!isMobile && <span className="term-dim">{trip.frameCount}</span>}
			{!isMobile && <span className="term-dim">{trip.date}</span>}
			<span className="term-trip-name">
				{trip.label} <span className="term-dim">— {trip.places}</span>
			</span>
			{isMobile && (
				<span className="term-trip-sub">
					{trip.frameCount} frames · {trip.places} · {trip.date}
				</span>
			)}
		</button>
	);
}

export function TripsBlock({
	photos,
	isMobile,
}: {
	photos: PhotosController;
	isMobile: boolean;
}) {
	const dirs = Object.keys(TRIPS);
	const totalFrames = dirs.reduce((sum, dir) => sum + TRIPS[dir].frameCount, 0);
	return (
		<div className="term-trips">
			{isMobile && (
				<div className="term-trips-count">
					{dirs.length} trip{dirs.length === 1 ? "" : "s"} · {totalFrames}{" "}
					frames
				</div>
			)}
			{!isMobile && (
				<div className="term-trip-header">
					<span>mode</span>
					<span>frames</span>
					<span>shot</span>
					<span>name</span>
				</div>
			)}
			{dirs.map((dir) => (
				<TripRow key={dir} dir={dir} photos={photos} isMobile={isMobile} />
			))}
			<div className="term-trips-footer">
				click a trip to open its gallery &nbsp;·&nbsp;
				<button type="button" className="term-link" onClick={photos.exitPhotos}>
					cd ~
				</button>{" "}
				[q]
			</div>
		</div>
	);
}

export function GalleryBlock({
	trip,
	cmd,
	photos,
	isMobile,
}: {
	trip: string;
	cmd: string;
	photos: PhotosController;
	isMobile: boolean;
}) {
	const tripInfo = TRIPS[trip];
	return (
		<div className="term-gallery-wrap">
			<div className="term-gallery-header">
				<div className="term-line term-hi">guest@romashov.dev:~$ {cmd}</div>
				<div className="term-dim">
					{tripInfo.frameCount} frames · {tripInfo.places} · {tripInfo.date}{" "}
					&nbsp;·&nbsp;
					<button
						type="button"
						className="term-link"
						onClick={photos.backToTrips}
					>
						cd ..
					</button>{" "}
					[q] back to photos
				</div>
			</div>
			<div className="term-gallery">
				{tripInfo.frameKeys.map((key, i) => (
					<GalleryCell
						key={key}
						frameKey={key}
						wide={i % 3 === 0}
						onOpen={(k) => photos.openFrame(k, trip)}
						onHover={photos.setHover}
						onHoverOut={() => photos.setHover(null)}
					/>
				))}
			</div>
			<div className="term-dim">
				[ scroll for {tripInfo.frameCount - tripInfo.frameKeys.length} more ]
			</div>
			{!isMobile && (
				<div className="term-hover-meta">
					<span className="term-med">
						{photos.hover ? FRAME_MAP[photos.hover].name : "—"}
					</span>
					<span>
						{photos.hover
							? FRAME_MAP[photos.hover].meta
							: "hover a frame for details"}
					</span>
				</div>
			)}
		</div>
	);
}

export function FrameViewer({ photos }: { photos: PhotosController }) {
	const viewerFrame = photos.w7 ? FRAME_MAP[photos.w7.key] : null;
	const viewerTrip = photos.w7 ? TRIPS[photos.w7.trip] : null;
	const viewerIdx =
		photos.w7 && viewerTrip
			? viewerTrip.frameKeys.indexOf(photos.w7.key) + 1
			: null;

	if (!viewerFrame || !viewerTrip) return null;

	return (
		<div className="term-viewer">
			<div className="term-viewer-bar">
				<span className="term-viewer-name">{viewerFrame.name}</span>
				<span className="term-viewer-place">{viewerFrame.place}</span>
				<button
					type="button"
					className="term-viewer-close"
					onClick={photos.closeViewer}
				>
					[q] close
				</button>
			</div>
			<div className="term-viewer-image">
				<img
					src={`/photos/${viewerFrame.key}-full.jpeg`}
					alt={viewerFrame.name}
				/>
			</div>
			<div className="term-viewer-footer">
				<span className="term-hi">{viewerFrame.meta}</span>
				<span className="term-viewer-idx">
					{viewerIdx} / {viewerTrip.frameCount}
				</span>
			</div>
			<div className="term-viewer-nav">
				<button type="button" onClick={() => photos.stepFrame(-1)}>
					[k] prev
				</button>
				<button type="button" onClick={() => photos.stepFrame(1)}>
					[j] next
				</button>
			</div>
		</div>
	);
}
