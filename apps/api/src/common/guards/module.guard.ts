import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { BusinessModule } from "@petflow/shared";
import type { Request } from "express";
import { REQUIRE_MODULE_KEY } from "../decorators/require-module.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AuthContext } from "../decorators/auth.decorator";
import { PrismaService } from "../../prisma/prisma.module";

interface RequestWithAuth extends Request {
  auth?: AuthContext;
}

/**
 * Bloqueia rotas de módulos desativados para a empresa.
 *
 * Ausência de linha em `CompanyModule` = módulo ativo (padrão). Linha com
 * `DISABLED` → 403. Rotas sem `@RequireModule` e rotas `@Public` (ex.:
 * webhook) nunca passam por esta checagem. Ocultação na UI não é controle
 * de acesso — este guard é a fonte de verdade no servidor.
 */
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const module = this.reflector.getAllAndOverride<BusinessModule | undefined>(
      REQUIRE_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!module) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.auth) {
      return true;
    }

    const row = await this.prisma.companyModule.findUnique({
      where: {
        companyId_module: { companyId: request.auth.companyId, module },
      },
      select: { status: true },
    });

    if (row?.status === "DISABLED") {
      throw new ForbiddenException(
        "Módulo desativado para esta empresa. Um administrador pode reativá-lo em Configurações.",
      );
    }

    return true;
  }
}
