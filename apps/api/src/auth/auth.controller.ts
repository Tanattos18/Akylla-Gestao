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
  type ConfirmPasswordResetInput,
  type DisableTwoFactorInput,
  type EnableTwoFactorInput,
  type LoginInput,
  type MeResponse,
  type RegisterInput,
  type RequestPasswordResetInput,
  type ResetPasswordInput,
  type VerifyTwoFactorInput,
} from "@petflow/shared";
import { Public } from "../common/decorators/public.decorator";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { env } from "../config/env";
import { AuthService } from "./auth.service";
import { LoginRateLimiter, RegisterRateLimiter } from "./login-rate-limit";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(LoginRateLimiter) private readonly rateLimiter: LoginRateLimiter,
    @Inject(RegisterRateLimiter) private readonly registerLimiter: RegisterRateLimiter,
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
    this.rateLimiter.check(rateKey);

    const result = await this.authService.login(body, request);
    this.rateLimiter.reset(rateKey);

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
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!env.REGISTRATION_ENABLED) {
      throw new NotFoundException("Recurso indisponível");
    }

    const rateKey = `register|${ip}`;
    this.registerLimiter.check(rateKey);

    const result = await this.authService.register(body, request);
    this.registerLimiter.reset(rateKey);
    this.authService.setSessionCookie(response, result.token);

    return { user: result.user, company: result.company } satisfies MeResponse;
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
    this.rateLimiter.check(rateKey);
    await this.authService.resetPassword(body);
    this.rateLimiter.reset(rateKey);

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
    this.rateLimiter.check(rateKey);
    await this.authService.requestPasswordReset(body);
    this.rateLimiter.reset(rateKey);

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
    this.rateLimiter.check(rateKey);
    await this.authService.confirmPasswordReset(body);
    this.rateLimiter.reset(rateKey);

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
    this.rateLimiter.check(rateKey);

    const result = await this.authService.verifyTwoFactorChallenge(body, request);
    this.authService.setSessionCookie(response, result.token);

    return { user: result.user, company: result.company } satisfies MeResponse;
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
