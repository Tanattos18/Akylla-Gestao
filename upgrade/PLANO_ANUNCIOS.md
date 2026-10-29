# Plano — Módulo de Anúncios (Akylla Gestão)

> Transcrição do `PLANO_ANUNCIOS.pdf` do proprietário (proposta de
> 2026-10-29, baseada no commit `60067a5`). **Situação:** fases **A1** e
> **A2** autorizadas e implementadas em 2026-10-29; **A3 em diante
> aguardam autorização**, fase por fase (`AGENTS.md`, regra 2). O que
> mudou na implementação está marcado com *(implementação)*.

## 1. Objetivo

Vender gestão de anúncios aos clientes que já compraram site, perfil,
loja ou sistema, e controlar tudo no Akylla: o que está sendo anunciado,
quanto foi investido, quantos contatos vieram e quanto o cliente paga
pela gestão.

Regras de negócio fixas:

1. A verba dos anúncios é paga pelo cliente direto à plataforma (Meta,
   Google, TikTok), com o cartão dele. O Akylla nunca recebe nem guarda
   dinheiro de verba.
2. O que o Akylla cobra é a gestão (mensalidade + implantação), pelo
   fluxo de contratos que já existe.
3. Valores calculados (CPC, CTR, custo por contato) sempre no servidor,
   nunca aceitos do cliente.
4. Rastreamento nos sites sem dados pessoais (só contagens por dia).

## 2. Onde fica no sistema

| Lugar | O que mostra |
|---|---|
| Administração › Anúncios (novo, `adminOnly`, módulo `ADS`) | Visão geral, campanhas, contas de anúncio, relatórios |
| Ficha do cliente (`ClientTabs`) | Nova aba Anúncios: campanhas do cliente e resultados |
| Entrega (`/entregas/[id]`) | Indicador "rastreamento de anúncios ativo" e campanhas que apontam para o site |
| Catálogo digital | Novo tipo de produto Gestão de anúncios (os pacotes) |
| Contratos | Contrato do pacote de anúncios (cobrança, lembretes e pausa já existentes) |
| Início | Cartão "Anúncios": campanhas ativas, investimento do mês, contatos |

Por ser um `BusinessModule`, o módulo `ADS` também pode ser vendido
depois como item avulso do SaaS (kits/combos da Fase 8b).

## 3. O que reaproveitar

| Peça existente | Uso nos anúncios |
|---|---|
| `DigitalProduct` + `Subscription` | Pacotes de gestão (Básico, Crescimento, Premium) e contratos, sem tabela nova de preço |
| `contract-billing.ts` (worker) | Títulos a receber da mensalidade de gestão, automático |
| Lembretes de cobrança WhatsApp | Valem igual para o contrato de anúncios |
| `credential-crypto.ts` (AES-256-GCM) | Guardar tokens das APIs Meta/Google cifrados |
| `akylla-status.js` + chave pública da entrega | Já está nos sites vendidos: vira o rastreador de contatos (fase A3) |
| `rate-limit-store.ts` (Redis + fallback) | Limitar o endpoint público de rastreamento |
| `common/utils/csv.ts` + Importações | Importar o CSV exportado do Gerenciador de Anúncios (fase A2) |
| `WhatsAppTemplate` + presets | Modelo `relatorio_anuncios` para o resumo semanal |
| `ComboChart`, `StatCard`, `DataTable`, `Tabs` | Telas sem componente novo de base |
| `AdminGuard`, RLS, `withTenantContext` | Segurança igual ao resto |

## 4. Modelo de dados

Tudo com `companyId` + FK `Restrict` + índices por empresa + RLS FORCE
na mesma migration + entrada em `TENANT_TABLES`.

### 4.1 Enums

- `BusinessModule`: + `ADS`; `DigitalProductType`: + `ADS_MANAGEMENT`.
- `AdPlatform`: META (Facebook + Instagram), GOOGLE, TIKTOK, OTHER.
- `AdObjective`: MESSAGES, TRAFFIC, LEADS, SALES, PROFILE_VISITS, AWARENESS.
- `AdCampaignStatus`: DRAFT, WAITING_APPROVAL (cliente aprova arte/texto),
  ACTIVE, PAUSED, FINISHED.
- `AdMetricSource`: MANUAL, CSV (Gerenciador de Anúncios), API (fase A5).
- `AdTrackingEvent` (fase A3): PAGE_VIEW, WHATSAPP_CLICK, PHONE_CLICK, FORM_SUBMIT.
- `AdAccountConnection`: MANUAL (só o id da conta), API (token cifrado).
- *(implementação)* `AdLogAction` em vez de texto livre: CREATE, UPDATE,
  STATUS, METRIC, METRIC_FIX, CSV_IMPORT (SYNC entra na fase A5).

### 4.2 Tabelas

- `AdAccount` — conta de anúncio do CLIENTE (o cartão é dele): `clientId`,
  `platform`, `name`, `externalAccountId?`, `connection`, `tokenEncrypted?`
  (nunca devolvido), `tokenExpiresAt?`, `lastSyncAt?`, `lastSyncError?`,
  `status`; unique `(companyId, platform, externalAccountId)`.
- `AdCampaign` — `clientId`, `adAccountId?`, `deliveryId?` (site/loja/perfil
  promovido), `subscriptionId?` (contrato de gestão), `platform`,
  `objective`, `status`, `name`, `promotedItem`, `targetUrl?`,
  `utmCampaign` (gerado no servidor, único por empresa), `audienceNotes?`,
  `dailyBudget?`/`totalBudget?` (verba do cliente, referência), `startAt?`,
  `endAt?`, `externalCampaignId?`, `notes?`, `createdByUserId`.
- `AdMetricDaily` — por dia e por origem (unique `campaignId + date +
  source`): impressões, alcance, cliques, `spend`, resultados. Correção
  manual = novo lançamento que substitui o do mesmo dia/origem, com
  registro em `AdCampaignLog`.
- `AdTrackingDaily` (fase A3) — contagem diária vinda dos sites, sem IP,
  cookie ou dado pessoal.
- `AdReport` (fase A4) — foto imutável dos números do período.
- `AdCampaignLog` — histórico imutável (criar, ativar, pausar, corrigir
  métrica, conectar conta), mesmo padrão do `BillingActionLog`.

### 4.3 Indicadores (calculados no servidor)

| Indicador | Fórmula |
|---|---|
| CTR | cliques ÷ impressões |
| CPC | investimento ÷ cliques |
| Custo por resultado | investimento ÷ resultados |
| Contatos pelo site (A3) | WHATSAPP_CLICK + PHONE_CLICK + FORM_SUBMIT da campanha (rastreamento) |
| Custo por contato (A3) | investimento ÷ contatos pelo site |
| Investimento do mês | soma de `spend` (preferência: API > CSV > MANUAL no mesmo dia) |

Registrados em `docs/akylla/DICIONARIO_INDICADORES.md`.

## 5. API

Prefixo `/api`, `companyId` do contexto, escrita só com `AdminGuard`,
módulo exigido com `@RequireModule("ADS")`.

| Método | Rota | Função | Fase |
|---|---|---|---|
| GET | `/ads/overview?from&to` | Cartões da visão geral e por cliente | A1 |
| GET/POST | `/ads/accounts` | Listar/criar conta de anúncio | A1 |
| PATCH | `/ads/accounts/:id` | Editar; conectar token (A5) | A1 |
| GET/POST | `/ads/campaigns` | Listar (filtros: cliente, status, plataforma) / criar | A1 |
| GET/PATCH | `/ads/campaigns/:id` | Detalhe com indicadores / editar | A1 |
| POST | `/ads/campaigns/:id/status` | Ativar, pausar, finalizar (com motivo → log) | A1 |
| PUT | `/ads/campaigns/:id/metrics/:date` | Lançar/corrigir métrica do dia | A1 |
| POST | `/ads/campaigns/:id/metrics/import` | CSV do Gerenciador de Anúncios | A2 |
| GET | `/ads/campaigns/:id/link?url=` | Gera o link com UTM para colocar no anúncio | A1 |
| GET | `/clients/:id/ads` | Aba Anúncios na ficha do cliente | A1 |
| POST | `/ads/reports` | Gerar relatório de período (snapshot) | A4 |
| GET | `/ads/reports/:id/message` | Texto pronto para copiar/enviar no WhatsApp | A4 |
| POST | `/public/track/:key` | Público: incrementa contador; CORS aberto, limite por IP (Redis), 204 | A3 |
| GET | `/public/ads-report/:key` | Público: página de leitura do relatório | A4 |

## 6. Telas

1. `/anuncios` — visão geral: período; cartões (campanhas ativas,
   investimento do cliente no mês, contatos, custo médio, receita de
   gestão no mês vinda dos contratos `ADS_MANAGEMENT`); tabela por
   cliente; alerta de campanhas sem métrica há 3+ dias.
2. `/anuncios/campanhas` — lista com filtros; Nova campanha: cliente → o
   que promover (entrega ou texto livre) → plataforma e objetivo → verba
   de referência e datas → gera o link com UTM.
3. `/anuncios/campanhas/[id]` — gráfico investimento × resultados por dia
   (`ComboChart`), indicadores, lançar métrica do dia, importar CSV,
   histórico (log), botões de status.
4. `/anuncios/contas` — contas de anúncio por cliente; na fase A5,
   "Conectar com a Meta/Google".
5. `/anuncios/relatorios` — gerar, copiar mensagem, ver enviados (A4).
6. Ficha do cliente › aba Anúncios e Entrega › Anúncios.
7. Menu: `{ label: "Anúncios", href: "/anuncios", icon: Megaphone,
   adminOnly: true, module: "ADS" }` no grupo Administração.

## 7. Rastreamento nos sites (fase A3)

O `akylla-status.js` já roda nos sites vendidos com `data-site="CHAVE"`.
Acrescentar, com a mesma regra de falha aberta: ler `utm_campaign` da URL
e guardar só na `sessionStorage` (sem cookie); PAGE_VIEW 1 por sessão;
cliques em `wa.me`, `api.whatsapp.com`, `tel:` e envio de formulários via
`navigator.sendBeacon` para `/api/public/track/CHAVE`; `data-track="off"`
desliga. Servidor valida chave e evento, acha a campanha pelo
`utmCampaign` da mesma empresa e faz `count + 1`; não grava IP,
user-agent nem horário exato. Entregas "nunca pausar" podem ser
rastreadas. Atualizar a política de privacidade-modelo dos sites
vendidos. Pixel da Meta e Google Tag continuam no site do cliente quando
a campanha precisar.

## 8. Fases (ordem rígida)

| Fase | Entrega | Depende de |
|---|---|---|
| A1 · Base manual | enums, módulo ADS, tipo ADS_MANAGEMENT, AdAccount, AdCampaign, AdMetricDaily, AdCampaignLog, telas 1–4 e 6, lançamento manual, link UTM, menu | nada externo — já dá para vender |
| A2 · Importar CSV | upload do relatório do Gerenciador de Anúncios (Meta) e do Google Ads, com mapeamento de colunas e prévia | A1 |
| A3 · Rastreamento | AdTrackingDaily, `/public/track/:key`, extensão do `akylla-status.js`, "contatos pelo site" e custo por contato | A1 |
| A4 · Relatórios | AdReport, mensagem pronta, modelo WhatsApp `relatorio_anuncios`, worker semanal (segunda 9h), página pública de leitura | A1, A3 |
| A5 · API leitura | Meta Marketing API (insights) e depois Google Ads API: token cifrado, sincronização diária no worker, `source = API` | app aprovado na Meta (verificação da empresa) e developer token do Google |
| A6 · API escrita | criar/pausar campanha pelo Akylla, com log e confirmação | A5 estável |
| A7 · Extras | pedido de anúncio pelo cliente (formulário público), rede de banners entre sites dos clientes | decisão do proprietário |

## 9. Testes (cada fase)

`tests/integration/ads.test.ts`: isolamento por empresa (404 em id de
outra empresa), RLS das tabelas novas em `TENANT_TABLES`, `AdminGuard`
nas escritas, 403 `MODULE_NOT_CONTRACTED` sem o módulo, cálculo dos
indicadores (divisão por zero → null), precedência API > CSV > MANUAL,
UTM único, log imutável. Rastreamento (A3): chave inválida → 404 sem
vazar; campanha de outra empresa ignorada; limite por IP; nenhum dado
pessoal persistido; script com falha aberta. `npm run validate` verde
antes de concluir.

## 10. Preços sugeridos (catálogo digital)

Cadastrar como `DigitalProduct` tipo `ADS_MANAGEMENT`, cobrança mensal:

| Pacote | Inclui | Faixa |
|---|---|---|
| Básico | 1 plataforma, até 2 campanhas, relatório mensal | R$ 400–700/mês |
| Crescimento | Meta + Google, landing page, relatório semanal, rastreamento | R$ 900–1.500/mês |
| Premium | tudo + criação de artes/vídeos curtos + reunião mensal | a partir de R$ 2.000/mês |
| Implantação | contas, pixel, rastreador, primeira campanha | R$ 300–800 (único) |

Combo de venda: site + 3 meses de anúncios com desconto.

## 11. Documentação

`docs/akylla/ANUNCIOS.md` (guia de uso), `docs/architecture/DATABASE.md`,
`docs/architecture/API.md`, `DICIONARIO_INDICADORES.md`,
`docs/akylla/PAUSA_DE_SITES.md` (rastreador no mesmo script, fase A3),
`CHANGELOG.md`, `PROJECT_STATUS.md`, `IMPLEMENTATION_CHECKLIST.md`.
