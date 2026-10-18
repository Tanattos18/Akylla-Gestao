import type { MetadataRoute } from "next";

/**
 * O sistema é área logada: só as páginas públicas (perfis, termos) podem
 * aparecer no Google. O site de divulgação é akyllagestao.com.br.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/para/", "/termos", "/privacidade", "/login"], disallow: "/" }],
  };
}
