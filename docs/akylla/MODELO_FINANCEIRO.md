# Akylla Gestão — Modelo financeiro básico (Etapa 8 — detalhamento)

**Data:** 12/10/2026
**Natureza:** detalhamento prévio exigido pelo roteiro ("definir
conceitos") e pelo PLANO §9 ("detalhar antes de implementar").
**Nenhum schema, migration ou código foi alterado** — implementação
condicionada à aprovação deste documento pelo proprietário.

---

## 1. Inspecção do modelo atual (roteiro, instrução 1)

**[Código]** O financeiro hoje é exclusivamente **fluxo de caixa por
sessão**:

- `CashSession` — abertura/fechamento por turno; `CashMovement` — IN/OUT
  com origem `MANUAL|SALE|SALE_CANCELMENT|REVERSAL`, flag `inCash`
  (apenas `CASH` compõe cédulas), estorno auditável (`reversalOfId`,
  motivo, autor).
- Vinculações existentes: `saleId` (único por origem), `subscriptionId`
  (pagamento de assinatura de cliente grava `MANUAL`).
- **Não existe:** vencimento, situação aberto/vencido/pago, contraparte,
  categoria de despesa/receita, previsões, parcelamento.
- **[Teste]** comportamento do caixa coberto por 37 testes aprovados.

## 2. Conceitos separados (roteiro, instrução 2)

| Conceito | Definição no Akylla | Onde vive |
|---|---|---|
| **Conta a pagar (PAYABLE)** | Título de saída **futura** (despesa a prazo, fiado a fornecedor) | `FinancialEntry.direction = PAYABLE` |
| **Conta a receber (RECEIVABLE)** | Título de entrada **futura** (fiado a cliente, receita a prazo) | `FinancialEntry.direction = RECEIVABLE` |
| **Pagamento/recebimento realizado** | Liquidação de um título (`OPEN → PAID`, com `paidAt`) | `FinancialEntry` + gerador de `CashMovement` |
| **Caixa** | Dinheiro efetivamente movimentado no turno | `CashSession`/`CashMovement` (inalterado) |
| **Fluxo de caixa (relatório)** | **Previsto** (títulos `OPEN` por vencimento) × **Realizado** (movimentos de sessão + liquidações) | `/financeiro` com abas |
| **Billing da Akylla** | Assinatura da empresa no SaaS | `TenantPlan`/`TenantSubscription` — **nunca** misturado (roteiro, instrução 9; MAPA §5) |

## 3. Modelo proposto (migration aditiva)

```prisma
enum FinancialDirection { PAYABLE  RECEIVABLE }
enum FinancialStatus    { OPEN  PAID  CANCELLED }
enum FinancialOrigin    { MANUAL  SALE  SUBSCRIPTION }

model FinancialEntry {
  id              String            @id @default(cuid())
  companyId       String
  company         Company           @relation(..., onDelete: Restrict)
  direction       FinancialDirection
  description     String            // 2..200
  amount          Decimal           @db.Decimal(12, 2)   // > 0
  dueDate         DateTime          // vencimento
  status          FinancialStatus   @default(OPEN)
  paidAt          DateTime?
  cancelReason    String?
  clientId        Client?           @relation(..., onDelete: SetNull)  // contraparte
  supplierId      Supplier?         @relation(..., onDelete: SetNull)  // contraparte
  categoryId      Category?         @relation(..., onDelete: SetNull)  // categoria financeira
  origin          FinancialOrigin   @default(MANUAL)
  originId        String?           // vínculo com origem (ex.: venda)
  cashMovementId  CashMovement?     @relation(..., onDelete: SetNull)  // liquidado em dinheiro
  createdByUserId User              @relation(..., onDelete: Restrict)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@unique([companyId, origin, originId])
  @@index([companyId, status, dueDate])
  @@index([companyId, direction, status, dueDate])
}
```

- Adições aditivas nos models existentes: `financialEntries` em
  `Company`, `Client`, `Supplier`, `Category`, `User`, `CashMovement`.
- **Decimal(12,2)** para valores (instrução 5); nada de `Float`.
- Duplicidade: `@@unique([companyId, origin, originId])` + idempotência
  por `clientRequestId` (padrão das vendas) + transições via
  `updateMany` condicional (padrão dos estornos).

## 4. Transições de status (instrução 4 — só no servidor)

| De | Para | Regra |
|---|---|---|
| — | `OPEN` | criação com `amount > 0`, `dueDate` obrigatório, contraparte da mesma empresa |
| `OPEN` | `PAID` | liquidação: grava `paidAt`; **se dinheiro**, cria `CashMovement` na sessão aberta (lock) e grava `cashMovementId` |
| `PAID` | `OPEN` | estorno de liquidação (motivo obrigatório); estorna o `CashMovement` vinculado com o mecanismo `REVERSAL` existente |
| `OPEN` | `CANCELLED` | cancelar título (motivo obrigatório); sem volta |
| qualquer | — | `OVERDUE` **não é status armazenado**: é derivado (`status = OPEN` e `dueDate < hoje`) — evita job de varredura e mantém filtro por período correto (instrução 7) |

## 5. Relação com o caixa (instrução 6)

- **Venda continua lançando direto no caixa** (`SALE`, inCash só para
  `CASH`) — o `CashMovement` da venda **é** o registro que prova que a
  venda foi recebida; nenhuma venda é "considerada recebida" fora do
  caixa.
- Títulos a prazo (fiado) entram como `OPEN` e só afetam o caixa quando
  **liquidados** → nenhum saldo de caixa sem movimento correspondente.

## 6. Testes planejados (lista do roteiro)

1. Criar conta a pagar e a receber (+ validações de campo)
2. Marcar pagamento/recebimento e validar saldos (`cash/summary`
   coerente)
3. Cancelamento e estorno auditáveis (motivo, autor, devolução única)
4. Relatórios por período e status (previsto × realizado)
5. Isolamento por empresa (padrão A×B: leitura/escrita cruzada → 404)
6. Arredondamento e decimais (12,2; soma por período no servidor)

## 7. Escopo da migration e plano de reversão

- **Aditiva apenas:** 1 tabela nova + 3 enums novos + colunas de relação
  (`financialEntries`) nos models existentes. **Nenhuma tabela/coluna
  existente é alterada ou removida.**
- **Reversão:** `DROP` da tabela e dos enums + remoção das relações
  (nada de dados de produção é perdido além dos próprios títulos);
  rollback documentado no CHANGELOG da etapa.
- Ordem: schema → migration SQL → `db:validate` → API (`financial`) →
  UI (`/financeiro` abas) → testes → docs.

## 8. Decisões que dependem do proprietário

| # | Questão | Opções |
|---|---|---|
| **D1** | Forma do modelo | **(a)** modelo único `FinancialEntry` com `direction` (recomendado — uma tabela, UI/testes compartilhados) · (b) dois modelos `Payable`/`Receivable` |
| **D2** | Venda × títulos | **(a)** manter venda só no caixa (recomendado — instrução 6 satisfeita pelo `CashMovement` da venda); títulos = lançamentos manuais/assinaturas · (b) venda com cliente também gera `Receivable` já liquidado (rastro duplo) |
| **D3** | Origem no caixa ao liquidar título | **(a)** estender `CashMovementOrigin` com `ACCOUNT` (migration aditiva de enum, recomendado — semântica clara) · (b) usar `MANUAL` sem mexer no enum |
| **D4** | Aprovação da migration aditiva (§7) para implementar a Etapa 8 | aprovar / propor ajustes |
