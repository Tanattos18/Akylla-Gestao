# Ordem de serviço — regras do módulo (Fase 2 · 2.3)

> Regras do módulo `SERVICE_ORDERS`. Estudadas, **sem copiar código**, em
> OCA/repair (`repair_service`, `repair_quotation_manual_sync`) e no
> ERPNext (*Maintenance Visit*), conforme `upgrade/REFERENCIAS_GIT.md`.

## Ciclo de vida (transições estritas)

```
RASCUNHO → ORÇAMENTO → APROVADA → EM EXECUÇÃO → CONCLUÍDA
    └──────────┴───────────┴────────────┴──→ CANCELADA (com motivo)
```

- `PATCH /status` aceita **só o próximo estado**. Pular etapa → 400; OS
  concluída/cancelada → 409.
- Emitir o orçamento exige ao menos 1 item.
- Cancelar exige motivo (3–500) e só vale para OS não concluída. A
  conclusão é **final**, porque já gerou estoque, financeiro e comissão.
- Cada passo registra data e hora (`quotedAt`, `approvedAt`, `startedAt`,
  `completedAt`, `cancelledAt`).
- A troca de estado usa `updateMany` condicional ao estado atual: dois
  cliques simultâneos não avançam duas vezes (409).

## Itens e valores (autoridade do servidor)

| Item | Preço |
|---|---|
| Serviço do catálogo | preço do serviço (o valor enviado é ignorado) |
| Produto/peça do catálogo | preço de venda do produto |
| Item livre (mão de obra, peça avulsa) | valor informado (obrigatório) |

- Subtotal, desconto e total são calculados no servidor; desconto maior
  que o subtotal → 400.
- **Itens, desconto, técnico e título** só mudam em rascunho/orçamento.
  Depois da aprovação ficam **travados** (409). As observações continuam
  editáveis até o cancelamento.
- Número sequencial **por empresa** (`OS-00001`), gerado com a linha da
  empresa travada.

## Conclusão (uma transação)

1. **Estoque:** produtos usados saem do estoque (locks por id, em ordem
   fixa) com movimento `OUT` (referência `OS-xxxxx`). Estoque insuficiente
   → 400 e **nada** é gravado; a OS continua "em execução".
2. **Financeiro:** uma conta **a receber** do cliente
   (`origin: SERVICE_ORDER`) no valor total, se maior que zero. O valor não
   pode ser editado no financeiro (vem da OS).
3. **Comissão** do técnico (se houver e o módulo estiver ativo): base =
   itens com o desconto rateado; regras como em `COMISSOES.md` (serviços
   usam a regra do profissional ou o padrão). `ON_SALE` libera na
   conclusão; `ON_PAYMENT`/`SPLIT` liberam quando a conta da OS é recebida.

## Anexos (fotos e laudos)

- `POST /attachments` (campo `file`): **JPG, PNG ou PDF até 5 MB**, no
  máximo 20 por OS.
- O tipo é verificado pelos **bytes do arquivo** (assinatura), não pela
  extensão. Um texto renomeado para `.png` → 400.
- Guardados em disco em `UPLOADS_DIR/service-orders/<empresa>/<os>/` com
  nome aleatório. O nome original só é exibido, depois de saneado, e nunca
  entra no caminho.
- Download com `Content-Type` real, `nosniff` e `no-store`. Outra empresa
  → 404.
- Remover só antes de concluir/cancelar. Depois disso, os anexos são
  histórico.
- ⚠️ **Os anexos não estão no backup do banco.** A pasta `UPLOADS_DIR`
  precisa de cópia própria (ver `backup/README.md`).

## WhatsApp

Uma mensagem enviada em `/api/whatsapp/messages` com `serviceOrderId`
(OS do mesmo cliente) fica vinculada à OS
(`origin: SERVICE_ORDER`, `originId`). `GET /service-orders/:id/messages`
lista o histórico.

## Permissões e isolamento

- Módulo opcional `SERVICE_ORDERS`.
- Operação do dia a dia: **qualquer usuário** da empresa abre e movimenta
  OS (como no PDV).
- RLS nas 3 tabelas; outra empresa → 404.

## Fora do escopo desta entrega

- Assinatura do cliente na aprovação, garantia, checklist de entrada do
  equipamento e OS recorrente.
- Envio automático de WhatsApp a cada mudança de etapa. Hoje o envio é
  manual com vínculo à OS.
- Itens com profissionais diferentes na mesma OS (um técnico por OS).
