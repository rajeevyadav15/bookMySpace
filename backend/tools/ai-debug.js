require("dotenv").config({ quiet: true });

const llm = require("../src/modules/ai/llm");
const { tools } = require("../src/modules/ai/ai.tools");
const aiService = require("../src/modules/ai/ai.service");

async function step(name, fn) {
  try {
    const result = await fn();
    console.log(`[OK] ${name} ->`, result);
  } catch (e) {
    console.log(`[FAIL] ${name} -> status: ${e.status}`, String(e.message).slice(0, 400));
  }
}

(async () => {
  console.log("AI configured:", llm.isConfigured());

  await step("1 plain call", async () => {
    const r = await llm.createMessage({
      max_tokens: 50,
      messages: [{ role: "user", content: "Say hi" }],
    });
    return r.choices[0].message.content;
  });

  await step("2 call with tools", async () => {
    const r = await llm.createMessage({
      max_tokens: 512,
      messages: [{ role: "user", content: "Find Hindi movies" }],
      tools,
    });
    const m = r.choices[0].message;
    return m.tool_calls
      ? "tool_calls: " + m.tool_calls.map((c) => c.function.name).join(", ")
      : "text: " + m.content;
  });

  await step("3 full chat", async () => {
    const r = await aiService.chat([
      { role: "user", content: "Raipur me kaunsi movies chal rahi hain?" },
    ]);
    return JSON.stringify(r).slice(0, 300);
  });

  process.exit(0);
})();