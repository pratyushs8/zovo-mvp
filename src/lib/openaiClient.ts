// Isolated OpenAI client singleton.
//
// All Responses API calls go through getOpenAIClient() — never construct
// OpenAI directly in service code. This keeps the client swappable:
// tests call setOpenAIClient() with a mock; nothing else needs to change.

import OpenAI from "openai";
import { env } from "@/lib/env";

// The model used for explanation generation. Named constant so it's easy to
// find and change without grepping through service code.
export const EXPLAIN_MODEL = "gpt-4o-mini";

// Timeout in milliseconds for a single Responses API call.
// Covers all cards in one request — 15 s is generous for a short structured task.
export const EXPLAIN_TIMEOUT_MS = 15_000;

// If the API key is still the example placeholder, the client is initialised
// but every call will fail with an auth error and fall back to deterministic
// copy. That is the correct behaviour for a local dev environment without a
// real key — no special-casing needed.

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return _client;
}

// Used by tests to inject a mock or a pre-configured client.
// Call with null to reset to the default singleton.
export function setOpenAIClient(client: OpenAI | null): void {
  _client = client;
}
