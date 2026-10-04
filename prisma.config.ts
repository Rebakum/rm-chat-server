import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/models",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed-admin.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
