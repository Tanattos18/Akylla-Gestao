import type { NextFunction, Request, Response } from "express";

/**
 * Cabeçalhos básicos de segurança (N4 · 1.12). Sem dependências novas:
 * apenas headers que não quebram o frontend (sem CSP por enquanto — o
 * Next.js com inline scripts/styles exige política desenhada à parte).
 */
export function securityHeadersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}
