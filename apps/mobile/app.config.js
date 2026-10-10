// Extends app.json. Push on Android needs Firebase's google-services.json
// (public identifiers, safe to commit; see CLAUDE.md "Push notifications").
// It is only referenced when present, so builds and `expo start` keep working
// before Firebase is set up (push tokens fail until it is).
const { existsSync } = require("node:fs");
const { join } = require("node:path");

const GOOGLE_SERVICES = "./google-services.json";

module.exports = ({ config }) => {
	if (!existsSync(join(__dirname, GOOGLE_SERVICES))) return config;
	return {
		...config,
		android: { ...config.android, googleServicesFile: GOOGLE_SERVICES },
	};
};
