// Minimal Anthropic API client (no SDK dependency).
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

export async function askClaude({ system, messages, maxTokens = 1200 }) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// Streaming variant for the widget (job 1) - returns a ReadableStream of
// plain text chunks (already unwrapped from Anthropic's SSE framing), not
// the raw response body. Caller is responsible for buffering the full text
// if it needs to persist the final reply once the stream ends.
export async function streamClaude({ system, messages, maxTokens = 500 }) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages, stream: true }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload);
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            controller.enqueue(event.delta.text);
          }
        } catch {
          // Malformed/partial SSE frame - skip it, the stream keeps going.
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

// Pulls the first JSON object out of a model reply, tolerating code fences.
export function extractJson(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model reply");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Forces the model to respond via a single tool call against a fixed JSON
// schema, structurally guaranteeing schema-shaped output - unlike
// askClaude + extractJson's "please reply with only JSON" convention, which
// the model can (and, under some inputs, reliably does) ignore entirely by
// replying in plain prose instead. Used for the one call in this codebase
// where a broken result blocks a paid customer outright (deploy route's
// config generation) - see that route for the retry/fallback wrapped
// around this. Throws only on a genuine API-shape problem (missing tool
// call in the response), not on model whim, since tool_choice removes that
// failure mode at the API level.
export async function askClaudeStructured({ system, messages, toolName, toolDescription, schema, maxTokens = 1800 }) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
      tools: [{ name: toolName, description: toolDescription, input_schema: schema }],
      tool_choice: { type: "tool", name: toolName },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const toolUse = (data.content || []).find((b) => b.type === "tool_use" && b.name === toolName);
  if (!toolUse) throw new Error("Model did not return the expected tool call");
  return toolUse.input;
}
