// Accesso diretto al DB SQLite dei test e2e (lo stesso del server avviato da playwright.config.ts).
import { PrismaClient } from "@prisma/client";

export const db = new PrismaClient({ datasourceUrl: "file:./e2e.db" });
