import { useEffect, useState } from "react";

export function useIsMobile(breakpoint = 700): boolean {
	const query = `(max-width: ${breakpoint}px)`;
	const [isMobile, setIsMobile] = useState(
		() => window.matchMedia(query).matches,
	);

	useEffect(() => {
		const mql = window.matchMedia(query);
		const handler = () => setIsMobile(mql.matches);
		mql.addEventListener("change", handler);
		return () => mql.removeEventListener("change", handler);
	}, [query]);

	return isMobile;
}
