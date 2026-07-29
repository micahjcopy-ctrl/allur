// ---------------------------------------------------------------------------
// native.ts — the single bridge between ALLUR's web code and the Capacitor
// native shell.
//
// Why this file exists (read before changing it):
//
//   `navigator.geolocation` DOES NOT WORK inside an iOS WKWebView. Apple never
//   implemented it. In the browser and in an installed PWA our cardio tracking
//   works fine; the moment the same code runs inside the native iOS wrapper it
//   silently returns nothing and GPS tracking is dead. The only way to get a
//   location on native iOS is through a native plugin.
//
//   The same is true, less severely, for the camera: a `<input type="file"
//   capture>` does open the iOS camera, but it produces no native permission
//   prompt tied to an Info.plist purpose string, which is what App Review
//   expects to see (Guideline 5.1.1), and it is one of the signals reviewers
//   use to classify an app as "a repackaged website" (Guideline 4.2).
//
// The contract:
//   - On web (browser or installed PWA) every function here either defers to
//     the existing browser API or returns null so the caller keeps its current
//     web path. Nothing about the PWA changes.
//   - On native, we use the Capacitor plugin.
//   - Plugins are dynamically imported so the web bundle never pays for them.
//   - Nothing here throws. A failure degrades to the web path or a clean error.
// ---------------------------------------------------------------------------

import { Capacitor } from "@capacitor/core";

export type Platform = "ios" | "android" | "web";

/** True only inside the Capacitor native shell (iOS/Android app), not a PWA. */
export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function platform(): Platform {
  try {
    const p = Capacitor.getPlatform();
    return p === "ios" || p === "android" ? p : "web";
  } catch {
    return "web";
  }
}

// --------------------------------------------------------------------------
// Location
// --------------------------------------------------------------------------

export interface GeoPoint {
  t: number;
  lat: number;
  lon: number;
  alt?: number;
  acc?: number;
}

/** Why a location watch failed. Callers map these to user-facing copy. */
export type GeoErrorKind = "denied" | "unavailable" | "lost";

export interface GeoWatch {
  clear: () => void;
}

const GEO_OPTS = { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 };

/**
 * Start a continuous location watch. Returns null if a watch could not be
 * started at all (no GPS, or permission denied) — in that case `onError` has
 * already fired and the caller should fall back to manual entry.
 */
export async function startLocationWatch(
  onPoint: (p: GeoPoint) => void,
  onError: (kind: GeoErrorKind) => void,
): Promise<GeoWatch | null> {
  if (isNative()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.requestPermissions({ permissions: ["location"] });
      if (perm.location === "denied") {
        onError("denied");
        return null;
      }
      const id = await Geolocation.watchPosition(GEO_OPTS, (pos, err) => {
        if (err || !pos) {
          onError("lost");
          return;
        }
        const c = pos.coords;
        onPoint({
          t: pos.timestamp || Date.now(),
          lat: c.latitude,
          lon: c.longitude,
          alt: c.altitude ?? undefined,
          acc: c.accuracy ?? undefined,
        });
      });
      return {
        clear: () => {
          void Geolocation.clearWatch({ id }).catch(() => {});
        },
      };
    } catch {
      onError("unavailable");
      return null;
    }
  }

  // --- web / PWA path: unchanged behaviour ---
  if (!("geolocation" in navigator)) {
    onError("unavailable");
    return null;
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const c = pos.coords;
      onPoint({
        t: pos.timestamp || Date.now(),
        lat: c.latitude,
        lon: c.longitude,
        alt: c.altitude ?? undefined,
        acc: c.accuracy ?? undefined,
      });
    },
    (err) => onError(err.code === err.PERMISSION_DENIED ? "denied" : "lost"),
    GEO_OPTS,
  );
  return {
    clear: () => navigator.geolocation.clearWatch(id),
  };
}

/** One-shot position. Resolves null on any failure (caller decides the copy). */
export async function getLocationOnce(): Promise<GeoPoint | null> {
  if (isNative()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.requestPermissions({ permissions: ["location"] });
      if (perm.location === "denied") return null;
      const pos = await Geolocation.getCurrentPosition(GEO_OPTS);
      return {
        t: pos.timestamp || Date.now(),
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        alt: pos.coords.altitude ?? undefined,
        acc: pos.coords.accuracy ?? undefined,
      };
    } catch {
      return null;
    }
  }
  if (!("geolocation" in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          t: pos.timestamp || Date.now(),
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          alt: pos.coords.altitude ?? undefined,
          acc: pos.coords.accuracy ?? undefined,
        }),
      () => resolve(null),
      GEO_OPTS,
    );
  });
}

// --------------------------------------------------------------------------
// Camera
// --------------------------------------------------------------------------

/**
 * Capture a photo through the native camera/library picker.
 *
 * Returns a data URL, or null on web (where the caller should keep using its
 * existing `<input type="file">`) and on cancel. A null return is never an
 * error — it means "use your fallback".
 */
export async function capturePhoto(source: "camera" | "photos" = "camera"): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 82,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: source === "photos" ? CameraSource.Photos : CameraSource.Camera,
      // Long edge cap. The meal/physique vision calls downscale again, but
      // capping here keeps a multi-MB phone photo out of memory entirely.
      width: 1600,
      correctOrientation: true,
    });
    return photo.dataUrl ?? null;
  } catch {
    // User cancelled the picker, or permission denied. Both are non-errors.
    return null;
  }
}

// --------------------------------------------------------------------------
// Network — used by the native offline state (Guideline 4.2)
// --------------------------------------------------------------------------

export interface NetworkWatch {
  clear: () => void;
}

/** Subscribe to connectivity. Uses the native plugin on device, `online`/`offline` on web. */
export async function watchNetwork(onChange: (online: boolean) => void): Promise<NetworkWatch> {
  if (isNative()) {
    try {
      const { Network } = await import("@capacitor/network");
      const status = await Network.getStatus();
      onChange(status.connected);
      const handle = await Network.addListener("networkStatusChange", (s) => onChange(s.connected));
      return { clear: () => void handle.remove() };
    } catch {
      /* fall through to the web listeners */
    }
  }
  const on = () => onChange(true);
  const off = () => onChange(false);
  onChange(navigator.onLine);
  window.addEventListener("online", on);
  window.addEventListener("offline", off);
  return {
    clear: () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    },
  };
}
