import type { Line } from "../types";
import { sec } from "./shared";

export function help(): Line[] {
	return sec("available:", [
		{ t: "about        who I am", link: "about" },
		{ t: "projects     things I built and kept", link: "projects" },
		{ t: "photos       film scans, 1-bit previews", link: "photos" },
		{ t: "resume       pdf, one page, no jargon", link: "resume" },
		"",
		"undocumented commands exist. `ls -a` is a start.",
	]);
}
