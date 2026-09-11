"""Compose App Store screenshots: brand background, Archivo caption, device frame.

Usage: python3 make_screens.py <captures_dir> <out_dir>
captures_dir holds NN-name.png|jpg portrait app captures (any size, ~9:19.5).
Produces both 6.5" (1284x2778) and 6.9" (1320x2868) sets.
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT = os.environ.get("ARCHIVO_TTF", os.path.join(os.path.dirname(os.path.abspath(__file__)), "Archivo-var.ttf"))  # google/fonts ofl/archivo
BG = (11, 17, 32)
CYAN = (91, 224, 230)
WHITE = (245, 247, 250)
MUTED = (160, 172, 190)

CAPTIONS = {
    "dashboard": ("Mission control for today", "Plan, macros and progress in one glance"),
    "score": ("One number for where you're heading", "Your ALLUR Score, from your own data"),
    "coach": ("Ask. Approve. Plan updated.", "Shorter session? Tweaky knee? Just ask"),
    "macros": ("Snap a meal, macros logged", "Calories and macros from a photo in seconds"),
    "plan": ("Built for your equipment and your time", "Volume that adapts week over week"),
    "progress": ("See the change, week over week", "Weight, PRs and photos become feedback"),
    "onboarding": ("Starts from your real starting point", "Goals, schedule, injuries and equipment"),
}

SIZES = {"6.5": (1284, 2778), "6.9": (1320, 2868)}


def font(size, weight=800):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_axes([weight, 100])
    return f


def wrap(draw, text, f, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=f) <= max_w:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    return lines


def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


def compose(capture, key, W, H):
    canvas = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(canvas)
    # subtle radial glow behind the phone
    glow = Image.new("RGB", (W, H), BG)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W * 0.1, H * 0.35, W * 0.9, H * 1.05], fill=(18, 40, 52))
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    canvas.paste(glow, (0, 0))
    draw = ImageDraw.Draw(canvas)

    head, sub = CAPTIONS.get(key, (key.replace("-", " ").title(), ""))
    pad = int(W * 0.08)
    y = int(H * 0.075)
    hf = font(int(W * 0.072), 800)
    for line in wrap(draw, head, hf, W - 2 * pad):
        draw.text((pad, y), line, font=hf, fill=WHITE)
        y += int(hf.size * 1.12)
    if sub:
        sf = font(int(W * 0.036), 500)
        y += int(W * 0.015)
        for line in wrap(draw, sub, sf, W - 2 * pad):
            draw.text((pad, y), line, font=sf, fill=MUTED)
            y += int(sf.size * 1.3)
    # accent rule
    y += int(W * 0.03)
    draw.rounded_rectangle([pad, y, pad + int(W * 0.12), y + 8], radius=4, fill=CYAN)

    # device: keep the capture's aspect, fit width to ~82% of canvas, anchor bottom (bleed)
    cap = capture.convert("RGB")
    dev_w = int(W * 0.82)
    dev_h = int(cap.height * dev_w / cap.width)
    cap = cap.resize((dev_w, dev_h), Image.LANCZOS)
    radius = int(dev_w * 0.11)
    top = max(y + int(W * 0.06), H - dev_h + int(H * 0.04))
    # bezel
    bezel = int(W * 0.018)
    frame = Image.new("RGB", (dev_w + 2 * bezel, dev_h + 2 * bezel), (24, 30, 44))
    fmask = rounded_mask(frame.size, radius + bezel)
    shadow = Image.new("RGB", (W, H), BG)
    sd = ImageDraw.Draw(shadow)
    sx = (W - frame.width) // 2
    sd.rounded_rectangle([sx, top - bezel + 40, sx + frame.width, top - bezel + frame.height + 40], radius=radius + bezel, fill=(0, 0, 0))
    shadow = shadow.filter(ImageFilter.GaussianBlur(60))
    canvas = Image.composite(shadow, canvas, shadow.convert("L").point(lambda v: 255 if v < 8 else 0)) if False else canvas
    canvas.paste(frame, (sx, top - bezel), fmask)
    canvas.paste(cap, (sx + bezel, top), rounded_mask(cap.size, radius))
    return canvas


def main(src, out):
    os.makedirs(out, exist_ok=True)
    files = sorted(f for f in os.listdir(src) if f.lower().endswith((".png", ".jpg", ".jpeg")))
    for f in files:
        key = os.path.splitext(f)[0].split("-", 1)[-1]
        cap = Image.open(os.path.join(src, f))
        for tag, (W, H) in SIZES.items():
            img = compose(cap, key, W, H)
            name = f"{os.path.splitext(f)[0]}_{tag}in_{W}x{H}.png"
            img.save(os.path.join(out, name), optimize=True)
            print(name, img.size)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
