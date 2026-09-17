import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { generatePhotosPlugin } from "./vite-plugins/generate-photos.ts";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		generatePhotosPlugin(),
		react(),
		babel({ presets: [reactCompilerPreset()] }),
	],
});
