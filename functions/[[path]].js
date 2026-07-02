import worker from "../cloudflare-worker.js";

export const onRequest = async (context) => {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/\/+$/g, "") || "/";

  if (path === "/health" || path.startsWith("/api/") || path.startsWith("/debug")) {
    return worker.fetch(context.request, context.env);
  }

  return context.next();
};
