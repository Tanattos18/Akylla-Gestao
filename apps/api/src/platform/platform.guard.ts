import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import type { AuthContext } from "../common/decorators/auth.decorator";
import { env } from "../config/env";
import { PrismaService } from "../prisma/prisma.module";

/**
 * Fase 8: só o dono da plataforma entra em /api/platform/*. Regras:
 * e-mail em PLATFORM_ADMIN_EMAILS (único no sistema), e-mail verificado,
 * empresa dona (PLATFORM_COMPANY_SLUG, quando definido), papel ADMIN e, em
 * produção, 2FA ativo (o painel enxerga todas as empresas). Falha → 403.
 */
@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const auth = request.auth;
    const denied = new ForbiddenException("Acesso restrito ao dono da plataforma");
    if (!auth || auth.role !== "ADMIN" || env.PLATFORM_ADMIN_EMAILS.length === 0) throw denied;

    const user = await this.prisma.user.findFirst({
      where: { id: auth.userId, companyId: auth.companyId },
      select: { email: true, twoFactorEnabled: true, emailVerifiedAt: true, company: { select: { slug: true } } },
    });
    if (!user || !env.PLATFORM_ADMIN_EMAILS.includes(user.email.trim().toLowerCase())) throw denied;
    if (!user.emailVerifiedAt) throw denied;
    if (env.PLATFORM_COMPANY_SLUG && user.company.slug !== env.PLATFORM_COMPANY_SLUG) throw denied;
    if (env.NODE_ENV === "production" && !user.twoFactorEnabled) {
      throw new ForbiddenException("Ative a verificação em duas etapas (Configurações › Segurança) para usar o painel da plataforma");
    }
    (request as Request & { platformAdminEmail?: string }).platformAdminEmail = user.email;
    return true;
  }
}
