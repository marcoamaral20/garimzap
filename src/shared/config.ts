import { z } from "zod";

const configSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://entrelinhas:entrelinhas@localhost:5432/entrelinhas"),
  HOST: z.string().min(1).default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
});

export type AppConfig = {
  databaseUrl: string;
  host: string;
  logLevel: z.infer<typeof configSchema>["LOG_LEVEL"];
  nodeEnv: z.infer<typeof configSchema>["NODE_ENV"];
  port: number;
  redisUrl: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = configSchema.safeParse(env);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment: ${message}`);
  }

  return {
    databaseUrl: result.data.DATABASE_URL,
    host: result.data.HOST,
    logLevel: result.data.LOG_LEVEL,
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    redisUrl: result.data.REDIS_URL,
  };
}
