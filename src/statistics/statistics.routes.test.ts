import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../app";
import { createPostgresMessageRepository } from "../messages/message.repository";
import { createPostgresParserResultRepository } from "../parser/parser-result.repository";
import { createPostgresPropertyListingRepository } from "../property-listings/property-listing.repository";
import { createDatabase } from "../shared/database/database";
import { runMigrations } from "../shared/database/migrate";
import { createPostgresStatisticsRepository } from "./statistics.repository";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://entrelinhas:entrelinhas@localhost:5432/entrelinhas";

describe("statistics routes", () => {
  const database = createDatabase(databaseUrl);
  const messageRepository = createPostgresMessageRepository(database.db);
  const parserResultRepository = createPostgresParserResultRepository(database.db);
  const propertyListingRepository = createPostgresPropertyListingRepository(database.db);
  const statisticsRepository = createPostgresStatisticsRepository(database.db);
  const app = buildApp({
    config: {
      databaseUrl,
      host: "127.0.0.1",
      logLevel: "silent",
      nodeEnv: "test",
      port: 0,
      redisUrl: "redis://localhost:6379",
    },
    statisticsRepository,
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

  it("returns product statistics using processed messages as the extraction denominator", async () => {
    await createProcessedListingMessage();
    await createProcessedParserResult("unstructured");
    await createProcessedParserResult("rejected");
    await createProcessingMessage();

    const response = await app.inject({
      method: "GET",
      url: "/statistics",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        extractionSuccessRate: 33.3333,
        totalMessagesCurrentlyProcessing: 1,
        totalPropertyListings: 1,
        totalReceivedMessages: 4,
        totalRejectedMessages: 1,
        totalUnstructuredMessages: 1,
      },
    });
  });

  it("returns zero extraction success rate when there are no processed messages", async () => {
    await createProcessingMessage();

    const response = await app.inject({
      method: "GET",
      url: "/statistics",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: {
        extractionSuccessRate: 0,
        totalMessagesCurrentlyProcessing: 1,
        totalReceivedMessages: 1,
      },
    });
  });

  async function createProcessedListingMessage() {
    const rawMessage = await createRawMessage();
    await messageRepository.markProcessed(rawMessage.message.id);
    const parserResult = await parserResultRepository.createForMessage({
      rawMessageId: rawMessage.message.id,
      reason: null,
      status: "listing_created",
    });

    await propertyListingRepository.createFromParserResult({
      bedrooms: 3,
      city: "Londrina",
      contactPhone: "(43) 99999-9999",
      intent: "sale",
      locationText: "Jardim Europa, Londrina - PR",
      neighborhood: "Jardim Europa",
      parserResultId: parserResult.id,
      priceAmount: 320000,
      propertyType: "house",
      rawMessageId: rawMessage.message.id,
      state: "PR",
    });
  }

  async function createProcessedParserResult(status: "rejected" | "unstructured") {
    const rawMessage = await createRawMessage();
    await messageRepository.markProcessed(rawMessage.message.id);

    await parserResultRepository.createForMessage({
      rawMessageId: rawMessage.message.id,
      reason: status === "rejected" ? "unsupported_domain" : "missing_price",
      status,
    });
  }

  async function createProcessingMessage() {
    const rawMessage = await createRawMessage();
    await messageRepository.markProcessing(rawMessage.message.id);
  }

  async function createRawMessage() {
    return messageRepository.createAccepted({
      externalMessageId: randomUUID(),
      groupId: "group_123",
      groupName: "Imoveis Norte PR",
      senderId: "user_123",
      senderName: "Maria",
      sentAt: "2026-07-01T10:00:00.000Z",
      text: "Mensagem de teste",
    });
  }
});
