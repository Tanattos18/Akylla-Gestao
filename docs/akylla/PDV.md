# PDV — Ponto de Venda do Akylla Gestão

> **Natureza:** documento funcional do módulo PDV (módulo do núcleo,
> mantido no Akylla Gestão). Descreve o fluxo de tela, as regras
> de negócio, a API, o modelo de dados, a integração com caixa/estoque/
> financeiro e as garantias de segurança.
>
> **Status:** implementado e coberto por testes (suíte de vendas). Não
> anuncia recurso fiscal, de adquirente ou de conciliação — o sistema
> registra a venda operacional e o caixa interno.
>
> **Nota (2026-10-14):** o texto "contas a receber (futuro)" em §9 está
> desatualizado — o módulo **Financial (AP/AR) existe desde a Etapa 8**
> (`apps/api/src/financial`, rota `/api/financial`).

---

## 1. Visão geral

O PDV é a tela de registro de vendas presenciais. Ele busca produtos,
monta um carrinho, aplica desconto, escolhe a forma de pagamento e grava
a venda em uma única transação que também:

- baixa o estoque e registra o `StockMovement` (saída);
- lança o recebimento no caixa (`CashMovement` com `origin: SALE`);
- vincula a venda à sessão de caixa aberta;
- gera o código do comprovante (`receiptCode`, prefixo `PF-`).

**Regra de ouro:** o frontend envia apenas `items` (productId +
quantidade), desconto, forma de pagamento e cliente opcional. **Preço,
subtotal e total são sempre recalculados no servidor** a partir do
`salePrice` vigente no banco — valores enviados pelo cliente são
ignorados.

---

## 2. Fluxo do usuário (tela `/pdv`)

Arquivo: `apps/web/src/app/pdv/page.tsx`

1. **Sessão e caixa** — ao carregar, busca a sessão (`fetchSession`) e
   verifica se há caixa aberto (`GET /api/cash/sessions/current`). Sem
   caixa, exibe aviso âmbar e bloqueia "Finalizar venda".
2. **Busca de produto** — campo com debounce de 300 ms consulta
   `GET /api/products?status=ACTIVE&pageSize=8&search=...` (nome, SKU ou
   código de barras). Cada resultado mostra saldo e preço de venda.
3. **Carrinho** — "Adicionar" insere o produto (qtd 1). Estoque ≤ 0
   bloqueia a adição; quantidade é limitada ao saldo disponível.
4. **Ajustes** — quantidade editável (1…estoque), remoção de item,
   desconto em reais (limitado ao subtotal), cliente opcional (lista de
   clientes ativos), forma de pagamento.
5. **Forma "Outro"** — exige descrição obrigatória (ex.: vale,
   transferência, cheque), gravada em `paymentNote`.
6. **Finalizar** — valida carrinho, desconto e "Outro"; envia
   `POST /api/sales` com `clientRequestId` (UUID) para idempotência.
7. **Pós-venda** — mostra o comprovante (`Receipt`), botão "Imprimir"
   (nova janela via `printReceipt`) e atalhos "Nova venda" / "Ver
   histórico".

---

## 3. API

Controller: `apps/api/src/sales/sales.controller.ts`
Serviço: `apps/api/src/sales/sales.service.ts`

| Método | Rota | Permissão | Descrição |
|---|---|---|---|
| POST | `/api/sales` | sessão | Cria venda; recalcula tudo no servidor |
| GET | `/api/sales` | sessão | Histórico paginado; filtros `status`, `search` (receiptCode), `from`, `to` |
| GET | `/api/sales/:id` | sessão | Detalhe com itens (snapshots) |
| POST | `/api/sales/:id/cancel` | **ADMIN** | Cancela com `reason`; devolve estoque e registra estorno no caixa |

### 3.1 Payload de criação (`createSaleSchema`)

`packages/shared/src/index.ts`

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `items` | array | sim | 1…100 itens; cada item: `productId` (1–60) + `quantity` (> 0) |
| `discount` | string decimal | não (padrão `"0")` | ≥ 0; ≤ subtotal (validado no servidor) |
| `paymentMethod` | enum | sim | `CASH` · `CARD` · `PIX` · `OTHER` |
| `paymentNote` | string | não | Obrigatório na prática quando `OTHER` (UI); máx. 300 |
| `clientId` | string \| null | não | Cliente da mesma empresa e `ACTIVE` |
| `clientRequestId` | string | não | 8–64 chars; unicidade `(companyId, clientRequestId)` — idempotência |

### 3.2 Respostas relevantes

| Situação | HTTP | Mensagem |
|---|---|---|
| Caixa fechado | 409 | `Caixa fechado: abra o caixa para registrar vendas` |
| Estoque insuficiente | 400 | `Estoque insuficiente para "X" (disponível: …)` |
| Produto inativo/outro tenant | 400/404 | mensagem clara |
| Desconto > subtotal | 400 | validação no servidor |
| Reenvio (mesmo `clientRequestId`) | 409 | `Venda já registrada…` |
| Cancelar sem motivo | 400 | `reason` ≥ 3 caracteres |
| Cancelar venda já cancelada | 409 | sem devolução dupla |

---

## 4. Transação e segurança de dados

`SalesService.create` executa tudo em `prisma.$transaction` com ordem
fixa de locks para evitar deadlock:

1. **Lock da sessão de caixa** — `lockOpenCashSession` (`SELECT … FOR
   UPDATE` na `CashSession` aberta). Sem sessão → 409.
2. **Leitura do cliente** (opcional) — sem lock; valida tenant e status.
3. **Lock dos produtos** — `SELECT … FOR UPDATE` por `productId`
   **ordenado alfabeticamente** (ordem determinística entre transações
   concorrentes).
4. **Validações** — estoque ≥ quantidade; desconto ≤ subtotal.
5. **Criação** — `Sale` + `SaleItem[]` (snapshots de nome, SKU, unidade
   e preço no momento da venda).
6. **Baixa de estoque** — `product.stockQuantity -= quantity` +
   `StockMovement` (`type: OUT`, referência ao `receiptCode`).
7. **Financeiro** — um único `CashMovement` (`type: IN`,
   `origin: SALE`, `inCash: true` só quando `CASH`).

**Idempotência:** o `clientRequestId` (UUID gerado no front e renovado
após cada venda) tem unicidade no banco. Duplo clique ou retry de rede
não cria venda duplicada — responde 409 e a UI orienta a consultar o
histórico.

**Preço no servidor:** o `unitPrice` gravado vem do `Product.salePrice`
lido com lock; o frontend nunca envia preço.

**Snapshot:** `SaleItem` copia `productName`, `productSku`, `unit` e
`unitPrice`. Renomear ou reprecificar o produto depois não altera
comprovantes e histórico antigos.

---

## 5. Cancelamento (estorno)

`POST /api/sales/:id/cancel` — **somente ADMIN** (`AdminGuard`),
motivo obrigatório (3–500 caracteres).

Dentro de transação:

1. Localiza a venda (`COMPLETED`); já cancelada → 409.
2. Lock da sessão de caixa aberta (mesma regra da venda).
3. Lock dos produtos envolvidos (ordem determinística).
4. `status = CANCELLED` + `cancelledAt`, `cancelledByUserId`,
   `cancelReason` (`updateMany` com guarda `status: "COMPLETED"` —
   cancelamento duplo não passa).
5. Devolve estoque (`increment`) + `StockMovement` (`type: IN`, com o
   motivo).
6. Lança `CashMovement` de reversão (`type: OUT`,
   `origin: SALE_CANCELMENT`, `inCash` conforme a forma original).

O estorno entra na **sessão aberta atual** (não reabre sessão antiga) —
mesma convenção do caixa.

---

## 6. Modelo de dados

`database/prisma/schema.prisma`

### Sale

| Campo | Tipo | Observação |
|---|---|---|
| `receiptCode` | string | `PF-` + 8 chars (alfabeto sem ambíguos); único por empresa |
| `clientRequestId` | string? | idempotência; único por empresa |
| `status` | `COMPLETED` \| `CANCELLED` | padrão `COMPLETED` |
| `subtotal` / `discount` / `total` | Decimal(12,2) | valores do servidor |
| `paymentMethod` | enum | CASH/CARD/PIX/OTHER |
| `paymentNote` | string? | descrição do "Outro" |
| `createdByUserId` | FK User | vendedor |
| `cancelledByUserId` / `cancelReason` / `cancelledAt` | — | auditoria |
| `cashSessionId` | FK CashSession? | sessão do momento da venda |

Índices: `(companyId, receiptCode)` único, `(companyId, clientRequestId)`
único, `(companyId, createdAt)`, `(companyId, status)`,
`(companyId, clientId)`.

### SaleItem

Snapshot imutável por linha: `productName`, `productSku`, `unit`,
`unitPrice`, `quantity` (Decimal 12,3 — suporta kg/L), `subtotal`.
Relação `Restrict` com produto e venda (não apaga histórico em cascata).

---

## 7. Comprovante e impressão

- **Na tela** — `apps/web/src/components/Receipt.tsx`: layout
  monoespaçado com empresa, código, data, vendedor, itens, totais,
  pagamento e selo de cancelamento quando aplicável.
- **Impressão** — `apps/web/src/lib/print.ts`: abre nova janela
  (`window.open`), escreve HTML/CSS de cupom 80 mm (Courier New,
  260 px) e chama `window.print()`. Se o navegador bloquear pop-up, a
  UI exibe aviso para permitir. Não há dependência de biblioteca de
  impressão.

Código do comprovante: `PF-` + 8 caracteres do alfabeto
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (evita I, O, 0, 1), gerado com
`crypto.randomInt` no servidor.

---

## 8. Integração com os demais módulos

| Módulo | Integração |
|---|---|
| **Caixa** | Venda exige sessão `OPEN`; grava `cashSessionId` e `CashMovement` (`inCash` só para Dinheiro). Fechamento de caixa consolida as movimentações. |
| **Estoque** | Baixa automática na venda; devolução no cancelamento; alertas de estoque mínimo alimentam o dashboard. |
| **Financeiro** | Vendas alimentam relatórios (`/api/reports/summary`), dashboard (KPIs, combo chart, donut por pagamento) e o módulo de contas a receber (futuro). |
| **Clientes** | Vinculação opcional; recibo e histórico exibem o nome; venda com cliente inativo é rejeitada. |
| **Relatórios** | `GET /api/reports/sales` exporta CSV do histórico; filtros por período/status. |

---

## 9. Permissões e multiempresa

- **Criar/listar/detalhar venda:** qualquer usuário autenticado da
  empresa (vendedor ou admin).
- **Cancelar venda:** somente `ADMIN` (guarda global + `AdminGuard`).
- **Escopo:** `companyId` sempre do contexto autenticado; leitura com
  `findFirst({ id, companyId })` → 404 para venda de outra empresa.
- **Caixa:** a sessão lockada é sempre a da empresa do token.

---

## 10. Validações de UI (camada fina)

O frontend valida antes de enviar, mas **as mesmas regras são
reexecutadas no servidor** (fonte da verdade):

| UI | Servidor |
|---|---|
| Carrinho não vazio | `items` min 1 |
| Desconto ≥ 0 e ≤ subtotal | idem (Decimal) |
| "Outro" com descrição | `paymentNote` ≤ 300 |
| Quantidade ≤ estoque (carrinho) | `stockQuantity.lt(quantity)` com lock |
| Caixa aberto (botão desabilitado) | 409 com lock |

---

## 11. Garantias cobertas por testes

`tests/integration/sales.test.ts` (+ `cash.test.ts`):

- Venda válida baixa estoque e registra movimento.
- Totais recalculados no servidor (payload adulterado é ignorado).
- Estoque insuficiente / produto inativo / produto de outro tenant
  rejeitados sem efeito colateral.
- Desconto negativo ou maior que o subtotal rejeitado.
- **Idempotência:** mesmo `clientRequestId` não cria duas vendas.
- **Concorrência:** vendas simultâneas nunca deixam estoque negativo.
- Snapshot de itens preservado após renomear produto.
- Cancelamento: exige admin, exige motivo, devolve estoque uma única
  vez, segundo cancelamento → 409, registra movimento de estorno.
- Isolamento multiempresa (404 em venda de outra empresa).
- Venda com cliente opcional; cliente inativo/`clientId` alheio
  rejeitados.

---

## 12. Limitações conhecidas

Conforme `docs/akylla/LIMITACOES_VENDAS.md` e
`docs/akylla/CHECKLIST_PRE_PRODUCAO.md`:

| # | Limitação | Status |
|---|---|---|
| L1 | Sem **NFC-e / emissão fiscal** — o sistema não é emissor de nota e não deve ser anunciado como tal | deliberado |
| L2 | Sem integração de **adquirente / maquininha** — pagamento por cartão é registro operacional, não captura | deliberado |
| L3 | Sem **conciliação bancária** automática | futuro |
| L4 | Sem **modo offline** — PDV depende de API disponível | futuro |
| L5 | Sem **leitor de código de barras** dedicado (busca por texto cobre o caso comum) | futuro |
| L6 | Sem **troco calculado** para pagamento em dinheiro | futuro |
| L7 | Sem **venda com preço customizado por item** (só desconto global) | deliberado |
| L8 | Sem **devolução parcial** (cancelamento é total) | futuro |
| L9 | Impressão depende de pop-up do navegador | conhecido |

> Nenhuma dessas limitações pode ser prometida em material comercial
> sem implementação + testes + aprovação do proprietário.

---

## 13. Arquivos principais

| Camada | Arquivo |
|---|---|
| UI PDV | `apps/web/src/app/pdv/page.tsx` |
| Comprovante (tela) | `apps/web/src/components/Receipt.tsx` |
| Impressão | `apps/web/src/lib/print.ts` |
| Histórico UI | `apps/web/src/app/vendas/page.tsx` e `vendas/[id]/page.tsx` |
| API | `apps/api/src/sales/sales.controller.ts` |
| Regras | `apps/api/src/sales/sales.service.ts` |
| Lock de caixa | `apps/api/src/cash/cash-session.helpers.ts` |
| Schema Zod | `packages/shared/src/index.ts` (`createSaleSchema`, `cancelSaleSchema`, `listSalesQuerySchema`) |
| Banco | `database/prisma/schema.prisma` (`Sale`, `SaleItem`) |
| Testes | `tests/integration/sales.test.ts`, `tests/integration/cash.test.ts` |

---

## 14. Comandos de verificação

```bash
npm test                 # suíte completa (inclui sales.test + cash.test)
npm run lint
npm run typecheck
```

Fluxo manual: abrir caixa em `/caixa` → vender em `/pdv` → imprimir →
histórico em `/vendas` → cancelar (admin) em `/vendas/[id]`.
