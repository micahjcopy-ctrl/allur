// ---------------------------------------------------------------------------
// Share cards — canvas-rendered PNGs for the viral loop. No dependencies.
//
// Every card carries the getallur.com watermark and (when available) the
// user's referral code, so a shared screenshot is also an acquisition asset.
// Layouts are fixed-size (1080×1350 scan / 1080×1080 PR) so they look right
// on Instagram, X and iMessage regardless of the device that rendered them.
// ---------------------------------------------------------------------------

import type { AllurScoreData } from "@/lib/allurScore";

const BG = "#0a0e13";
const CARD = "#111820";
const TRACK = "#1e2732";
const PRIMARY = "#5be0e6";
const TEXT = "#f4f7f8";
const MUTED = "#8b98a5";
const SUCCESS = "#4ade80";

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const baseCanvas = (w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  // ambient glow
  const glow = ctx.createRadialGradient(w / 2, h * 0.28, 60, w / 2, h * 0.28, w * 0.75);
  glow.addColorStop(0, "rgba(91,224,230,0.14)");
  glow.addColorStop(1, "rgba(91,224,230,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  return { canvas, ctx };
};

const wordmark = (ctx: CanvasRenderingContext2D, w: number, y: number) => {
  ctx.fillStyle = TEXT;
  ctx.font = "600 44px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  const text = "A L L U R";
  ctx.fillText(text, w / 2, y);
};

const watermark = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  referralCode?: string | null,
) => {
  ctx.textAlign = "center";
  ctx.fillStyle = MUTED;
  ctx.font = "500 30px system-ui, -apple-system, sans-serif";
  ctx.fillText("getallur.com", w / 2, h - 76);
  if (referralCode) {
    ctx.fillStyle = PRIMARY;
    ctx.font = "600 28px system-ui, -apple-system, sans-serif";
    ctx.fillText(`join with code ${referralCode.toUpperCase()}`, w / 2, h - 36);
  }
};

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );

/** 1080×1350 scan card: score ring, delta, potential, muscle bars, body fat. */
export async function renderScanCard(
  d: AllurScoreData,
  referralCode?: string | null,
): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const { canvas, ctx } = baseCanvas(W, H);

  wordmark(ctx, W, 96);
  ctx.fillStyle = MUTED;
  ctx.font = "500 30px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    `BODY SCAN · ${new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`,
    W / 2,
    148,
  );

  // Score ring
  const cx = W / 2;
  const cy = 400;
  const R = 175;
  ctx.lineCap = "round";
  ctx.strokeStyle = TRACK;
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = PRIMARY;
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + (Math.min(d.overall, 100) / 100) * Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = TEXT;
  ctx.font = "700 150px system-ui, -apple-system, sans-serif";
  ctx.fillText(String(d.overall), cx, cy + 40);
  ctx.fillStyle = MUTED;
  ctx.font = "600 28px system-ui, -apple-system, sans-serif";
  ctx.fillText("ALLUR SCORE", cx, cy + 92);

  // Delta pill
  if (d.delta != null && d.delta !== 0) {
    const label = `${d.delta > 0 ? "▲ +" : "▼ "}${d.delta}`;
    ctx.font = "700 34px system-ui, -apple-system, sans-serif";
    const tw = ctx.measureText(label).width;
    roundRect(ctx, cx - tw / 2 - 26, cy + 122, tw + 52, 58, 29);
    ctx.fillStyle = d.delta > 0 ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)";
    ctx.fill();
    ctx.fillStyle = d.delta > 0 ? SUCCESS : "#f87171";
    ctx.fillText(label, cx, cy + 163);
  }

  // Potential + body fat tiles
  const tileY = 660;
  const tileW = 460;
  const tiles: { label: string; value: string }[] = [
    { label: "POTENTIAL", value: String(d.potential) },
    { label: "BODY FAT", value: `${Math.round(d.bodyFat)}%` },
  ];
  tiles.forEach((t, i) => {
    const x = i === 0 ? W / 2 - tileW - 20 : W / 2 + 20;
    roundRect(ctx, x, tileY, tileW, 130, 24);
    ctx.fillStyle = CARD;
    ctx.fill();
    ctx.fillStyle = TEXT;
    ctx.font = "700 56px system-ui, -apple-system, sans-serif";
    ctx.fillText(t.value, x + tileW / 2, tileY + 72);
    ctx.fillStyle = MUTED;
    ctx.font = "600 22px system-ui, -apple-system, sans-serif";
    ctx.fillText(t.label, x + tileW / 2, tileY + 108);
  });

  // Muscle bars (up to 6)
  const parts = d.parts.slice(0, 6);
  const barX = 120;
  const barW = W - 240;
  let y = 880;
  for (const p of parts) {
    ctx.textAlign = "left";
    ctx.fillStyle = TEXT;
    ctx.font = "600 32px system-ui, -apple-system, sans-serif";
    ctx.fillText(p.part, barX, y);
    ctx.textAlign = "right";
    ctx.fillStyle = PRIMARY;
    ctx.font = "700 32px system-ui, -apple-system, sans-serif";
    ctx.fillText(String(Math.round(p.rating)), barX + barW, y);
    roundRect(ctx, barX, y + 14, barW, 14, 7);
    ctx.fillStyle = TRACK;
    ctx.fill();
    roundRect(ctx, barX, y + 14, Math.max(14, barW * (Math.min(p.rating, 100) / 100)), 14, 7);
    ctx.fillStyle = PRIMARY;
    ctx.fill();
    y += 66;
  }

  watermark(ctx, W, H, referralCode);
  return toBlob(canvas);
}

/** 1080×1080 PR celebration card. */
export async function renderPrCard(
  args: { exercise: string; weight: string; reps: string; date: string },
  referralCode?: string | null,
): Promise<Blob> {
  const W = 1080;
  const H = 1080;
  const { canvas, ctx } = baseCanvas(W, H);

  wordmark(ctx, W, 96);
  ctx.fillStyle = SUCCESS;
  ctx.font = "700 40px system-ui, -apple-system, sans-serif";
  ctx.fillText("NEW PERSONAL RECORD", W / 2, 300);

  ctx.fillStyle = TEXT;
  ctx.font = "700 88px system-ui, -apple-system, sans-serif";
  ctx.fillText(args.exercise, W / 2, 440);

  ctx.fillStyle = PRIMARY;
  ctx.font = "800 150px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${args.weight} × ${args.reps}`, W / 2, 640);

  ctx.fillStyle = MUTED;
  ctx.font = "500 32px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    new Date(args.date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
    W / 2,
    730,
  );

  watermark(ctx, W, H, referralCode);
  return toBlob(canvas);
}

/**
 * Share via the native sheet when the platform supports file sharing,
 * otherwise download the PNG. Returns which path was taken.
 */
export async function sharePng(
  blob: Blob,
  filename: string,
  text: string,
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch {
      // user cancelled or share failed — fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
