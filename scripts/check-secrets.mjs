#!/usr/bin/env node
/**
 * Scanner de segredos para o repositório (N1 — L11).
 * Percorre apenas arquivos versionados (git ls-files) e procura padrões
 * comuns de credenciais. Não examina .env, node_modules, dist, backup ou a
 * pasta "automação do whatsapp" (fora do monorepo).
 *
 * Uso: node scripts/check-secrets.mjs  (ou via CI)
 * Exit code 0 = sem achados; 1 = achou possíveis segredos.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const IGNORED = [
  ".env",
  ".env.example",
  "node_modules/",
  "dist/",
  "coverage/",
  "backup/",
  "automação do whatsapp/",
];

const PATTERNS = [
  { name: "Chave privada", regex: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: "Token de acesso AWS", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "Bearer token", regex: /Bearer [A-Za-z0-9._~+/-]{20,}/ },
  { name: "Senha inline em URL", regex: /(postgres|mysql|mongodb|redis):\/\/[^\s:@]+:[^\s:@]+@/ },
  { name: "Secret padrão do projeto", regex: /MERCADOPAGO_ACCESS_TOKEN=\S{20,}/ },
  { name: "Token WhatsApp", regex: /WHATSAPP_ACCESS_TOKEN=\S{20,}/ },
];

function trackedFiles() {
  try {
    const out = execFileSync("git", ["ls-files"], { cwd: rootDir, encoding: "utf8" });
    return out.split("\n").filter(Boolean);
  } catch {
    console.error("Não foi possível listar arquivos versionados (git ls-files).");
    process.exit(1);
  }
}

let findings = 0;

for (const file of trackedFiles()) {
  if (IGNORED.some((path) => file.includes(path))) continue;

  let content;
  try {
    content = readFileSync(resolve(rootDir, file), "utf8");
  } catch {
    continue;
  }

  for (const pattern of PATTERNS) {
    if (pattern.regex.test(content)) {
      console.log(`⚠️  Possível ${pattern.name} em: ${file}`);
      findings += 1;
    }
  }
}

if (findings > 0) {
  console.error(`\n${findings} possível(is) segredo(s) encontrado(s). Revise antes de commitar.`);
  process.exit(1);
}

console.log("✅ Nenhum possível segredo encontrado nos arquivos versionados.");
