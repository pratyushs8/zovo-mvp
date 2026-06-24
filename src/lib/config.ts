// Central place for non-secret app configuration.
// Secrets (API keys, DB URL) live in src/lib/env.ts — never here.
export const config = {
  app: {
    name: "ZoCo",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  },
} as const;
