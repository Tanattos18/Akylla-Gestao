import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Armazenamento dos anexos da OS (Fase 2 · 2.3) em disco local.
 *
 * - Pasta base: `UPLOADS_DIR` (padrão `<cwd>/uploads`; em produção, um volume
 *   persistente ou bucket — ver docs/operations/DEPLOY.md). Lida a cada uso.
 * - Caminho montado só com ids gerados pelo sistema (`service-orders/
 *   <companyId>/<osId>/<uuid>.<ext>`): o nome enviado pelo usuário nunca
 *   entra no caminho (sem path traversal).
 * - Tipo detectado pelos BYTES do arquivo (assinatura), não pela extensão
 *   nem pelo mimetype informado pelo navegador.
 */

export type AllowedKind = { ext: "jpg" | "png" | "pdf"; mimeType: string };

export function detectAllowedKind(buffer: Buffer): AllowedKind | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: "jpg", mimeType: "image/jpeg" };
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { ext: "png", mimeType: "image/png" };
  }
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-") {
    return { ext: "pdf", mimeType: "application/pdf" };
  }
  return null;
}

export function uploadsRoot(): string {
  const configured = process.env.UPLOADS_DIR;
  if (!configured) return resolve(process.cwd(), "uploads");
  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
}

/** Nome exibido: só caracteres seguros, sem caminho, máx. 120. */
export function sanitizeFilename(original: string | undefined, ext: string): string {
  const base = (original ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = base.normalize("NFKC").replace(/[^\p{L}\p{N}._ -]/gu, "_").replace(/\s+/g, " ").trim();
  const withoutExt = cleaned.replace(/\.[^.]*$/, "") || "anexo";
  return `${withoutExt.slice(0, 110)}.${ext}`;
}

export async function saveAttachment(companyId: string, serviceOrderId: string, buffer: Buffer, ext: string) {
  const relative = join("service-orders", companyId, serviceOrderId, `${randomUUID()}.${ext}`);
  const absolute = join(uploadsRoot(), relative);
  await mkdir(join(uploadsRoot(), "service-orders", companyId, serviceOrderId), { recursive: true });
  await writeFile(absolute, buffer, { flag: "wx" });
  return relative.split("\\").join("/");
}

export function readAttachment(storagePath: string): Promise<Buffer> {
  return readFile(join(uploadsRoot(), storagePath));
}

export async function removeAttachment(storagePath: string): Promise<void> {
  await unlink(join(uploadsRoot(), storagePath)).catch(() => undefined);
}
