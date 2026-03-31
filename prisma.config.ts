import "dotenv/config";
import { defineConfig } from "prisma/config";

const prismaConfigDatasourceUrl =
  process.env.DIRECT_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  "postgresql://flowmerge:flowmerge@127.0.0.1:5432/flowmerge";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: prismaConfigDatasourceUrl,
  },
});
