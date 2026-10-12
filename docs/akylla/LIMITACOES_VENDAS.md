# Akylla Gestão — Fluxo de venda validado e limitações (Etapa 7)

**Data:** 12/10/2026
**Natureza:** conferência do fluxo PDV → venda → estoque → caixa contra o
roteiro da Etapa 7. Nenhuma alteração de código foi necessária: o fluxo
atende os 9 itens do roteiro. Suíte de base: **444/444**.

---

## 1. Decisão de caixa (roteiro, instrução 2)

**Mantida a regra de abertura/fechamento de caixa por turno** (decisão
original da base, "Vendas exigem caixa aberto"). Nada foi alterado — a
instrução do roteiro proíbe mudar essa regra silenciosamente; qualquer
simplificação (venda sem sessão) depende de decisão explícita futura.

## 2. Fluxo validado — evidência por item do roteiro

| # | Instrução do roteiro | Evidência [Código] / [Teste] |
|---|---|---|
| 1 | Mapear fluxo PDV, caixa e venda | `sales.service.ts` (`create`/`cancel`), `cash.service.ts`, UI `/pdv`, `/vendas`, `/caixa` |
| 2 | Definir regra de caixa com o proprietário | §1 acima — mantida |
| 3 | Recalcular preços, descontos e totais no servidor | **[Teste]** `sales.test` "valores adulterados pelo frontend são ignorados", "desconto maior que o subtotal é rejeitado" |
| 4 | Validar estoque e cliente quando selecionado | **[Teste]** "estoque insuficiente é rejeitado", "produto de outra empresa retorna 404", "cliente inativo é rejeitado", "clientId de outra empresa é rejeitado" |
| 5 | Gravar venda, itens, estoque e financeiro em transação | **[Código]** `$transaction` + `lockOpenCashSession` (`sales.service.ts` L103, L225); **[Teste]** "venda válida baixa estoque e registra movimento" |
| 6 | Snapshots dos itens vendidos | **[Código]** `SaleItem.productName/unitPrice`; **[Teste]** "detalhe preserva snapshot mesmo após renomear o produto" |
| 7 | Idempotência contra venda duplicada | **[Código]** `clientRequestId` único por venda; **[Teste]** "mesmo clientRequestId não cria duas vendas" |
| 8 | Cancelamentos/estornos auditáveis e consistentes | **[Código]** motivo obrigatório (≥3), `AdminGuard`, devolução única de estoque, `CashMovement` `SALE_CANCELMENT`; **[Teste]** "admin cancela com motivo e devolve estoque uma única vez", "segundo cancelamento retorna 409", "cancelamento é registrado no histórico" |
| 9 | Não anunciar fiscal/adquirente/conciliação | **[Código]** grep em `/pdv`, `/vendas`, `/caixa`: nenhuma menção a fiscal, maquininha, adquirente ou conciliação |

## 3. Testes do roteiro — cobertura

| Teste exigido | Existe |
|---|---|
| Venda válida | ✓ `sales.test` L200 |
| Estoque insuficiente | ✓ L333 |
| Desconto inválido | ✓ L351 (negativo), L364 (> subtotal) |
| Dupla submissão | ✓ L409 |
| Falha durante transação | ✓ L333 (não altera nada), L707 (rollback), L442 (concorrência) |
| Cancelamento e estorno | ✓ L563–L636 + `cash.test` L285–L305 |
| Consistência venda × estoque × financeiro | ✓ `cash.test` L235–L305 (`SALE`, `SALE_CANCELMENT`, estorno único) |

## 4. Limitações explícitas (entregável)

1. **Sem emissão fiscal** (NF-e/NFC-e), **sem integração com
   adquirentes/POS** e **sem conciliação bancária** — nada disso existe
   nem será anunciado (roteiro, instrução 9).
2. **Cancelamento apenas total** — não há troca, devolução parcial ou
   rateio de cancelamento (`POST /sales/:id/cancel` cancela a venda
   inteira e devolve todo o estoque).
3. **Uma forma de pagamento por venda** — `paymentMethod` é único
   (CASH/PIX/CREDIT/DEBIT/TRANSFER/OTHER); venda com múltiplas formas
   (ex.: parte pix, parte dinheiro) não é suportada.
4. **Venda exige caixa aberto** — não há venda fora de sessão de caixa
   (regra mantida, §1); caixa é in-memory por processo (rate limit e
   sessões não sobrevivem a restart — risco da auditoria §7).
5. **Pagamento de assinatura de cliente não tem origem dedicada** no
   caixa — grava `CashMovementOrigin.MANUAL` (`subscriptions.service.ts`
   L208, L280); futuras origens exigem migration de enum (decisão
   futura).
6. **Movimentos de estoque não têm chave de idempotência** (só vendas
   têm `clientRequestId`) — requisição repetida cria dois movimentos,
   com saldo sempre consistente (testado na Etapa 6); coluna nova
   exigiria migration.
7. **Sem lote, validade ou número de série** por item — controle de
   estoque é quantitativo (3 decimais) e por produto.
8. **Sem venda offline/PDV nativo** — PDV é página web com sessão
   autenticada; sem funcionamento sem rede.
9. **Recibo é comercial, não fiscal** — `PF-` (prefixo preservado da
   base por regra permanente), PDF via `Receipt.tsx`.

## 5. Conclusão

Fluxo de venda ponta a ponta testado sem inconsistências financeiras ou
de estoque (critério de conclusão da Etapa 7). Nenhum código alterado;
entregável documental. Limitações acima são conhecidas e aceitas até
decisão em contrário.
