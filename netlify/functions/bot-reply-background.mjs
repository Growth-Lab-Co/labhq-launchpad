// Netlify Background Function (note the -background suffix: Netlify invokes
// this async with a 202 and up to 15 minutes to run, rather than the ~10-26s
// budget a normal function gets). Enqueued by app/api/app-webhook/route.js
// once it's confirmed an InboundMessage webhook belongs to a known tenant -
// all the actual gating (bot enabled, channel, quiet hours, handoff, rate
// cap) and reply generation happens here, in lib/bot.js, so the code path is
// shared with anything else that might call processInboundMessage directly.
import { processInboundMessage } from "../../lib/bot.js";

export default async (req) => {
  const payload = await req.json().catch(() => ({}));
  const result = await processInboundMessage(payload);
  console.log(
    `[CONVO-BOT] processed tenant=${payload.tenant} conversationId=${payload.conversationId}:`,
    JSON.stringify(result)
  );
  return new Response("ok");
};
