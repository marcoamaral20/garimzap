import { buildApp } from "./app";
import { createPostgresMessageRepository } from "./messages/message.repository";
import { createBullMqProcessingQueue } from "./processing/processing.queue";
import { createPostgresPropertyListingRepository } from "./property-listings/property-listing.repository";
import { loadConfig } from "./shared/config";
import { createDatabase } from "./shared/database/database";
import { createPostgresStatisticsRepository } from "./statistics/statistics.repository";

async function start() {
  const config = loadConfig();
  const database = createDatabase(config.databaseUrl);
  const processingQueue = createBullMqProcessingQueue(config.redisUrl);
  const app = buildApp({
    config,
    messageRepository: createPostgresMessageRepository(database.db),
    processingQueue,
    propertyListingRepository: createPostgresPropertyListingRepository(database.db),
    statisticsRepository: createPostgresStatisticsRepository(database.db),
  });

  try {
    await app.listen({
      host: config.host,
      port: config.port,
    });
  } catch (error) {
    app.log.error(error, "Failed to start Entrelinhas");
    process.exitCode = 1;
  }
}

void start();
