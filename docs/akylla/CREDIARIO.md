# Crediário — regras do módulo (Fase 2 · 2.2)

> Regras do módulo `CREDIT`. Estudadas, **sem copiar código**, em
> OCA/account-payment (`account_payment_term_extension`, `account_due_list`)
> e no ERPNext (*Payment Terms* / *Payment Schedule*), conforme
> `upgrade/REFERENCIAS_GIT.md`.

## Conceitos

| Conceito | No Akylla |
|---|---|
| **Conta de crediário** | uma por cliente. Tem **limite** aprovado pelo ADMIN, **saldo em aberto** e situação (liberado ou bloqueado) |
| **Parcela** | parte de uma venda a prazo, com número/total, vencimento, valor e status (em aberto, paga, vencida ou cancelada) |

## Venda no crediário (PDV)

1. Forma de pagamento **Crediário**. Exige cliente e o plano
   `{ installments: 1–24, firstDueDate }`.
2. **Autoridade do servidor:** o PDV envia só a quantidade de parcelas e o
   1º vencimento. Valores e datas são calculados no servidor; o roteiro
   original sugeria receber `[{dueDate, amount}]` do cliente, o que violaria
   a regra de que o servidor manda.
3. **Validações**, na mesma transação, com a conta travada
   (`FOR UPDATE`, depois de caixa e produtos, em ordem fixa):
   - módulo `CREDIT` desativado → 403
   - cliente sem conta → 403 "sem crediário aprovado"
   - conta bloqueada → 403
   - `saldo + total da venda > limite` → 403 com o valor disponível
   - 1º vencimento no passado → 400
4. **Parcelas:** iguais, arredondadas para baixo, com a sobra de centavos
   na **última** (soma = total). Vencimentos **mensais** no mesmo dia; em
   meses mais curtos vale o último dia (31/01 → 28/02 → 31/03).
5. Cada parcela gera uma **conta a receber** no financeiro
   (`origin: CREDIT_SALE`, com o cliente). O saldo da conta sobe o total
   da venda.
6. **Caixa:** a venda a prazo **não** lança entrada no caixa. O dinheiro
   entra quando cada parcela é recebida.

## Vencimento

Feito na leitura: listagens, detalhe e pagamento marcam como `OVERDUE` as
parcelas em aberto cujo vencimento é anterior a hoje (dia em UTC, como os
demais períodos do sistema).

## Recebimento

`POST /api/credit-installments/:id/pay` (ADMIN) liquida a conta a receber
pelo financeiro. Exige **caixa aberto**, gera entrada no caixa, marca a
parcela como paga e desconta o valor do saldo. O financeiro fica
sincronizado:

- receber a parcela pela tela `/financeiro` tem o mesmo efeito;
- estornar o recebimento devolve a parcela para "em aberto" e o valor ao
  saldo;
- o título da parcela não pode ser editado nem cancelado avulso (409).

**Comissões:** quando a **última** parcela de uma venda é paga, as
comissões que aguardavam o pagamento (`ON_PAYMENT`/`SPLIT_50_50`) são
liberadas automaticamente. Ver `COMISSOES.md`.

## Cancelamento da venda

| Parcela | Efeito |
|---|---|
| Em aberto / vencida | `CANCELLED`, a receber cancelado, valor sai do saldo |
| Paga | permanece paga; o **total já pago é devolvido** ao cliente pela saída `SALE_CANCELMENT` no caixa |

## Permissões e isolamento

- Módulo opcional `CREDIT` (`@RequireModule`).
- Leitura (carteira, parcelas): todos. Aprovar limite, bloquear e receber:
  ADMIN.
- `companyId` da sessão; outra empresa → 404; RLS em `CreditAccount` e
  `CreditInstallment`.

## Fora do escopo desta entrega

- Baixa **parcial** de parcela, juros e multa por atraso, renegociação.
- Entrada (sinal) na venda a prazo e intervalo diferente de mensal.
- Envio de cobrança pelo WhatsApp (já há fila e templates; virá depois).
