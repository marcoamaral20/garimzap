import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../app";
import { createPostgresMessageRepository } from "../messages/message.repository";
import { createPostgresParserResultRepository } from "../parser/parser-result.repository";
import { createDatabase } from "../shared/database/database";
import { runMigrations } from "../shared/database/migrate";
import { createPostgresPropertyListingRepository } from "./property-listing.repository";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://entrelinhas:entrelinhas@localhost:5432/entrelinhas";

describe("property listing routes", () => {
  const database = createDatabase(databaseUrl);
  const messageRepository = createPostgresMessageRepository(database.db);
  const parserResultRepository = createPostgresParserResultRepository(database.db);
  const propertyListingRepository = createPostgresPropertyListingRepository(database.db);
  const app = buildApp({
    config: {
      databaseUrl,
      host: "127.0.0.1",
      logLevel: "silent",
      nodeEnv: "test",
      port: 0,
      redisUrl: "redis://localhost:6379",
    },
    propertyListingRepository,
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

  it("lists property listings using the consistent data response shape", async () => {
    const listing = await createPropertyListing({
      city: "Londrina",
      neighborhood: "Jardim Europa",
      priceAmount: 320000,
      propertyType: "house",
    });

    const response = await app.inject({
      method: "GET",
      url: "/property-listings",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [
        {
          city: "Londrina",
          id: listing.id,
          locationText: "Jardim Europa, Londrina - PR",
          neighborhood: "Jardim Europa",
          parserResultId: listing.parserResultId,
          priceAmount: 320000,
          propertyType: "house",
          rawMessageId: listing.rawMessageId,
        },
      ],
    });
  });

  it("filters property listings by city, neighborhood, property type, and price range", async () => {
    const matchingListing = await createPropertyListing({
      city: "Londrina",
      neighborhood: "Jardim Europa",
      priceAmount: 320000,
      propertyType: "house",
    });
    await createPropertyListing({
      city: "Maringa",
      neighborhood: "Zona 07",
      priceAmount: 450000,
      propertyType: "apartment",
    });

    const response = await app.inject({
      method: "GET",
      url: "/property-listings?city=londrina&neighborhood=jardim%20europa&propertyType=house&minPrice=300000&maxPrice=350000",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [
        {
          id: matchingListing.id,
        },
      ],
    });
  });

  it("rejects invalid listing query parameters", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/property-listings?propertyType=boat&minPrice=banana",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "invalid_query",
      message: "Property listing query parameters are invalid.",
    });
  });

  it("retrieves a property listing by id", async () => {
    const listing = await createPropertyListing({
      city: "Londrina",
      neighborhood: "Jardim Europa",
      priceAmount: 320000,
      propertyType: "house",
    });

    const response = await app.inject({
      method: "GET",
      url: `/property-listings/${listing.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: {
        id: listing.id,
        parserResultId: listing.parserResultId,
        rawMessageId: listing.rawMessageId,
      },
    });
  });

  it("returns not found when a property listing does not exist", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/property-listings/${randomUUID()}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "not_found",
      message: "Property listing was not found.",
    });
  });

  async function createPropertyListing(input: {
    city: string;
    neighborhood: string;
    priceAmount: number;
    propertyType: "apartment" | "house";
  }) {
    const rawMessage = await messageRepository.createAccepted({
      externalMessageId: randomUUID(),
      groupId: "group_123",
      groupName: "Imoveis Norte PR",
      senderId: "user_123",
      senderName: "Maria",
      sentAt: "2026-07-01T10:00:00.000Z",
      text: "VENDO CASA\nJardim Europa\nLondrina - PR\nR$ 320.000",
    });
    const parserResult = await parserResultRepository.createForMessage({
      rawMessageId: rawMessage.message.id,
      reason: null,
      status: "listing_created",
    });

    return propertyListingRepository.createFromParserResult({
      bedrooms: 3,
      city: input.city,
      contactPhone: "(43) 99999-9999",
      intent: "sale",
      locationText: `${input.neighborhood}, ${input.city} - PR`,
      neighborhood: input.neighborhood,
      parserResultId: parserResult.id,
      priceAmount: input.priceAmount,
      propertyType: input.propertyType,
      rawMessageId: rawMessage.message.id,
      state: "PR",
    });
  }
});
