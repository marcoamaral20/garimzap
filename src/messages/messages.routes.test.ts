import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../app";
import { createDatabase } from "../shared/database/database";
import { runMigrations } from "../shared/database/migrate";
import { createPostgresMessageRepository } from "./message.repository";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://entrelinhas:entrelinhas@localhost:5432/entrelinhas";

const samplePayload = {
  externalMessageId: "msg_123",
  groupId: "group_456",
  groupName: "Imoveis Londrina",
  senderId: "user_789",
  senderName: "Maria",
  sentAt: "2026-07-01T10:00:00.000Z",
  text: "VENDO CASA\n3 quartos\nJardim Europa\nLondrina - PR\nR$ 320.000",
};

describe("message ingestion routes", () => {
  const database = createDatabase(databaseUrl);
  const messageRepository = createPostgresMessageRepository(database.db);
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
  });

  beforeAll(async () => {
    await runMigrations(database.pool);
  });

  beforeEach(async () => {
    await database.pool.query("delete from property_listings");
    await database.pool.query("delete from parser_results");
    await database.pool.query("delete from raw_messages");
  });

  afterAll(async () => {
    await app.close();
    await database.pool.end();
  });

  it("accepts a normalized incoming message and persists it as accepted", async () => {
    const response = await app.inject({
      method: "POST",
      payload: samplePayload,
      url: "/webhooks/messages",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      created: true,
      message: {
        externalMessageId: "msg_123",
        groupId: "group_456",
        groupName: "Imoveis Londrina",
        processingStatus: "accepted",
        senderId: "user_789",
        senderName: "Maria",
        sentAt: "2026-07-01T10:00:00.000Z",
        text: samplePayload.text,
      },
    });
    expect(response.json().message.id).toEqual(expect.any(String));
    expect(response.json().message.receivedAt).toEqual(expect.any(String));
  });

  it("returns an existing message without creating a duplicate", async () => {
    const firstResponse = await app.inject({
      method: "POST",
      payload: samplePayload,
      url: "/webhooks/messages",
    });
    const secondResponse = await app.inject({
      method: "POST",
      payload: samplePayload,
      url: "/webhooks/messages",
    });
    const listResponse = await app.inject({
      method: "GET",
      url: "/messages",
    });

    expect(firstResponse.statusCode).toBe(201);
    expect(secondResponse.statusCode).toBe(201);
    expect(secondResponse.json()).toMatchObject({
      created: false,
      message: {
        id: firstResponse.json().message.id,
      },
    });
    expect(listResponse.json().messages).toHaveLength(1);
  });

  it("lists and retrieves persisted raw messages", async () => {
    const createResponse = await app.inject({
      method: "POST",
      payload: {
        ...samplePayload,
        externalMessageId: randomUUID(),
      },
      url: "/webhooks/messages",
    });
    const messageId = createResponse.json().message.id;

    const listResponse = await app.inject({
      method: "GET",
      url: "/messages",
    });
    const detailResponse = await app.inject({
      method: "GET",
      url: `/messages/${messageId}`,
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      messages: [
        {
          id: messageId,
          processingStatus: "accepted",
        },
      ],
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      message: {
        id: messageId,
        text: samplePayload.text,
      },
    });
  });

  it("rejects invalid incoming payloads before persistence", async () => {
    const response = await app.inject({
      method: "POST",
      payload: {
        ...samplePayload,
        text: "",
      },
      url: "/webhooks/messages",
    });
    const listResponse = await app.inject({
      method: "GET",
      url: "/messages",
    });

    expect(response.statusCode).toBe(400);
    expect(listResponse.json().messages).toHaveLength(0);
  });

  it("returns not found when a raw message does not exist", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/messages/${randomUUID()}`,
    });

    expect(response.statusCode).toBe(404);
  });
});
