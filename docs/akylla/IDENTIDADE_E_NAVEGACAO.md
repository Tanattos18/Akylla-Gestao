# Akylla Gestão — Identidade e navegação (Etapa 2)

**Data:** 12/10/2026
**Escopo:** adaptação da identidade visível do PetFlow para **Akylla Gestão**,
conforme `PASSO_A_PASSO_OPENCODE_AKYLLA.md` (Etapa 2) e autorização do
proprietário. Nenhum módulo, tabela, migration, regra de negócio, controle de
acesso ou identificador interno foi alterado ou excluído.

---

## 1. Referências visíveis substituídas

| Arquivo | Antes | Depois | Motivo |
|---|---|---|---|
| `apps/web/src/app/layout.tsx` | `title: "PetFlow"` / descrição "SaaS de gestão para pet shops" | `title: "Akylla Gestão"` / "Sistema de gestão para pequenos negócios" | Metadados e posicionamento genérico |
| `apps/web/src/app/layout.tsx` | Emoji de pata 🐾 no cabeçalho | removido | símbolo exclusivo de pet shop |
| `apps/web/src/app/layout.tsx` | `<h1>PetFlow</h1>` + "Gestão para pet shops" | `<h1>Akylla Gestão</h1>` + "Gestão para pequenos negócios" | marca e subtítulo |
| `apps/web/src/app/layout.tsx` | badge "Etapa 9 — Assinaturas" no cabeçalho | removido (nav ficou sem badge) | artefato de desenvolvimento do PetFlow, não faz sentido no produto |
| `apps/web/src/app/layout.tsx` | footer "PetFlow © …" | "Akylla Gestão © …" | rodapé |
| `apps/web/src/app/login/page.tsx` | "Entrar no PetFlow" | "Entrar no Akylla Gestão" | tela de login |
| `apps/web/src/app/cadastro/page.tsx` | "Criar conta no PetFlow" | "Criar conta no Akylla Gestão" | tela de cadastro |
| `apps/web/src/app/faturamento/page.tsx` | "Faturamento do PetFlow", confirmação e aviso de cancelamento "do PetFlow" | "…do Akylla Gestão" / "no Akylla Gestão" | 3 textos da tela de billing |
| `apps/web/src/app/page.tsx` (home) | card "Clientes e animais" / "Cadastro de tutores, pets e fichas" | card "Clientes" / "Cadastro de clientes, contatos e histórico" | módulo é genérico; texto de nicho removido |
| `apps/web/src/app/page.tsx` (home) | card Agendamentos "Agenda diária de banho e tosa…" | "Agenda de atendimentos com lembretes no WhatsApp" | agenda é genérica (`petId` opcional) |
| `apps/web/src/app/page.tsx` (home) | card Faturamento "…no PetFlow" | "…no Akylla Gestão" | marca |
| `apps/web/src/components/Receipt.tsx` | fallback `?? "PetFlow"` e rodapé "PetFlow — Obrigado pela preferência!" | "Akylla Gestão" (ambos) | comprovante |
| `apps/web/src/app/pdv/page.tsx` e `apps/web/src/app/vendas/[id]/page.tsx` | fallback do nome da empresa `?? "PetFlow"` | `?? "Akylla Gestão"` | impressão de comprovante |
| `apps/web/src/app/relatorios/page.tsx` | nomes de fallback de CSV `petflow_*.csv` (3) | `akylla_*.csv` | exportação |
| `apps/api/src/reports/reports.service.ts` | prefixos de filename CSV `petflow_vendas`, `petflow_estoque_alertas`, `petflow_estoque_movimentos` | `akylla_*` (3) | exportação (lado servidor) |
| `apps/api/src/main.ts` | log "PetFlow API disponível em …" | "Akylla Gestão API disponível em …" | log de inicialização |
| `packages/shared/src/index.ts` | `APP_NAME = "PetFlow"` | `APP_NAME = "Akylla Gestão"` | constante de nome do produto (não é nome de pacote) |
| `apps/api/src/cli/bootstrap-admin.ts` | exemplos "Pet Shop Amigo Fiel" (ajuda do CLI) | "Mercado Central" (2 ocorrências) | exemplos genéricos |
| `apps/web/src/app/dashboard/page.tsx` | tooltip "(Etapa 8)" | removido o sufixo | artefato de etapa |
| `apps/web/src/app/whatsapp/page.tsx` | "Lembrete de agendamentos (Etapa 8)" | "Lembrete de agendamentos" | artefato de etapa |
| `apps/web/src/app/whatsapp/templates/page.tsx` | placeholder "Olá {{1}}, seu pet {{2}} aguarda pelo próximo banho." | "Olá {{1}}, seu agendamento de {{2}} está marcado para {{3}}." | exemplo neutro de template |

Varredura final: **0 ocorrências** de "PetFlow", "pet shop" ou 🐾 em textos
visíveis (`apps/web/src`, `apps/api/src`, `packages/*/src`). As ocorrências
restantes são **comentários de código** (ex.: "Etapa 6 — WhatsApp") e
identificadores internos preservados (§4).

## 2. Itens de navegação — análise e justificativa

**Nenhum item foi removido da navegação nesta etapa.** Justificativa:

- A navegação comum (grade de módulos da home, `apps/web/src/app/page.tsx`)
  não possui card exclusivo de pet shop: os módulos "Clientes", "Serviços",
  "Agendamentos" e "WhatsApp" são **genéricos** no código (ver
  `DIAGNOSTICO_INICIAL.md` §5) — foram mantidos, com textos genéricos, conforme
  a regra "não esconda funcionalidades genéricas".
- O módulo **Pets** (`/pets`) não é item de navegação comum: é acessível
  apenas pelos links internos de `/clientes` e `/clientes/[id]` (lista de pets
  do cliente e formulário "Cadastrar pet" na ficha). **Remover esses links
  quebraria um fluxo existente** (ficha do cliente → pets), portanto, conforme
  a seção 4 da autorização, o problema foi registrado e **nenhuma alteração
  destrutiva** foi feita. O destino definitivo (ocultar com flag de segmento)
  fica para a **Etapa 10**, com decisão do proprietário.
- Ocultação de menu **nunca** é mecanismo de autorização: nenhum guard,
  rota ou permissão foi alterado; o backend continua expondo os mesmos
  endpoints com as mesmas regras ADMIN/MEMBER e o mesmo isolamento por tenant.

## 3. Padrões de moeda e data

- **BRL**: padronizado o uso de `formatBrl()` (pt-BR, `R$ 1.234,56`) em
  `components/Receipt.tsx` (4 valores) e `lib/print.ts` (4 valores) — antes
  usavam `R$ ${x.toFixed(2)}` (formato "R$ 10.50", ponto decimal). As demais
  telas já usavam `formatBrl`/`toLocaleString("pt-BR") **[confirmado na
  inspeção]**.
- **Datas**: todas as datas visíveis já usam `toLocaleString("pt-BR")` /
  `toLocaleDateString("pt-BR")` (DD/MM/AAAA) via `lib/format.ts` ou chamadas
  inline pt-BR — **nenhuma alteração necessária**. Timestamps de API/banco
  permanecem ISO/UTC (não tocados).

## 4. Referências internas preservadas (de propósito)

| Referência | Motivo da preservação |
|---|---|
| Pacotes `@petflow/*` (api, web, worker, shared, whatsapp, config) | identificador interno — adiado pelo proprietário (Etapa 1, decisão 7) |
| Cookie `petflow_session` (default em `apps/api/src/config/env.ts:8`) | renomear derruba sessões abertas e exige migração; adiado |
| `service: "petflow-api"` no payload de `/health` | assertado por `tests/health.test.ts:24`; identificador interno |
| `verifiedName: "PetFlow Mock"` no provedor mock | assertado por `tests/whatsapp.test.ts:452`; infraestrutura de teste |
| Prefixo de comprovante `PF-XXXXXXXX` | identificador técnico de venda (schema/testes `sales.test.ts:212`); adiado |
| Bancos `petflow` / `petflow_test`, tabelas, migrations | proibido nesta etapa |
| Comentários "// Etapa N — …" no código | documentação interna histórica; não visível ao usuário |
| Pasta legada `automação do whatsapp/` | intocada (regra permanente) |
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
do nome do arquivo CSV exportado foi atualizada de
`petflow_vendas_…csv` para `akylla_vendas_…csv`, acompanhando a mudança
deliberada de identidade (mesma cobertura; nenhum cenário removido ou
enfraquecido).

## 6. Problemas, pendências e limitações

- **Nenhum problema encontrado** por lint, tipos, testes ou build.
- Não foram criadas migrations, não houve alteração de schema, banco,
  `.env`, configuração de produção ou dependências novas.
- Pendências herdadas/registradas (não desta etapa): indicadores de nicho no
  dashboard/relatórios ("pet(s) cadastrado(s)", "pets por espécie") — **Etapa
  9**; destino dos módulos de pet shop (`/pets`, lembretes com variável de
  pet) — **Etapa 10**; reescrita do seed de demonstração — etapa futura com
  aprovação; README e demais documentos em `docs/` ainda descrevem o PetFlow
  como produto (documentação histórica preservada; atualização comercial fica
  para o pré-lançamento, Etapa 12).

## 7. Decisões que precisam de aprovação futura

1. Renomear identificadores internos (`@petflow/*`, `petflow_session`,
   `PF-`, `petflow-api`, bancos) — recomendação: etapa dedicada depois da
   Etapa 12, com plano de reversão.
2. Ocultar `/pets` da experiência comum (Etapa 10) e como tratar os links
   internos da ficha do cliente.
3. Reescrever o seed de demonstração com dados de comércio variado.
