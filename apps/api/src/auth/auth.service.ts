import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.module";
import { allowedOrigins, env } from "../config/env";
import { MAIL_PROVIDER, type MailProvider } from "../mail/mail.module";
import {
  PASSWORD_RESET_TOKEN_TTL_MS,
  type ConfirmPasswordResetInput,
  type LoginInput,
  type RegisterInput,
  type RequestPasswordResetInput,
  type ResetPasswordInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

const BCRYPT_ROUNDS = 12;

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

  async login(input: LoginInput, request: Request) {
    const email = input.email;

    const candidates = await this.prisma.user.findMany({
      where: { email, status: "ACTIVE", company: { status: "ACTIVE" } },
      include: { company: true },
    });

    if (candidates.length === 0) {
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

    const token = await this.createSession(user.id, request);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug,
      },
    };
  }

  async register(input: RegisterInput, request: Request) {
    const email = input.email;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({ where: { email } });
      if (existing) {
        throw new ConflictException("Este email já está cadastrado");
      }

      const slug = await this.generateUniqueSlug(tx, input.companyName);
      const company = await tx.company.create({
        data: { name: input.companyName, slug },
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

      return { userId: user.id, user, company };
    }).then(async (created) => {
      const token = await this.createSession(created.userId, request);

      return {
        token,
        user: {
          id: created.user.id,
          name: created.user.name,
          email: created.user.email,
          role: created.user.role,
          status: created.user.status,
        },
        company: {
          id: created.company.id,
          name: created.company.name,
          slug: created.company.slug,
        },
      };
    });
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
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug,
      },
    };
  }
}
