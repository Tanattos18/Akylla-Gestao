# Componentes e acessibilidade — regras (Fase 5)

> Padrão visual e de acessibilidade do painel. Componentes em
> `apps/web/src/components/ui/`, no estilo do shadcn/ui (copiados para o
> projeto), **sem Radix**: o `<dialog>` nativo já resolve foco, Esc e
> `aria-modal`.

## Componentes

| Componente | Uso | Regras |
|---|---|---|
| `DataTable` | toda listagem (31 telas) | colunas tipadas; `numeric` alinha à direita com algarismos tabulares (moeda sempre `numeric`); `empty`; `totals` (linha de total); `expanded` (linha que abre detalhes); `onRowClick` + `rowLabel` (linha clicável, também por Enter/Espaço); `hidden` (coluna condicional, ex.: Ações só ADMIN); `bare` dentro de cartão; `title`/`caption`. No celular cada linha vira cartão rótulo + valor; na impressão sai sempre como tabela |
| `useDialog()` | `confirm()` e `prompt()` | substituem `window.confirm/prompt` (proibidos). `prompt` valida `minLength`/`maxLength` antes de enviar (ex.: justificativa fiscal 15–255); `danger` para ações destrutivas |
| `useToast()` | retorno de ações | `success(texto)` e `error(err)`; lê `message` e `issues[]` da API (Zod). Erros de formulário continuam junto do campo |
| `Tabs` | `/relatorios`, `/configuracoes` | padrão WAI-ARIA (setas, Home/End) |

`DialogProvider` e `ToastProvider` ficam no `layout.tsx`.

## Cores (`globals.css`)

- Tokens semânticos: `--color-accent`, `--color-danger`, `--color-warning`,
  `--color-info`, `--color-muted`, `--color-border-subtle`,
  `--color-foreground`.
- **Texto só nos tons 700+** (vermelho, verde, âmbar etc.); 500/600 só
  para fundo, borda e ícone grande. Texto cinza sobre branco no mínimo
  `slate-500`; sobre `slate-100`, `slate-700`.
- Botão principal: `bg-primary-700` (contraste 5:1 com branco);
  `bg-primary-600` com texto branco reprova (3,2:1).
- Links dentro de parágrafo são sublinhados (não depender só da cor).

## Acessibilidade

- Foco visível único (`:focus-visible`, contorno `primary-700`) e link
  "Pular para o conteúdo".
- Barra do topo cabe em 1024–1280 px (antes estourava a tela em 1280).
- `npm run test:a11y` (`scripts/a11y.mjs`): abre 36 telas (públicas e
  logadas, com uma empresa de auditoria criada na hora, senha aleatória)
  e roda o axe-core (WCAG 2.1 A/AA). Falha com violação grave ou
  crítica. Roda na CI (job "Acessibilidade"). Localmente, com o navegador
  completo do Playwright: `A11Y_BROWSER_CHANNEL=chromium`.
- Resultado em 2026-10-18: **0 violações** nas 36 telas.

## Impressão

`@media print` esconde barra do topo, menus e botões; comprovante de venda
e OS têm botão "Imprimir". O CNPJ no comprovante entra com o cadastro da
empresa (Fase 7).
