import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

const isBenignClosedConnection = (message: string): boolean =>
  message.includes("Error in PostgreSQL connection") && message.includes("kind: Closed");

const createPrisma = (): PrismaClient => {
  const client = new PrismaClient({
    log: [
      { level: "warn", emit: "stdout" },
      { level: "error", emit: "event" },
    ],
  });

  client.$on("error", (event) => {
    const message = String(event.message ?? "");
    // Neon's pooler closes idle connections; Prisma auto-reconnects, so this
    // is noise. Real query/bootstrap errors still reach stderr.
    if (isBenignClosedConnection(message)) return;
    console.error("[prisma:error]", message, event);
  });

  return client;
};

const prisma = globalForPrisma.__prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}

export default prisma;
