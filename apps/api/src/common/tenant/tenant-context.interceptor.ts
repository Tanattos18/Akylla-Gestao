import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { Observable } from "rxjs";
import { TenantContext } from "./tenant-context.service";
import type { AuthContext } from "../decorators/auth.decorator";

interface RequestWithAuth extends Request {
  auth?: AuthContext;
}

/**
 * Envolve a execução do handler no contexto de tenant (N4 · 1.4).
 * Executa após o AuthGuard, então `request.auth` já está presente.
 * Rotas públicas (sem `request.auth`) ficam sem contexto — transparente.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  // @Inject explícito: o runtime (tsx/esbuild) não emite
  // emitDecoratorMetadata — sem ele o Nest resolve undefined.
  constructor(@Inject(TenantContext) private readonly tenantContext: TenantContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const auth = request.auth;

    if (!auth) {
      return next.handle();
    }

    return new Observable<unknown>((subscriber) => {
      this.tenantContext.run(
        { companyId: auth.companyId, userId: auth.userId },
        () => {
          const subscription = next.handle().subscribe(subscriber);
          return () => subscription.unsubscribe();
        },
      );
    });
  }
}
