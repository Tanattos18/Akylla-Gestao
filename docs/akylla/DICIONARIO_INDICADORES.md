# Akylla Gestão — Dicionário dos indicadores (Etapa 9)

**Data:** 12/10/2026
**Entregável da Etapa 9** do `docs/PASSO_A_PASSO_OPENCODE_AKYLLA.md`
("Dicionário dos indicadores e testes de relatórios").

Regras gerais que valem para **todos** os indicadores abaixo:

1. **Cálculo sempre no servidor** (`apps/api/src/reports/reports.service.ts`,
   `apps/api/src/cash/cash.service.ts`, `apps/api/src/financial/financial.service.ts`);
   a UI apenas exibe — nenhum número é somado no cliente.
2. **Tenant**: todo `WHERE` inclui `companyId` vindo da sessão autenticada;
   `companyId` enviado pelo cliente é ignorado (`reports.test.ts` —
   "ignora companyId enviado pelo cliente").
3. **Período**: `from`/`to` em `YYYY-MM-DD`, janela inclusiva em **UTC**
   (`REPORT_TIMEZONE = "UTC"`), default 30 dias, máximo 366 dias,
   `from > to` ou data inválida → HTTP 400.
4. **Estado vazio**: sem dados o valor é `0`, `null` ou lista vazia —
   **nunca** um número estimado. Ex.: `ticketAverage = null` quando não
   há vendas concluídas.
5. **Valores monetários**: strings com 2 casas (`Decimal.toFixed(2)`),
   sempre calculadas no servidor.
6. **Leitura**: qualquer usuário autenticado (MEMBER ou ADMIN) pode ler
   os relatórios; escrita segue as regras de cada módulo.

---

## 1. Os quatro indicadores exigidos pelo roteiro

| Indicador | Significado exato | Onde vive | Fórmula / fonte |
|---|---|---|---|
| **Faturamento** | Soma dos totais das **vendas concluídas** (`status = COMPLETED`) criadas no período, líquida de descontos; **não** é caixa recebido nem contas a receber | `GET /api/reports/summary` → `sales.net` (dashboard "Vendas do período") | `SUM(Sale.total)` com `status = COMPLETED` e `createdAt` no período. `sales.gross` = `SUM(subtotal)`; `sales.discounts` = `SUM(discount)`; `ticketAverage` = `net / completedCount` (ou `null`); canceladas ficam em `sales.cancelledCount/Total` e **não** entram no faturamento |
| **Receita recebida** | Valor **liquidado** (título em aberto → pago) dos títulos a receber no período; representa dinheiro efetivamente recebido pelos títulos do módulo AP/AR | `GET /api/financial/summary` → `paidInTotal` (`paidInCount`) | `SUM(FinancialEntry.amount)` com `direction = RECEIVABLE`, `status = PAID` e `paidAt` no período. Complementos: `paidOutTotal` = saídas liquidadas; a visão de **caixa em dinheiro** é `GET /api/cash/summary` → `totalIn` (todas as entradas de caixa do período, inclui vendas, manuais, assinaturas e liquidações) |
| **Contas vencidas** | Títulos **em aberto com vencimento anterior ao momento da consulta**; `OVERDUE` é derivado, nunca armazenado | `GET /api/financial/summary` → `overdueReceivablesTotal/Count` (a receber) e `overduePayablesTotal/Count` (a pagar) | `SUM(amount)` de `FinancialEntry` com `status = OPEN`, `dueDate < now` (e dentro do `from/to` informado, quando houver) |
| **Saldo de caixa** | Dinheiro esperado na sessão de caixa **aberta** (não é saldo bancário e não considera títulos ainda não liquidados) | `GET /api/reports/summary` → `cash.openSession.expectedBalance` (dashboard "Caixa") | `CashSession.initialAmount` + entradas `inCash = true` − saídas `inCash = true` da sessão. Para o período: `GET /api/cash/summary` → `net` = `totalIn − totalOut` (movimentos do período, com período sem filtro = histórico inteiro) |

> **Separação conceitual:** "faturamento" é a receita de vendas do
> negócio (quando ocorrer a venda); "receita recebida" é o dinheiro já
> liquidado nos títulos; "saldo de caixa" é o que está fisicamente no
> caixa aberto. Os três números **podem e devem diferir** — por isso
> cada um tem origem e endpoint próprios. O faturamento/billing da
> **própria plataforma Akylla** (`/api/billing/*`, `TenantSubscription`)
> é outro conceito e não aparece nestes indicadores (ver
> `docs/akylla/MAPA_DE_MODULOS.md` §"billing × financeiro").

---

## 2. `GET /api/reports/summary` — dashboard (`/dashboard`)

| Campo | Significado | Fonte | Estado vazio |
|---|---|---|---|
| `sales.completedCount/gross/discounts/net` | Vendas concluídas no período (contagem e valores) | `Sale` (`COMPLETED`) | `0` / `"0.00"` |
| `sales.cancelledCount/cancelledTotal` | Vendas canceladas no período (fora do faturamento) | `Sale` (`CANCELLED`) | `0` / `"0.00"` |
| `sales.ticketAverage` | Ticket médio = `net / completedCount` | derivado | `null` (não `0`) |
| `salesByDay[]` | Série diária (`day`, `count`, `net`) — só `COMPLETED` | SQL agrupado por `to_char(createdAt,'YYYY-MM-DD')` | `[]` |
| `salesByPaymentMethod[]` | Série por forma de pagamento — só `COMPLETED` | `Sale.groupBy(paymentMethod)` | `[]` |
| `cash.openSession` | Sessão de caixa aberta (`id`, `openedAt`, `initialAmount`, `expectedBalance`) | `CashSession` (`OPEN`) | `null` |
| `cash.entriesInCash/exitsInCash` | Entradas/saídas que **contam** no caixa (`inCash = true`) no período | `CashMovement` | `"0.00"` |
| `cash.entriesTotal/exitsTotal` | Todas as entradas/saídas, inclusive fora do caixa (ex.: Pix) | `CashMovement` | `"0.00"` |
| `stock.outOfStockCount` | Produtos **ativos** com saldo `= 0` | SQL `FILTER` em `Product` | `0` |
| `stock.lowStockCount` | Produtos ativos com `minimumStock > 0` e `0 < saldo <= mínimo` | SQL `FILTER` em `Product` | `0` |
| `clients.newClients` | Clientes criados no período (data de cadastro) | `Client.createdAt` | `0` |
| `services.*` | Agendamentos por status no período (data/hora de início) | `Appointment` | `0` em todos |
| `whatsapp.*` | Mensagens por status no período (total e estados) | `WhatsAppMessage` | `0` |
| `modules.servicesRealized.available` | Se o módulo "serviços realizados" está disponível (true/razão) | configuração | `available: false` + `reason` |

## 3. Relatórios detalhados (`/relatorios`)

| Endpoint / aba | Indicadores principais | Estado vazio |
|---|---|---|
| `GET /api/reports/sales` (aba Vendas) | `totals.completed{count,gross,discounts,net}`, `totals.cancelled{count,total}`, lista paginada com cliente/responsável | `items: []`, totais `"0.00"` |
| `GET /api/reports/stock/alerts` (Estoque) | `alerts.total/outOfStockCount/lowStockCount` (ativos) | `0` |
| `GET /api/reports/stock/movements` (Estoque) | `totals.byType[]` (quantidades por tipo de movimento) + lista | `[]`/`0` |
| `GET /api/reports/cash` (Caixa e financeiro) | `movements.inCash{entries,exits,net}`, `movements.all{entries,exits}`, `movements.byOrigin[]` (Manual/Venda/Cancelamento/Estorno/Liquidação de título), `movements.reversals{count,total}`, `sessions{openedCount,closedCount,closedWithDifferenceCount,totalDifference,items[]}` | zera tudo; `items: []` |
| `GET /api/reports/clients` (Clientes) | `newClients` (período) + `services` (agendamentos por status) | `0` |
| `GET /api/reports/whatsapp` (WhatsApp) | `total`, `byStatus[]`, `states{...}`, `failed{count,byReason[]}` | `0`/`[]` |
| `GET /api/cash/summary` (usado em `/caixa` e `/financeiro`) | `salesTotal`, `manualEntriesTotal`, `manualExitsTotal`, `cancelmentsTotal`, `reversalsInTotal/Out/Net`, `totalIn`, `totalOut`, `net` por período | `"0.00"` |
| `GET /api/financial/summary` (usado em `/financeiro`) | `openPayables/Receivables{Total,Count}`, `overduePayables/Receivables{Total,Count}`, `paidIn/Out{Total,Count}`, `cancelledCount` | `"0.00"`/`0` |

---

## 4. Indicadores removidos (Etapa 9 — fim do nicho)

| Indicador antigo | Onde aparecia | Destino |
|---|---|---|
| `clients.newPets` ("pet(s) cadastrado(s)") | `summary` do dashboard e card "Novos clientes" | **removido** — substituído pelo já existente `newClients` (genérico); decisão registrada no PLANO §9 |
| `newPets` e `petsBySpecies[]` ("Novos pets por espécie") | `GET /api/reports/clients` e aba Clientes | **removidos** — a aba mantém `newClients` + `services`; os modelos `Pet`/`PetSpecies` continuam existindo como módulo opcional (destino na Etapa 10) |

Evidência: `tests/integration/reports.test.ts` — "sem indicador de nicho"
(`newPets`/`petsBySpecies` `toBeUndefined()`).

---

## 5. Regras de exportação e visualização

- **CSV**: gerado em `apps/api/src/common/utils/csv.ts`; separador CRLF;
  toda célula entre aspas com `"` duplicado; células iniciadas por
  `= + - @ TAB CR` **ou** por sinal após espaço inicial recebem apóstrofo
  (proteção contra *CSV injection*); limite `CSV_ROW_LIMIT = 5000`
  linhas (CSV ignora paginação); nomes `akylla_<relatório>_<from>_<to>.csv`;
  disponível hoje em vendas, alertas e movimentos de estoque.
- **Paginação**: JSON com `page` ≥ 1 e `pageSize` 1..100 (default 20).
- **Gráficos**: séries do dashboard são filtradas **no servidor** para
  `COMPLETED` apenas e usam um único período (`periodLabel`); status e
  períodos diferentes nunca são misturados na mesma série.
- **Limites de período**: `REPORT_MAX_RANGE_DAYS = 366` (400 acima disso).

## 6. Como rastrear qualquer número (verificação manual)

Todo indicador acima pode ser conferido com uma consulta direta no
banco filtrando `companyId` + período, por exemplo:

```sql
-- faturamento
SELECT COALESCE(SUM("total"), 0) FROM "Sale"
WHERE "companyId" = :empresa AND "status" = 'COMPLETED'
  AND "createdAt" BETWEEN :de AND :ate;

-- contas vencidas
SELECT COALESCE(SUM("amount"), 0) FROM "FinancialEntry"
WHERE "companyId" = :empresa AND "status" = 'OPEN'
  AND "direction" = 'RECEIVABLE' AND "dueDate" < NOW();
```

Os testes automatizados de coerência
(`tests/integration/reports.test.ts` — "coerência entre indicadores e dados de
origem") executam exatamente essa comparação via Prisma para vendas,
clientes, estoque, WhatsApp, títulos (AP/AR) e entradas de caixa.

## 7. Testes da Etapa 9

| Exigência do roteiro | Teste |
|---|---|
| Empresa vazia | `reports.test.ts` — "empresa sem nenhum dado zera todos os indicadores…" (summary, sales, clients, `financial/summary`, `cash/summary`) |
| Empresa com dados | `reports.test.ts` — suíte existente de `summary`, vendas, estoque, caixa, clientes e WhatsApp |
| Filtros por data | janela inclusiva de 1 dia, validação 400 (invertido/longo/inválido), períodos de movimentos/WhatsApp |
| Empresa A × Empresa B | isolamento em todos os endpoints + `tenancy-audit.test.ts` (CSV de A não contém dados de B) |
| Exportação com caracteres especiais e fórmulas | "neutraliza fórmulas (inclusive com espaço inicial) e escapa vírgulas, aspas e quebras de linha" + teste original de `=HACK` |
| Coerência entre indicadores e dados de origem | "resumo, relatórios de estoque/financeiro/caixa batem com o banco" |
