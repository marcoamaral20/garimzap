import { describe, expect, it } from "vitest";

import { loadConfig } from "./config";

describe("loadConfig", () => {
  it("returns safe development defaults when optional environment variables are omitted", () => {
    const config = loadConfig({});

    expect(config).toEqual({
      databaseUrl: "postgresql://entrelinhas:entrelinhas@localhost:5432/entrelinhas",
      host: "0.0.0.0",
      logLevel: "info",
      nodeEnv: "development",
      port: 3000,
      redisUrl: "redis://localhost:6379",
    });
  });

  it("parses explicit environment values", () => {
    const config = loadConfig({
      HOST: "127.0.0.1",
      DATABASE_URL: "postgresql://example:example@localhost:5432/example",
      LOG_LEVEL: "debug",
      NODE_ENV: "test",
      PORT: "4000",
      REDIS_URL: "redis://example.com:6380",
    });

    expect(config).toEqual({
      databaseUrl: "postgresql://example:example@localhost:5432/example",
      host: "127.0.0.1",
      logLevel: "debug",
      nodeEnv: "test",
      port: 4000,
      redisUrl: "redis://example.com:6380",
    });
  });

  it("rejects invalid port values", () => {
    expect(() => loadConfig({ PORT: "not-a-number" })).toThrow("Invalid environment");
  });
});
