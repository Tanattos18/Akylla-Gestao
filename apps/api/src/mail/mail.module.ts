import { Global, Injectable, Logger, Module } from "@nestjs/common";

export const MAIL_PROVIDER = "MAIL_PROVIDER";

/**
 * Provedor de e-mail transacional atrás de interface (N4 · 1.5).
 * Hoje: log (nenhum envio real). Produção: implementar com SMTP/SES/
 * Resend e trocar o provider — nenhum chamador muda.
 */
export interface MailProvider {
  sendPasswordReset(email: string, resetUrl: string): Promise<void>;
}

@Injectable()
export class LogMailProvider implements MailProvider {
  private readonly logger = new Logger(LogMailProvider.name);

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    this.logger.log(
      `Redefinição de senha solicitada para ${email} — link (sem envio real): ${resetUrl}`,
    );
  }
}

@Global()
@Module({
  providers: [{ provide: MAIL_PROVIDER, useClass: LogMailProvider }],
  exports: [MAIL_PROVIDER],
})
export class MailModule {}
