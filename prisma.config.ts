import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Match the app's own env convention (see ConfigurationModule): .env.local is
// the real source of truth for local dev, with .env as a fallback.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
