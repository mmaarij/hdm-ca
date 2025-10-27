import type { Config } from "drizzle-kit";

export default {
  schema: "./src/app/infrastructure/models/index.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/hdm.db",
  },
} satisfies Config;
