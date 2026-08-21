module.exports = {
  dependencies: {
    // Unused in app code (no analytics calls anywhere in src/) and, unlike
    // crashlytics/perf, has no auto-init Gradle plugin applied in
    // android/app/build.gradle. Its Android codegen output path
    // (node_modules/@react-native-firebase/analytics/android/.../generated/jni/...)
    // exceeds Windows' 260-char MAX_PATH under this repo's checkout path,
    // failing :app:buildCMakeDebug. Disabling autolinking for it removes
    // that codegen output from the build entirely; re-enable by deleting
    // this entry if analytics is ever wired up.
    '@react-native-firebase/analytics': {
      platforms: {
        android: null,
      },
    },
  },
};
