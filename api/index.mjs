// Vercel serverless function for the whole API.
//
// `vercel.json` rewrites every `/api/*` request here. The handler is the Express
// app (built by `pnpm --filter @workspace/api-server run build` during the
// Vercel build step), which does its own routing on the original req.url.
export { default } from "../artifacts/api-server/dist/handler.mjs";
