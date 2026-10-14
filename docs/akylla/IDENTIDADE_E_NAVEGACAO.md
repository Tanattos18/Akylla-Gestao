# Akylla Gestão — Identidade e navegação (Etapa 2)

**Data:** 12/10/2026
**Escopo:** definição da identidade visível do **Akylla Gestão**, conforme
`PASSO_A_PASSO_OPENCODE_AKYLLA.md` (Etapa 2) e autorização do
proprietário. Nenhum módulo, tabela, migration, regra de negócio, controle de
acesso ou identificador interno foi alterado ou excluído.

---

## 1. Identidade vigente

| Arquivo | Definição vigente | Motivo |
|---|---|---|
| `apps/web/src/app/layout.tsx` | `title: "Akylla Gestão"` / descrição "Sistema de gestão para pequenos negócios" | Metadados e posicionamento genérico |
| `apps/web/src/app/layout.tsx` | `<h1>Akylla Gestão</h1>` + "Gestão para pequenos negócios" | marca e subtítulo |
| `apps/web/src/app/layout.tsx` | footer "Akylla Gestão © …"; sem emoji e sem badges de etapa | rodapé limpo |
| `apps/web/src/app/login/page.tsx` | "Entrar no Akylla Gestão" | tela de login |
| `apps/web/src/app/cadastro/page.tsx` | "Criar conta no Akylla Gestão" | tela de cadastro |
| `apps/web/src/app/faturamento/page.tsx` | "Faturamento do Akylla Gestão", confirmação e aviso de cancelamento "no Akylla Gestão" | textos da tela de billing |
| `apps/web/src/app/page.tsx` (home) | card "Clientes" / "Cadastro de clientes, contatos e histórico" | módulo genérico (sem texto de nicho) |
| `apps/web/src/app/page.tsx` (home) | card Agendamentos "Agenda de atendimentos com lembretes no WhatsApp" | agenda genérica (`petId` opcional) |
| `apps/web/src/app/page.tsx` (home) | card Faturamento "…no Akylla Gestão" | marca |
| `apps/web/src/components/Receipt.tsx` | fallback `?? "Akylla Gestão"` e rodapé "Akylla Gestão — Obrigado pela preferência!" | comprovante |
| `apps/web/src/app/pdv/page.tsx` e `apps/web/src/app/vendas/[id]/page.tsx` | fallback do nome da empresa `?? "Akylla Gestão"` | impressão de comprovante |
| `apps/web/src/app/relatorios/page.tsx` | nomes de fallback de CSV `akylla_*.csv` (3) | exportação |
| `apps/api/src/reports/reports.service.ts` | prefixos de filename CSV `akylla_vendas`, `akylla_estoque_alertas`, `akylla_estoque_movimentos` | exportação (lado servidor) |
| `apps/api/src/main.ts` | log "Akylla Gestão API disponível em …" | log de inicialização |
| `packages/shared/src/index.ts` | `APP_NAME = "Akylla Gestão"` | constante de nome do produto (não é nome de pacote) |
| `apps/api/src/cli/bootstrap-admin.ts` | exemplos "Mercado Central" na ajuda do CLI | exemplos genéricos |
| `apps/web/src/app/dashboard/page.tsx` | sem sufixos de etapa nos tooltips | artefato de etapa |
| `apps/web/src/app/whatsapp/page.tsx` | "Lembrete de agendamentos" (sem número de etapa) | artefato de etapa |
| `apps/web/src/app/whatsapp/templates/page.tsx` | placeholder "Olá {{1}}, seu agendamento de {{2}} está marcado para {{3}}." | exemplo neutro de template |
| CSV/exportação | prefixo único `akylla_*` em todas as exportações | identidade da marca |

Varredura de identidade: **0 ocorrências** da marca anterior, de "pet shop"
ou de 🐾 em textos visíveis (`apps/web/src`, `apps/api/src`,
`packages/*/src`). As ocorrências restantes são **comentários de código**
(ex.: "Etapa 6 — WhatsApp") e identificadores internos preservados (§4).

## 2. Itens de navegação — análise e justificativa

**Nenhum item foi removido da navegação comum.** Justificativa:

- A navegação comum (grade de módulos da home, `apps/web/src/app/page.tsx`)
  não possui card exclusivo de nicho: os módulos "Clientes", "Serviços",
  "Agendamentos" e "WhatsApp" são **genéricos** no código (ver
  `DIAGNOSTICO_INICIAL.md` §5) — foram mantidos, com textos genéricos,
  conforme a regra "não esconda funcionalidades genéricas".
- O módulo **Pets** (`/pets`) não é item de navegação comum: é acessável
  apenas pelos links internos de `/clientes` e `/clientes/[id]` (lista de pets
  do cliente e formulário "Cadastrar pet" na ficha). **Remover esses links
  quebraria um fluxo existente** (ficha do cliente → pets), portanto o
  problema foi registrado e **nenhuma alteração destrutiva** foi feita.
  O destino definitivo foi resolvido na **Etapa 10**: `/pets` responde 403
  quando o módulo está desabilitado (`ModuleGuard`) — ver
  `PLANO_MODULARIZACAO.md`.
- Ocultação de menu **nunca** é mecanismo de autorização: nenhum guard,
  rota ou permissão foi alterado; o backend continua expondo os mesmos
  endpoints com as mesmas regras ADMIN/MEMBER e o mesmo isolamento por tenant.

## 3. Padrões de moeda e data

- **BRL**: padronizado o uso de `formatBrl()` (pt-BR, `R$ 1.234,56`) em
  `components/Receipt.tsx` e `lib/print.ts` — as demais telas já usavam
  `formatBrl`/`toLocaleString("pt-BR")` **[confirmado na inspeção]**.
- **Datas**: todas as datas visíveis usam `toLocaleString("pt-BR")` /
  `toLocaleDateString("pt-BR")` (DD/MM/AAAA) via `lib/format.ts` ou chamadas
  inline pt-BR. Timestamps de API/banco permanecem ISO/UTC (não tocados).

## 4. Identificadores técnicos legados preservados (compatibilidade)

> Não são a marca do produto. Renomeá-los exige etapa dedicada com plano de
> migração (sessões abertas, imports, asserts de teste).

| Referência | Motivo da preservação |
|---|---|
| Pacotes `@petflow/*` (api, web, worker, shared, whatsapp, config) | identificador interno — adiado pelo proprietário (decisão registrada) |
| Cookie `petflow_session` (default em `apps/api/src/config/env.ts:8`) | renomear derruba sessões abertas e exige migração; adiado |
| `service: "petflow-api"` no payload de `/health` | assertado por `tests/health.test.ts:24`; identificador interno |
| Nome legado do fixture `verifiedName` do provedor mock | assertado por `tests/whatsapp.test.ts:452`; infraestrutura de teste |
| Prefixo de comprovante `PF-XXXXXXXX` | identificador técnico de venda (schema/testes `sales.test.ts:212`); adiado |
| Bancos `petflow` / `petflow_test`, tabelas, migrations | renomear exige migração de dados; adiado |
| Comentários "// Etapa N — …" no código | documentação interna histórica; não visível ao usuário |
| Pasta legada `automação do whatsapp/` | intocada (regra permanente em `AGENTS.md`) |
| Seed de demonstração ("Mundo Pet", banho e tosa) | é **dados** de demonstração, não identidade; reescrita é etapa futura com aprovação |

## 5. Comandos executados e resultados (Etapa 2)

| Comando | Resultado | Comparação com a linha de base (Etapa 1) |
|---|---|---|
| `npm run lint` | **OK — exit 0, 0 erros** | igual |
| `npm run typecheck` | **OK — exit 0** (5 workspaces) | igual |
| `npm test` | **OK — 18 arquivos, 380/380 aprovados**, 66,58 s | igual (380/380); **nenhum teste falhou** |
| `npm run build` | **OK — exit 0** | igual |
| `npm run db:validate` | **OK — schema válido** | igual |

Único teste ajustado de propósito: `tests/reports.test.ts:828` — a asserção
do nome do arquivo CSV exportado foi atualizada para o novo prefixo
`akylla_vendas_…csv`, acompanhando a mudança deliberada de identidade
(mesma cobertura; nenhum cenário removido ou enfraquecido).

## 6. Problemas, pendências e limitações

- **Nenhum problema encontrado** por lint, tipos, testes ou build.
- Não foram criadas migrations, não houve alteração de schema, banco,
  `.env`, configuração de produção ou dependências novas.
- Resolvidos nas etapas seguintes: indicadores de nicho
  (Etapa 9 — `DICIONARIO_INDICADORES.md`), destino dos módulos de nicho
  (Etapa 10 — `PLANO_MODULARIZACAO.md`), documentação do produto
  (reorganização de 13/10/2026 — ver CHANGELOG).
- Pendências abertas: reescrita do seed de demonstração com dados de
  comércio variado (etapa futura com aprovação); renomear identificadores
  técnicos legados (§7).

## 7. Decisões que precisam de aprovação futura

1. Renomear identificadores técnicos legados (`@petflow/*`,
   `petflow_session`, `PF-`, `petflow-api`, bancos) — recomendação: etapa
   dedicada, com plano de reversão.
2. Reescrever o seed de demonstração com dados de comércio variado.
