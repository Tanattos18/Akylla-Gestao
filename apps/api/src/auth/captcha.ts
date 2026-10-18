import { BadRequestException, Logger } from "@nestjs/common";
import { env } from "../config/env";

export const CAPTCHA_VERIFIER = "CAPTCHA_VERIFIER";

/**
 * Captcha opcional do cadastro (Fase 1 · 1D). Referência: validação no
 * servidor do Cloudflare Turnstile (upgrade/REFERENCIAS_GIT.md).
 * Sem TURNSTILE_SECRET_KEY → desligado (aceita tudo).
 */
export interface CaptchaVerifier {
  readonly enabled: boolean;
  /** Lança 400 quando o token falta ou é inválido. */
  verify(token: string | undefined, remoteIp: string | undefined): Promise<void>;
}

export class DisabledCaptchaVerifier implements CaptchaVerifier {
  readonly enabled = false;
  async verify(): Promise<void> {
    return;
  }
}

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type FetchLike = (input: string, init: { method: string; body: URLSearchParams; signal: AbortSignal }) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

export class TurnstileCaptchaVerifier implements CaptchaVerifier {
  readonly enabled = true;
  private readonly logger = new Logger(TurnstileCaptchaVerifier.name);

  constructor(
    private readonly secret: string,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {}

  async verify(token: string | undefined, remoteIp: string | undefined): Promise<void> {
    if (!token) {
      throw new BadRequestException("Confirme que você não é um robô.");
    }
    const body = new URLSearchParams({ secret: this.secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);

    let success = false;
    try {
      const response = await this.fetchImpl(TURNSTILE_VERIFY_URL, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(5000),
      });
      const data = (await response.json()) as { success?: boolean };
      success = response.ok && data.success === true;
    } catch (error) {
      // Falha fechada: sem confirmação do Turnstile, o cadastro não passa
      this.logger.warn(`Turnstile indisponível: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!success) {
      throw new BadRequestException("Verificação anti-robô falhou. Recarregue a página e tente de novo.");
    }
  }
}

export function createCaptchaVerifier(): CaptchaVerifier {
  return env.TURNSTILE_SECRET_KEY
    ? new TurnstileCaptchaVerifier(env.TURNSTILE_SECRET_KEY)
    : new DisabledCaptchaVerifier();
}
