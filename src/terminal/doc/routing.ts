export function parseDocPath(pathname: string): boolean {
	return pathname === "/doc/resume";
}

export function docUrlFor(open: boolean): string | null {
	return open ? "/doc/resume" : null;
}
