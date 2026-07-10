import { Router, type IRouter, type Request, type Response } from "express";
import { makeRateLimit } from "../lib/rateLimit";

const router: IRouter = Router();

// Scenic route suggestions — OpenRouteService round-trip routing (green
// weighting on foot profiles). The API key lives server-side only; while
// ORS_API_KEY is unset the endpoint answers 501 and the client quietly hides
// the feature, so shipping this is safe before the key exists.
const rateLimit = makeRateLimit("cardio-routes", 10, 60_000);

const ORS_BASE = "https://api.openrouteservice.org/v2/directions";

const PROFILES: Record<string, string> = {
  run: "foot-walking",
  walk: "foot-walking",
  hike: "foot-hiking",
  cycle: "cycling-regular",
};

interface OrsFeature {
  properties?: {
    summary?: { distance?: number };
    ascent?: number;
    descent?: number;
  };
  geometry?: { coordinates?: [number, number, number?][] };
}

/** Downsample a GeoJSON line to at most `max` points for the response. */
const slimLine = (coords: [number, number, number?][], max = 80) => {
  if (coords.length <= max) return coords.map(([lon, lat]) => ({ lat, lon }));
  const stride = (coords.length - 1) / (max - 1);
  const out: { lat: number; lon: number }[] = [];
  for (let i = 0; i < max; i++) {
    const [lon, lat] = coords[Math.round(i * stride)];
    out.push({ lat, lon });
  }
  return out;
};

router.post(
  "/cardio/route-suggestions",
  rateLimit,
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Please sign in to use this feature." });
      return;
    }
    const key = process.env.ORS_API_KEY;
    if (!key) {
      res.status(501).json({ error: "Route suggestions are not configured yet." });
      return;
    }

    const { lat, lon, type, targetDistanceM } = (req.body ?? {}) as {
      lat?: unknown;
      lon?: unknown;
      type?: unknown;
      targetDistanceM?: unknown;
    };
    if (
      typeof lat !== "number" ||
      typeof lon !== "number" ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      res.status(400).json({ error: "A valid start location is required." });
      return;
    }
    const profile = PROFILES[typeof type === "string" ? type : "run"] ?? "foot-walking";
    const length = Math.min(Math.max(Number(targetDistanceM) || 5000, 1000), 60_000);
    const green = profile.startsWith("foot");

    try {
      // Three round-trip variants from different seeds = three distinct loops.
      const seeds = [7, 23, 51];
      const results = await Promise.allSettled(
        seeds.map(async (seed) => {
          const roundTrip = { round_trip: { length, points: 4, seed } };
          const r = await fetch(`${ORS_BASE}/${profile}/geojson`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: key },
            body: JSON.stringify({
              coordinates: [[lon, lat]],
              elevation: true,
              options: green
                ? { ...roundTrip, profile_params: { weightings: { green: 0.8 } } }
                : roundTrip,
            }),
          });
          if (!r.ok) throw new Error(`ORS responded ${r.status}`);
          const data = (await r.json()) as { features?: OrsFeature[] };
          return data.features?.[0];
        }),
      );

      const names = ["Loop A", "Loop B", "Loop C"];
      const suggestions = results
        .map((r, i) => (r.status === "fulfilled" && r.value ? { f: r.value, name: names[i] } : null))
        .filter((x): x is { f: OrsFeature; name: string } => x !== null)
        .map(({ f, name }) => ({
          name,
          distanceM: Math.round(f.properties?.summary?.distance ?? 0),
          elevGainM: Math.round(f.properties?.ascent ?? 0),
          polyline: slimLine(f.geometry?.coordinates ?? []),
          scenicScore: green ? 0.8 : 0.5,
        }))
        .filter((s) => s.distanceM > 0 && s.polyline.length > 1);

      if (!suggestions.length) {
        res.status(502).json({ error: "No routes found near you — try a different distance." });
        return;
      }
      res.json({ suggestions });
    } catch (err) {
      req.log.error({ err }, "route suggestion request failed");
      res.status(500).json({ error: "Route suggestions are unavailable right now." });
    }
  },
);

export default router;
