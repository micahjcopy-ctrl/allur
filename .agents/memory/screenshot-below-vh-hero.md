---
name: Screenshotting below a 100vh hero
description: How to visually verify below-the-fold sections when a page opens with a full-viewport-height hero
---

The app-preview screenshot tool captures only the top of the page (≈ viewport height from the top); it does NOT scroll-capture the full page.

**Why this bites:** a hero with `min-h-[100vh]` always equals the screenshot viewport height, so a single capture shows only the hero. Two things that seem like they'd help but DON'T in this environment:
- Passing a hash anchor in the path (e.g. `/home#pricing`) — the browser fragment jump does not fire reliably on a fresh load (large images delay layout, page lands back at top).
- Increasing `viewport_size` height — the hero is `100vh`, so it grows to match and still fills the frame.

**How to apply:** to review below-the-fold sections, make a *temporary* edit, screenshot, then revert:
- Lower the hero `min-h` (e.g. `min-h-[640px]`) so following sections rise into the captured window, and/or
- Add `hidden` to the section(s) directly above the area you want to see so it floats into the top viewport.
Always revert the temporary edits before finishing.
