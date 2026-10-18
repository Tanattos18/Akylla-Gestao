import { Global, Injectable, Logger, Module } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";

export const MAIL_PROVIDER = "MAIL_PROVIDER";

/**
 * Provedor de e-mail transacional atrás de interface (N4 · 1.5; Fase 1 · 1D).
 * - `SMTP_HOST` definido → `SmtpMailProvider` (nodemailer; referência em
 *   upgrade/REFERENCIAS_GIT.md, Fase 1 · 1D).
 * - Sem SMTP → `LogMailProvider` (nenhum envio real). Em produção o link não
 *   vai para o log, porque contém token de uso único.
 */
export interface MailProvider {
  sendPasswordReset(email: string, resetUrl: string): Promise<void>;
  sendEmailVerification(email: string, name: string, verifyUrl: string): Promise<void>;
}

interface MailMessage {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(title: string, paragraphs: string[], ctaLabel: string, url: string): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px">${escapeHtml(p)}</p>`).join("");
  return `<!doctype html><html lang="pt-BR"><body style="font-family:system-ui,Segoe UI,sans-serif;color:#0f172a;background:#f8fafc;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
<h1 style="font-size:18px;margin:0 0 16px">${escapeHtml(title)}</h1>${body}
<p style="margin:20px 0"><a href="${escapeHtml(url)}" style="background:#b45309;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block">${escapeHtml(ctaLabel)}</a></p>
<p style="margin:0;font-size:12px;color:#475569">Se o botão não funcionar, copie este endereço no navegador:<br>${escapeHtml(url)}</p>
</div><p style="text-align:center;font-size:11px;color:#64748b">Akylla Gestão</p></body></html>`;
}

export function passwordResetMessage(resetUrl: string): MailMessage {
  const lines = [
    "Recebemos um pedido para redefinir a senha da sua conta no Akylla Gestão.",
    "O link vale por 1 hora e só pode ser usado uma vez. Se não foi você, ignore este e-mail: sua senha continua a mesma.",
  ];
  return {
    subject: "Redefinição de senha — Akylla Gestão",
    text: `${lines.join("\n\n")}\n\nRedefinir senha: ${resetUrl}`,
    html: layout("Redefinir senha", lines, "Redefinir senha", resetUrl),
  };
}

export function emailVerificationMessage(name: string, verifyUrl: string): MailMessage {
  const lines = [
    `Olá, ${name}!`,
    "Falta só confirmar seu e-mail para ativar a sua empresa no Akylla Gestão.",
    `O link vale por ${env.EMAIL_VERIFICATION_TTL_HOURS} horas. Se você não criou esta conta, ignore este e-mail.`,
  ];
  return {
    subject: "Confirme seu e-mail — Akylla Gestão",
    text: `${lines.join("\n\n")}\n\nConfirmar e-mail: ${verifyUrl}`,
    html: layout("Confirme seu e-mail", lines, "Confirmar e-mail", verifyUrl),
  };
}

@Injectable()
export class LogMailProvider implements MailProvider {
  private readonly logger = new Logger(LogMailProvider.name);

  private linkForLog(url: string): string {
    return env.NODE_ENV === "production" ? "[link omitido em produção]" : url;
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    this.logger.log(
      `Redefinição de senha solicitada para ${email} — link (sem envio real): ${this.linkForLog(resetUrl)}`,
    );
  }

  async sendEmailVerification(email: string, _name: string, verifyUrl: string): Promise<void> {
    this.logger.log(
      `Confirmação de e-mail para ${email} — link (sem envio real): ${this.linkForLog(verifyUrl)}`,
    );
  }
}

export class SmtpMailProvider implements MailProvider {
  constructor(
    private readonly transporter: Transporter,
    private readonly from: string,
  ) {}

  private async send(to: string, message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, to, ...message });
  }

  sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    return this.send(email, passwordResetMessage(resetUrl));
  }

  sendEmailVerification(email: string, name: string, verifyUrl: string): Promise<void> {
    return this.send(email, emailVerificationMessage(name, verifyUrl));
  }
}

export function createMailProvider(): MailProvider {
  if (!env.SMTP_HOST) return new LogMailProvider();
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return new SmtpMailProvider(transporter, env.MAIL_FROM);
}

@Global()
@Module({
  providers: [{ provide: MAIL_PROVIDER, useFactory: createMailProvider }],
  exports: [MAIL_PROVIDER],
})
export class MailModule {}
