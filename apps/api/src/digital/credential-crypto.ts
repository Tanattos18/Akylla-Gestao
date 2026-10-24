import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";
import { env } from "../config/env";

/**
 * Senhas dos logins das entregas: AES-256-GCM, mesmo formato dos segredos
 * fiscais (`v1:<iv>:<tag>:<cifrado>`, base64). Chave CREDENTIALS_ENCRYPTION_KEY
 * ou, na falta dela, FISCAL_ENCRYPTION_KEY. Sem chave, a API recusa gravar.
 */

const VERSION = "v1";

function key(): Buffer {
  const hex = env.CREDENTIALS_ENCRYPTION_KEY ?? env.FISCAL_ENCRYPTION_KEY;
  if (!hex) {
    throw new ServiceUnavailableException(
      "Chave de cifra não configurada (CREDENTIALS_ENCRYPTION_KEY ou FISCAL_ENCRYPTION_KEY): o servidor não grava senhas sem cifra",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptCredential(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decryptCredential(payload: string): string {
  const [version, iv, tag, data] = payload.split(":");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Senha em formato desconhecido");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
