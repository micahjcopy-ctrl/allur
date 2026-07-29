import type { CapacitorConfig } from "@capacitor/cli";

// ---------------------------------------------------------------------------
// Capacitor native shell config.
//
// ⚠️ appId IS PERMANENT. Once a build with this bundle identifier is submitted
// to App Store Connect it can never be changed — a different appId is a
// different app, with a different listing, and no way to migrate existing
// installs or reviews. Confirm this string with Micah before the first upload.
//
// Platform folders (ios/, android/) are NOT committed. They are generated on
// the Mac with `npx cap add ios` / `npx cap add android`, which requires Xcode
// and the Android SDK. See NATIVE_SETUP.md. Regenerating them is cheap and
// keeps large binary toolchain output out of the repo.
// ---------------------------------------------------------------------------

const config: CapacitorConfig = {
  appId: "com.getallur.app",
  appName: "ALLUR",

  // Vite builds the app to artifacts/fitcoach/dist/public (see vite.config.ts).
  webDir: "dist/public",

  // Ship the compiled bundle inside the binary rather than pointing the webview
  // at the live site. A wrapper that just loads a remote URL is the single most
  // common Guideline 4.2 rejection ("repackaged website"), and it also means a
  // network blip becomes a blank screen instead of a handled offline state.
  server: {
    androidScheme: "https",
  },

  ios: {
    // Lets our own CSS own the safe areas via env(safe-area-inset-*) rather
    // than the webview inseting the whole viewport for us.
    contentInset: "never",
    backgroundColor: "#0b1120",
  },

  android: {
    backgroundColor: "#0b1120",
  },

  plugins: {
    SplashScreen: {
      // Held until the React app calls hide() once it has actually rendered,
      // so users never see a white flash between the splash and first paint.
      launchAutoHide: false,
      backgroundColor: "#0b1120",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
