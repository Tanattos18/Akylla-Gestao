# Upgrade — design: o que CSS, JS e componentes trazem para o HTML

**Papel deste arquivo:** catálogo de melhorias de **design de interface**
— a parte que o HTML sozinho não entrega. Cada ideia traz **(a)** o que
é e como funciona, **(b)** o que ela melhora **no Akylla Gestão**, com
arquivos reais, **(c)** por onde começar e **(d)** prioridade.

Continua o trabalho de [`MELHORIAS.md`](MELHORIAS.md) (que cobre backend,
operação e produto). Este cobre a **camada de apresentação**.

Não é plano aprovado — é catálogo para decisão (regra 2 do `AGENTS.md`).

**Base inspecionada:** `apps/web/` (Next.js 15 + React 19 + Tailwind v4),
`components/ui/` e `components/shell/`, `globals.css`,
`docs/akylla/REDESIGN_PAINEL.md`.

---

## Legenda

| | Significado |
|---|---|
| **P0** | quebra a experiência ou é bug real no código |
| **P1** | ganho grande de usabilidade/confiança com esforço baixo |
| **P2** | polimento que diferencia o produto |
| **P3** | exploratório |

---

## 0. Achados concretos no código (resolver primeiro)

São **bugs e débitos reais** encontrados ao inspecionar o frontend. Não
são ideias — são correções.

| # | Achado | Arquivo | Efeito |
|---|---|---|---|
| **D-1** | `color: var(--foreground)` — **`--foreground` nunca é definida** no `@theme` | `apps/web/src/app/globals.css:39` | a cor do texto cai no default do browser; qualquer tema futuro ou componente que dependa da variável quebra em silêncio |
| **D-2** | Fonte carregada como `variable: "--font-inter"` mas o CSS usa a **string literal** `"Inter"`; a variável `--font-inter` é setada no `<html>` e **nunca lida** | `layout.tsx:6-9` × `globals.css:34` | duplicação frágil: trocar a fonte exige editar 2 lugares e a variável que o Next injeta é desperdiçada |
| **D-3** | Classes e comentários de **sidebar** mortos — a sidebar foi removida pela topbar (opção B) | `globals.css:16-21, 43-50`; `.sidebar-scroll` | CSS sem uso; confunde quem for manter |
| **D-4** | **32 `<table>` escritos inline** nas páginas, sem componente compartilhado | `apps/web/src/app/**` | cabeçalho, zebra, alinhamento de moeda e responsividade se repetem e divergem página a página |
| **D-5** | **Nenhum** `loading.tsx`, `error.tsx` ou `not-found.tsx` no App Router | `apps/web/src/app/` (só `layout.tsx` e `page.tsx`) | toda navegação mostra a tela anterior congelada até o dado chegar; 404 e 500 caem na página branca do Next |
| **D-6** | Primitivos de UI faltam: **sem `Table`, `Modal`/`Dialog`, `Select`, `Toast`, `Tabs`** | `components/ui/` (só Badge, Button, Card, Input, Progress, Skeleton, StatCard, EmptyState, 2 charts) | cada tela inventa a própria versão; é a origem do D-4 |
| **D-7** | **Contraste reprovado** em tokens usados como texto: `text-amber-500`/branco = **2.15**, `text-success-500`/branco = **2.49**, `text-amber-600`/branco = **3.19** (mínimo AA = 4.5) | `globals.css` + **194** usos de `text-primary`/`text-amber` | parte do texto informativo do produto não atinge WCAG AA; ver §4.3 |

> **D-1 e D-2 são correções de 15 minutos** e não afetam nenhum teste de
> backend. **D-7** é uma busca e substituição (`text-amber-600` →
> `text-amber-700`). **D-5** usa infraestrutura que o Next.js já traz —
> custo quase zero.

---

## 1. Fundamentos: tokens e CSS

### 1.1 Design tokens semânticos — **P0**

- **O que é:** par nomeado por *papel*, não por cor. Hoje os tokens são
  nomes de paleta (`--color-primary-500`, `--color-success-600`). O
  passo seguinte é definir `--color-accent`, `--color-danger`,
  `--color-warning`, `--color-info`, `--surface-raised`,
  `--text-muted`, `--border-subtle` — e **usar só esses** nos
  componentes.
- **O que melhora no Akylla:** hoje, para mudar o tom de "sucesso", é
  preciso vasculhar `success-500/600/700` em vários componentes. Com
  tokens semânticos, troca-se **uma linha**. É o que torna possível
  tema por segmento (item 1.4) sem reescrever telas.
- **Onde começar:** `globals.css` — os 5 blocos de cor já existentes
  viram a base; adicionar os semânticos por cima.
- **Relação:** é o pré-requisito de 1.3, 1.4 e 3.1.

### 1.2 Completar a escala e remover os pontos cegos — **P1**

- **O que é:** o `@theme` tem `primary` 50–900 completo, mas `success`
  só tem 50/500/600/700, e **não existem** `danger`, `warning`, `info`.
  As páginas compensam usando classes utilitárias soltas
  (`text-red-600`, `bg-amber-100`) fora da paleta da marca.
- **O que melhora no Akylla:** o sistema hoje parece ter **duas
  paletas**: a da marca (amber, aprovada em R1) e uma improvisada de
  utilitários Tailwind. Completar a escala unifica o visual sem mexer
  em layout.
- **Onde começar:** `globals.css`; varredura por `text-red|bg-red|
  text-emerald|bg-slate` nas 39 páginas.

### 1.3 Escuro por tokens (não por classe `dark:`) — **P2**

- **O que é:** a topbar e o drawer mobile já são escuros
  (`--color-sidebar: #0f172a`). Em vez de espalhar `dark:` por toda
  parte, definir os tokens de superfície/texto/borda e trocar os
  valores num único bloco.
- **O que melhora no Akylla:** o painel já é "híbrido" (topbar escura +
  conteúdo claro) e **não tem dark mode** (`dark:` nunca aparece no
  código). Com tokens, um dark mode completo vira ~20 linhas de CSS —
  e não 39 páginas editadas. Também é pré-requisito para o usuário
  que opera à noite (PDV, caixa).
- **Onde começar:** fechar D-1 primeiro; depois `@media (prefers-color-
  scheme: dark)` ou classe em `<html>`.

### 1.4 Tema por segmento (papelaria, oficina, pet shop) — **P3**

- **O que é:** a mesma base semântica com a paleta `primary` trocada
  por tenant, resolvida no servidor e injetada como variáveis CSS.
- **O que melhora no Akylla:** o produto se propõe a **não** ser de pet
  shop, mas ainda é visualmente amber genérico. Trocar a cor primária
  por segmento vende a multidão sem tocar no código das telas — e só
  funciona porque os tokens são semânticos (1.1).
- **Cuidado (regra 6 do `AGENTS.md`):** nunca logar/comitar o mapeamento
  com dados de cliente; e a marca Akylla deve permanecer reconhecível
  (decisão de design, não técnica).

---

## 2. Componentes: parar de reinventar

### 2.1 `Table` compartilhado — **P0**

- **O que é:** um `<Table>` em `components/ui/` com colunas tipadas,
  cabeçalho, zebra opcional, alinhamento à direita para moeda/qtd,
  estado vazio e **versão empilhada no mobile**.
- **O que melhora no Akylla:** resolve o **D-4** (32 tabelas inline).
  Cada tela que hoje repete `<th>`/`<td>` passa a importar. Ganho
  concreto: alinhamento consistente de valores em R$, que hoje é a
  maior fonte de "parece errado" num sistema financeiro.
- **Por onde começar:** `caixa/movimentos`, `produtos` e `clientes` —
  são as 3 mais repetidas.

### 2.2 `Modal`/`Dialog` acessível — **P1**

- **O que é:** diálogo com foco preso (trap), fecha no `Esc`, devolve o
  foco ao gatilho, `aria-modal`, fundo com `aria-hidden`.
- **O que melhora no Akylla:** cancelamento de venda, estorno de caixa,
  exclusão lógica e edição de template são **ações destrutivas**.
  Hoje a UI pode estar usando `confirm()` do browser ou navegação de
  confirmação — ambos são cruéis no mobile e impossíveis de estilizar.
  Com um modal próprio, a confirmação ganha motivo obrigatório (a API
  já exige `reason ≥ 3` em estorno/cancelamento/`reverse`).
- **Por onde começar:** extrair o diálogo de confirmação já usado em
  `pdv`/`caixa`.

### 2.3 `Select`, `Combobox` e `DateInput` — **P1**

- **O que é:** controles nativos **estilizados** (não reescritos), com
  `label` ligado, mensagem de erro via `aria-invalid`/`aria-describedby`.
- **O que melhora no Akylla:** filtros de período, seletor de categoria,
  de método de pagamento e de status existem em quase toda listagem.
  Sem componente único, cada um tem aparência e comportamento diferentes
  — e o `ProductForm`/`AppointmentForm` já carregam essa complexidade
  isoladamente.

### 2.4 `Toast` para feedback de ação — **P1**

- **O que é:** notificação não bloqueante (sucesso/erro) com região
  `aria-live="polite"`, auto-dismiss e empilhamento.
- **O que melhora no Akylla:** após criar um cliente, liquidar um
  título (`POST /api/financial/:id/pay`) ou enfileirar mensagem
  WhatsApp, **o usuário não recebe confirmação visível** além do
  reload da lista. E o servidor devolve erros ricos
  (`{ statusCode, message, issues[] }` do Zod) que hoje provavelmente
  viram alert ou somem. Um toast que mostre `issues[]` do Zod torna a
  validação compreensível para o usuário comum.
- **Por onde começar:** consumir o shape de erro do
  `ZodValidationPipe` já documentado em `API.md`.

### 2.5 Extrair `PageHeader` e `FilterBar` — **P2**

- **O que é:** cabeçalho de tela (título, subtítulo, ação principal) e
  barra de filtros padronizados.
- **O que melhora no Akylla:** 39 páginas protegidas repetem o mesmo
  topo. Unificar dá ritmo visual ao produto e reduz o custo de criar
  a próxima tela.

---

## 3. Movimento: o papel do JS na sensação

### 3.1 Transições de estado e microinterações — **P1**

- **O que é:** 150–200 ms em hover/focus/pressed de botão, abertura de
  drawer, expandir/colapsar seção. Só `transition-*` do Tailwind —
  **sem biblioteca de animação**.
- **O que melhora no Akylla:** há **11 ocorrências** de
  `animate-|transition-|@keyframes` em todo o `apps/web`. O painel
  responde, mas não **reage**: o clique parece não ter acontecido até a
  lista recarregar. Em PDV (fluxo repetido 50×/dia) essa ausência vira
  percepção de lentidão mesmo com resposta em 80 ms.
- **Cuidado:** `prefers-reduced-motion` deve desligar tudo (a11y).

### 3.2 Skeletons coerentes com o layout real — **P1**

- **O que é:** `Skeleton.tsx` **já existe**; falta usá-lo de forma
  consistente e com a geometria da tabela/lista que vai aparecer.
- **O que melhora no Akylla:** sem `loading.tsx` (D-5) e sem skeletons
  padronizados, o usuário vê a tela anterior congelada e depois o
  conteúdo "pulando". Um skeleton com a altura certa da tabela remove a
  sensação de salto — custo quase zero, pois o componente já está lá.

### 3.3 Optimistic UI em ações rápidas — **P2**

- **O que é:** aplicar a mudança visual antes da resposta do servidor,
  com rollback se falhar.
- **O que melhora no Akylla:** otimizar para **status** (inativar
  usuário, mudar status de template WhatsApp, marcar consentimento
  `OPTED_OUT`) — ações de um clique. Para dinheiro (caixa, financeiro,
  venda) **não**: saldo e totais são recalculados no servidor por regra
  permanente, então a lista deve esperar.

### 3.4 Gráficos com entrada e transição de dados — **P2**

- **O que é:** `ComboChart.tsx` e `DonutChart.tsx` já existem; adicionar
  animação de entrada e transição ao trocar período.
- **O que melhora no Akylla:** ao trocar de mês no dashboard, o gráfico
  pisca. Animação de interpolação mostra **o que mudou**, que é a
  pergunta real do usuário.

---

## 4. Acessibilidade (a11y)

### 4.1 Auditoria com axe/Lighthouse no PR — **P1**

- **O que é:** roda `@axe-core/playwright` nas telas principais e
  falha o PR em violações sérias.
- **O que melhora no Akylla:** há apenas ~63 ocorrências de
  `aria-|role=` em 39 páginas + 22 componentes — pouco para um sistema
  que é **o trabalho diário** de alguém. Sem medição, não há como
  saber o tamanho do problema. É a mesma lógica da cobertura de
  testes do `MELHORIAS.md` §4.1: medir antes de decidir.

### 4.2 Foco visível e ordem de tabulação — **P1**

- **O que é:** `focus-visible` visível em todos os interativos e
  ordem de tabulação coerente com a leitura visual.
- **O que melhora no Akylla:** quem opera o PDV **de teclado** (mão na
  sacola, outra no enter) não consegue confirmar onde está. Um
  `outline` consistente em `Button`/`Input` já resolvido em 1 componente
  vale para as 39 telas.

### 4.3 Contraste medido nos tokens (já há reprovações) — **P1**

- **O que é:** checar razão de contraste ≥ 4.5:1 (texto normal) nos
  pares texto/fundo usados de fato.
- **O que melhora no Akylla:** **medido neste catálogo** — há
  reprovações reais:

  | Par | Razão | Situação |
  |---|---|---|
  | `--color-sidebar-text` `#94a3b8` sobre `#0f172a` | **6.96** | ✅ OK |
  | `text-primary-700` `#b45309` sobre branco | **5.02** | ✅ OK |
  | `text-amber-700` sobre branco | **5.02** | ✅ OK |
  | `text-amber-600` `#d97706` sobre branco | **3.19** | ❌ reprova em texto normal |
  | `text-amber-500` `#f59e0b` sobre branco | **2.15** | ❌ reprovado |
  | `text-success-500` `#14b8a6` sobre branco | **2.49** | ❌ reprovado |

  Há **194 ocorrências** de `text-primary`/`text-amber` nas telas, e
  `text-xs text-amber-600` já aparece assim
  (`agenda/page.tsx:154`). Ou seja: parte do texto informativo do
  produto **não atinge o mínimo WCAG AA**.
- **Correção barata:** banir os stops 300/400/500/600 como **cor de
  texto** — texto só nos stops 700+. Os 500/600 continuam válidos como
  fundo, borda e ícone grande. Isso vira regra dos tokens semânticos
  (1.1): `--color-text-accent` aponta para o 700, não para o 500.
- **Onde começar:** `globals.css` + varredura de `text-amber-6|5`.

### 4.4 Regiões vivas e anúncio de resultados — **P2**

- **O que é:** `aria-live` anunciando "12 clientes encontrados",
  "caixa fechado com diferença de R$ 2,00".
- **O que melhora no Akylla:** leitores de tela hoje não anunciam
  quando a lista filtra ou quando o fechamento de caixa devolve
  `differenceBalance`. O dado existe no servidor; falta anunciá-lo.

---

## 5. Responsividade

### 5.1 Mobile-first no fluxo do balcão — **P1**

- **O que é:** testar os fluxos críticos em 360 px (Android médio).
- **O que melhora no Akylla:** o shell já tem drawer mobile em acordeão
  (REDESIGN_PAINEL), mas as **32 tabelas inline** (D-4) não têm versão
  empilhada. Num tablet de balcão, a listagem de produtos com 8 colunas
  vira rolagem horizontal. O `Table` (2.1) resolve junto.

### 5.2 Áreas de toque e densidade — **P2**

- **O que é:** alvos ≥ 44 px e um "modo denso" opcional para telas
  com muitas linhas.
- **O que melhora no Akylla:** o PDV e a agenda são operados com o
  dedo. Botões pequenos = erro de toque = venda errada.

---

## 6. Estados: o que a tela mostra quando algo não está acontecendo

### 6.1 `loading.tsx`, `error.tsx`, `not-found.tsx` — **P0**

- **O que é:** arquivos de rota do App Router que o Next.js renderiza
  automaticamente.
- **O que melhora no Akylla:** resolve o **D-5** com infraestrutura já
  existente. `error.tsx` global pode ainda reportar ao Sentry
  (integração 2.1 do `MELHORIAS.md`). `not-found.tsx` dá um caminho de
  volta quando o usuário digita URL errada ou abre recurso de outra
  empresa (que **deve** responder 404 — hoje talvez apareça "Something
  went wrong").
- **Custo:** 3 arquivos pequenos.

### 6.2 Estados vazios com ação — **P1**

- **O que é:** `EmptyState.tsx` **já existe**; garantir que toda lista
  vazia o use com o botão da próxima ação ("Cadastrar primeiro
  cliente", "Abrir caixa").
- **O que melhora no Akylla:** o produto é novo. A primeira hora do
  usuário é **tela vazia** — e é onde ele decide se entende o sistema.
  Um estado vazio que explica o próximo passo converte melhor que um
  tour.

### 6.3 Erros in-line no campo, não só no toast — **P1**

- **O que é:** mensagem de validação ligada ao input via
  `aria-describedby`, mostrando a primeira `issue` do Zod.
- **O que melhora no Akylla:** os schemas compartilhados já têm mensagens
  em português (`"Motivo é obrigatório"`, `"Motivo deve ter no máximo
  500 caracteres"`). Elas chegam no corpo do 400 — falta exibi-las
  **no campo**. Hoje o usuário vê um bloco de texto sem saber onde
  corrigir.

### 6.4 Skeleton/fallback nas áreas do shell — **P2**

- **O que é:** o `AppShell` busca sessão e módulos; dar fallback visual
  nesse fetch evita flash de menu incompleto.

---

## 7. Dados e visualização

### 7.1 Tabelas com ordenação e busca local — **P2**

- **O que é:** ordenar por coluna e filtrar no cliente quando o
  conjunto é pequeno (< 500 linhas).
- **O que melhora no Akylla:** toda listagem já pagina no servidor
  (`paginationQuerySchema`) — ótimo. Mas para **um dia de movimentos**,
  ordenar por valor no cliente é o esperado; refazer round-trip por
  cada clique de cabeçalho parece lento.

### 7.2 Formatação monetária centralizada — **P1**

- **O que é:** um `formatBRL()` único, com `Intl.NumberFormat("pt-BR")`,
  usado por `StatCard`, tabelas, gráficos e recibo.
- **O que melhora no Akylla:** valores vêm do servidor como string de 2
  casas (decimais no banco, nunca float — regra permanente). Se cada
  tela formatar por conta própria, uma hora aparece `R$ 1.500,0` ou
  `1500.00`. Num sistema financeiro isso é credibilidade.

### 7.3 Gráficos acessíveis (texto alternativo) — **P2**

- **O que é:** resumo textual dos gráficos e tabela de dados
  equivalente.
- **O que melhora no Akylla:** `ComboChart` e `DonutChart` não são lidos
  por leitor de tela. O dashboard é a tela de decisão do dono — não
  pode ser inacessível.

---

## 8. Performance percebida e entrega

### 8.1 `useOptimistic`/`useTransition` nas navegações — **P2**

- **O que é:** mostrar o estado pendente do link/botão durante a
  transição.
- **O que melhora no Akylla:** rewrites `/api/:path*` → 3001 mantêm o
  domínio único (bom para cookie `HttpOnly`), mas o carregamento é
  sempre rede. Indicar progresso no botão evita duplo clique — crítico
  em `POST /api/sales`, onde repetição cria venda duplicada.

### 8.2 Fonte: fechar o D-2 — **P2**

- **O que é:** usar a variável que o `next/font` já injeta
  (`--font-inter`) em vez da string literal `"Inter"`, e definir
  `font-display` no CSS.
- **O que melhora no Akylla:** a Inter **já** é otimizada pelo Next
  (subset `latin`, auto-hosting, `display: swap` por padrão) — não há
  problema de performance a resolver aqui. Só o débito do D-2: a
  variável `--font-inter` é setada no `<html>` e nunca lida, e o
  fallback não é controlado.

### 8.3 PWA para o tablet de balcão — **P3**

- **O que é:** manifest + service worker, instalável.
- **O que melhora no Akylla:** o PDV em tablet ganha tela cheia e
  ícone próprio. **Não** prometer offline aqui — isso é outro item
  (`MELHORIAS.md` §5.7) e tem complexidade alta.

---

## 9. Impressão e contextos especiais

### 9.1 `@media print` para recibo e relatórios — **P2**

- **O que é:** estilos de impressão: sem shell, sem botões, largura de
  bobina (58/80 mm) ou A4.
- **O que melhora no Akylla:** `Receipt.tsx` já existe e a exportação
  CSV já tem limite e anti-injeção. Mas **imprimir o recibo** ou o
  relatório do dia hoje sai com topbar, menus e cores de tela. É a
  diferença entre "tem um botão de imprimir" e "funciona no balcão".

### 9.2 Página de recibo standalone (URL imprimível) — **P2**

- **O que é:** rota pública/tokenizada só com o recibo, para reenviar
  por WhatsApp sem expor o painel.
- **O que melhora no Akylla:** combina com o módulo WhatsApp já
  implementado: o lojista manda o comprovante pelo mesmo canal que já
  tem integração.

---

## Resumo por prioridade

| P | Itens |
|---|---|
| **P0** | D-1 `--foreground` · D-2 fonte · D-4/D-6 `Table`+primitivos · D-5 rotas `loading/error/not-found` · D-7 contraste (regra 700+ para texto) · 1.1 tokens semânticos |
| **P1** | 1.2 completar escala · 2.2 Modal · 2.3 Select/Date · 2.4 Toast · 3.1 microinterações · 3.2 skeletons · 4.1 axe na CI · 4.2 foco · 4.3 contraste · 5.1 mobile balcão · 6.2 empty states · 6.3 erros in-line · 7.2 formatação BRL |
| **P2** | 1.3 dark por tokens · 2.5 PageHeader/FilterBar · 3.3 optimistic (só status) · 3.4 animar gráficos · 4.4 aria-live · 5.2 áreas de toque · 6.4 fallback do shell · 7.1 ordenação local · 7.3 gráficos acessíveis · 8.1 useTransition · 8.2 fonte · 9.1 print · 9.2 recibo standalone |
| **P3** | 1.4 tema por segmento · 8.3 PWA |

## Sequência sugerida

1. **Uma tarde:** D-1, D-2, D-3, D-5, **D-7**, 7.2, 1.2 — correções
   baratas e visíveis (a regra "texto só nos stops 700+" é uma busca e
   substituição segura).
2. **Uma semana:** `Table` (2.1) + `loading/error/not-found` + 3.2
   skeletons + 6.2 empty states + 6.3 erros in-line. Sai o "site
   genérico" e entra um produto.
3. **Duas semanas:** tokens semânticos (1.1) + Modal + Toast + micro-
   interações + auditoria axe na CI (4.1) com 4.2/4.3.
4. **Depois:** dark mode, print, gráficos, tema por segmento.

## Regras de ouro do design neste produto

1. **O servidor manda.** Nenhum valor, saldo, total ou limite calculado
   no cliente (regra permanente). Design nunca disputa regra de negócio.
2. **Dinheiro não otimiza.** UI pode ser otimista em status; em
   caixa/venda/financeiro, sempre esperar o servidor.
3. **Acessível por padrão.** Focus visível, contraste, label ligado —
   isso é comportamento, não enfeite.
4. **Consistência > criatividade.** O usuário opera o mesmo fluxo 50
   vezes por dia; ele quer previsibilidade.
5. **`prefers-reduced-motion` respeitado.** Toda animação tem desligar.

## Como usar este arquivo

- Mesmo processo de [`MELHORIAS.md`](MELHORIAS.md): nada entra em
  `IMPLEMENTATION_CHECKLIST.md` sem decisão do proprietário.
- Design é decidido junto com produto — marcar quando uma ideia
  depender de aprovação visual (padrão já usado em R1–R6 do
  `REDESIGN_PAINEL.md`).
- Os achados **D-1 a D-7** são correção de débito, não melhoria: podem
  ser executados assim que autorizados, sem design review.
