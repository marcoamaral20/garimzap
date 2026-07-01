import { describe, expect, it } from "vitest";

import { buildApp } from "./app";

describe("GET /health", () => {
  it("returns minimal service health with the current environment", async () => {
    const app = buildApp({
      config: {
        databaseUrl: "postgresql://entrelinhas:entrelinhas@localhost:5432/entrelinhas",
        host: "127.0.0.1",
        logLevel: "silent",
        nodeEnv: "test",
        port: 0,
        redisUrl: "redis://localhost:6379",
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      environment: "test",
      status: "ok",
    });

    await app.close();
  });
});
