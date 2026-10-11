// Runtime fingerprint for EAS Update (runtimeVersion policy "fingerprint").
// The app config versions (`version`, `android.versionCode`) stay out of the
// hash, so a version bump that only changes JS still reaches installed builds
// as an OTA update; any native change still produces a new runtime. The second
// skip is @expo/fingerprint's default, kept because this list replaces it.
const { SourceSkips } = require("expo/fingerprint");

/** @type {import("expo/fingerprint").Config} */
module.exports = {
	sourceSkips:
		SourceSkips.ExpoConfigVersions |
		SourceSkips.PackageJsonAndroidAndIosScriptsIfNotContainRun,
};
