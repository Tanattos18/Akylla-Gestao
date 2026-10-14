/**
 * Chave de normalização de nome de cliente (anti-duplicidade, Etapa 5):
 * minúsculas, sem espaços nas bordas e espaços colapsados.
 */
export function clientNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
