#!/usr/bin/env node
/**
 * Script para validar qualidade do código antes de commit/PR
 * Uso: npm run validate
 */

import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

console.log("🔍 Validando qualidade do código...\n");

const checks = [
  { name: "Lint", cmd: "npm run lint" },
  { name: "TypeCheck", cmd: "npm run typecheck" },
  { name: "Tests", cmd: "npm test" },
  { name: "Build", cmd: "npm run build" },
  { name: "DB Validate", cmd: "npm run db:validate" },
];

let allPassed = true;

for (const check of checks) {
  console.log(`\n▶ ${check.name}...`);
  try {
    execSync(check.cmd, { stdio: "inherit", cwd: rootDir });
    console.log(`✅ ${check.name} OK`);
  } catch {
    console.error(`❌ ${check.name} FALHOU`);
    allPassed = false;
  }
}

console.log("\n" + "=".repeat(40));
if (allPassed) {
  console.log("🎉 Todas as validações passaram!");
  process.exit(0);
} else {
  console.log("💥 Algumas validações falharam. Corrija antes de commitar.");
  process.exit(1);
}