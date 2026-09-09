import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// PORT only matters for the local dev/preview server; default it so a plain
// `vite build` (e.g. on Vercel) works without any Replit env injection.
const port = Number(process.env.PORT ?? 5173) || 5173;

// The app is served at the domain root on Vercel; BASE_PATH stays overridable
// for Replit's path-router setup.
const basePath = process.env.BASE_PATH ?? "/";

// ---------------------------------------------------------------------------
// Native build guard.
//
// Vite inlines import.meta.env.* at build time. `iapAvailable()` in src/lib/iap.ts
// is therefore a compile-time constant: with VITE_REVENUECAT_IOS_KEY unset it
// folds to `false` and the ENTIRE in-app-purchase path is dead-code-eliminated.
//
// On web that is the desired behaviour — no purchase code ships to browsers.
// On a native build it is a silent, invisible failure that produces a binary
// with no way to buy anything, which Apple rejects under Guideline 3.1.1.
//
// So: building for native without the key is a hard error, not a warning.
// Set VITE_NATIVE_BUILD=1 for any build that will be wrapped by Capacitor.
// ---------------------------------------------------------------------------
if (process.env.VITE_NATIVE_BUILD === "1" && !process.env.VITE_REVENUECAT_IOS_KEY) {
  throw new Error(
    "\n\n" +
      "  Native build aborted: VITE_REVENUECAT_IOS_KEY is not set.\n\n" +
      "  Without it the in-app purchase code is compiled out of the bundle and\n" +
      "  the app ships with no way to subscribe — an automatic App Store\n" +
      "  rejection under Guideline 3.1.1 that is invisible in the source.\n\n" +
      "  Set the key (RevenueCat dashboard -> API keys -> Apple App Store) and\n" +
      "  rebuild:\n\n" +
      "    VITE_NATIVE_BUILD=1 VITE_REVENUECAT_IOS_KEY=appl_xxx pnpm build\n\n",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
