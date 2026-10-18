import type { NextConfig } from "next";

/**
 * Destino do proxy `/api/*`. Em dev, a API roda em localhost:3001. Em
 * produção (Fase 1 · 1G), a API é outro serviço: defina API_INTERNAL_URL
 * (URL interna/privada da API, sem barra final) no **build** do web — o
 * Next grava os rewrites no manifesto durante o `next build`.
 */
const apiUrl = (process.env.API_INTERNAL_URL || "http://localhost:3001").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
