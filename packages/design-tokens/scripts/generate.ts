// Writes the Tailwind v4 theme CSS consumed by the web app.
import { writeFileSync } from "node:fs";
import { renderThemeCss } from "../src/theme-css.ts";

const target = new URL("../src/generated/theme.css", import.meta.url);
writeFileSync(target, renderThemeCss());
console.log(`Wrote ${target.pathname}`);
