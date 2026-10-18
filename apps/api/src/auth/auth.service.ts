import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { generateSecret, generateURI, verify } from "otplib";
import { PrismaService } from "../prisma/prisma.module";
import { allowedOrigins, env } from "../config/env";
import { MAIL_PROVIDER, type MailProvider } from "../mail/mail.module";
import {
  EMAIL_NOT_VERIFIED_CODE,
  PASSWORD_RESET_TOKEN_TTL_MS,
  type ResendVerificationInput,
  type VerifyEmailInput,
  type ChangePasswordInput,
  type ConfirmPasswordResetInput,
  type DisableTwoFactorInput,
  type EnableTwoFactorInput,
  type LoginInput,
  type RegisterInput,
  type RequestPasswordResetInput,
  type ResetPasswordInput,
  type TwoFactorSetupDto,
  type VerifyTwoFactorInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

const BCRYPT_ROUNDS = 12;

/** Desafio 2FA pendente: expira em 5 minutos; falhar = refazer o login. */
const TWO_FACTOR_CHALLENGE_TTL_MS = 5 * 60 * 1000;

interface TwoFactorChallenge {
  userId: string;
  expiresAt: number;
}

/** Fase 8: dono da plataforma (e-mail em PLATFORM_ADMIN_EMAILS). */
export function isPlatformAdmin(email: string): boolean {
  return env.PLATFORM_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
  ) {}

  private readonly twoFactorChallenges = new Map<string, TwoFactorChallenge>();

  private takeChallenge(challengeId: string): TwoFactorChallenge | null {
    const challenge = this.twoFactorChallenges.get(challengeId);
    if (challenge) {
      this.twoFactorChallenges.delete(challengeId);
    }
    if (!challenge || challenge.expiresAt <= Date.now()) {
      return null;
    }
    return challenge;
  }

  async login(input: LoginInput, request: Request) {
    const email = input.email;

    const candidates = await this.prisma.user.findMany({
      where: { email, status: "ACTIVE", company: { status: "ACTIVE" } },
      include: { company: true },
    });

    if (candidates.length === 0) {
      await this.rejectIfPendingVerification(input);
      throw new UnauthorizedException("Credenciais inválidas");
    }

    if (candidates.length > 1) {
      throw new UnauthorizedException(
        "Este email está associado a mais de uma conta. Contate o suporte.",
      );
    }

    const user = candidates[0];
    const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const challengeId = randomBytes(16).toString("base64url");
      this.twoFactorChallenges.set(challengeId, {
        userId: user.id,
        expiresAt: Date.now() + TWO_FACTOR_CHALLENGE_TTL_MS,
      });
      return { requiresTwoFactor: true as const, challengeId };
    }

    const token = await this.createSession(user.id, request);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        isPlatformAdmin: isPlatformAdmin(user.email),
        twoFactorEnabled: user.twoFactorEnabled,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug,
        document: user.company.document,
        phone: user.company.phone,
        address: user.company.address,
      },
    };
  }

  /**
   * Cadastro aberto (Fase 1 · 1D): cria a empresa em `PENDING_VERIFICATION`
   * + administrador + aceites e envia o link de confirmação. Não abre
   * sessão: o login e o AuthGuard exigem empresa `ACTIVE`, então nada é
   * acessível até `verifyEmail`. Retorna o token bruto só para o chamador
   * interno (testes); o controller o descarta.
   */
  async register(input: RegisterInput): Promise<{ email: string; verificationToken: string }> {
    const email = input.email;

    const created = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({ where: { email } });
      if (existing) {
        throw new ConflictException("Este email já está cadastrado");
      }

      const slug = await this.generateUniqueSlug(tx, input.companyName);
      const company = await tx.company.create({
        data: {
          name: input.companyName,
          slug,
          status: "PENDING_VERIFICATION",
          // Fase 8: teste grátis a partir do cadastro (0 = sem teste)
          trialEndsAt: new Date(Date.now() + env.TRIAL_DAYS * 86_400_000),
        },
      });

      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
      const user = await tx.user.create({
        data: {
          companyId: company.id,
          name: input.name,
          email,
          passwordHash,
          role: "ADMIN",
        },
      });

      await tx.legalConsent.createMany({
        data: [
          {
            companyId: company.id,
            userId: user.id,
            role: "USER",
            type: "TERMS",
            version: input.termsVersion,
          },
          {
            companyId: company.id,
            userId: user.id,
            role: "USER",
            type: "PRIVACY",
            version: input.termsVersion,
          },
        ],
      });

      return user;
    });

    const verificationToken = await this.issueEmailVerification(created.id, created.email, created.name);
    return { email: created.email, verificationToken };
  }

  /** Gera um token novo (invalida os anteriores) e envia o link. */
  private async issueEmailVerification(userId: string, email: string, name: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt: new Date(now.getTime() + env.EMAIL_VERIFICATION_TTL_HOURS * 3600_000),
        },
      }),
    ]);

    const base = allowedOrigins[0] ?? "http://localhost:3000";
    await this.mail.sendEmailVerification(email, name, `${base}/confirmar-email?token=${token}`);
    return token;
  }

  /**
   * Confirma o e-mail (uso único, com expiração): ativa a empresa, marca o
   * e-mail como confirmado e abre a sessão. O token é consumido com
   * `updateMany` condicional: dois cliques simultâneos não ativam duas vezes.
   */
  async verifyEmail(input: VerifyEmailInput, request: Request) {
    const tokenHash = createHash("sha256").update(input.token).digest("hex");
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("Link de confirmação inválido ou expirado");
    }

    const user = await this.prisma.user.findFirst({
      where: { id: record.userId, status: "ACTIVE" },
      include: { company: true },
    });
    if (!user || user.company.status === "INACTIVE") {
      throw new BadRequestException("Link de confirmação inválido ou expirado");
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const used = await tx.emailVerificationToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: now },
      });
      if (used.count === 0) {
        throw new BadRequestException("Link de confirmação inválido ou expirado");
      }
      await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
      await tx.company.updateMany({
        where: { id: user.companyId, status: "PENDING_VERIFICATION" },
        data: { status: "ACTIVE" },
      });
    });

    const token = await this.createSession(user.id, request);
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        isPlatformAdmin: isPlatformAdmin(user.email),
        twoFactorEnabled: user.twoFactorEnabled,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug,
        document: user.company.document,
        phone: user.company.phone,
        address: user.company.address,
      },
    };
  }

  /**
   * Reenvia o link. Nunca revela se o e-mail existe ou se já foi
   * confirmado: a resposta HTTP é sempre a mesma.
   */
  async resendEmailVerification(input: ResendVerificationInput): Promise<{ token: string | null }> {
    const user = await this.prisma.user.findFirst({
      where: { email: input.email, status: "ACTIVE", company: { status: "PENDING_VERIFICATION" } },
      select: { id: true, email: true, name: true },
    });
    if (!user) return { token: null };
    const token = await this.issueEmailVerification(user.id, user.email, user.name);
    return { token };
  }

  /**
   * Login de conta ainda não confirmada: com a senha certa, responde 403 com
   * código próprio (a tela oferece reenviar o link). Senha errada segue como
   * "Credenciais inválidas" para não revelar contas.
   */
  private async rejectIfPendingVerification(input: LoginInput): Promise<void> {
    const pending = await this.prisma.user.findFirst({
      where: { email: input.email, status: "ACTIVE", company: { status: "PENDING_VERIFICATION" } },
      select: { passwordHash: true },
    });
    if (pending && (await bcrypt.compare(input.password, pending.passwordHash))) {
      throw new ForbiddenException({
        message: "Confirme seu e-mail para ativar a conta. Enviamos um link no cadastro.",
        code: EMAIL_NOT_VERIFIED_CODE,
      });
    }
  }

  private async generateUniqueSlug(
    tx: Pick<PrismaService, "company">,
    companyName: string,
  ): Promise<string> {
    const base = slugify(companyName) || "empresa";
    let candidate = base;

    for (let suffix = 2; suffix < 1000; suffix += 1) {
      const taken = await tx.company.findUnique({ where: { slug: candidate } });
      if (!taken) return candidate;
      candidate = `${base}-${suffix}`;
    }

    return `${base}-${Date.now()}`;
  }

  private async createSession(userId: string, request: Request): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = new Date();

    await this.prisma.session.create({
      data: {
        tokenHash,
        userId,
        expiresAt: new Date(now.getTime() + env.AUTH_SESSION_TTL_HOURS * 3600_000),
        ip: request.ip ?? null,
        userAgent: (request.headers["user-agent"] ?? null)?.slice(0, 300) ?? null,
      },
    });

    await this.prisma.session.deleteMany({
      where: {
        userId,
        expiresAt: { lt: new Date(Date.now() - 30 * 24 * 3600_000) },
      },
    });

    return token;
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const candidates = await this.prisma.user.findMany({
      where: {
        email: input.email,
        status: "ACTIVE",
        company: { status: "ACTIVE" },
      },
    });

    if (candidates.length === 0) {
      throw new NotFoundException("Usuário não encontrado");
    }

    if (candidates.length > 1) {
      throw new BadRequestException(
        "Este email está associado a mais de uma conta. Contate o suporte.",
      );
    }

    const user = candidates[0];
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  /**
   * Solicita redefinição por token de e-mail (N4 · 1.5). Nunca revela se o
   * e-mail existe: responde da mesma forma nos dois casos. Retorna o token
   * bruto para o chamador interno (testes); o controller o descarta e o
   * envio real passa pelo `MailProvider`.
   */
  async requestPasswordReset(input: RequestPasswordResetInput): Promise<{ token: string | null }> {
    const user = await this.prisma.user.findFirst({
      where: { email: input.email, status: "ACTIVE", company: { status: "ACTIVE" } },
      select: { id: true, email: true },
    });

    if (!user) {
      return { token: null };
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
      },
    });

    const base = allowedOrigins[0] ?? "http://localhost:3000";
    await this.mail.sendPasswordReset(
      user.email,
      `${base}/redefinir-senha?token=${token}`,
    );

    return { token };
  }

  /**
   * Confirma a redefinição com token de uso único: valida hash, expiração e
   * uso anterior; troca a senha, revoga sessões e marca o token como usado.
   */
  async confirmPasswordReset(input: ConfirmPasswordResetInput): Promise<void> {
    const tokenHash = createHash("sha256").update(input.token).digest("hex");

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("Token inválido ou expirado");
    }

    const user = await this.prisma.user.findFirst({
      where: { id: record.userId, status: "ACTIVE", company: { status: "ACTIVE" } },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException("Token inválido ou expirado");
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  /**
   * Segundo fator TOTP (N4 · 1.7): restrito a ADMIN. `setup` gera o segredo
   * (exibido uma vez via QR); `enable` ativa após prova de posse; o login
   * passa a exigir o desafio; `disable` exige a senha atual.
   */
  async setupTwoFactor(auth: AuthContext): Promise<TwoFactorSetupDto> {
    if (auth.role !== "ADMIN") {
      throw new ForbiddenException("Segundo fator disponível apenas para administradores");
    }

    const secret = generateSecret();
    await this.prisma.user.update({
      where: { id: auth.userId },
      data: { twoFactorSecret: secret, twoFactorEnabled: false },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: { email: true },
    });
    return {
      secret,
      otpauthUrl: generateURI({ issuer: "Akylla Gestão", label: user.email, secret }),
    };
  }

  async enableTwoFactor(auth: AuthContext, input: EnableTwoFactorInput): Promise<void> {
    if (auth.role !== "ADMIN") {
      throw new ForbiddenException("Segundo fator disponível apenas para administradores");
    }

    const user = await this.prisma.user.findFirst({
      where: { id: auth.userId, companyId: auth.companyId },
      select: { twoFactorSecret: true },
    });
    if (!user?.twoFactorSecret) {
      throw new BadRequestException("Gere o segredo antes de ativar (setup)");
    }
    const checked = await verify({ secret: user.twoFactorSecret, token: input.token });
    if (!checked.valid) {
      throw new UnauthorizedException("Código inválido");
    }

    await this.prisma.user.update({
      where: { id: auth.userId },
      data: { twoFactorEnabled: true },
    });
  }

  async disableTwoFactor(auth: AuthContext, input: DisableTwoFactorInput): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: auth.userId, companyId: auth.companyId },
      select: { passwordHash: true },
    });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException("Senha inválida");
    }

    await this.prisma.user.update({
      where: { id: auth.userId },
      data: { twoFactorSecret: null, twoFactorEnabled: false },
    });
  }

  async verifyTwoFactorChallenge(input: VerifyTwoFactorInput, request: Request) {
    const challenge = this.takeChallenge(input.challengeId);
    if (!challenge) {
      throw new UnauthorizedException("Desafio expirado ou inválido — refaça o login");
    }

    const user = await this.prisma.user.findFirst({
      where: { id: challenge.userId, status: "ACTIVE", company: { status: "ACTIVE" } },
      include: { company: true },
    });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException("Desafio expirado ou inválido — refaça o login");
    }
    const checked = await verify({ secret: user.twoFactorSecret, token: input.token });
    if (!checked.valid) {
      throw new UnauthorizedException("Código inválido");
    }

    const token = await this.createSession(user.id, request);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        isPlatformAdmin: isPlatformAdmin(user.email),
        twoFactorEnabled: user.twoFactorEnabled,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug,
        document: user.company.document,
        phone: user.company.phone,
        address: user.company.address,
      },
    };
  }

  setSessionCookie(
    res: {
      cookie: (name: string, value: string, options: object) => void;
    },
    token: string,
  ) {
    res.cookie(env.AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.AUTH_COOKIE_SECURE,
      path: "/",
      maxAge: env.AUTH_SESSION_TTL_HOURS * 3600_000,
    });
  }

  /**
   * Troca a própria senha (Fase 8): confere a senha atual, grava o novo hash
   * e encerra as OUTRAS sessões do usuário (a atual continua).
   */
  async changePassword(auth: AuthContext, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: auth.userId, companyId: auth.companyId },
      select: { id: true, passwordHash: true },
    });
    if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      throw new BadRequestException("Senha atual incorreta");
    }
    if (input.currentPassword === input.newPassword) {
      throw new BadRequestException("A nova senha precisa ser diferente da atual");
    }
    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null, id: { not: auth.sessionId } },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async logout(
    auth: AuthContext,
    res: { clearCookie: (name: string, options: object) => void },
  ) {
    await this.prisma.session.updateMany({
      where: { id: auth.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.clearCookie(env.AUTH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.AUTH_COOKIE_SECURE,
      path: "/",
    });
  }

  async me(auth: AuthContext) {
    const user = await this.prisma.user.findFirst({
      where: { id: auth.userId, companyId: auth.companyId },
      include: { company: true },
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Sessão inválida ou expirada");
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        isPlatformAdmin: isPlatformAdmin(user.email),
        twoFactorEnabled: user.twoFactorEnabled,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug,
        document: user.company.document,
        phone: user.company.phone,
        address: user.company.address,
      },
    };
  }
}
