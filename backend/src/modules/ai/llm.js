const env = require("../../config/env");

let client;

function isConfigured() {
  return Boolean(env.aiApiKey);
}

function getClient() {
  if (!client) {
    const OpenAI = require("openai");
    const Client = OpenAI.default || OpenAI;
    client = new Client({
      apiKey: env.aiApiKey,
      baseURL: env.aiBaseUrl,
      timeout: 30000,
      maxRetries: 2,
    });
  }
  return client;
}

// Single place for all AI calls. Tests replace this function.
async function createMessage(params) {
  return getClient().chat.completions.create({ model: env.aiModel, ...params });
}

module.exports = { isConfigured, createMessage };