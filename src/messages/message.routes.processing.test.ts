import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app";
import { createDatabase } from "../shared/database/database";
import { runMigrations } from "../shared/database/migrate";
import { createPostgresMessageRepository } from "./message.repository";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://entrelinhas:entrelinhas@localhost:5432/entrelinhas";

const samplePayload = {
  externalMessageId: "msg_processing_123",
  groupId: "group_processing_456",
  groupName: "Imoveis Londrina",
  senderId: "user_789",
  senderName: "Maria",
  sentAt: "2026-07-01T10:00:00.000Z",
  text: "VENDO CASA\n3 quartos\nJardim Europa\nLondrina - PR\nR$ 320.000",
};

describe("message ingestion processing enqueueing", () => {
  const database = createDatabase(databaseUrl);
  const messageRepository = createPostgresMessageRepository(database.db);
  const processingQueue = {
    enqueueRawMessage: vi.fn().mockResolvedValue(undefined),
  };
  const app = buildApp({
    config: {
      databaseUrl,
      host: "127.0.0.1",
      logLevel: "silent",
      nodeEnv: "test",
      port: 0,
      redisUrl: "redis://localhost:6379",
    },
    messageRepository,
    processingQueue,
  });

  beforeAll(async () => {
    await runMigrations(database.pool);
  });

  beforeEach(async () => {
    await database.pool.query("delete from property_listings");
    await database.pool.query("delete from parser_results");
    await database.pool.query("delete from raw_messages");
    processingQueue.enqueueRawMessage.mockClear();
  });

  afterAll(async () => {
    await app.close();
    await database.pool.end();
  });

  it("enqueues processing after a new raw message is accepted", async () => {
    const response = await app.inject({
      method: "POST",
      payload: {
        ...samplePayload,
        externalMessageId: randomUUID(),
      },
      url: "/webhooks/messages",
    });

    expect(response.statusCode).toBe(201);
    expect(processingQueue.enqueueRawMessage).toHaveBeenCalledWith(response.json().message.id);
  });

  it("does not enqueue processing for duplicate message submissions", async () => {
    await app.inject({
      method: "POST",
      payload: samplePayload,
      url: "/webhooks/messages",
    });
    await app.inject({
      method: "POST",
      payload: samplePayload,
      url: "/webhooks/messages",
    });

    expect(processingQueue.enqueueRawMessage).toHaveBeenCalledTimes(1);
  });
});
