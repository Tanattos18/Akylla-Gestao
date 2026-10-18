import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AuthContext } from "../decorators/auth.decorator";
import { AccessService } from "../../billing/access";

interface RequestWithAuth extends Request {
  auth?: AuthContext;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Caminhos que continuam liberados mesmo em somente leitura: sair, trocar
 * senha/2FA, regularizar o pagamento, exportar dados (LGPD/portabilidade)
 * e o painel do dono da plataforma.
 */
const ALLOWED_PREFIXES = [
  "/api/auth/",
  "/api/billing/",
  "/api/platform/",
  "/api/company/export",
  "/api/lgpd/",
  "/api/webhooks/",
];

/**
 * Fase 8: empresa em SOMENTE LEITURA (venceu há mais de 5 dias) pode
 * consultar tudo, mas qualquer alteração responde 402 com código
 * `SUBSCRIPTION_READ_ONLY`. Os dados nunca são apagados.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.auth || SAFE_METHODS.has(request.method)) return true;
    const path = (request.originalUrl ?? request.url).split("?")[0] ?? "";
    if (ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;

    const summary = await this.access.getAccess(request.auth.companyId);
    if (!summary.readOnly) return true;

    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: "SUBSCRIPTION_READ_ONLY",
        message:
          "Sua assinatura venceu e o sistema está em modo somente leitura. Regularize em Faturamento para voltar a registrar.",
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
