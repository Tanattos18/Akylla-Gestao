import type { NextConfig } from "next";

/**
 * Destino do proxy `/api/*`. Em dev, a API roda em localhost:3001. Em
 * produção (Fase 1 · 1G), a API é outro serviço: defina API_INTERNAL_URL
 * (URL interna/privada da API, sem barra final) no **build** do web — o
 * Next grava os rewrites no manifesto durante o `next build`.
 */
const apiUrl = (process.env.API_INTERNAL_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");

/**
 * Cabeçalhos de segurança das páginas (auditoria pós-Fase 8). A política de
 * conteúdo (CSP) só vale no build de produção: o modo dev do Next usa eval.
 * Liberados: Sentry (erros do navegador) e Cloudflare Turnstile (captcha).
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.sentry.io",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: csp }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Não anunciar a tecnologia do servidor (X-Powered-By)
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  transpilePackages: ["@petflow/shared"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
