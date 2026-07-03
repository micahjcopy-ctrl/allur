// Client-side image helpers shared by onboarding, progress, and macros.

/**
 * Downscale an image (as a data URL) to `maxDim` on its long edge and re-encode
 * as JPEG. Used both to keep vision-API payloads small and as the first pass of
 * `compressForStorage`.
 */
export const downscaleImage = (src: string, maxDim = 1024, quality = 0.82): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(src);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Could not load that image."));
    img.src = src;
  });

/**
 * The persistence layer drops any inline photo whose data URL exceeds
 * ~300k chars (the account-sync body-size safety cap) — which used to make
 * "saved" photos silently vanish on the next app launch. Keep our own budget
 * comfortably under that cap so a stored photo can never be dropped.
 */
export const MAX_STORED_PHOTO_CHARS = 280_000;

/**
 * Compress a photo until its data URL fits within the persistence budget,
 * stepping down size/quality as needed. Detail-heavy photos that stay large at
 * one setting simply move to the next step; the final step is small enough
 * that any real-world photo fits. Falls back to the smallest attempt if the
 * source can't be decoded mid-way.
 */
export const compressForStorage = async (src: string): Promise<string> => {
  const steps: Array<[number, number]> = [
    [900, 0.78],
    [800, 0.68],
    [700, 0.58],
    [560, 0.5],
  ];
  let best = src;
  for (const [dim, q] of steps) {
    try {
      best = await downscaleImage(src, dim, q);
    } catch {
      return best;
    }
    if (best.length <= MAX_STORED_PHOTO_CHARS) return best;
  }
  return best;
};
