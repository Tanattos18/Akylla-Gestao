/**
 * Transformação (2026-10-23): o Akylla passa a controlar clientes e produtos
 * digitais. As telas de loja (PDV, vendas, estoque, fornecedores, crediário,
 * comissões e importações) saem do menu e das rotas, sem apagar código nem
 * dados — a API continua respondendo. Para religar: NEXT_PUBLIC_RETAIL_UI=true
 * no ambiente do build da web.
 */
export const RETAIL_UI_ENABLED = process.env.NEXT_PUBLIC_RETAIL_UI === "true";

/** Rotas de loja bloqueadas quando RETAIL_UI_ENABLED é false. */
export const RETAIL_ROUTES = [
  "/pdv",
  "/vendas",
  "/produtos",
  "/categorias",
  "/fornecedores",
  "/crediario",
  "/comissoes",
  "/profissionais",
  "/importacoes",
] as const;

/**
 * Fora do menu, mas com a rota liberada: renovar um contrato (assinatura)
 * ainda registra o pagamento no caixa aberto.
 */
export const RETAIL_MENU_ONLY_ROUTES = ["/caixa"] as const;

function matches(pathname: string, routes: readonly string[]): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

export function isRetailRoute(pathname: string): boolean {
  return !RETAIL_UI_ENABLED && matches(pathname, RETAIL_ROUTES);
}

export function isRetailMenuItem(href: string): boolean {
  return !RETAIL_UI_ENABLED && matches(href, [...RETAIL_ROUTES, ...RETAIL_MENU_ONLY_ROUTES]);
}
