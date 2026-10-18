# Documentação — Akylla Gestão

**Papel deste arquivo:** índice técnico de toda a documentação do
projeto. A apresentação de produto (para quem chega no repositório)
está no [`../README.md`](../README.md).

Para começar, leia nesta ordem:

1. [`../README.md`](../README.md) — visão de produto e como executar
2. [Documento técnico completo](AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md) — mapa único do sistema
3. [Status do projeto](operations/PROJECT_STATUS.md) — onde estamos hoje

---

## Estado atual do produto

| Documento | Conteúdo |
|---|---|
| [Documento técnico completo](AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md) | fonte única consolidada — 29 seções: stack, módulos, DB, auth, frontend, testes, segurança, pendências, importação, entregas fora do roteiro, catálogos de melhoria (§26) e design (§27), plano do primeiro cliente (§28), mapa de documentos (§29) |
| [Status do projeto](operations/PROJECT_STATUS.md) | etapa vigente, entregas, pendências (fonte única das contagens correntes) |
| [Checklist de implementação](operations/IMPLEMENTATION_CHECKLIST.md) | progresso etapa a etapa |
| [Changelog](operations/CHANGELOG.md) | histórico completo de alterações |
| [Checklist — primeiro cliente](operations/CHECKLIST_PRIMEIRO_CLIENTE.md) | roteiro executável (3 semanas) até o primeiro cliente pagante, com critério de aceite go/no-go |

## Produto (sempre atual)

| Documento | Conteúdo |
|---|---|
| [PDV](akylla/PDV.md) | fluxo de venda, API, regras, comprovante, limitações |
| [Dicionário de indicadores](akylla/DICIONARIO_INDICADORES.md) | definição exata de cada número do dashboard |
| [Comissões](akylla/COMISSOES.md) | regras de cálculo, precedência, liberação, pagamento e estorno |
| [Crediário](akylla/CREDIARIO.md) | venda a prazo: limite, parcelas, vencidas, recebimento e cancelamento |
| [Ordem de serviço](akylla/ORDEM_DE_SERVICO.md) | estados, itens, conclusão (estoque/financeiro/comissão), anexos e WhatsApp |
| [Nota fiscal](akylla/FISCAL.md) | emissão por integradora, segredos cifrados, webhook, cancelamento e o que falta para emitir de verdade |

## Arquitetura e dados

| Documento | Conteúdo |
|---|---|
| [Arquitetura](architecture/ARCHITECTURE.md) | tecnologias e decisões registradas |
| [API](architecture/API.md) | endpoints, permissões, payloads, convenções |
| [Banco de dados](architecture/DATABASE.md) | modelo, migrations, diretrizes |

## Operação e qualidade

| Documento | Conteúdo |
|---|---|
| [Desenvolvimento](operations/DEVELOPMENT.md) | ambiente e execução local |
| [Deploy em produção](operations/DEPLOY.md) | peças, role do banco (RLS), comandos por serviço, variáveis e GitHub Actions |
| [Runbook de operação](operations/RUNBOOK.md) | monitoramento (Sentry, UptimeRobot), incidentes, rollback, restauração |

## Roteiro de evolução e decisão de venda

| Documento | Conteúdo |
|---|---|
| [Roteiro de evolução (Prompt Mestre)](../upgrade/Prompt_Mestre.md) | 7 fases, regras invioláveis e critérios de aceite |
| [Go/No-go para venda](akylla/GO_NO_GO.md) | matriz de liberação do primeiro cliente pagante |
| [Checklist pré-produção](akylla/CHECKLIST_PRE_PRODUCAO.md) | evidências e limitações L1–L14 |

## Arquivados (fora do Git)

Em 2026-10-18, a pedido do proprietário, os itens fora de uso foram
movidos para `../Arquivos Sem USO/`, uma pasta **local, ignorada pelo
Git**. Eles continuam no histórico do Git até o commit `672463f`:

- entregáveis do roteiro antigo (Etapas 0–12): diagnóstico inicial,
  plano de adaptação, identidade e navegação, auditoria multiempresa,
  mapa de módulos, modelo financeiro, redesign do painel, plano de
  modularização, plano de billing, plano de importação, limitações de
  vendas, diretrizes do produto e passo a passo OpenCode;
- a base histórica `automação do whatsapp/`;
- rascunhos de planejamento (deepseek, GEMINI, GPT, compilado de
  melhorias), substituídos pelo Prompt Mestre.

Para consultar um deles pelo Git:
`git show 672463f:docs/akylla/MAPA_DE_MODULOS.md`.

## Requisitos

| Documento | Conteúdo |
|---|---|
| [PRD](requirements/PRD.md) | requisitos do Akylla Gestão (produto, escopo, não funcionais) |

## Fora de `docs/` — pastas da raiz

| Pasta | Conteúdo |
|---|---|
| [`../upgrade/REFERENCIAS_GIT.md`](../upgrade/REFERENCIAS_GIT.md) | repositórios do GitHub para consultar em cada módulo do roteiro, com licença e o que pode ou não ser copiado |
| [`../upgrade/MELHORIAS.md`](../upgrade/MELHORIAS.md) | melhorias de backend, operação, segurança e produto (P0–P3), cada uma com função, impacto e ponto de partida |
| [`../upgrade/MELHORIAS_DESIGN.md`](../upgrade/MELHORIAS_DESIGN.md) | melhorias de design de interface — tokens, componentes, movimento, a11y, estados e impressão; inclui 7 débitos já medidos no código |
| [`../backup/`](../backup/README.md) | cópias de segurança locais (conteúdo ignorado pelo Git; só o README é versionado) |

Nenhuma ideia de `upgrade/` vale como plano sem decisão do proprietário
(regra 2 do `AGENTS.md`).

---

## Convenções

- **Idioma:** português do Brasil.
- **Estado:** documentos de etapa usam data; documentos de estado
  atual são reescritos quando o sistema muda (ver CHANGELOG).
- **Nomenclatura:** `docs/akylla/` = produto e decisão de venda ·
  `docs/architecture/` = técnica · `docs/operations/` = processo ·
  `docs/requirements/` = requisitos do produto.
- **Agentes:** regras em [`../AGENTS.md`](../AGENTS.md).
- **READMEs do repo:** este arquivo é o índice de documentação; o
  `README.md` da raiz é a vitrine do produto; `database/README.md`
  resume o layout Prisma. Não criar novos README sem necessidade.
