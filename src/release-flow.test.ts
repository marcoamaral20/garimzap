import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "./app";
import { createPostgresMessageRepository } from "./messages/message.repository";
import { createPostgresParserResultRepository } from "./parser/parser-result.repository";
import { processRawMessage } from "./processing/process-raw-message";
import { createPostgresPropertyListingRepository } from "./property-listings/property-listing.repository";
import { createDatabase } from "./shared/database/database";
import { runMigrations } from "./shared/database/migrate";
import { createPostgresStatisticsRepository } from "./statistics/statistics.repository";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://garimzap:garimzap@localhost:5432/garimzap";

describe("MVP release flow", () => {
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
    messageRepository,
    propertyListingRepository,
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

  it("turns an incoming message into a queryable property listing and product metrics", async () => {
    const webhookResponse = await app.inject({
      method: "POST",
      payload: {
        externalMessageId: "demo_msg_001",
        groupId: "demo_group_001",
        groupName: "Imoveis Londrina",
        senderId: "demo_user_001",
        senderName: "Maria",
        sentAt: "2026-07-01T10:00:00.000Z",
        text: "VENDO CASA\n3 quartos\nJardim Europa\nLondrina - PR\nR$ 320.000\nContato: (43) 99999-9999",
      },
      url: "/webhooks/messages",
    });
    const rawMessageId = webhookResponse.json().message.id;

    await processRawMessage({
      messageRepository,
      parserResultRepository,
      propertyListingRepository,
      rawMessageId,
    });

    const listingsResponse = await app.inject({
      method: "GET",
      url: "/property-listings?city=Londrina&propertyType=house&minPrice=300000",
    });
    const statisticsResponse = await app.inject({
      method: "GET",
      url: "/statistics",
    });

    expect(webhookResponse.statusCode).toBe(201);
    expect(listingsResponse.json()).toMatchObject({
      data: [
        {
          city: "Londrina",
          locationText: "Jardim Europa, Londrina - PR",
          priceAmount: 320000,
          propertyType: "house",
          rawMessageId,
        },
      ],
    });
    expect(statisticsResponse.json()).toEqual({
      data: {
        extractionSuccessRate: 100,
        totalMessagesCurrentlyProcessing: 0,
        totalPropertyListings: 1,
        totalReceivedMessages: 1,
        totalRejectedMessages: 0,
        totalUnstructuredMessages: 0,
      },
    });
  });
});
