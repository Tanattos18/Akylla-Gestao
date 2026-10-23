import type { MetadataRoute } from "next";

/**
 * Aplicativo instalável (PWA): no Windows, o Edge/Chrome oferecem
 * "Instalar Akylla Gestão", que cria ícone no menu Iniciar e abre em
 * janela própria. Os dados continuam no servidor.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Akylla Gestão",
    short_name: "Akylla",
    description: "Controle de clientes e serviços digitais: entregas, contratos, financeiro, agenda e WhatsApp.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Clientes", url: "/clientes", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Entregas", url: "/entregas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Contratos", url: "/assinaturas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Agenda", url: "/agenda", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
