---
name: FitCoach static images
description: How to add bundled image assets to the fitcoach web artifact
---

# Static images in `artifacts/fitcoach`

There is **no** module/type declaration for importing `.png`/image files (no `vite-env.d.ts`), and tsconfig `paths` only maps `@/*` (the `@assets` Vite alias has no matching TS path). So `import img from "@assets/..."` or `import img from "./x.png"` will fail typecheck.

**Convention:** put bundled images in `artifacts/fitcoach/public/<subdir>/` and reference them by URL with the base prefix:

```tsx
<img src={`${import.meta.env.BASE_URL}physiques/bodybuilder.png`} />
```

**Why:** the artifact runs under a non-root BASE_PATH behind the shared proxy; `import.meta.env.BASE_URL` already includes the trailing-slash base, so root-relative `/physiques/...` would escape the prefix.

**How to apply:** generate/copy images into `public/`, never `attached_assets/` (not web-served). Avoid raw image imports unless you first add a `*.png` ambient module declaration.
