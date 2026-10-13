# Documentação — Akylla Gestão

Índice de toda a documentação do projeto, organizada por finalidade.
Para começar, leia nesta ordem:

1. [`../README.md`](../README.md) — visão de produto e como executar
2. [Documento técnico completo](AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md) — mapa único do sistema
3. [Status do projeto](operations/PROJECT_STATUS.md) — onde estamos hoje

---

## Estado atual do produto

| Documento | Conteúdo |
|---|---|
| [Documento técnico completo](AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md) | 23 seções: stack, módulos, DB, auth, frontend, testes, segurança, pendências |
| [Status do projeto](operations/PROJECT_STATUS.md) | etapa vigente, entregas, pendências |
| [Checklist de implementação](operations/IMPLEMENTATION_CHECKLIST.md) | progresso etapa a etapa |
| [Changelog](operations/CHANGELOG.md) | histórico completo de alterações |
| [Checklist pré-produção](akylla/CHECKLIST_PRE_PRODUCAO.md) | evidências, limitações L1–L14, itens antes de comercializar |
| [Dicionário de indicadores](akylla/DICIONARIO_INDICADORES.md) | definição exata de cada número do dashboard |

## Produto e identidade

| Documento | Conteúdo |
|---|---|
| [Diretrizes do produto](akylla_gestao_diretrizes_opencode.md) | posicionamento, tom, o que anunciar/não anunciar |
| [Mapa de módulos](akylla/MAPA_DE_MODULOS.md) | classificação núcleo/opcional/nicho e decisões |
| [Plano de modularização](akylla/PLANO_MODULARIZACAO.md) | destinos dos módulos de nicho e ativação por segmento |
| [Redesign do painel](akylla/REDESIGN_PAINEL.md) | evolução visual (sidebar → topbar B); design tokens |
| [PDV](akylla/PDV.md) | fluxo de venda, API, regras, comprovante, limitações |
| [Modelo financeiro](akylla/MODELO_FINANCEIRO.md) | caixa, contas a pagar/receber, lançamentos |
| [Plano de billing](akylla/PLANO_BILLING.md) | planos, limites por tenant, Mercado Pago |
| [Limitações de vendas](akylla/LIMITACOES_VENDAS.md) | fluxo PDV validado e o que não fazemos |

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
| [Auditoria multiempresa](akylla/AUDITORIA_MULTIEMPRESA.md) | isolamento por tenant e permissões (Etapa 3) |

## Histórico das etapas (adaptação PetFlow → Akylla)

> Registros de entrega por etapa. Não descrevem o estado atual do
> produto quando conflitarem com os documentos acima.

| Documento | Etapa |
|---|---|
| [Diagnóstico inicial](akylla/DIAGNOSTICO_INICIAL.md) | 0 — linha de base |
| [Plano de adaptação](akylla/PLANO_DE_ADAPTACAO.md) | 1 — etapas, riscos, aceitação |
| [Identidade e navegação](akylla/IDENTIDADE_E_NAVEGACAO.md) | 2 — rebranding PetFlow → Akylla |
| [Passo a passo OpenCode](PASSO_A_PASSO_OPENCODE_AKYLLA.md) | roteiro das 12 etapas |

## Requisitos (origem PetFlow)

| Documento | Conteúdo |
|---|---|
| [PRD](requirements/PRD.md) | requisitos originais do PetFlow (base preservada) |

---

## Convenções

- **Idioma:** português do Brasil.
- **Estado:** documentos de etapa usam data; documentos de estado
  atual são reescritos quando o sistema muda (ver CHANGELOG).
- **Nomenclatura:** `docs/akylla/` = produto/adaptação ·
  `docs/architecture/` = técnica · `docs/operations/` = processo ·
  `docs/requirements/` = origem.
- **Agentes:** regras em [`../AGENTS.md`](../AGENTS.md).
