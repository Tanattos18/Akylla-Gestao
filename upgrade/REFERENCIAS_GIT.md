# Referências no GitHub — por módulo do roteiro

> Repositórios para **consultar antes de implementar cada módulo** do
> [`Prompt_Mestre.md`](Prompt_Mestre.md). Levantamento de 2026-10-18.
> Estrelas, licença e data da última atividade foram conferidas pela API
> do GitHub nesse dia.
>
> **Uso:** antes de cada módulo, estudar a referência (1–2 h) e registrar
> as regras adotadas num documento curto em `docs/akylla/`. Depois
> implementar **no nosso padrão**: `companyId` da sessão, valores
> calculados no servidor, histórico imutável, `AdminGuard`/`ModuleGuard`
> e testes. Nenhum desses projetos substitui o nosso código.

## Regra de licença (ler antes de abrir qualquer link)

| Licença | O que podemos fazer |
|---|---|
| **MIT, Apache-2.0, ISC** | 🟢 **copiar e adaptar código**, mantendo o aviso de copyright do autor (comentário no arquivo + menção no CHANGELOG) |
| **MPL-2.0** | 🟡 usar como dependência; alterações *nos próprios arquivos* da lib precisam ser publicadas |
| **LGPL-3.0** | 🟡 usar como biblioteca sem alterar; não copiar trechos para o nosso código |
| **GPL-3.0** | 🟠 **estudar regras e fluxos; não copiar código.** Usar como dependência só no servidor e após confirmação jurídica |
| **AGPL-3.0** | 🔴 **só estudar** (regras de negócio, modelagem, casos de borda). Copiar código obrigaria a abrir o código do Akylla, que é um SaaS |

Na dúvida, vale a regra mais restritiva: estudar, sem copiar.

---

## Fase 1 — Confiabilidade

| Item | Repositório | Licença | ★ | O que usar |
|---|---|---|---|---|
| 1B · Monitoramento | [getsentry/sentry-javascript](https://github.com/getsentry/sentry-javascript) | MIT | 8,7 mil | SDK oficial (`@sentry/node` já instalado; `@sentry/nestjs` e `@sentry/nextjs`). Guia: [docs.sentry.io › NestJS](https://docs.sentry.io/platforms/javascript/guides/nestjs/) e [› Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/) |
| 1C · Rate limit distribuído | [animir/node-rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible) | ISC | 3,5 mil | stores Redis e memória com contador atômico. Encaixa atrás da nossa interface `rate-limit-store.ts` |
| 1C · Rate limit (alternativa serverless) | [upstash/ratelimit-js](https://github.com/upstash/ratelimit-js) | MIT | 2 mil | se o Redis for Upstash (HTTP, sem conexão persistente) |
| 1C · Rate limit Nest | [nestjs/throttler](https://github.com/nestjs/throttler) | MIT | 711 | referência de interface de storage. ⚠️ [kkoomen/nestjs-throttler-storage-redis](https://github.com/kkoomen/nestjs-throttler-storage-redis) está **descontinuado**: não usar |
| 1D · E-mail | [nodemailer/nodemailer](https://github.com/nodemailer/nodemailer) | MIT | 17,6 mil | envio SMTP para verificação de e-mail e reset de senha |
| 1D · E-mail (alternativa API) | [resend/resend-node](https://github.com/resend/resend-node) | MIT | 966 | se escolhermos o Resend em vez de SMTP |
| 1D · Captcha | [Cloudflare Turnstile — validação no servidor](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) | docs | — | chamada `siteverify` no `POST /api/auth/register` |
| 1E · **RLS com Prisma** | [prisma/prisma-client-extensions › `row-level-security`](https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security) | Apache-2.0 | 228 | 🟢 **exemplo oficial** de `set_config('app.current_company_id', …)` por transação via extensão do Prisma. Base direta do `withTenantContext` |
| 1E · Auditoria | [prisma/prisma-client-extensions › `audit-log-context`](https://github.com/prisma/prisma-client-extensions/tree/main/audit-log-context) | Apache-2.0 | — | mesmo padrão (contexto por transação), útil para o log de quem alterou |

## Fase 2 — Retenção

### 2.1 Comissões

| Repositório | Licença | ★ | Onde olhar |
|---|---|---|---|
| [OCA/commission](https://github.com/OCA/commission) | AGPL-3.0 | 168 | `commission_oca` (regras, tipos fixo/percentual/por faixa), `sale_commission_oca` (comissão na venda), `account_commission_oca` (liberação por pagamento e fechamento por período), `hr_commission_oca` (comissão por funcionário). 🔴 só estudar |
| [frappe/erpnext](https://github.com/frappe/erpnext) | GPL-3.0 | 40 mil | doctypes *Sales Partner*, *Sales Person* e *Commission* (taxa por item/parceiro, relatório de comissões). 🟠 só estudar |

**Pontos a extrair:** precedência de regra (produto > profissional >
padrão), liberação na venda × no pagamento, estorno quando a venda é
cancelada, fechamento por período.

### 2.2 Crediário

| Repositório | Licença | ★ | Onde olhar |
|---|---|---|---|
| [OCA/account-payment](https://github.com/OCA/account-payment) | AGPL-3.0 | 117 | `account_payment_term_extension` (parcelas, dias, arredondamento da última parcela), `account_due_list` (carteira de vencimentos). 🔴 só estudar |
| [OCA/l10n-brazil › `l10n_br_account_due_list`](https://github.com/OCA/l10n-brazil) | AGPL-3.0 | 367 | vencimentos no contexto brasileiro. 🔴 só estudar |
| [frappe/erpnext](https://github.com/frappe/erpnext) | GPL-3.0 | 40 mil | *Payment Terms Template* / *Payment Schedule*. 🟠 só estudar |

**Pontos a extrair:** soma das parcelas = total (centavos vão para a
última parcela), vencido calculado na leitura, baixa parcial, limite de
crédito.

### 2.3 Ordem de serviço

| Repositório | Licença | ★ | Onde olhar |
|---|---|---|---|
| [OCA/repair](https://github.com/OCA/repair) | AGPL-3.0 | 27 | `repair_service` (serviços na OS), `base_repair_config`, `repair_quotation_manual_sync` (orçamento → aprovação). 🔴 só estudar |
| [frappe/erpnext](https://github.com/frappe/erpnext) | GPL-3.0 | 40 mil | *Maintenance Visit* / *Warranty Claim*. 🟠 só estudar |

**Pontos a extrair:** máquina de estados (rascunho → orçamento →
aprovada → em execução → concluída / cancelada), o que trava após a
aprovação, geração de conta a receber na conclusão.

## Fase 3 — Fiscal (NFC-e / NF-e / NFS-e por integração)

| Repositório | Licença | ★ | Onde olhar |
|---|---|---|---|
| [**JoaoHenriqueBarbosa/FinOpenPOS**](https://github.com/JoaoHenriqueBarbosa/FinOpenPOS) | **MIT** | 104 | 🟢 **melhor referência de código**: TypeScript, Next.js 16 e React 19. Ver `packages/fiscal` e `packages/addon-fiscal` (NF-e/NFC-e) e `packages/event-sourcing`. Projeto pequeno: revisar antes de reaproveitar |
| [nfe/client-nodejs](https://github.com/nfe/client-nodejs) | MIT | 141 | 🟢 SDK oficial da **NFE.io** (TypeScript, sem dependências). Candidato a `NfeIoFiscalProvider` |
| [nfewizard-org/nfewizard-io](https://github.com/nfewizard-org/nfewizard-io) | GPL-3.0 | 319 | comunicação direta com a SEFAZ: `packages/nfce`, `packages/nfse`, `packages/danfe` e `STATUS_HOMOLOGACAO.md`. 🟠 estudar layout e erros comuns |
| [nfephp-org/sped-nfe](https://github.com/nfephp-org/sped-nfe) | LGPL/GPL/MIT (PHP) | 1,6 mil | referência mais madura de layout, validação e regras da SEFAZ (consulta) |
| [OCA/l10n-brazil](https://github.com/OCA/l10n-brazil) | AGPL-3.0 | 367 | `l10n_br_fiscal` (CFOP, NCM, CST, tributação), `l10n_br_fiscal_edi`, `l10n_br_fiscal_certificate` (certificado A1). 🔴 só estudar a modelagem fiscal |
| [lealhugui/node-dfe](https://github.com/lealhugui/node-dfe) | MIT | 259 | ⚠️ sem atividade desde 2023. Só consulta histórica |

**Integradoras (emissor autorizado; decisão do roteiro: não ter emissor
próprio):** [NFE.io — docs](https://nfe.io/docs/) ·
[Focus NFe — docs](https://focusnfe.com.br/doc/) · Spedy (site oficial).
Comparar preço por nota, NFS-e por município e webhook de status antes
de escolher.

**Apoio (dados brasileiros):** [brazilian-utils/javascript](https://github.com/brazilian-utils/javascript)
(MIT, 1,6 mil★). 🟢 Valida CPF/CNPJ com dígito verificador, CEP e
telefone. Resolve também a pendência "CPF valida só 11 dígitos".

## Fase 4 — Perfis, onboarding e CRM

| Repositório | Licença | ★ | Onde olhar |
|---|---|---|---|
| [twentyhq/twenty](https://github.com/twentyhq/twenty) | AGPL-3.0 (+ arquivos Enterprise) | 58 mil | CRM em **NestJS + TypeScript** (mesma stack). Estudar: workspaces multiempresa, onboarding, timeline do cliente, campos personalizados. 🔴 só estudar |
| [odoo/odoo](https://github.com/odoo/odoo) | LGPL-3.0 (Community) | 55 mil | assistente de instalação por "apps" (módulos por segmento). Comparação de produto |

## Fase 5 — Design e UX

| Repositório | Licença | ★ | O que usar |
|---|---|---|---|
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | MIT | 125 mil | 🟢 `Table`, `Dialog`, `Select`, `Toast`, `Tabs` (o roteiro prevê adotar). Os componentes são copiados para o projeto |
| [dequelabs/axe-core-npm](https://github.com/dequelabs/axe-core-npm) | MPL-2.0 | 727 | `@axe-core/playwright` para o `npm run test:a11y` |

## Fase 6 — Qualidade

| Repositório | Licença | ★ | O que usar |
|---|---|---|---|
| [microsoft/playwright](https://github.com/microsoft/playwright) | Apache-2.0 | 98 mil | E2E (rascunho já existe em `Arquivos Sem USO/fase6-wip-nao-commitado/`) |
| [nestjs/swagger](https://github.com/nestjs/swagger) | MIT | 1,9 mil | OpenAPI em `/api/docs` |

## Fase 7 — Produto (comparação de funcionalidades)

| Repositório | Licença | ★ | Para quê |
|---|---|---|---|
| [alextselegidis/easyappointments](https://github.com/alextselegidis/easyappointments) | GPL-3.0 | 4,4 mil | agenda semana/mês, disponibilidade por profissional. 🟠 só estudar |
| [opensourcepos/opensourcepos](https://github.com/opensourcepos/opensourcepos) | MIT (exige manter o crédito no rodapé) | 4,4 mil | PDV, impressão de cupom, relatórios |
| [medusajs/medusa](https://github.com/medusajs/medusa) | MIT (exceto materiais Enterprise) | 36 mil | estoque multi-local, promoções, modelagem de comércio em TypeScript |
| [Dolibarr/dolibarr](https://github.com/Dolibarr/dolibarr) | GPL-3.0 | 7,7 mil | ERP/CRM completo para comparar funcionalidades. 🟠 só estudar |
| [frappe/erpnext](https://github.com/frappe/erpnext) | GPL-3.0 | 40 mil | ERP completo para comparar funcionalidades. 🟠 só estudar |

---

## Como registrar o uso

- **Código MIT/Apache/ISC reaproveitado:** comentário no topo do arquivo
  (`Adaptado de <repo> (<licença>), © <autor>`) e linha no CHANGELOG da
  entrega.
- **Referência só estudada:** citar o link no documento de regras do
  módulo (`docs/akylla/<MODULO>.md`).
- **Atualizar esta lista** quando uma referência for descartada,
  substituída ou sair de manutenção.
