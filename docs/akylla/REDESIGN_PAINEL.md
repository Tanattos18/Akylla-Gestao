# Redesign do painel — Akylla Gestão

> **Status: IMPLEMENTADO.** Design tokens, componentes de UI e dashboard
> entregues na fase 1 (R1–R6). Layout de navegação evoluiu para a
> **opção B — topbar única** (ver §13).

---

## 1. Estado atual (layout B)

A navegação do painel usa **topbar escura única, sem sidebar**
(`components/shell/Header.tsx` + `AppShell.tsx`; `Sidebar.tsx`
removido):

```
┌──────────────────────────────────────────────────────────────┐
│ [a] Akylla  Início  Dashboard  Operação▾ Estoque▾ …  🔍 🔔 👤│ ← topbar slate-900
├──────────────────────────────────────────────────────────────┤
│ Akylla › Dashboard                                           │ ← breadcrumb fino
├──────────────────────────────────────────────────────────────┤
│              Conteúdo (max-w-[1440px], full-width)           │
└──────────────────────────────────────────────────────────────┘
```

| Elemento | Comportamento |
|---|---|
| Dropdowns | 5 grupos (Operação, Estoque, Relacionamento, Gestão, Administração), filtrados por `CompanyModule` e perfil ADMIN |
| Busca global | Clientes, produtos, pets, serviços e vendas |
| Sino | Estoque baixo + contas vencidas (recarrega ao abrir) |
| Perfil | Dados, faturamento, trocar empresa, sair |
| Mobile `<768px` | Hambúrguer abre painel acordeão com os mesmos grupos |
| Conteúdo | Full-width centralizado em `max-w-[1440px]` (sem padding lateral de sidebar) |

> **Nota histórica:** as seções §2–§10 descrevem a proposta original
> com **sidebar lateral fixa** (fase de design, nunca publicada como
> estado final). O shell entregue na fase 1 usou sidebar recolhível;
> o proprietário escolheu depois a **opção B (topbar)**, que é o
> estado vigente. Tokens, componentes de UI e dashboard continuam
> válidos. Seções §2–§11 = proposta original; §12 = decisões; §13 =
> evolução para o layout atual.

---

## 2. Diagnóstico do estado atual (quando da proposta)

| Aspecto | Hoje | Problema |
|---|---|---|
| Layout | Topbar simples + conteúdo centralizado `max-w-5xl` | Sem navegação persistente; usuário depende dos botões da home |
| Sidebar | **Inexistente** | Cada página é uma ilha; voltar exige link "Início" avulso |
| Header | Só branding textual ("Akylla Gestão") | Sem breadcrumb, sem data, sem avatar, sem logout visível |
| Navegação | Links na home + pontuais | 21 páginas sem menu lateral; descoberta difícil |
| Componentes | `inputClass`, botões e `StatCard` duplicados em ~40 arquivos | Sem design system; manutenção proporcional ao número de páginas |
| Tipografia | Stack do sistema (`ui-sans-serif`) | Sem fonte customizada; inconsistente entre S.O. |
| Cores | Teal + Slate inline em cada componente | Trocar marca exige grep em ~40 arquivos; sem tokens |
| Gráficos | Divs CSS (barras) | Funcional, mas sem interação (hover, tooltip) |
| Encoding | `FinancialEntries.tsx` com acentos quebrados | "NÃ£o foi possÃ­vel" — bug de encoding UTF-8 |

---

## 3. Layout proposto (referência visual — sidebar)

```
┌─────────────┬──────────────────────────────────────────────────┐
│             │  Header: breadcrumb · data · avatar              │
│   SIDEBAR   ├──────────────────────────────────────────────────┤
│   (fixa)    │                                                  │
│             │  Conteúdo da página                              │
│  Logo       │  (KPIs, tabelas, formulários, etc.)              │
│  Empresa    │                                                  │
│  Nav        │                                                  │
│  Ajuda      │                                                  │
│  Usuário    │                                                  │
└─────────────┴──────────────────────────────────────────────────┘
```

### 3.1 Sidebar (esquerda, fixa, largura 260px)

- **Fundo escuro** (`#111827` / slate-900 ou `#0f172a`).
- **Topo**: logo Akylla (ícone + wordmark) + seletor de empresa
  (avatar com iniciais + nome + chevron; menu futuro para trocar empresa).
- **Navegação**: itens com ícone + label, agrupados:
  - **Principal**: Visão geral (dashboard), Clientes, Produtos, Estoque,
    Vendas/PDV, Caixa, Financeiro.
  - **Operação**: Agenda, Serviços, WhatsApp, Assinaturas.
  - **Administração**: Usuários, Faturamento, Relatórios.
- Item ativo: fundo sutil (`bg-white/10`) + indicador lateral
  (barra `bg-amber-500` de 3px) + texto `text-white`.
- Item inativo: `text-slate-400 hover:text-white hover:bg-white/5`.
- **Módulos desabilitados** (`CompanyModule` = DISABLED): item oculto
  ou desabilitado com opacity-40 + tooltip "Módulo desativado".
- **Rodapé da sidebar**:
  - Card "Precisa de ajuda?" (fundo `bg-white/5`, ícone de suporte,
    link "Fale com a gente" → WhatsApp ou mailto).
  - Linha do usuário: avatar circular com iniciais, nome, papel
    (Proprietário/Membro), botão sair (ícone de logout).

### 3.2 Header (topo da área de conteúdo)

- Fundo `bg-white` com `border-b border-slate-200`.
- **Esquerda**: breadcrumb (`Minha empresa > Visão geral`) com
  separador `›` e último item em `text-slate-900 font-medium`.
- **Direita**: data por extenso ("Segunda-feira, 12 de Outubro") +
  avatar do usuário (círculo com iniciais, fundo `bg-amber-100`,
  texto `text-amber-800`).

### 3.3 Conteúdo (área principal)

- Fundo `bg-slate-50` (consistente com `--background` atual).
- Padding interno generoso (`px-8 py-8`).
- Título de página com **overline sutil** (ex.: "SEU NEGÓCIO EM UM OLHAR"
  em `text-[11px] uppercase tracking-widest text-slate-400`) + título
  grande (`text-3xl font-semibold text-slate-900`) + saudação
  contextual ("Olá, vamos cuidar do que importa").

---

## 4. Dashboard (Visão geral) — redesign

A página `/dashboard` (hoje: 6 StatCards + 2 gráficos CSS) passa a
seguir a estrutura abaixo:

### 4.1 Linha de KPIs (4 cards)

| Card | Valor | Ícone | Cor do ícone |
|---|---|---|---|
| Vendas registradas | Total líquido do período (BRL) | seta ↗ | `text-violet-600 bg-violet-50` |
| A receber | Soma de `FinancialEntry` PENDING/AR | seta ↙ | `text-amber-600 bg-amber-50` |
| A pagar | Soma de `FinancialEntry` PENDING/AP | seta ↗ | `text-red-500 bg-red-50` |
| Saldo financeiro | Caixa líquido (inCash) | pulse/wave | `text-teal-600 bg-teal-50` |

Cada card:
- Fundo `bg-white`, `rounded-xl border border-slate-200 p-5`, `shadow-sm`.
- Ícone em círculo de 40px no canto superior direito.
- Label em `text-sm text-slate-500`.
- Valor grande em `text-2xl font-semibold text-slate-900`.
- Subtexto em `text-xs text-slate-400` (ex.: "Nenhum lançamento ativo").

### 4.2 Gráfico de atividade + widgets laterais

Layout em 2 colunas (`lg:grid-cols-3`):

**Coluna esquerda (2/3)** — "Atividade da empresa":
- Gráfico de linha/barras dos últimos meses (vendas × despesas).
- Sem dados: estado vazio centralizado com ícone, título
  "Ainda não há atividade" e texto explicativo.
- Rodapé: "Valores baseados nos registros da sua empresa" + período.

**Coluna direita (1/3)** — 2 widgets empilhados:
- **Catálogo**: total de produtos + link "Ver produtos →".
- **Estoque atenção**: contagem de produtos abaixo do mínimo +
  link "Conferir estoque →". Fundo `bg-amber-50` quando > 0.

### 4.3 Atividade recente

- Título "Atividade recente" com ícone de relógio.
- Lista de eventos (vendas, cancelamentos, novos clientes, etc.)
  com ícone, descrição e timestamp à direita.
- Sem eventos: estado vazio limpo.

---

## 5. Design tokens (Tailwind v4 `@theme`)

Substituir as classes `teal` inline por tokens no `globals.css`:

```css
@import "tailwindcss";

@theme {
  /* Marca */
  --color-primary-50:  #fffbeb;   /* amber-50  */
  --color-primary-100: #fef3c7;   /* amber-100 */
  --color-primary-500: #f59e0b;   /* amber-500 */
  --color-primary-600: #d97706;   /* amber-600 */
  --color-primary-700: #b45309;   /* amber-700 */

  /* Sidebar */
  --color-sidebar:       #0f172a; /* slate-900 */
  --color-sidebar-hover: #1e293b; /* slate-800 */
  --color-sidebar-text:  #94a3b8; /* slate-400 */

  /* Superfícies */
  --color-surface:       #ffffff;
  --color-background:    #f8fafc; /* slate-50 */

  /* Fonte */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}
```

**Justificativa da cor primária (amber):** a referência do proprietário
usa laranja/âmbar como destaque. O teal atual pode ser mantido como
cor de *sucesso/positivo* (badges, botões de confirmação) para não
quebrar a semântica existente.

**Fonte:** Inter (via `next/font/google`) — moderna, legível em
tamanhos pequenos, open-source. Alternativa: Geist Sans.

---

## 6. Componentes a criar (`apps/web/src/components/ui/`)

Extrair os padrões duplicados em ~40 arquivos para componentes
reutilizáveis:

| Componente | Substitui | Props principais |
|---|---|---|
| `Sidebar.tsx` | (novo) | `items`, `activePath`, `company`, `user` |
| `Header.tsx` | header do `layout.tsx` | `breadcrumb[]`, `user` |
| `AppShell.tsx` | (novo) | envolve Sidebar + Header + main |
| `Card.tsx` | `rounded-lg border bg-white p-4 shadow-sm` | `className`, `children` |
| `StatCard.tsx` | StatCard local do dashboard | `label`, `value`, `icon`, `trend`, `subtext` |
| `Button.tsx` | botões repetidos | `variant: primary|secondary|ghost|danger`, `size` |
| `Input.tsx` | `inputClass` repetido | `label`, `error`, `type` |
| `Badge.tsx` | badges de status | `color: teal|amber|red|sky|slate` |
| `Table.tsx` | tabelas repetidas | `columns`, `rows`, `empty` |
| `Modal.tsx` | (novo, se necessário) | `open`, `onClose`, `title` |
| `EmptyState.tsx` | estados vazios do dashboard | `icon`, `title`, `description` |

---

## 7. Páginas afetadas

### Impacto direto (layout)
- `app/layout.tsx` → substituir topbar por `AppShell` (sidebar +
  header + conteúdo).
- `app/page.tsx` (home) → reavaliar: com sidebar, a home pode virar a
  própria "Visão geral" (dashboard) ou um hub mais enxuto.

### Impacto indireto (classes de cor)
- ~40 arquivos com `teal-*` inline → migrar para `primary-*` ou
  manter teal como cor secundária de sucesso.
- Prioridade: botões (`bg-teal-700`), links, badges, focus rings.

### Sem impacto (não mexer)
- Lógica de negócio, API, testes, backend.
- Páginas de login/cadastro/redefinir-senha (ficam com layout próprio,
  sem sidebar).

---

## 8. Responsividade

| Breakpoint | Sidebar | Comportamento |
|---|---|---|
| `≥ 1024px` | Fixa, 260px | Layout completo |
| `768–1023px` | Recolhida (ícones only, 64px) | Labels ocultos; tooltips |
| `< 768px` | Off-canvas (drawer) | Hambúrguer no header; sidebar desliza |

---

## 9. Estados vazios e microinterações

- **Estados vazios** padronizados: ícone circular, título, descrição,
  CTA opcional. Usar em dashboard sem dados, listas vazias, etc.
- **Skeleton loading**: em vez de "Carregando..." em texto, usar
  blocos cinza animados (`animate-pulse`) no lugar dos cards/tabelas.
- **Hover em cards**: `hover:shadow-md transition-shadow`.
- **Focus ring**: `focus-visible:ring-2 focus-visible:ring-primary-500`
  em todos os elementos interativos (a11y).

---

## 10. Plano de implementação (fases)

### Fase 1 — Fundação (sem mudar páginas)
1. Instalar Inter via `next/font/google`.
2. Adicionar `@theme` no `globals.css` com tokens.
3. Criar `components/ui/`: `Card`, `Button`, `Input`, `Badge`,
   `StatCard`, `EmptyState`.
4. Testar que nada quebra (lint + testes).

### Fase 2 — Shell de layout
1. Criar `Sidebar.tsx` com navegação estática (itens + ícones Lucide
   ou SVG inline).
2. Criar `Header.tsx` com breadcrumb + data + avatar.
3. Criar `AppShell.tsx` orquestrando sidebar + header + main.
4. Substituir `layout.tsx` pelo `AppShell` (rotas de auth ficam fora).
5. Integrar `CompanyModule` para ocultar itens desabilitados.

### Fase 3 — Dashboard
1. Redesenhar `/dashboard` com layout de KPIs + gráfico + widgets +
   atividade recente.
2. Adicionar estado vazio e skeleton.

### Fase 4 — Migração das páginas
1. Trocar `teal-*` por tokens nos arquivos de maior tráfego
   (dashboard, home, pdv, produtos, clientes).
2. Substituir `inputClass`/botões duplicados pelos componentes de UI.
3. Corrigir encoding de `FinancialEntries.tsx`.

### Fase 5 — Polish
1. Responsividade (drawer mobile, sidebar recolhida).
2. Skeletons de carregamento.
3. Tooltips em ícones.
4. Dark mode (opcional, futuro).

---

## 11. Fora do escopo desta proposta

- Mudança de regra de negócio ou API.
- Novos endpoints ou modelos.
- Alteração de testes de backend.
- Deploy (exige aprovação).
- Biblioteca de gráficos externa (manter CSS/divs; avaliar Recharts
  apenas se houver demanda por interação avançada).

---

## 12. Decisões aprovadas e implementação

| # | Decisão | Escolha do proprietário | Status |
|---|---|---|---|
| R1 | Cor primária | **Amber / laranja** | ✅ Implementado (`@theme` primary-*) |
| R2 | Sidebar escura | **Slate-900** (#0f172a) | ✅ Implementado (`--color-sidebar`) |
| R3 | Fonte | **Inter** | ✅ Implementado (`next/font/google`) |
| R4 | Home vs Dashboard | **Manter separadas** | ✅ Home = hub; Dashboard = Visão geral |
| R5 | Ícones | **Lucide React** | ✅ Instalado e usado no Sidebar/Header/Dashboard |
| R6 | Estratégia | **Tudo de uma vez** | ✅ Entrega única |

### O que foi entregue

- `globals.css`: `@theme` Tailwind v4 com tokens primary (amber),
  sidebar, success (teal), superfícies e fonte Inter.
- `components/ui/`: Card, Button, Input/Textarea/Select, Badge,
  StatCard, EmptyState, Skeleton, **ComboChart** (barras + linha SVG),
  **DonutChart** (distribuição % SVG), **Progress** (barra de progresso),
  (+ barrel index).
- `components/shell/`: Sidebar (escura, navegação agrupada, empresa,
  ajuda, usuário/logout), Header (breadcrumb + data + avatar),
  AppShell (fetch sessão + módulos, layout condicional para rotas de
  auth).
- `layout.tsx`: Inter + AppShell (rotas de auth ficam sem sidebar).
- `/dashboard` redesenhado com base no dashboard de referência
  (`DimersonJr/dashboard-supermercado`):
  - **6 KPI cards** (Vendas, Pedidos, Ticket médio, Clientes novos,
    A receber, A pagar) — linha única no topo como no Power BI.
  - **Combo chart**: barras (vendas/dia) + linha (ticket médio/dia) —
    inspirado no "Ticket Médio Mês" do referência.
  - **Donut**: distribuição % das vendas por forma de pagamento —
    inspirado no "Distribuição de Pedidos por País".
  - **Saúde do caixa**: entradas vs saídas com barra de progresso —
    inspirado no "Desempenho do Ticket Médio" (gauge).
  - Widgets: Catálogo, Estoque, Agenda, **WhatsApp** (pendentes).
  - Skeleton loading, empty states, filtro de período.
- Migração `teal-*` → `primary-*` em 56 arquivos (~232 ocorrências).
- Alias `@/*` no tsconfig do web.
- `formatBrlCompact` para eixos de gráfico ("R$ 1,2 mil").

### Validações

- lint 0 · typecheck OK · **509/509 testes** · build OK.

---

## 13. Evolução do layout (fase 2 — opção B)

Após a entrega da fase 1 com sidebar recolhível, o proprietário
escolheu o **paradigma B — topbar única** entre as opções apresentadas
(B, E split view, palette ⌓K). Mudanças:

| Item | Fase 1 (sidebar) | Fase 2 (opção B, atual) |
|---|---|---|
| Navegação | Sidebar escura 260/72 px, recolhível | Topbar escura única com dropdowns |
| Header | Breadcrumb + data + avatar (conteúdo) | Tudo na topbar (busca, sino, perfil) |
| Conteúdo | `pl-[260px]` / `pl-[72px]` | Full-width `max-w-[1440px]` |
| Mobile | Drawer da sidebar | Acordeão sob a topbar |
| Arquivo | `Sidebar.tsx` | **removido** |

- Commits: `a942c84` (layout B) · CHANGELOG: 2026-10-12.
- Recomendações futuras **não implementadas**: split view (lista +
  detalhe lado a lado) e palette de comandos (⌘K).
