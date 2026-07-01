import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createPostgresMessageRepository } from "../messages/message.repository";
import { createPostgresParserResultRepository } from "../parser/parser-result.repository";
import { createPostgresPropertyListingRepository } from "../property-listings/property-listing.repository";
import { createDatabase } from "../shared/database/database";
import { runMigrations } from "../shared/database/migrate";
import { processRawMessage } from "./process-raw-message";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://entrelinhas:entrelinhas@localhost:5432/entrelinhas";

describe("processRawMessage integration", () => {
  const database = createDatabase(databaseUrl);
  const messageRepository = createPostgresMessageRepository(database.db);
  const parserResultRepository = createPostgresParserResultRepository(database.db);
  const propertyListingRepository = createPostgresPropertyListingRepository(database.db);

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

  it("persists a parser result and property listing for a complete listing", async () => {
    const rawMessage = await messageRepository.createAccepted({
      externalMessageId: randomUUID(),
      groupId: "group_123",
      groupName: "Imoveis Londrina",
      senderId: "user_123",
      senderName: "Maria",
      sentAt: "2026-07-01T10:00:00.000Z",
      text: "VENDO CASA\n3 quartos\nJardim Europa\nLondrina - PR\nR$ 320.000",
    });

    await processRawMessage({
      messageRepository,
      parserResultRepository,
      propertyListingRepository,
      rawMessageId: rawMessage.message.id,
    });

    const parserResults = await database.pool.query("select * from parser_results");
    const propertyListings = await database.pool.query("select * from property_listings");
    const processedMessage = await messageRepository.findById(rawMessage.message.id);

    expect(processedMessage?.processingStatus).toBe("processed");
    expect(parserResults.rows).toHaveLength(1);
    expect(parserResults.rows[0]).toMatchObject({
      raw_message_id: rawMessage.message.id,
      reason: null,
      status: "listing_created",
    });
    expect(propertyListings.rows).toHaveLength(1);
    expect(propertyListings.rows[0]).toMatchObject({
      city: "Londrina",
      location_text: "Jardim Europa, Londrina - PR",
      parser_result_id: parserResults.rows[0].id,
      price_amount: 320000,
      property_type: "house",
      raw_message_id: rawMessage.message.id,
    });
  });

  it("persists an unstructured parser result without a property listing", async () => {
    const rawMessage = await messageRepository.createAccepted({
      externalMessageId: randomUUID(),
      groupId: "group_123",
      groupName: "Imoveis Londrina",
      senderId: "user_123",
      senderName: "Maria",
      sentAt: "2026-07-01T10:00:00.000Z",
      text: "VENDO CASA\nJardim Europa\nLondrina - PR",
    });

    await processRawMessage({
      messageRepository,
      parserResultRepository,
      propertyListingRepository,
      rawMessageId: rawMessage.message.id,
    });

    const parserResults = await database.pool.query("select * from parser_results");
    const propertyListings = await database.pool.query("select * from property_listings");

    expect(parserResults.rows).toHaveLength(1);
    expect(parserResults.rows[0]).toMatchObject({
      raw_message_id: rawMessage.message.id,
      reason: "missing_price",
      status: "unstructured",
    });
    expect(propertyListings.rows).toHaveLength(0);
  });

  it("persists a rejected parser result without a property listing", async () => {
    const rawMessage = await messageRepository.createAccepted({
      externalMessageId: randomUUID(),
      groupId: "group_123",
      groupName: "Tech Jobs",
      senderId: "user_123",
      senderName: "Maria",
      sentAt: "2026-07-01T10:00:00.000Z",
      text: "Backend Developer remoto para startup",
    });

    await processRawMessage({
      messageRepository,
      parserResultRepository,
      propertyListingRepository,
      rawMessageId: rawMessage.message.id,
    });

    const parserResults = await database.pool.query("select * from parser_results");
    const propertyListings = await database.pool.query("select * from property_listings");

    expect(parserResults.rows).toHaveLength(1);
    expect(parserResults.rows[0]).toMatchObject({
      raw_message_id: rawMessage.message.id,
      reason: "unsupported_domain",
      status: "rejected",
    });
    expect(propertyListings.rows).toHaveLength(0);
  });

  it("does not duplicate parser results or property listings when a job is retried", async () => {
    const rawMessage = await messageRepository.createAccepted({
      externalMessageId: randomUUID(),
      groupId: "group_123",
      groupName: "Imoveis Londrina",
      senderId: "user_123",
      senderName: "Maria",
      sentAt: "2026-07-01T10:00:00.000Z",
      text: "VENDO CASA\n3 quartos\nJardim Europa\nLondrina - PR\nR$ 320.000",
    });

    await processRawMessage({
      messageRepository,
      parserResultRepository,
      propertyListingRepository,
      rawMessageId: rawMessage.message.id,
    });
    await processRawMessage({
      messageRepository,
      parserResultRepository,
      propertyListingRepository,
      rawMessageId: rawMessage.message.id,
    });

    const parserResults = await database.pool.query("select * from parser_results");
    const propertyListings = await database.pool.query("select * from property_listings");

    expect(parserResults.rows).toHaveLength(1);
    expect(propertyListings.rows).toHaveLength(1);
  });
});
