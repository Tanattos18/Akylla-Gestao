import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import * as tls from "node:tls";
import { X509Certificate } from "node:crypto";
import { env } from "../config/env";

/**
 * Segredos fiscais (Fase 3): AES-256-GCM com FISCAL_ENCRYPTION_KEY.
 * Formato: `v1:<iv b64>:<tag b64>:<cifrado b64>`. GCM autentica: dado
 * adulterado ou chave errada falha na decifra (nunca devolve lixo).
 */

const VERSION = "v1";

function key(): Buffer {
  if (!env.FISCAL_ENCRYPTION_KEY) {
    throw new ServiceUnavailableException(
      "FISCAL_ENCRYPTION_KEY não configurada: o servidor não grava segredos fiscais sem cifra",
    );
  }
  return Buffer.from(env.FISCAL_ENCRYPTION_KEY, "hex");
}

export function encryptSecret(plain: Buffer | string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(typeof plain === "string" ? Buffer.from(plain, "utf8") : plain), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decryptSecret(payload: string): Buffer {
  const [version, iv, tag, data] = payload.split(":");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Segredo fiscal em formato desconhecido");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]);
}

/**
 * Certificado A1 (.pfx/.p12): valida formato e senha com o próprio Node
 * (`tls.createSecureContext`), sem chamar `openssl` em processo externo (a
 * referência estudada passava a senha na linha de comando). Lê titular e
 * validade do certificado.
 */
export function inspectCertificate(pfx: Buffer, password: string): { subject: string; validTo: Date } {
  let context: tls.SecureContext;
  try {
    context = tls.createSecureContext({ pfx, passphrase: password });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/mac verify|bad decrypt|password/i.test(message)) {
      throw new BadRequestException("Senha do certificado incorreta");
    }
    throw new BadRequestException("Arquivo não é um certificado A1 (.pfx/.p12) válido");
  }
  const native = (context as unknown as { context?: { getCertificate?: () => Buffer | null } }).context;
  const der = native?.getCertificate?.();
  if (!der) throw new BadRequestException("Certificado sem dados legíveis");
  const certificate = new X509Certificate(der);
  const validTo = new Date(certificate.validTo);
  if (validTo.getTime() <= Date.now()) {
    throw new BadRequestException(`Certificado vencido em ${validTo.toLocaleDateString("pt-BR")}`);
  }
  return { subject: certificate.subject.replace(/\n/g, ", "), validTo };
}
