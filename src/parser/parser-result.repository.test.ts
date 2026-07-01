import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createPostgresMessageRepository } from "../messages/message.repository";
import { createDatabase } from "../shared/database/database";
import { runMigrations } from "../shared/database/migrate";
import { createPostgresParserResultRepository } from "./parser-result.repository";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://entrelinhas:entrelinhas@localhost:5432/entrelinhas";

describe("parser result repository", () => {
  const database = createDatabase(databaseUrl);
  const messageRepository = createPostgresMessageRepository(database.db);
  const parserResultRepository = createPostgresParserResultRepository(database.db);

  beforeAll(async () => {
    await runMigrations(database.pool);
  });

  beforeEach(async () => {
    await database.pool.query("delete from property_listings");
    await database.pool.query("delete from parser_results");
    await database.pool.query("delete from raw_messages");
  });

  afterAll(async () => {
    await database.pool.end();
  });

  it("creates one parser result for a raw message and returns it idempotently", async () => {
    const rawMessage = await messageRepository.createAccepted({
      externalMessageId: randomUUID(),
      groupId: "group_123",
      groupName: "Imoveis Londrina",
      senderId: "user_123",
      senderName: "Maria",
      sentAt: "2026-07-01T10:00:00.000Z",
      text: "Backend Developer remoto para startup",
    });

    const firstResult = await parserResultRepository.createForMessage({
      rawMessageId: rawMessage.message.id,
      reason: "unsupported_domain",
      status: "rejected",
    });
    const secondResult = await parserResultRepository.createForMessage({
      rawMessageId: rawMessage.message.id,
      reason: "unsupported_domain",
      status: "rejected",
    });

    expect(secondResult).toEqual(firstResult);
    expect(firstResult).toMatchObject({
      rawMessageId: rawMessage.message.id,
      reason: "unsupported_domain",
      status: "rejected",
    });
    expect(firstResult.createdAt).toEqual(expect.any(String));
  });
});
