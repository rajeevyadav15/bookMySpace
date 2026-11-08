require("dotenv").config({ quiet: true });

const key = process.env.AI_API_KEY;
const base =
  process.env.AI_BASE_URL ||
  "https://generativelanguage.googleapis.com/v1beta/openai/";

const models = [
  process.env.AI_MODEL,
  ...(process.env.AI_FALLBACK_MODELS || "").split(","),
]
  .map((m) => (m || "").trim())
  .filter(Boolean);

console.log("Key found:", Boolean(key), "| length:", key ? key.length : 0);
console.log("Models to test:", models.length, models.join(", "));

async function test(model) {
  const res = await fetch(base + "chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 50,
      messages: [{ role: "user", content: "Say hi in one word" }],
    }),
  });

  const body = await res.json().catch(() => ({}));
  const first = Array.isArray(body) ? body[0] : body;

  if (res.ok) {
    const text = (body.choices?.[0]?.message?.content || "").trim();
    console.log(`${model} -> ${res.status} OK: ${text}`);
  } else {
    const msg = (first?.error?.message || "").slice(0, 70);
    console.log(`${model} -> ${res.status} ${msg}`);
  }
}

(async () => {
  for (const model of models) {
    try {
      await test(model);
    } catch (e) {
      console.log(`${model} -> ERROR ${e.message}`);
    }
  }
})();