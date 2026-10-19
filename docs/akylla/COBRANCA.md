# Cobrança do SaaS e painel do dono — regras (Fase 8)

> Decisões do proprietário (2026-10-18):
> - preços sugeridos aprovados;
> - teste grátis de 14 dias;
> - inadimplente fica em **somente leitura**;
> - contratação por WhatsApp e pagamento registrado pelo dono, até a
>   conta Mercado Pago (CNPJ) ficar pronta.

## Kits de acesso (Fase 8b)

Todo kit inclui o **núcleo**: vendas/PDV, estoque, caixa, clientes,
produtos, financeiro e relatórios. Os **módulos** variam por kit, e o
cliente pode somar módulos avulsos (combo personalizado).

| Kit | Mensal | Anual (2 meses grátis) | Módulos incluídos | Usuários | Clientes | Produtos |
|---|---|---|---|---|---|---|
| Básico | R$ 79,90 | R$ 799,00 | Automação WhatsApp, Crediário | 3 | 200 | 100 |
| Intermediário | R$ 149,90 | R$ 1.499,00 | + Serviços, Agendamentos, Comissões | 10 | 1.000 | 500 |
| Avançado | R$ 249,90 | R$ 2.499,00 | todos os 9 módulos | ilimitado | ilimitado | ilimitado |

| Módulo avulso | Mensal |
|---|---|
| Automação WhatsApp | R$ 29,90 |
| Crediário | R$ 19,90 |
| Serviços | R$ 9,90 |
| Agendamentos | R$ 19,90 |
| Comissões | R$ 19,90 |
| Ordens de serviço | R$ 29,90 |
| Nota fiscal | R$ 39,90 |
| Assinaturas de clientes | R$ 19,90 |
| Pets | R$ 9,90 |

- **Combo:** kit + avulsos. Mensal = kit + soma dos avulsos; anual = kit
  anual + 10× cada avulso. Ex.: Básico + Nota fiscal = R$ 119,80/mês.
  Avulso que o kit já inclui não é cobrado.
- **Preços, módulos de cada kit e limites são editáveis** em
  **Plataforma › Kits e módulos** (os valores acima são a sugestão
  inicial da migration `20261019150000_module_kits`).
- **Quem usa o quê:**
  - teste grátis e empresa isenta → **todos** os módulos;
  - assinatura (ativa, em tolerância ou somente leitura) → só o kit + avulsos;
  - módulo não contratado some do menu, aparece como "Não contratado ·
    contratar" em Configurações › Módulos, e a API responde **403**
    `MODULE_NOT_CONTRACTED`. Os dados do módulo **não são apagados**.
- O cliente vê os kits e monta o combo em **Faturamento › Monte seu plano**;
  o botão leva o resumo (kit, avulsos, ciclo e total) para o WhatsApp.

Os limites só valem com assinatura paga. Taxa de implantação (opcional) é
combinada à parte, registrada como pagamento com observação.

## Ciclo de vida da empresa

```
cadastro ──► TESTE (14 dias) ──► pagou ──► ATIVA ──► venceu ──► TOLERÂNCIA (5 dias) ──► SOMENTE LEITURA
                 │                                                      ▲                        │
                 └──────────────── não pagou ───────────────────────────┘          pagou ◄───────┘
dono: ISENTAR (sem cobrança) · SUSPENDER (bloqueia login) · REATIVAR
```

| Situação | O cliente vê | Pode alterar dados? |
|---|---|---|
| Em teste | aviso nos últimos 7 dias | sim |
| Ativa | aviso 5 dias antes de vencer | sim (com os limites do plano) |
| Vencida (tolerância) | aviso vermelho com os dias restantes | sim |
| Somente leitura | aviso vermelho fixo; alterações respondem "regularize em Faturamento" | **não** (consulta, exportação, faturamento e sair continuam) |
| Suspensa | não entra (login bloqueado) | — |
| Isenta | nada | sim |

**Nunca se apaga dado** de empresa vencida ou suspensa.

## Passo a passo para liberar um cliente

1. **Cadastrar:** em **Plataforma › + Nova empresa**, informe o nome da
   empresa, o responsável, o e-mail (login) e os dias de teste (padrão
   14; 0 se ele já vai pagar). Sai uma **senha provisória**: use
   **Copiar mensagem** e mande pelo WhatsApp.
2. **Primeiro acesso:** o cliente entra em `app.akyllagestao.com.br`,
   troca a senha em **Minha conta** (clique no nome, no canto superior
   direito) e escolhe o perfil do negócio.
3. **Contratou:** recebeu o Pix ou boleto, vá em **Registrar pagamento**
   (kit, avulsos, mensal/anual, forma e valor — o valor sugerido já soma o
   combo). Libera na hora só o que foi contratado.
   - Trocar kit ou avulsos sem cobrar agora (upgrade combinado, cortesia,
     correção): botão **Módulos** da empresa. Vale na hora.
4. **Renovação:** a cada pagamento, **Registrar pagamento** de novo. O
   período soma ao final do atual, sem perder dias pagos.
5. **Não pagou:** o sistema avisa sozinho, dá 5 dias de tolerância e
   depois fica em somente leitura. Pagou, **Registrar pagamento** e volta
   na hora. Casos extremos: **Suspender**.

## Como cobrar hoje (sem Mercado Pago em produção)

1. O cliente se cadastra em `app.akyllagestao.com.br/cadastro` e ganha 14
   dias. O cadastro aberto exige SMTP; até lá, o dono cria a empresa pelo
   `create-admin.sh` ou indica o formulário do site.
2. Em **Faturamento**, os botões "Contratar mensal/anual" abrem o
   WhatsApp de vendas (`NEXT_PUBLIC_SALES_WHATSAPP`) com o plano escolhido.
3. O cliente paga por Pix ou boleto. **Faturamento › Pagar com Pix** mostra
   a chave Pix da Akylla (Mercado Pago), o favorecido, o botão "Copiar chave
   Pix" e "Enviar comprovante" (WhatsApp). Trocar a chave:
   `NEXT_PUBLIC_PIX_KEY` / `NEXT_PUBLIC_PIX_RECEIVER` (exige rebuild da web).
4. O dono abre **Administração › Plataforma** e usa **Registrar pagamento**
   (plano, ciclo, forma, valor e observação). A empresa fica ativa na hora
   e o pagamento entra no histórico.

## Painel do dono (`/plataforma`)

- **Acesso:** só e-mails em `PLATFORM_ADMIN_EMAILS` (o `create-admin.sh`
  preenche com a primeira conta), com papel ADMIN e, **em produção, com a
  verificação em duas etapas ativa** (Configurações › Segurança).
- **Contadores por situação**, com filtro e busca por empresa,
  identificador, CNPJ ou e-mail do admin.
- **Por empresa:**
  - admin, uso (usuários, clientes, produtos, vendas em 30 dias) e último
    acesso;
  - kit e avulsos contratados;
  - ações: registrar pagamento, módulos, +teste, isentar, ver pagamentos,
    nova senha, suspender e reativar.
- **Aba Kits e módulos:** edita preço mensal/anual, módulos incluídos e
  limites de cada kit, e o preço/"à venda" de cada módulo avulso.
- **Registro:** cada ação fica no log da API com o e-mail do dono, e os
  pagamentos ficam na tabela `PlatformPayment`, que não se altera.

## Segurança

- A empresa **não consegue ativar nem renovar o próprio plano**. As rotas
  antigas que permitiam isso foram removidas na Fase 8.
- O painel do dono usa conexão de sistema (atravessa a RLS de propósito)
  e só responde atrás do `PlatformGuard`.

## Pendente

- **Mercado Pago em produção** (conta de vendedor com CNPJ):
  - assinatura recorrente automática;
  - confirmação por webhook a cada cobrança (`subscription_authorized_payment`)
    estendendo o período;
  - botão "Pagar agora" em Faturamento.
- **Nota fiscal de serviço do próprio SaaS:** emitida pelo contador ou
  integradora, fora do sistema.
