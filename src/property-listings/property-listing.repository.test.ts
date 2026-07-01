import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createPostgresMessageRepository } from "../messages/message.repository";
import { createPostgresParserResultRepository } from "../parser/parser-result.repository";
import { createDatabase } from "../shared/database/database";
import { runMigrations } from "../shared/database/migrate";
import { createPostgresPropertyListingRepository } from "./property-listing.repository";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://entrelinhas:entrelinhas@localhost:5432/entrelinhas";

describe("property listing repository", () => {
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

  it("creates a property listing traceable to its raw message and parser result", async () => {
    const rawMessage = await messageRepository.createAccepted({
      externalMessageId: randomUUID(),
      groupId: "group_123",
      groupName: "Imoveis Londrina",
      senderId: "user_123",
      senderName: "Maria",
      sentAt: "2026-07-01T10:00:00.000Z",
      text: "VENDO CASA\n3 quartos\nJardim Europa\nLondrina - PR\nR$ 320.000",
    });
    const parserResult = await parserResultRepository.createForMessage({
      rawMessageId: rawMessage.message.id,
      reason: null,
      status: "listing_created",
    });

    const listing = await propertyListingRepository.createFromParserResult({
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

    expect(listing).toMatchObject({
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
    expect(listing.id).toEqual(expect.any(String));
    expect(listing.createdAt).toEqual(expect.any(String));
  });
});
