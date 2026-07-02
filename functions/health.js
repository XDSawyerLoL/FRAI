import worker from "../cloudflare-worker.js";

export const onRequest = async (context) => {
  return worker.fetch(context.request, context.env);
};
