const {
	tailwindV3Preset,
} = require("@habits/design-tokens/tailwind-v3-preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{ts,tsx}"],
	presets: [require("nativewind/preset"), tailwindV3Preset],
	plugins: [],
};
