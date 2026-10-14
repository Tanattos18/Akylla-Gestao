# Plano de modularização — destinos dos módulos de pet shop (Etapa 10)

> **Entregável da Etapa 10** do roteiro `docs/PASSO_A_PASSO_OPENCODE_AKYLLA.md`:
> plano de modularização com impacto e reversão. **Nenhuma exclusão** foi
> feita. Decisão do proprietário registrada antes de qualquer exclusão
> definitiva (critério da etapa).
>
> **Documento histórico (2026-10-12).** A contagem citada (490/490) é o
> total daquela data; hoje são 538 testes em 24 arquivos.

**Base normativa:**

- `docs/akylla/MAPA_DE_MODULOS.md` — matriz aprovada (itens 11-23, §6, §7);
- `docs/PASSO_A_PASSO_OPENCODE_AKYLLA.md` L340-356 — instruções da Etapa 10;
- Regra permanente: a pasta `automação do whatsapp/` **não foi e não será**
  alterada (confirmada fora de lint/build/testes e sem imports do monorepo).

---

## 1. Instruções da etapa × cumprimento

| Instrução | Cumprimento |
|---|---|
| 1. Não excluir pets, agenda, serviços e automações WhatsApp automaticamente | Nenhuma exclusão de código, tabela, rota, teste ou página |
| 2. Mapear dependências, rotas, tabelas, testes e relatórios | Seção 2 (evidência `file:line`) |
| 3. Recomendar por módulo: ocultar × opcional × genérico × retirar após aprovação | Seção 3 (uma recomendação por módulo, com justificativa) |
| 4. Se houver arquitetura de módulos, confirmar bloqueio no backend | Seção 4 — **não existe** mecanismo de flag hoje; registro da consequência |
| 5. Não apagar `automação do whatsapp/` | Confirmado intacta (seção 2.F) |

---

## 2. Mapeamento de dependências (evidência)

### 2.1 Tabela-resumo

| Módulo | Pontos de entrada UI | Depende de / usado por | FKs Restrict (bloqueiam exclusão) | Testes | Relatórios |
|---|---|---|---|---|---|
| **Pets** (11) | Sem card na home; atalhos em `/clientes` (`clientes/page.tsx:184-189`) e `/clientes/[id]:274`; página `/pets` | Usado por agenda (`appointments.service.ts:366`, `AppointmentForm.tsx:57`) e clientes (`clients.service.ts:121`) | `Pet→Client`, `Appointment.pet→Pet` | `pets.test.ts` (12) + tenancy (2) | Nenhum (nichos removidos na Etapa 9) |
| **Agenda** (12) | Card "Agendamentos" (`page.tsx:58-63`); 4 páginas `/agenda*` | Usa serviços/pets(opcional)/WhatsApp; **escreve** `WhatsAppMessage` (lembretes, `appointments.service.ts:436-577`) | `Appointment→Company/Client/Pet/Service` | `appointments.test.ts` (45, 10 de lembretes) + tenancy (3) | `summary.services`, `clients.services` |
| **Serviços** (13) | Card home (`page.tsx:34-39`); atalho em `/clientes:190-195` | Usado por agenda (`appointments.service.ts:381`) | `Service→Company`, `Appointment.service→Service` | `services.test.ts` (13) + tenancy (3) | Indireto (contagens de agendamentos) |
| **WhatsApp** (17) | Card home (`page.tsx:40-45`); 4 páginas `/whatsapp*`; consentimento em `/clientes/[id]:57,211`; card no dashboard; aba em relatórios | Worker (`apps/worker`); agenda escreve mensagens; relatórios leem `WhatsAppMessage` | `Config/Template/Consent/Message→Company`; `Consent→Client` | `whatsapp.test.ts` (61) + 10 lembretes + tenancy + reports | `summary.whatsapp`, relatório `whatsapp()` |
| **Assinaturas de clientes** (14) | Card home (`page.tsx:64-69`); 3 páginas `/assinaturas` + `/planos`; atalho em `/faturamento:138` | Usa caixa (`lockOpenCashSession`, `subscriptions.service.ts:10`) | `Subscription→Company/Client/Plan`; `CashMovement.subscriptionId` = SetNull | `subscriptions.test.ts` (18) + tenancy (6) | Nenhum |
| **Seed "Mundo Pet"** (20) | CLI `npm run db:seed:demo` (`apps/api/src/cli/seed-demo.ts`) | Semeia todos os módulos A-E | — (transação Prisma) | Sem teste próprio | Alimenta demos |

### 2.2 Cadeia de bloqueio de exclusão (por que nada pode ser apagado às cegas)

- `Client` não é excluível se tiver `Pet`, `Appointment`, `Subscription` ou
  `WhatsAppConsent` (todas FK `Restrict`);
- `Pet` e `Service` não são excluíveis se referenciados por `Appointment`;
- Apenas `CashMovement.subscriptionId` e vínculos internos de
  `WhatsAppMessage` (client/template/consent) são `SetNull`.

### 2.3 Bloqueio de backend hoje (instrução 4)

**Não existe** arquitetura de módulos/flags: grep por
`CompanyModule|featureFlag|enabledModules` em `apps/api` e `packages` = 0
ocorrências; `Company` (`schema.prisma:189-217`) não tem campo de módulos;
`app.module.ts:25-44` importa todos os módulos incondicionalmente. As únicas
flags existentes (`REGISTRATION_ENABLED`, `PASSWORD_RESET_ENABLED`) são
globais de ambiente, não por empresa.

**Consequência registrada:** qualquer ocultação feita apenas na UI **não é
controle de acesso**. Se/qualquer que seja o mecanismo de ativação escolhido
(opção A/B/C), o bloqueio de servidor (guard por módulo) **deve** acompanhar a
ativação — o backend isola por tenant/guards (Etapa 3), mas não desliga
módulo por empresa.

---

## 3. Recomendação por módulo

Legenda das opções do roteiro: **(1)** manter fora da navegação inicial ×
**(2)** transformar em módulo opcional × **(3)** reutilizar de forma genérica
× **(4)** retirar após aprovação.

| Módulo | Recomendação | Justificativa | O que mudaria (se aprovado) | Reversão |
|---|---|---|---|---|
| **Pets** | **(1)+(2)** — manter fora da navegação inicial (hoje já é) e classificar como **módulo opcional de nicho** | Único módulo 100% de nicho; sem relatórios desde a Etapa 9; dependências são só agenda (pet opcional) e clientes; código íntegro e testado | Nesta etapa: **nada**. Futuro (com flag autorizada): ocultar atalhos de `/clientes` e bloquear rotas `/api/pets` no servidor quando desativado | Reverter = remover a ocultação/flag; nenhum dado é afetado |
| **Agenda** | **(3)** — **reutilizar de forma genérica** (manter na navegação) | `petId` opcional (`schema.prisma:395`); fluxo cliente×serviço×horário serve a qualquer segmento; card já rotulado "Agendamentos" | Concluído nesta etapa: generalização do rótulo do lembrete (seção 3.1) | Reverter = 2 commits de texto (rótulo) |
| **Serviços** | **(3)** — **reutilizar de forma genérico** (manter) | Zero campos de nicho; é o catálogo usado pela agenda; rótulo "catálogo de serviços" já aplicado na Etapa 2 | Nada | — |
| **WhatsApp** | **(3)** — **reutilizar de forma genérico** (manter; é opcional do negócio, não de nicho) | Canal opt-in genérico com webhook assinado e fila por tenant; só o rótulo do lembrete citava nicho | Generalização do rótulo do lembrete (API + UI) | Reverter = 2 commits de texto |
| **Assinaturas de clientes** | **(3)** — **reutilizar de forma genérico** (manter) | `Client`+`SubscriptionPlan`, pagamento gera `CashMovement`; **sem** campo de pet; conceitualmente separadas do billing SaaS | Nada (separação conceitual reforçada na Etapa 11) | — |
| **Seed "Mundo Pet"** (20) | **(4)** — **retirar/reescrever após aprovação** (etapa futura) | Dados exclusivos de pet shop usados só em demonstração; reescrever com comércio variado exige aprovação do proprietário (já registrado na matriz) | **Não nesta etapa.** Se aprovado: nova versão do seed com dados genéricos + validação manual | Reverter = restaurar `seed-demo.ts` via Git |
| **Lembrete "{{1}} tutor/pet"** (21) | **(3)** — **generalizar** (executado nesta etapa) | Rótulo de nicho dentro de módulo genérico; o **comportamento** de `{{1}}` (`pet?.name || client.name`, `appointments.service.ts:480`) já é genérico — só o texto citava pet shop | **Executado:** mensagem de erro da API (`whatsapp-config.service.ts:88`) e texto da UI (`whatsapp/page.tsx:373`) agora dizem `{{1}} cliente`. Contagem de variáveis (3) e comportamento intactos; nenhum teste dependia do texto antigo | Reverter = reverter os 2 arquivos |

### 3.1 Generalização do lembrete — detalhe do que foi alterado

- `apps/api/src/whatsapp/whatsapp-config.service.ts:88` —
  `"...variáveis ({{1}} cliente, {{2}} serviço, {{3}} data e hora)"`;
- `apps/web/src/app/whatsapp/page.tsx:373` — mesmo texto na ajuda da UI;
- **Não alterado:** `APPOINTMENT_REMINDER_VARIABLE_COUNT = 3`
  (`packages/shared/src/index.ts:1022`), a montagem das variáveis
  (`appointments.service.ts:479-483`) e todos os 45 testes de agenda +
  61 de WhatsApp (validam a **contagem**, não o rótulo).

### 3.2 Módulos mantidos na navegação inicial (sem mudança)

`page.tsx` permanece com os 11 cards atuais (Produtos, PDV, Caixa,
Clientes, Serviços, WhatsApp, Dashboard, Relatórios, Agenda, Assinaturas,
Faturamento). **Pets não tem card** (já está fora da navegação inicial).
A eventual navegação agrupada por área (PLANO §8) permanece adiada — é
apresentação, não exclusão.

---

## 4. Ativação por segmento (D3, MAPA §6.3) — decisão e implementação

**Decisão do proprietário (2026-10-12): opção B — tabela `CompanyModule`.**
A alternativa recomendada no plano era "nenhum mecanismo agora"; o
proprietário escolheu a opção B, com implementação autorizada nesta etapa
(migration aditiva descrita em MAPA §6.3).

### 4.1 O que foi implementado

- **Schema/migration aditiva** `20261012154010_company_module`: enums
  `BusinessModule` (`PETS`, `APPOINTMENTS`, `SERVICES`, `WHATSAPP`,
  `SUBSCRIPTIONS`) e `CompanyModuleStatus` (`ACTIVE`/`DISABLED`), tabela
  `CompanyModule` (`@@unique([companyId, module])`, FK → `Company`
  `Cascade`). **Ausência de linha = módulo ativo** (todas as empresas
  existentes seguem funcionando sem seed). Núcleo nunca é desativável.
- **Bloqueio no backend** (`ModuleGuard` como APP_GUARD após
  `AuthGuard`): rotas com `@RequireModule(...)` retornam **403** quando
  o módulo está `DISABLED` para a empresa da sessão. Rotas públicas
  (webhook WhatsApp) e sem decorator nunca passam pela checagem —
  cumprida a instrução 4 da etapa.
- **API**: `GET /api/company-modules` (sessão) e
  `PATCH /api/company-modules` (`AdminGuard`, upsert `{ module, status }`).
- **UI**: a home oculta os cards de módulos desativados (Serviços,
  WhatsApp, Agendamentos, Assinaturas). Ocultação **não é** controle de
  acesso — o guard do servidor é a fonte de verdade.

### 4.2 Pendências registradas (não fazem parte desta etapa)

- `syncReminder` (agenda) não consulta ainda se o módulo `WHATSAPP` está
  ativo antes de enfileirar lembretes — refinamento futuro.
- Interface administrativa dedicada para alternar módulos (hoje via
  `PATCH /api/company-modules`; a home apenas exibe o resultado).
- Enforcement de módulos pelos planos do SaaS (`TenantPlan`) — **Etapa
  11**: a tabela `CompanyModule` é extensível para semear por plano.
- Reescrita do seed "Mundo Pet" (item 4 da seção 3) — etapa futura com
  aprovação explícita.

---

## 5. Plano de reversão (visão única)

1. **Rótulos do lembrete:** `git revert` dos 2 arquivos (seção 3.1).
2. **Seed:** nenhuma alteração; reversão futura = restaurar o arquivo.
3. **Exclusões:** **não houve** — não há nada a reverter.
4. **Opção B (CompanyModule):** reverter = parar de gravar linhas (as
   empresas voltam ao padrão "tudo ativo" por ausência de linha) e, se
   desejado, reverter o commit da migration (banco de produção: nova
   migration de remoção, avaliada na época — nunca drop em produção sem
   plano). O `ModuleGuard` sem linhas `DISABLED` não bloqueia nada.

---

## 6. Decisões do proprietário (registradas nesta etapa)

| # | Decisão | Status |
|---|---|---|
| **D2** | Destino dos módulos conforme seção 3 (nenhuma exclusão) | **CONFIRMADA pelo proprietário em 2026-10-12** |
| **D3** | Mecanismo de ativação por segmento | **DECIDIDA: opção B — tabela `CompanyModule`** (2026-10-12); implementada nesta etapa (seção 4) |
| — | Reescrever seed "Mundo Pet" com dados de comércio variado | Recomendado para etapa futura, com aprovação explícita |

---

## 7. Validações executadas

- `npm run lint` — 0 erros;
- `npm run typecheck` — OK;
- `npm test` — **490/490** (477 anteriores + 13 novos em
  `tests/integration/company-modules.test.ts`);
- `npm run build` — OK;
- `npm run db:validate` — OK (migration `20261012154010_company_module`
  aplicada em `petflow` e `petflow_test`);
- Grep `tutor` em `apps/`, `packages/`, `tests/` — 0 ocorrências.
