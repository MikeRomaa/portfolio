import { Fragment, type MouseEvent } from "react";
import "./Terminal.css";
import { BOOT_BANNER, BOOT_PRE } from "./commands";
import { DocViewer } from "./doc/DocViewer";
import { FrameViewer, GalleryBlock, TripsBlock } from "./photos/PhotosViews";
import type { Line } from "./types";
import { useIsMobile } from "./useIsMobile";
import { useTerminal } from "./useTerminal";

const TOP_COMMANDS = ["about", "projects", "photos", "resume", "help"];

function LineRow({
	line,
	onLinkClick,
}: {
	line: Line;
	onLinkClick: (cmd: string) => void;
}) {
	const style = { color: line.color, paddingLeft: line.pad };
	if (line.link) {
		return (
			<button
				type="button"
				className="term-line"
				style={style}
				data-link
				onClick={() => onLinkClick(line.link as string)}
			>
				{line.t || " "}
			</button>
		);
	}
	return (
		<div className="term-line" style={style}>
			{line.t || " "}
		</div>
	);
}

// Dithered by default, revealing the color photo on hover — the same
// mechanic as a gallery cell (see photos/PhotosViews.tsx), reusing its CSS.
// `revealed` (0-1) uncovers it top to bottom in step with the banner text
// typing out beside it, rather than popping in all at once.
function Portrait({ revealed }: { revealed: number }) {
	return (
		<div
			className="term-cell term-portrait"
			style={{ clipPath: `inset(0 0 ${(1 - revealed) * 100}% 0)` }}
		>
			<img src="/portrait.jpeg" alt="" className="term-cell-photo" />
			<img src="/portrait-1bit.png" alt="" className="term-cell-dither" />
		</div>
	);
}

export function Terminal() {
	const t = useTerminal();
	const isMobile = useIsMobile();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		t.run(t.cmd);
	};

	const activePill = t.photos.activeView
		? "photos"
		: (t.hist.at(-1)?.cmd.trim().toLowerCase() ?? "");

	// The name banner renders as one block (with the portrait beside it)
	// instead of as ordinary typed lines — everything before/after it still
	// types out line by line as usual.
	const bootPreLines = t.bootLines.slice(0, BOOT_PRE.length);
	const bootBannerLines = t.bootLines.slice(
		BOOT_PRE.length,
		BOOT_PRE.length + BOOT_BANNER.length,
	);
	const bootPostLines = t.bootLines.slice(BOOT_PRE.length + BOOT_BANNER.length);
	const bootBannerRevealed = bootBannerLines.length / BOOT_BANNER.length;

	// Clicking anywhere in the terminal — including its own interactive bits
	// (links, cells, pills), which now render as real <button>s and so would
	// otherwise hang onto focus after being clicked — returns focus to the
	// prompt, so typing works without hunting for the input first. Only the
	// prompt input itself is excluded, so clicking inside it to position the
	// cursor doesn't fight with that.
	const focusPrompt = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (target.closest("input")) return;
		t.inputRef.current?.focus();
	};

	return (
		<div className="term-page">
			{/* biome-ignore lint/a11y/noStaticElementInteractions: click-anywhere-in-the-terminal-to-focus-the-prompt, not a discrete control */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: same — it wraps the real interactive descendants (the form/input, links, cells), which is where keyboard support actually lives */}
			<div className="term-screen" onClick={focusPrompt}>
				<div className="term-scanlines" aria-hidden />
				{!isMobile && <div className="term-rollband" aria-hidden />}
				<div className="term-vignette" aria-hidden />

				<div className="term-body">
					<div className="term-scroll" ref={t.scrollRef}>
						{bootPreLines.map((line, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: bootLines only ever grows as a prefix (BOOT.slice(0, i)), never reorders or drops from the front, so index is a stable identity here
							<div className="term-line term-dim" key={`pre-${i}`}>
								{line || " "}
							</div>
						))}
						{bootBannerLines.length > 0 && (
							<div className="term-boot-banner">
								<Portrait revealed={bootBannerRevealed} />
								<pre className="term-boot-banner-art">
									{bootBannerLines.join("\n")}
								</pre>
							</div>
						)}
						{bootPostLines.map((line, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: same as bootPreLines above
							<div className="term-line term-dim" key={`post-${i}`}>
								{line || " "}
							</div>
						))}

						{t.booted &&
							t.hist.map((entry) => {
								// Gallery blocks fold the "guest@...:~$ <cmd>" echo into their
								// own sticky header instead of printing it again above.
								if (entry.kind === "photos" && entry.view !== "trips") {
									return (
										<GalleryBlock
											key={entry.id}
											trip={entry.view}
											cmd={entry.cmd}
											photos={t.photos}
											isMobile={isMobile}
										/>
									);
								}
								return (
									<Fragment key={entry.id}>
										<div className="term-line term-hi">
											guest@romashov.dev:~$ {entry.cmd}
										</div>
										{entry.kind === "cmd" &&
											entry.out.map((line, j) => (
												// biome-ignore lint/suspicious/noArrayIndexKey: entry.out is a fixed array baked in when the entry was created — it never reorders or mutates afterward
												<LineRow line={line} onLinkClick={t.run} key={j} />
											))}
										{entry.kind === "photos" && entry.view === "trips" && (
											<TripsBlock photos={t.photos} isMobile={isMobile} />
										)}
									</Fragment>
								);
							})}

						<div ref={t.bottomRef} />
					</div>
				</div>

				{isMobile ? (
					<div className="term-cmdbar-wrap">
						<div className="term-line term-hi term-prompt-static">
							guest@romashov.dev:~$ <span className="term-caret" />
						</div>
						<div className="term-cmdbar">
							{TOP_COMMANDS.map((cmd) => (
								<button
									type="button"
									key={cmd}
									className={`term-pill${activePill === cmd ? " term-pill--active" : ""}`}
									onClick={() => {
										if (!t.booted) t.skipBoot();
										t.run(cmd);
									}}
								>
									{cmd}
								</button>
							))}
						</div>
					</div>
				) : (
					<form className="term-prompt-row" onSubmit={handleSubmit}>
						<span className="term-hi term-prompt-label">
							guest@romashov.dev:~$
						</span>
						<input
							ref={t.inputRef}
							className="term-input"
							value={t.cmd}
							spellCheck={false}
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="off"
							onChange={(e) => t.setCmd(e.target.value)}
							style={{ width: `${t.cmd.length}ch` }}
						/>
						<span className="term-caret" />
					</form>
				)}

				{!isMobile && t.booted && (
					<div className="term-hint">
						try:{" "}
						{TOP_COMMANDS.map((cmd, i) => (
							<Fragment key={cmd}>
								{i > 0 && " · "}
								<button
									type="button"
									className="term-link"
									onClick={() => t.run(cmd)}
								>
									{cmd}
								</button>
							</Fragment>
						))}
						&nbsp;&nbsp;(there are things in here that aren't on this list)
					</div>
				)}

				<FrameViewer photos={t.photos} />
				<DocViewer doc={t.doc} />
			</div>
		</div>
	);
}
