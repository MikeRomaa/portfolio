export const BOOT_PRE: string[] = [
	"IBM 5151 monochrome display  ·  P4 white phosphor",
	"Memory test: 640K OK",
	"Loading /boot/portfolio.img ...................... done",
	"Mounting ~/film (36 frames) ..................... done",
	"",
];

// Rendered together as one block (see Terminal.tsx) so the portrait can sit
// beside it, rather than as ordinary typed lines.
export const BOOT_BANNER: string[] = [
	"▗▄ ▄▖  █       ▗▖             ▗▄▖       ",
	"▐█ █▌  ▀       ▐▌             ▝▜▌       ",
	"▐███▌ ██   ▟██▖▐▙██▖ ▟██▖ ▟█▙  ▐▌       ",
	"▐▌█▐▌  █  ▐▛  ▘▐▛ ▐▌ ▘▄▟▌▐▙▄▟▌ ▐▌       ",
	"▐▌▀▐▌  █  ▐▌   ▐▌ ▐▌▗█▀▜▌▐▛▀▀▘ ▐▌       ",
	"▐▌ ▐▌▗▄█▄▖▝█▄▄▌▐▌ ▐▌▐▙▄█▌▝█▄▄▌ ▐▙▄      ",
	"▝▘ ▝▘▝▀▀▀▘ ▝▀▀ ▝▘ ▝▘ ▀▀▝▘ ▝▀▀   ▀▀      ",
	"",
	"▗▄▄▖                     ▗▖             ",
	"▐▛▀▜▌                    ▐▌             ",
	"▐▌ ▐▌ ▟█▙ ▐█▙█▖ ▟██▖▗▟██▖▐▙██▖ ▟█▙ ▐▙ ▟▌",
	"▐███ ▐▛ ▜▌▐▌█▐▌ ▘▄▟▌▐▙▄▖▘▐▛ ▐▌▐▛ ▜▌ █ █ ",
	"▐▌▝█▖▐▌ ▐▌▐▌█▐▌▗█▀▜▌ ▀▀█▖▐▌ ▐▌▐▌ ▐▌ ▜▄▛ ",
	"▐▌ ▐▌▝█▄█▘▐▌█▐▌▐▙▄█▌▐▄▄▟▌▐▌ ▐▌▝█▄█▘ ▐█▌ ",
	"▝▘ ▝▀ ▝▀▘ ▝▘▀▝▘ ▀▀▝▘ ▀▀▀ ▝▘ ▝▘ ▝▀▘   ▀  ",
];

export const BOOT_POST: string[] = [
	"",
	"Welcome. This is a resume that you can type into.",
	"",
];

export const BOOT: string[] = [...BOOT_PRE, ...BOOT_BANNER, ...BOOT_POST];
