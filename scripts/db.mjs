#!/usr/bin/env node
/**
 * Script utilitário para operações de banco de dados
 * Uso: npm run db:reset
 */

import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const command = args[0];

const commands = {
  reset: () => {
    console.log("🔄 Resetando banco de dados de desenvolvimento...");
    execSync("npm run db:generate", { stdio: "inherit", cwd: rootDir });
    execSync("npx prisma migrate reset --force --schema database/prisma/schema.prisma", { stdio: "inherit", cwd: rootDir });
    execSync("npm run bootstrap:admin", { stdio: "inherit", cwd: rootDir });
    console.log("✅ Banco resetado e seed aplicado");
  },
  studio: () => {
    console.log("🎨 Abrindo Prisma Studio...");
    execSync("npx prisma studio --schema database/prisma/schema.prisma", { stdio: "inherit", cwd: rootDir });
  },
  seed: () => {
    console.log("🌱 Aplicando seed de demonstração...");
    execSync("npm run bootstrap:admin", { stdio: "inherit", cwd: rootDir });
    execSync("npm run db:seed:demo", { stdio: "inherit", cwd: rootDir });
    console.log("✅ Seed aplicado");
  },
  status: () => {
    console.log("📊 Status das migrations:");
    execSync("npx prisma migrate status --schema database/prisma/schema.prisma", { stdio: "inherit", cwd: rootDir });
  },
  help: () => {
    console.log(`
Uso: npm run db -- <comando>

Comandos disponíveis:
  reset    - Reseta o banco (drop + migrations + seed)
  studio   - Abre Prisma Studio
  seed     - Aplica seed de demonstração
  status   - Mostra status das migrations
  help     - Mostra esta ajuda
`);
  },
};

if (commands[command]) {
  commands[command]();
} else {
  commands.help();
  process.exit(1);
}