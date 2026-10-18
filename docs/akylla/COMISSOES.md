# Comissões — regras do módulo (Fase 2 · 2.1)

> Documento de regras do módulo `COMMISSIONS`, escrito antes da
> implementação. As regras foram estudadas em
> [OCA/commission](https://github.com/OCA/commission) (AGPL-3.0) e no
> ERPNext (GPL-3.0), **apenas como referência**: nenhum código foi copiado
> (`upgrade/REFERENCIAS_GIT.md`).

## Conceitos

| Conceito | No Akylla |
|---|---|
| **Profissional** | quem recebe comissão (vendedor, tosador, cabeleireiro). Não precisa ser usuário do sistema. Nunca é apagado, só inativado |
| **Regra** | percentual com alvo opcional: profissional e/ou produto **ou** categoria. Tem política de liberação e pode ser ativada/desativada |
| **Comissão** | uma por (venda × profissional), com o detalhamento por item em `lines` |

## Cálculo (sempre no servidor)

1. **Base por item** = subtotal do item com o desconto da venda **rateado
   proporcionalmente**. Os centavos que sobram vão para o último item, de
   modo que a soma das bases é exatamente o total da venda.
2. **Percentual por item**, onde a regra mais específica vence:
   1. regra do **produto** para o profissional da venda
   2. regra do **produto** para todos
   3. regra da **categoria** do produto para o profissional
   4. regra da **categoria** para todos
   5. regra **só do profissional** (sem produto/categoria)
   6. **comissão padrão** do profissional (`commissionDefault`)
   7. regra **geral** da empresa (sem profissional, produto ou categoria)
   8. nenhuma: 0%
3. **Valor total** = soma exata de base × % ÷ 100, arredondada **uma vez**
   a 2 casas (meio para cima). Os valores por item são arredondados e a
   sobra de centavos vai para o último item com comissão. Assim a soma das
   linhas é sempre igual ao total, sem o "centavo fantasma" de arredondar
   linha a linha (R$ 2,01 em vez de R$ 2,00 em 3 × R$ 6,67 a 10%).
4. Valor total 0 → nenhuma comissão é criada.

## Liberação (quando a comissão fica devida)

| Política | Regra |
|---|---|
| `ON_SALE` | libera na venda |
| `ON_PAYMENT` | libera quando a venda é paga |
| `SPLIT_50_50` | 50% na venda, 50% no pagamento |

Hoje **todas as formas de pagamento do PDV liquidam na hora**, então as
três políticas liberam na venda. O crediário (Fase 2 · 2.2) trará vendas a
prazo e o efeito real de `ON_PAYMENT`/`SPLIT`. Se as linhas de uma venda
tiverem políticas diferentes, vale a mais conservadora
(`ON_PAYMENT` > `SPLIT` > `ON_SALE`).

**Liberar** (automático na venda ou `POST /api/commissions/:id/release`
para pendentes): `PENDING → RELEASED` e cria uma **conta a pagar**
(`FinancialEntry` `PAYABLE`, `origin: COMMISSION`, `originId` = comissão).

## Pagamento

`POST /api/commissions/:id/pay` (ADMIN) liquida a conta a pagar pelo
financeiro: exige **caixa aberto**, gera saída no caixa e marca a comissão
`PAID`. O financeiro fica sincronizado nos dois sentidos:

- liquidar o título em `/financeiro` marca a comissão como paga;
- estornar a liquidação devolve a comissão para `RELEASED`;
- títulos de comissão **não podem** ser editados (o valor é calculado) nem
  cancelados avulsos (cancela-se a venda).

## Cancelamento da venda (histórico imutável)

| Situação da comissão | O que acontece |
|---|---|
| `PENDING` / `RELEASED` | comissão `CANCELLED` + conta a pagar `CANCELLED` (com o motivo) |
| `PAID` | comissão `CANCELLED` + **conta a receber** do profissional (`origin: COMMISSION_REVERSAL`), que é o estorno auditado. O título pago original fica como está |

Tudo ocorre na mesma transação do cancelamento da venda.

## Permissões e isolamento

- Módulo opcional `COMMISSIONS` (`@RequireModule`). Desativado: rotas → 403
  e venda com profissional → 403. Venda sem profissional segue normal.
- Leitura de profissionais e comissões: todos os usuários. Cadastro,
  regras, liberar e pagar: ADMIN.
- `companyId` sempre da sessão; leitura individual de outra empresa → 404;
  RLS nas 3 tabelas novas (regra do AGENTS.md).

## Fora do escopo desta entrega

- Comissão por item com profissionais diferentes na mesma venda (hoje é um
  profissional por venda). A ordem de serviço (2.3) trará profissional por
  serviço.
- Faixas/metas (comissão escalonada) e pagamento em lote por período.
  Hoje o fechamento mostra os totais por profissional e o pagamento é por
  comissão.
