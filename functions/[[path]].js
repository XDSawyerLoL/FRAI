import worker from "../cloudflare-worker.js";

const API_PREFIXES = ["/api/", "/debug"];
const API_EXACT_PATHS = new Set(["/health"]);

export const onRequest = async (context) => {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/\/+$/g, "") || "/";

  const isApiRoute = API_EXACT_PATHS.has(path)
    || API_PREFIXES.some(prefix => path.startsWith(prefix));

  if (isApiRoute) {
    return worker.fetch(context.request, context.env);
  }

  return context.next();
};
