import type { Line } from "../types";

export const C = {
	dim: "#6f6d66",
	norm: "#e9e7e0",
	hi: "#ffffff",
};

export type Row = string | { t: string; link?: string; color?: string };

export function sec(title: string, rows: Row[]): Line[] {
	const lines: Line[] = [{ t: title, color: C.hi }];
	for (const r of rows) {
		if (typeof r === "string") {
			lines.push({ t: r, color: C.dim, pad: "2ch" });
		} else {
			lines.push({
				t: r.t,
				color: r.link ? C.hi : (r.color ?? C.dim),
				pad: "2ch",
				link: r.link,
			});
		}
	}
	return lines;
}
