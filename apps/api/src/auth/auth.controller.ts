import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Ip,
  NotFoundException,
  Post,
  Get,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  requestPasswordResetSchema,
  confirmPasswordResetSchema,
  enableTwoFactorSchema,
  verifyTwoFactorSchema,
  disableTwoFactorSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  type RegisterPendingResponse,
  type ResendVerificationInput,
  type VerifyEmailInput,
  type ConfirmPasswordResetInput,
  type DisableTwoFactorInput,
  type EnableTwoFactorInput,
  type LoginInput,
  type MeResponse,
  type RegisterInput,
  type RequestPasswordResetInput,
  type ResetPasswordInput,
  type VerifyTwoFactorInput,
  changePasswordSchema,
  type ChangePasswordInput,
} from "@petflow/shared";
import { Public } from "../common/decorators/public.decorator";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { env } from "../config/env";
import { AuthService } from "./auth.service";
import { LoginRateLimiter, RegisterRateLimiter } from "./login-rate-limit";
import { CAPTCHA_VERIFIER, type CaptchaVerifier } from "./captcha";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(LoginRateLimiter) private readonly rateLimiter: LoginRateLimiter,
    @Inject(RegisterRateLimiter) private readonly registerLimiter: RegisterRateLimiter,
    @Inject(CAPTCHA_VERIFIER) private readonly captcha: CaptchaVerifier,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Ip() ip: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rateKey = `${ip}|${body.email}`;
    await this.rateLimiter.check(rateKey);

    const result = await this.authService.login(body, request);
    await this.rateLimiter.reset(rateKey);

    if ("requiresTwoFactor" in result) {
      response.status(202);
      return result;
    }

    this.authService.setSessionCookie(response, result.token);

    return { user: result.user, company: result.company } satisfies MeResponse;
  }

  @Public()
  @Post("register")
  @HttpCode(201)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Ip() ip: string,
  ) {
    if (!env.REGISTRATION_ENABLED) {
      throw new NotFoundException("Recurso indisponível");
    }

    // Fase 1 · 1D: conta TODOS os cadastros do IP (não zera no sucesso) —
    // REGISTER_RATE_LIMIT_MAX por janela (produção: 3/hora)
    const rateKey = `register|${ip}`;
    await this.registerLimiter.check(rateKey);
    await this.captcha.verify(body.captchaToken, ip);

    const result = await this.authService.register(body);
    return { status: "PENDING_VERIFICATION", email: result.email } satisfies RegisterPendingResponse;
  }

  @Public()
  @Post("verify-email")
  @HttpCode(200)
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput,
    @Ip() ip: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Tentativas com link inválido contam; a confirmação válida zera
    const rateKey = `verify-email|${ip}`;
    await this.rateLimiter.check(rateKey);
    const result = await this.authService.verifyEmail(body, request);
    await this.rateLimiter.reset(rateKey);
    this.authService.setSessionCookie(response, result.token);
    return { user: result.user, company: result.company } satisfies MeResponse;
  }

  @Public()
  @Post("resend-verification")
  @HttpCode(200)
  async resendVerification(
    @Body(new ZodValidationPipe(resendVerificationSchema)) body: ResendVerificationInput,
    @Ip() ip: string,
  ) {
    if (!env.REGISTRATION_ENABLED) {
      throw new NotFoundException("Recurso indisponível");
    }
    await this.registerLimiter.check(`resend|${ip}|${body.email}`);
    await this.authService.resendEmailVerification(body);
    // Resposta idêntica exista ou não a conta
    return { ok: true };
  }

  @Public()
  @Post("reset-password")
  @HttpCode(200)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
    @Ip() ip: string,
  ) {
    if (!env.PASSWORD_RESET_ENABLED) {
      throw new NotFoundException("Recurso indisponível");
    }

    const rateKey = `reset|${ip}|${body.email}`;
    await this.rateLimiter.check(rateKey);
    await this.authService.resetPassword(body);
    await this.rateLimiter.reset(rateKey);

    return { ok: true };
  }

  @Public()
  @Post("request-password-reset")
  @HttpCode(200)
  async requestPasswordReset(
    @Body(new ZodValidationPipe(requestPasswordResetSchema))
    body: RequestPasswordResetInput,
    @Ip() ip: string,
  ) {
    const rateKey = `request-reset|${ip}|${body.email}`;
    await this.rateLimiter.check(rateKey);
    await this.authService.requestPasswordReset(body);
    await this.rateLimiter.reset(rateKey);

    return { ok: true };
  }

  @Public()
  @Post("confirm-password-reset")
  @HttpCode(200)
  async confirmPasswordReset(
    @Body(new ZodValidationPipe(confirmPasswordResetSchema))
    body: ConfirmPasswordResetInput,
    @Ip() ip: string,
  ) {
    const rateKey = `confirm-reset|${ip}`;
    await this.rateLimiter.check(rateKey);
    await this.authService.confirmPasswordReset(body);
    await this.rateLimiter.reset(rateKey);

    return { ok: true };
  }

  @Post("2fa/setup")
  @HttpCode(200)
  setupTwoFactor(@Auth() auth: AuthContext) {
    return this.authService.setupTwoFactor(auth);
  }

  @Post("2fa/enable")
  @HttpCode(200)
  async enableTwoFactor(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(enableTwoFactorSchema)) body: EnableTwoFactorInput,
  ) {
    await this.authService.enableTwoFactor(auth, body);
    return { ok: true };
  }

  @Post("2fa/disable")
  @HttpCode(200)
  async disableTwoFactor(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(disableTwoFactorSchema)) body: DisableTwoFactorInput,
  ) {
    await this.authService.disableTwoFactor(auth, body);
    return { ok: true };
  }

  @Public()
  @Post("2fa/verify")
  @HttpCode(200)
  async verifyTwoFactor(
    @Body(new ZodValidationPipe(verifyTwoFactorSchema)) body: VerifyTwoFactorInput,
    @Ip() ip: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rateKey = `2fa|${ip}|${body.challengeId}`;
    await this.rateLimiter.check(rateKey);

    const result = await this.authService.verifyTwoFactorChallenge(body, request);
    this.authService.setSessionCookie(response, result.token);

    return { user: result.user, company: result.company } satisfies MeResponse;
  }

  /** Fase 8: trocar a própria senha (encerra as outras sessões). */
  @Post("change-password")
  @HttpCode(200)
  async changePassword(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
  ) {
    const rateKey = `change-password|${auth.userId}`;
    await this.rateLimiter.check(rateKey);
    await this.authService.changePassword(auth, body);
    await this.rateLimiter.reset(rateKey);
    return { ok: true };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(
    @Auth() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(auth, response);
    return { ok: true };
  }

  @Get("me")
  async me(@Auth() auth: AuthContext): Promise<MeResponse> {
    return this.authService.me(auth);
  }
}
