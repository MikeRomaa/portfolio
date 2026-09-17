import type { DocController } from "./useDoc";

export function DocViewer({ doc }: { doc: DocController }) {
	if (!doc.docOpen) return null;

	return (
		<div className="term-viewer term-doc-viewer">
			<div className="term-viewer-bar">
				<span className="term-viewer-name">resume.pdf</span>
				<a
					className="term-doc-newtab"
					href="/doc/resume.pdf"
					target="_blank"
					rel="noopener noreferrer"
				>
					open in new tab ↗
				</a>
				<button
					type="button"
					className="term-viewer-close"
					onClick={doc.closeDoc}
				>
					[q] close
				</button>
			</div>
			<iframe
				className="term-doc-frame"
				src="/doc/resume.pdf#toolbar=0&navpanes=0"
				title="resume.pdf"
			/>
		</div>
	);
}
