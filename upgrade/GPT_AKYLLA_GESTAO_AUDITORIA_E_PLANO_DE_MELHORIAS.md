# Akylla Gestão — Auditoria técnica e plano de evolução para SaaS comercial

> **Data da análise:** 15/10/2026  
> **Repositório analisado:** https://github.com/Tanattos18/Akylla-Gestao  
> **Objetivo:** avaliar o estado documentado do sistema e propor melhorias verificáveis para transformá-lo em um SaaS hospedado, seguro, sustentável e comercializável para pequenas empresas.  
> **Natureza deste documento:** auditoria documental e análise das informações públicas do repositório. Não substitui uma execução independente do código, teste de invasão, revisão jurídica ou validação do ambiente real de produção.

---

## 1. Resumo executivo

### Veredito

**O projeto apresenta uma base técnica promissora e testes automatizados relevantes, mas a documentação do próprio repositório afirma que ele ainda não deve ser considerado pronto para produção comercial.**

O README descreve um SaaS multiempresa para pequenos negócios, com clientes, fornecedores, produtos, estoque, vendas/PDV, caixa, contas a pagar/receber, relatórios, módulos opcionais e cobrança da assinatura do próprio SaaS. O documento `docs/operations/PROJECT_STATUS.md` registra as etapas 0–12 concluídas e informa, na atualização mais recente visível, validações de lint, TypeScript, testes, build e schema. Também identifica pendências concretas para produção: backups com restauração testada, LGPD, deploy real, monitoramento, vulnerabilidades de dependências e testes ponta a ponta do Mercado Pago.

**Conclusão prática:** não é necessário recomeçar o sistema. A recomendação é congelar novas funcionalidades não essenciais e executar um ciclo controlado de preparação para produção, com critérios de aceite claros. Só depois deve ocorrer um piloto com dados reais e, após validação, a venda aberta de assinaturas.

### O que esta análise confirma — e o que não confirma

| Tipo de afirmação | Resultado |
|---|---|
| O repositório documenta um produto multiempresa e módulos de gestão | Confirmado pelo README público |
| O status documenta 538 testes aprovados, lint/typecheck/build/schema válidos | Confirmado como resultado registrado pelo projeto; não é uma execução independente feita nesta auditoria |
| A documentação identifica lacunas de produção | Confirmado no checklist pré-produção e no status |
| O sistema é invulnerável ou está seguro para qualquer carga | **Não confirmado** |
| O deploy de produção funciona e pode ser recuperado após falha | **Não confirmado**; o status diz que o deploy real e o teste de restauração estão pendentes |
| A cobrança recorrente real está pronta para clientes | **Não confirmado**; a documentação informa que o fluxo sandbox existe, mas falta E2E e ativação aprovada |
| O sistema atende integralmente à LGPD | **Não confirmado**; há pendências registradas de privacidade e operação |

### Recomendação principal

Priorizar na ordem abaixo:

1. **P0 — proteção de dados e recuperação:** backups automatizados, restauração testada, gestão de segredos, vulnerabilidades e configuração segura de produção.
2. **P0 — privacidade e acesso:** fluxo de direitos do titular, política de retenção, revisão de autorização e decisões documentadas de LGPD.
3. **P0 — operação real:** ambiente de staging, deploy repetível, migrations seguras, monitoramento e alertas.
4. **P0 — cobrança comercial:** validar checkout/webhook do Mercado Pago de ponta a ponta e garantir que plano, pagamento, limites e acesso estejam coerentes.
5. **P1 — experiência comercial:** onboarding, tela de plano e consumo, suporte, termos/políticas, demonstração sem dados reais e processo de cancelamento.
6. **P1/P2 — evolução do produto:** resolver débitos de interface e só depois ampliar módulos conforme evidência de uso dos primeiros clientes.

---

## 2. Escopo e método

Esta análise usa como fontes primárias os arquivos públicos do repositório, em especial:

- `README.md`
- `docs/operations/PROJECT_STATUS.md`
- `docs/akylla/CHECKLIST_PRE_PRODUCAO.md`
- `docs/README.md`
- `upgrade/MELHORIAS.md`
- `upgrade/MELHORIAS_DESIGN.md`

As recomendações de segurança e processo são relacionadas a referências públicas do OWASP, NIST e ANPD, listadas ao final.

### Limitações importantes

- O repositório foi consultado pela interface pública do GitHub. Não foi feita uma clonagem e execução independente de todos os componentes.
- Os resultados de testes citados são **evidências registradas pelo projeto**, não uma certificação externa.
- Não foram medidos tempo de resposta, uso de memória, capacidade concorrente, disponibilidade real, custos observados ou recuperação de desastre.
- Não foram realizadas análises dinâmicas, fuzzing, teste de invasão ou auditoria jurídica.
- O ambiente de hospedagem final, domínio, provedor de e-mail e políticas comerciais ainda precisam ser definidos pelo proprietário.

Para evitar suposições, cada item abaixo é tratado como **achado documentado**, **recomendação** ou **decisão que depende do proprietário**.

---

## 3. Estado atual observado no repositório

### 3.1 Funcionalidades descritas

O README documenta os seguintes grupos funcionais:

- Autenticação por sessão e usuários com perfis `ADMIN` e `MEMBER`.
- Cadastro e isolamento de empresas/tenants.
- Clientes, fornecedores, categorias e produtos.
- Estoque e movimentações.
- Vendas e frente de caixa (PDV).
- Abertura e fechamento de caixa por turno.
- Contas a pagar e receber.
- Dashboard, relatórios e exportação CSV.
- Planos e assinatura do SaaS.
- Módulos opcionais de serviços, agendamentos, assinaturas de clientes, WhatsApp e pets.
- Importação de CSV para entidades documentadas no status do projeto.
- Integração com Mercado Pago descrita como implementada em ambiente sandbox.

O próprio README delimita o escopo: não se posiciona como ERP completo para qualquer setor e deixa operações fiscais, contábeis, de frota ou de produção fora do escopo inicial. Essa delimitação deve continuar explícita no site comercial e nos contratos.

### 3.2 Evidências de qualidade registradas

`docs/operations/PROJECT_STATUS.md` registra, na atualização consultada:

- `npm run lint`: sem erros.
- `npm run typecheck`: OK.
- `npm test`: 538/538 testes aprovados, em 24 arquivos.
- `npm run build`: OK.
- `npm run db:validate`: OK.
- CI no GitHub Actions adicionada em 14/10/2026.

Esses resultados são um bom sinal de disciplina de desenvolvimento. Entretanto, **testes passando não demonstram, por si só, que backups, deploy, cobrança, segurança operacional ou recuperação de desastre estão prontos**.

### 3.3 Pendências expressamente registradas

O checklist pré-produção e o status apontam, entre outras:

- Não declarar o produto pronto para produção.
- Backups automatizados e teste real de restauração ainda pendentes.
- Deploy/CD real ainda pendente; o arquivo de CD é descrito como placeholder.
- Monitoramento e alertas ainda pendentes.
- Fluxo de exclusão/anonimização e processos de LGPD pendentes.
- Vulnerabilidades em dependências, inclusive duas de produção (`postcss`/`next`, classificadas como alta no status consultado).
- Rate limit de login em memória, que não é compartilhado entre múltiplas instâncias e reinicia com o processo.
- Sem RLS no PostgreSQL; o isolamento de tenants está aplicado na camada da aplicação.
- Redefinição de senha sem token de e-mail: documentada como inadequada para produção se habilitada.
- Cadastro de empresa sem verificação de e-mail/antiabuso suficiente para exposição pública ampla.
- E2E do Mercado Pago em sandbox e ativação de cobrança recorrente real ainda pendentes.
- Tela `/faturamento` ainda não exibe todos os limites e o uso do plano.
- Dados de demonstração ainda têm temática de pet shop.
- Débitos de design D-4 e D-6 continuam listados como dependentes de trabalho no componente de tabela/primitivos.
- Algumas limitações funcionais conhecidas: agenda por dia, formas de pagamento pouco configuráveis, ausência de venda direta de serviços no PDV, entre outras.

A lista completa e a severidade mais recente devem ser conferidas no próprio `CHECKLIST_PRE_PRODUCAO.md` e no `PROJECT_STATUS.md` antes de executar qualquer item.

---

## 4. Prioridades e regras de execução

### 4.1 Níveis de prioridade

| Prioridade | Significado | Regra |
|---|---|---|
| **P0** | Bloqueia produção ou envolve risco elevado de dados, segurança, cobrança ou confiança | Resolver antes de clientes pagantes com dados reais |
| **P1** | Necessário para operação previsível e atendimento profissional | Resolver antes de ampliar a base de clientes |
| **P2** | Melhoria de qualidade, produtividade ou experiência | Fazer após estabilizar o serviço |
| **P3** | Exploratória ou dependente de demanda | Só executar após validar necessidade real |

### 4.2 Regras de mudança

1. Trabalhar em branch própria para cada entrega relevante.
2. Criar backup e confirmar o ambiente antes de migrations ou alterações destrutivas.
3. Não executar migrations diretamente em produção sem ensaio em staging e plano de reversão/recuperação.
4. Para cada tarefa, registrar: problema, evidência, alteração, testes, risco, plano de rollback e critério de aceite.
5. Executar a validação completa definida pelo projeto (`npm run validate`, quando disponível no checkout atual) após mudanças pertinentes.
6. Não misturar refatoração ampla, alteração de schema e mudança de cobrança numa única entrega.
7. Não copiar `.env.example` como configuração de produção sem revisar flags e segredos.
8. O agente de código deve inspecionar o estado atual antes de modificar arquivos; documentação antiga não substitui a inspeção do código atual.
9. Não introduzir serviços pagos adicionais sem estimar o custo total e confirmar o orçamento do proprietário.
10. Nenhuma sugestão deste arquivo deve ser interpretada como autorização automática para mudar o projeto.

---

# PARTE A — Infraestrutura, hospedagem e deploy

## 5. Ambiente de produção reproduzível — P0

**Problema observado:** o checklist registra que produção não está configurada e que o CD ainda é placeholder.

### Melhorias recomendadas

- Escolher explicitamente uma arquitetura inicial simples: uma aplicação/API, frontend e worker conforme a estrutura real do repositório, mais PostgreSQL.
- Separar ambientes `development`, `test`, `staging` e `production`, com banco e credenciais distintos.
- Definir domínio, DNS, HTTPS/TLS, política de renovação de certificado e redirecionamento HTTP→HTTPS.
- Criar um procedimento de deploy repetível e versionado; evitar instruções manuais que existam apenas na memória do desenvolvedor.
- Usar migrações versionadas e aplicar migrações em etapa controlada do deploy.
- Configurar health checks para aplicação e dependências críticas. Diferenciar health básico de readiness, que verifica se a aplicação está pronta para receber tráfego.
- Fixar versões de runtime compatíveis com `package.json`, lockfile e CI.
- Documentar portas, processos, volumes persistentes, política de reinício, logs e procedimento de atualização.
- Garantir que uploads temporários não sejam tratados como armazenamento permanente.
- Validar comportamento de worker, filas e tarefas agendadas após reinício da aplicação.

### Critérios de aceite

- Um operador consegue implantar uma versão a partir de um commit identificado seguindo somente a documentação.
- Um deploy em staging é repetível sem alterações manuais não documentadas.
- HTTPS é obrigatório; cookies de autenticação usam `Secure` em produção.
- A aplicação falha de forma segura se variáveis essenciais estiverem ausentes.
- A versão implantada e o resultado do deploy ficam registrados.
- Existe procedimento documentado para interromper o deploy e restaurar a versão anterior, considerando também compatibilidade de schema.

## 6. Banco de dados e migrations — P0

### Melhorias recomendadas

- Usar PostgreSQL como banco operacional de produção, conforme suporte já documentado pelo projeto.
- Separar credenciais de migração das credenciais usadas pela aplicação, se a arquitetura e o provedor permitirem.
- Aplicar o princípio do menor privilégio aos usuários de banco.
- Testar cada migration em uma cópia recente ou ambiente de staging antes da produção.
- Para mudanças incompatíveis, preferir estratégia expand/contract: adicionar compatibilidade, migrar dados, mudar a aplicação e remover o legado em etapa posterior.
- Documentar o tamanho estimado de tabelas e índices críticos; revisar índices a partir de consultas reais e `EXPLAIN ANALYZE`, sem indexar tudo indiscriminadamente.
- Verificar transações e concorrência em estoque, venda, caixa e recebimentos para impedir saldo inconsistente ou dupla baixa.
- Definir política de retenção de dados operacionais e de auditoria.
- Não usar banco de desenvolvimento ou de teste como banco de produção.
- Validar o procedimento de migração em banco vazio e em banco já populado.

### Critérios de aceite

- Migrações de produção são ensaiadas e têm resultado registrado.
- Existe plano de recuperação antes de migration destrutiva.
- Operações financeiras e de estoque críticas são transacionais e têm testes de concorrência relevantes.
- As credenciais de aplicação não possuem permissões administrativas desnecessárias.

## 7. Backups e recuperação de desastre — P0

**Problema observado:** o status registra ausência de backups automatizados e restauração testada.

### Melhorias recomendadas

- Automatizar backups PostgreSQL em frequência definida a partir da perda de dados tolerável pelo negócio.
- Guardar cópias fora da mesma máquina/volume que hospeda a aplicação.
- Criptografar backups em trânsito e em repouso, protegendo também as chaves de criptografia.
- Definir retenção (por exemplo, diária/semanal/mensal) após calcular custo e necessidade legal/operacional.
- Definir objetivos de recuperação:
  - **RPO:** quanto de dado pode ser perdido em um incidente.
  - **RTO:** quanto tempo o sistema pode ficar indisponível.
- Testar restauração em ambiente isolado, não apenas verificar se o arquivo de backup existe.
- Agendar testes de restauração recorrentes e registrar data, duração, versão do backup, resultado e problemas encontrados.
- Incluir instruções para recuperar aplicação, banco, variáveis e arquivos persistentes.
- Garantir que logs, backups e dumps não sejam publicados no Git ou compartilhados sem controle de acesso.
- Definir quem pode restaurar e como prevenir que um restore sobrescreva acidentalmente produção.

### Critérios de aceite

- Backup automático gera alerta em caso de falha.
- Uma restauração completa foi realizada e documentada em ambiente isolado.
- O processo de recuperação tem duração medida e atende ao RTO/RPO escolhidos.
- O procedimento é repetível por outra pessoa seguindo o runbook.

## 8. Monitoramento, logs e alertas — P0/P1

### Melhorias recomendadas

- Monitorar disponibilidade HTTP, falhas 5xx, latência, uso de CPU/memória, espaço em disco, conexões PostgreSQL, reinícios e falhas do worker.
- Monitorar processos de negócio: falhas de checkout, webhooks recusados, fila de mensagens atrasada, importações falhadas e tarefas não executadas.
- Centralizar logs estruturados com timestamp, ambiente, versão, request ID e contexto mínimo necessário.
- Não registrar senhas, tokens, cookies de sessão, conteúdo integral de dados pessoais ou credenciais de integração.
- Configurar alertas acionáveis, com limites e instruções de resposta; evitar alertas sem responsável.
- Criar dashboards operacionais simples antes de dashboards sofisticados para usuários.
- Usar monitoramento externo de uptime além de uma rota interna de health.
- Documentar níveis de severidade e como registrar, investigar e encerrar incidentes.

### Critérios de aceite

- Uma falha simulada gera alerta observável.
- Um erro de API pode ser correlacionado entre log e request ID sem expor segredos.
- Há runbook para indisponibilidade, disco cheio, banco indisponível e worker parado.

## 9. Escalabilidade e custos — P1

O checklist do projeto contém estimativas de hospedagem, mas são estimativas documentais, não cotações garantidas nem medições de consumo.

### Melhorias recomendadas

- Começar com a arquitetura mais simples que atenda aos requisitos medidos; não adotar Kubernetes, microsserviços ou Redis sem necessidade demonstrada.
- Medir latência p50/p95/p99, taxa de erro, conexões e tempo de consultas antes de otimizar.
- Avaliar rate limiting compartilhado entre instâncias quando houver mais de uma réplica; a limitação em memória já está documentada.
- Estabelecer limites por plano para usuários, clientes, produtos, armazenamento, importações e mensagens, se esses recursos forem efetivamente medidos e suportados.
- Monitorar custo por empresa ativa e custo por transação; incluir hospedagem, banco, e-mail, gateway, WhatsApp, observabilidade, backups e domínio.
- Definir alertas de orçamento e política para picos de consumo.
- Planejar capacidade com teste de carga representativo antes de prometer números de empresas ou usuários.
- Fazer teste de carga em staging, nunca contra produção sem autorização e janela controlada.

### Critérios de aceite

- A capacidade inicial anunciada é baseada em teste e limites definidos, não em chute.
- Há alerta para custo, saturação de banco e disco.
- A decisão de escalar vertical ou horizontalmente tem métricas que a justifiquem.

---

# PARTE B — Segurança, identidade e isolamento multiempresa

## 10. Segurança de dependências — P0

**Problema observado:** o status consultado identifica vulnerabilidades no `npm audit`, inclusive duas em dependências de produção (`postcss`/`next`) classificadas como alta naquele relatório.

### Melhorias recomendadas

- Rodar `npm audit` novamente no commit atual; a lista pode mudar com novas versões e advisories.
- Separar vulnerabilidades de runtime/produção das que afetam apenas ferramentas de desenvolvimento, sem ignorar nenhuma.
- Conferir advisories originais, versões afetadas, versão corrigida e risco de breaking change.
- Atualizar dependências em branch isolada, uma família de mudanças por vez.
- Rodar lint, typecheck, testes, build e validação do banco depois de cada atualização relevante.
- Executar smoke tests em staging após o deploy.
- Habilitar Dependabot ou mecanismo equivalente para abrir PRs de atualização.
- Gerar inventário de dependências e acompanhar alertas de segurança.
- Não aplicar `npm audit fix --force` cegamente: pode introduzir mudanças incompatíveis.
- Registrar exceções temporárias com justificativa, responsável e data de expiração.

### Critérios de aceite

- Não há vulnerabilidade conhecida de severidade alta/crítica sem tratamento explícito e aprovado em dependência de produção.
- Cada exceção possui avaliação de impacto, mitigação e prazo.
- O pipeline bloqueia regressões relevantes conforme política definida.

## 11. Autenticação, sessões e recuperação de senha — P0

O checklist documenta cookies `HttpOnly`, `SameSite`, configuração de `Secure`, bcrypt e rate limit de login. Também documenta que o reset de senha sem token de e-mail é apenas local e não deve ser habilitado em produção.

### Melhorias recomendadas

- Em produção, habilitar HTTPS e cookie `Secure`; validar `HttpOnly`, `SameSite` e escopo de domínio/caminho.
- Manter o reset sem token desabilitado até implementar um fluxo seguro por token de uso único, com expiração curta e armazenamento seguro do token.
- Evitar revelar se um e-mail existe durante recuperação de senha.
- Invalidar sessões após troca de senha, alteração sensível de credenciais ou suspeita de comprometimento.
- Criar política de expiração, revogação e encerramento de sessões.
- Adicionar verificação de e-mail antes de liberar cadastro público, se o cadastro público for adotado.
- Considerar MFA para administradores da plataforma e, conforme risco, administradores de empresas.
- Validar proteção contra CSRF conforme os métodos e a estratégia de cookies usada.
- Garantir rate limiting compartilhado em produção multi-instância.
- Documentar processo de recuperação de conta sem depender de intervenção manual informal.

### Critérios de aceite

- O fluxo de recuperação é testado com token expirado, reutilizado, inválido e válido.
- Reset de senha e cadastro não ficam expostos em configuração insegura.
- Sessões podem ser revogadas de maneira previsível.
- Tentativas abusivas são limitadas mesmo após reinício e entre instâncias, quando aplicável.

## 12. Cadastro público e abuso — P0

**Problema observado:** o status informa que o cadastro aberto cria tenant sem verificação de e-mail e sem controles antiabuso suficientes para exposição ampla.

### Melhorias recomendadas

- Manter o cadastro público desabilitado até que exista proteção adequada, ou usar fluxo por convite no piloto.
- Se habilitar cadastro público, exigir verificação de e-mail e avaliar CAPTCHA/controle de abuso acessível, rate limit e detecção de automação.
- Limitar criação de tenants por IP, e-mail e outros sinais proporcionais, sem bloquear injustamente usuários legítimos.
- Definir proteção contra enumeração, spam e criação automatizada de contas.
- Adicionar trilha de auditoria para convites, cadastro, ativação, bloqueio e exclusão.
- Criar processo administrativo para suspender tenant fraudulento sem acessar seus dados de negócio desnecessariamente.

### Critérios de aceite

- O usuário não consegue criar contas em massa sem controle.
- O cadastro/convite é testado contra abuso básico.
- Existe processo documentado para bloqueio, contestação e recuperação de acesso.

## 13. Isolamento de tenants e autorização — P0

O projeto registra testes de isolamento A×B e derivação de `companyId` a partir da sessão autenticada. Isso é positivo, mas não elimina a necessidade de defesa em profundidade.

### Melhorias recomendadas

- Preservar a regra de que o tenant vem do contexto autenticado, nunca de `companyId` fornecido pelo navegador.
- Continuar adicionando testes negativos: usuário da empresa A tenta ler, alterar, exportar, excluir ou referenciar IDs da empresa B.
- Cobrir APIs, relatórios, exportações CSV, importações, uploads, jobs, webhooks e qualquer nova rota.
- Revisar tarefas assíncronas para garantir que o tenant esteja associado de forma segura ao job.
- Avaliar Row-Level Security (RLS) no PostgreSQL como camada adicional de defesa, com base em um desenho de conexão/contexto de tenant que não possa ser manipulado pelo usuário. RLS mal configurada pode causar falsa sensação de segurança; precisa de testes e análise de conexão/transactions.
- Documentar a matriz de permissões por papel e módulo; evitar confiar em botões ocultos na interface.
- Testar acesso direto a endpoints quando um módulo está desativado.
- Revisar ações de plataforma global para que sejam distintas das permissões de administrador de uma empresa.
- Auditar operações administrativas e alterações de permissões.
- Validar que IDs imprevisíveis não sejam tratados como substituto de autorização.

### Critérios de aceite

- Cada recurso de negócio é autorizado por tenant e papel no servidor.
- Testes de integração provam que empresa A não consegue acessar dados da empresa B por leitura, escrita, exportação ou referência indireta.
- A estratégia de RLS é formalmente decidida: implementada e testada, ou não adotada com riscos e controles compensatórios documentados.
- Rotas de plataforma e rotas de tenant estão claramente separadas.

## 14. Proteção contra ataques web — P1

### Melhorias recomendadas

- Revisar validação de entrada, schemas e mensagens de erro para não expor detalhes internos.
- Aplicar limites de tamanho, tipo e frequência a uploads e importações.
- Verificar proteção contra SQL injection, XSS, CSRF, SSRF e path traversal conforme as funções existentes e as dependências utilizadas.
- Configurar cabeçalhos de segurança apropriados, incluindo CSP quando compatível com o frontend.
- Validar CORS com uma lista de origens explícita; não usar wildcard com credenciais.
- Revisar redirecionamentos e URLs externas para evitar open redirect.
- Tratar CSV exportado contra formula injection em programas de planilha, especialmente valores iniciados por `=`, `+`, `-` ou `@`.
- Limitar tentativas e tamanho de payload nos webhooks.
- Revisar erros 4xx/5xx e garantir que não retornem stack trace ou segredos ao cliente.
- Usar OWASP ASVS/WSTG como listas de verificação, ajustando os controles ao risco do produto.

### Critérios de aceite

- Existe revisão de segurança documentada para os fluxos de maior risco.
- Importações, exportações, webhooks e endpoints públicos têm limites e testes.
- Cabeçalhos e políticas de navegador são verificados no domínio de staging.

## 15. Segredos e configuração — P0

### Melhorias recomendadas

- Guardar segredos em variáveis protegidas do ambiente de deploy ou em um secret manager; nunca no Git, imagens públicas ou logs.
- Rotacionar tokens se houver suspeita de exposição.
- Separar chaves por ambiente e por integração.
- Dar acesso aos segredos somente a quem/processo precisa deles.
- Validar no startup a presença e o formato das variáveis essenciais.
- Manter `.env.example` como referência sem valores reais, mas revisar com atenção as flags que não devem ser ativadas em produção.
- Não incluir dumps, backups, arquivos `.env`, tokens Meta/Mercado Pago ou credenciais de banco em commits.
- Documentar rotação e revogação de credenciais.

### Critérios de aceite

- Scanner de segredos passa no repositório e no pipeline.
- A configuração de produção foi revisada variável por variável.
- Há procedimento de rotação de token e resposta a segredo exposto.

---

# PARTE C — LGPD, privacidade e governança

## 16. Inventário de dados e papéis — P0

A aplicação trata dados como nome, telefone, e-mail, CPF e endereço de clientes, conforme o catálogo de melhorias do próprio projeto. Isso torna necessário formalizar os dados tratados e os fluxos de acesso.

### Melhorias recomendadas

- Criar inventário dos dados pessoais por entidade, finalidade, origem, destinatário, local de armazenamento e prazo de retenção.
- Mapear os papéis envolvidos no tratamento e as responsabilidades contratuais entre a Akylla e as empresas clientes. A classificação jurídica depende da operação concreta e deve ser validada com orientação adequada.
- Definir bases legais e finalidades por processo; não usar consentimento como resposta universal.
- Publicar aviso de privacidade compreensível para os usuários do SaaS e orientar as empresas clientes sobre suas próprias responsabilidades.
- Definir canal para solicitações de titulares e processo de atendimento.
- Criar procedimento para acesso, correção, exportação, anonimização e exclusão, respeitando hipóteses legais de retenção.
- Definir prazos de retenção para contas encerradas, logs, backups e registros financeiros.
- Formalizar contratos com provedores que processem dados e revisar transferências internacionais quando aplicável.
- Preparar procedimento de resposta a incidentes envolvendo dados pessoais.
- Minimizar coleta de dados: campo opcional deve permanecer opcional se não for necessário à operação.

### Critérios de aceite

- Existe inventário de dados e finalidades.
- Existe canal e fluxo operacional para solicitações de titulares.
- A política de privacidade e os contratos foram revisados para a operação real do serviço.
- Há procedimento de incidente e decisão sobre comunicação, quando legalmente aplicável.

## 17. Exclusão, anonimização e retenção — P0

**Problema observado:** o checklist documenta ausência de fluxo completo de exclusão/anonimização LGPD.

### Melhorias recomendadas

- Desenhar o processo por entidade antes de codificar: dados que podem ser apagados, dados que precisam ser retidos e dados que podem ser anonimizados.
- Não apagar indiscriminadamente vendas, movimentações financeiras ou trilha de auditoria se houver obrigação legítima de retenção.
- Separar anonimização de exclusão física e registrar a decisão aplicada.
- Proteger o endpoint com autorização forte, confirmação e auditoria.
- Definir como solicitações se propagam para exportações, integrações e backups, respeitando limitações técnicas e prazos definidos.
- Testar que anonimizar um cliente não corrompe totais, vendas, caixa ou relatórios.
- Documentar a política para backups expirarem naturalmente, sem prometer remoção imediata de toda cópia se o processo não garantir isso.

### Critérios de aceite

- O pedido de titular percorre um fluxo rastreável.
- Dados retidos têm justificativa documentada.
- Testes garantem consistência financeira após anonimização.
- A política explica limites e prazos de remoção em backups.

## 18. Documentos jurídicos e transparência — P1

Preparar, com revisão adequada à atividade real:

- Termos de uso do SaaS.
- Política de privacidade.
- Política de cookies, se aplicável.
- Contrato/termos de assinatura e cobrança.
- Política de cancelamento, inadimplência, reembolso e exportação de dados.
- SLA ou descrição honesta do suporte e disponibilidade, sem prometer o que não é medido.
- Lista de subprocessadores/provedores relevantes.
- Canal de privacidade e contato de suporte.
- Procedimento para solicitação de encerramento e portabilidade.

**Importante:** documentos gerados por IA ou modelos genéricos não substituem revisão jurídica. As regras aplicáveis dependem do modelo comercial, do tratamento de dados e dos contratos concretos.

---

# PARTE D — SaaS comercial, cobrança e planos

## 19. Separar cobrança do SaaS e financeiro do cliente — P0

O README afirma que o billing da Akylla é separado do financeiro operacional de cada empresa. Essa separação precisa ser mantida em modelos, APIs, permissões, relatórios e interface.

### Melhorias recomendadas

- Manter entidades e permissões distintas para assinatura Akylla e contas a pagar/receber da empresa cliente.
- Não permitir que um administrador de tenant altere preços globais, planos de outros clientes ou credenciais de gateway.
- Definir um papel de plataforma separado, com autenticação forte e auditoria.
- Registrar eventos de cobrança com identificador do provedor, status, valor, moeda, tenant, plano e timestamps necessários.
- Tratar webhook como fonte de eventos externos não confiáveis até validar assinatura, identidade e idempotência.
- Não ativar acesso apenas porque o navegador retornou de uma página de checkout.
- Definir transições válidas de status de assinatura, pagamento pendente, aprovado, recusado, cancelado, em atraso e expirado.
- Criar reconciliação periódica entre registros internos e o provedor de pagamento.
- Definir como lidar com chargeback, estorno, pagamento duplicado e webhook atrasado.
- Não armazenar dados de cartão que o produto não precisa armazenar; usar os mecanismos tokenizados do gateway.

### Critérios de aceite

- Os testes cobrem eventos repetidos, fora de ordem, inválidos e atrasados.
- A ativação de plano ocorre somente após confirmação confiável do pagamento/status.
- Uma assinatura não pode conceder acesso a outro tenant.
- Existe rotina de reconciliação e procedimento de suporte para divergências.

## 20. Mercado Pago ponta a ponta — P0

**Problema observado:** a documentação informa que o fluxo sandbox foi implementado, mas falta E2E completo e a cobrança recorrente real não está ativada.

### Plano de validação

1. Configurar ambiente de staging com credenciais sandbox separadas.
2. Criar uma assinatura de teste desde o painel do cliente.
3. Simular sucesso, recusa, cancelamento, repetição de webhook, atraso e falha temporária.
4. Confirmar que a assinatura só muda de estado após evento autenticado e validado.
5. Confirmar que eventos duplicados não duplicam pagamento, fatura ou concessão de acesso.
6. Testar limite de uso e comportamento quando a assinatura fica inativa.
7. Testar recuperação após webhook perdido por indisponibilidade.
8. Conferir logs sem dados de cartão ou segredos.
9. Documentar o resultado e obter aprovação antes de trocar para credenciais de produção.
10. Fazer teste controlado de produção com valores e contas autorizados antes de disponibilizar a todos.

### Critérios de aceite

- Fluxos críticos de cobrança têm testes E2E repetíveis em sandbox.
- Webhooks são autenticados e idempotentes.
- Existe reconciliação para eventos ausentes.
- A ativação de produção é uma decisão explícita e reversível.

## 21. Planos, limites e inadimplência — P0/P1

O projeto documenta limites como `userLimit`, `clientLimit` e `productLimit`, mas também registra que a tela `/faturamento` ainda precisa mostrar limites e uso.

### Melhorias recomendadas

- Definir cada plano em uma tabela comercial clara: preço, periodicidade, recursos, limites e política de suporte.
- Exibir ao administrador da empresa o plano atual, status, próxima cobrança quando disponível, uso atual e limite.
- Implementar enforcement de limites no servidor, não somente ocultando botões na interface.
- Testar limites no instante de criação concorrente para evitar ultrapassagem por duas requisições simultâneas.
- Definir comportamento para assinatura inativa: leitura, período de tolerância, bloqueio de escrita, exportação e encerramento.
- Não bloquear exportação dos dados do cliente como forma de coerção; definir política transparente e compatível com obrigações legais.
- Criar fluxo administrativo de mudança de plano e trilha de auditoria.
- Evitar alterações retroativas silenciosas em planos de clientes.
- Definir como o sistema reage a falha de cobrança e como o usuário recebe aviso.

### Critérios de aceite

- Uso e limites visíveis na tela de faturamento.
- Limites são impostos na API e testados sob concorrência.
- Estados de assinatura têm comportamento funcional e comercial documentado.
- O cliente consegue compreender como cancelar e exportar os próprios dados.

## 22. Onboarding e gestão de clientes — P1

### Melhorias recomendadas

- Definir jornada desde a página pública até a primeira operação útil: conhecer, criar conta/aceitar convite, configurar empresa, importar dados, convidar usuários e registrar primeira venda.
- Criar checklist inicial dentro do sistema, com opção de dispensar ou retomar.
- Fornecer dados demonstrativos neutros, sem dados pessoais reais e sem tema exclusivo de pet shop.
- Oferecer modelos CSV e mensagens de validação compreensíveis.
- Incluir onboarding para configurar nome, fuso horário, moeda, métodos de pagamento, estoque inicial e permissões.
- Criar página pública com escopo real do produto, limitações, preço e perguntas frequentes.
- Criar canal de suporte e procedimento para incidentes.
- Registrar eventos de ativação de forma minimizada para identificar em que etapa os clientes travam.

### Critérios de aceite

- Uma pessoa não técnica consegue completar o onboarding usando documentação e mensagens do sistema.
- É possível importar um CSV de exemplo sem precisar de ajuda do desenvolvedor.
- O sistema explica erros de importação por linha e não duplica registros silenciosamente.

## 23. Produto, posicionamento e validação comercial — P1

### Recomendação de posicionamento

Manter a promessa inicial focada em **gestão operacional básica para pequenos negócios que trabalham com clientes, produtos/estoque, vendas, caixa e financeiro básico**. Não prometer ser um ERP completo nem atender todos os setores antes de validar as necessidades.

### Melhorias recomendadas

- Escolher um segmento inicial para o piloto, mesmo que a arquitetura permaneça genérica.
- Entrevistar alguns potenciais usuários e observar tarefas reais antes de adicionar módulos.
- Identificar 3–5 fluxos essenciais que o cliente precisa concluir sem ajuda.
- Definir critérios de sucesso do piloto: operações concluídas, erros, tempo de onboarding, incidentes, retenção e disposição de pagar.
- Validar o preço com clientes reais e custos reais; não fixar preço apenas por comparação superficial com concorrentes.
- Criar um processo simples de suporte, registro de bugs e priorização.
- Adiar funcionalidades fiscais, contábeis ou específicas de setores até haver escopo, pesquisa e validação técnica/legal.
- Medir uso por módulo antes de investir em novos módulos.
- Não lançar muitos planos antes de compreender o que os clientes realmente valorizam.

### Critérios de aceite

- Um piloto documentado confirma que os fluxos principais resolvem um problema real.
- Limitações são comunicadas antes da contratação.
- Há feedback estruturado e uma lista priorizada de problemas do piloto.

---

# PARTE E — Funcionalidades e integridade de negócio

## 24. Estoque, vendas e caixa — P0/P1

Esses módulos lidam com valores e quantidades; um erro pode afetar diretamente o cliente.

### Melhorias recomendadas

- Definir invariantes explícitas: uma venda concluída deve atualizar seus itens, estoque e efeitos financeiros de forma consistente.
- Usar transações de banco para operações que não podem ficar parcialmente concluídas.
- Definir estados de venda e cancelamento; evitar apagar operações que já tiveram efeito financeiro.
- Garantir que estornos criem lançamentos compensatórios e não alterem silenciosamente o histórico.
- Testar duas vendas concorrentes do último item em estoque.
- Testar repetição de requisição por timeout/retry para evitar venda ou baixa duplicada.
- Definir arredondamento monetário e unidade de precisão para valores; não usar ponto flutuante binário como base de cálculo financeiro.
- Definir regras para desconto, cancelamento, fechamento de caixa e diferença de caixa.
- Testar relatórios com dados de borda: período sem vendas, estorno, venda parcial, valores zero e filtros de data.
- Exibir fuso horário e datas de forma consistente.
- Documentar limitações de meios de pagamento e serviços vendidos no PDV até que sejam resolvidas.

### Critérios de aceite

- Testes de integração verificam consistência entre venda, estoque, caixa e financeiro.
- Falhas intermediárias não deixam registros parciais inconsistentes.
- Cancelamentos e estornos são rastreáveis.
- Os relatórios reconciliam com os registros transacionais.

## 25. Importação e exportação de dados — P1

O status registra importação CSV com dry-run, tratamento de duplicatas e histórico de lotes. Isso deve ser tratado como um fluxo importante de onboarding.

### Melhorias recomendadas

- Documentar modelos CSV, campos obrigatórios/opcionais, formato de datas, separador decimal, encoding e limites.
- Apresentar prévia e erros por linha antes de confirmar importação.
- Definir claramente o que acontece com duplicatas e como o usuário pode corrigir o arquivo.
- Garantir que uma importação interrompida possa ser identificada e não deixe dados parcialmente inconsistentes sem indicação.
- Restringir tamanho, quantidade de linhas, frequência e tempo máximo de processamento.
- Proteger CSV contra formula injection ao exportar.
- Permitir baixar relatório de erros sem expor dados de outras empresas.
- Testar importação duplicada, arquivo vazio, encoding inválido, campos enormes e registros conflitantes.
- Definir política de exportação integral para encerramento da conta.

### Critérios de aceite

- Um arquivo inválido não modifica dados sem consentimento claro.
- O usuário recebe erros acionáveis e consegue corrigir a planilha.
- Todo lote tem status e histórico visíveis.
- Exportações ficam restritas ao tenant autorizado.

## 26. WhatsApp e tarefas assíncronas — P1

O README descreve integração com WhatsApp Cloud API, templates, consentimento, fila, retentativas e webhooks. O status também documenta limitações de produção e dependência de URL pública para webhooks.

### Melhorias recomendadas

- Manter integração mock nos testes e credenciais reais apenas em ambiente protegido.
- Validar assinatura e origem dos webhooks; tratar repetição de eventos com idempotência.
- Aplicar retentativas com backoff, limite máximo e fila de mensagens falhadas para inspeção.
- Evitar ciclos infinitos de retentativa.
- Registrar consentimento, finalidade e origem da permissão para comunicações, conforme aplicável.
- Respeitar templates, janelas e políticas atuais da Meta; revisar a documentação oficial antes de publicar.
- Criar indicadores de fila: pendentes, enviadas, falhas, idade da mensagem e tentativas.
- Definir política de silêncio, opt-out e tratamento de número inválido.
- Testar que falha do provedor de WhatsApp não bloqueia venda ou operação principal.
- Definir timeout e circuit breaker se houver chamadas externas síncronas.

### Critérios de aceite

- A indisponibilidade do provedor não derruba os fluxos centrais.
- Webhooks repetidos não duplicam ações.
- Consentimento e opt-out são respeitados.
- A fila pode ser observada e recuperada sem intervenção no banco manualmente.

---

# PARTE F — Design, UX e acessibilidade

## 27. Sistema visual consistente — P1

O repositório já contém um catálogo de design e correções recentes; este plano complementa o trabalho existente, não o substitui.

### Melhorias recomendadas

- Consolidar tokens semânticos para cor, tipografia, espaçamento, bordas, sombras, foco e estados.
- Usar componentes reutilizáveis para tabelas, modais, seletores, notificações, botões, campos, paginação e filtros.
- Eliminar estilos duplicados e classes improvisadas quando já houver componente padrão.
- Definir regras consistentes de espaçamento, hierarquia visual, alinhamento e densidade de informação.
- Garantir que estados de sucesso, alerta, erro e informação não dependam apenas de cor.
- Criar padrões de formulários: rótulos persistentes, ajuda contextual, validação próxima ao campo e resumo de erros.
- Usar a mesma terminologia em navegação, botões, mensagens e documentação.
- Evitar modais para operações longas ou fluxos que exigem muitas decisões.
- Padronizar confirmações para ações destrutivas e irreversíveis.

### Critérios de aceite

- As páginas principais usam os mesmos componentes e tokens.
- Estados e mensagens são previsíveis.
- A interface não contém cores de texto com contraste insuficiente conhecido.

## 28. Acessibilidade WCAG — P1

O status registra correções de contraste em 15/10/2026 e aponta débitos de design ainda pendentes.

### Melhorias recomendadas

- Usar WCAG 2.2 nível AA como alvo de projeto, com validação manual e automatizada.
- Garantir contraste mínimo aplicável a texto normal e texto grande; verificar também controles, ícones informativos e estados de foco.
- Navegar pelas principais telas apenas com teclado.
- Garantir foco visível, ordem lógica e retorno de foco após fechar modal.
- Associar rótulos a inputs e fornecer mensagens de erro anunciáveis por leitores de tela.
- Garantir nomes acessíveis para ícones e botões sem texto.
- Não comunicar status somente por cor.
- Respeitar `prefers-reduced-motion`.
- Testar zoom, telas menores e leitores de tela nas jornadas essenciais.
- Evitar tabelas que dependam apenas de alinhamento visual para comunicar cabeçalhos.

### Critérios de aceite

- As jornadas de login, cadastro, venda, importação e faturamento passam por teste de teclado.
- Contraste é verificado com ferramenta e conferência manual.
- Erros e status dinâmicos são acessíveis.

## 29. Responsividade e comportamento de telas — P1

### Melhorias recomendadas

- Testar breakpoints reais nas páginas de dashboard, tabelas, formulários, PDV, importação e faturamento.
- Em telas estreitas, preferir colunas prioritárias, rolagem horizontal controlada ou visualização adaptada, em vez de comprimir tudo.
- Garantir que ações primárias permaneçam visíveis e que ações secundárias não poluam a interface.
- Definir estados consistentes de carregamento, vazio, erro, sucesso e sem permissão.
- Criar skeletons somente quando melhorarem a percepção de carregamento; não substituir mensagens de erro por carregamento infinito.
- Usar paginação e busca no servidor para conjuntos grandes.
- Preservar filtros e contexto ao navegar e retornar.
- Testar zoom e tamanho de fonte sem sobreposição.
- Avaliar impressão apenas onde exista necessidade operacional documentada.

### Critérios de aceite

- Não há ações essenciais inacessíveis em resoluções comuns.
- Não há overflow que esconda controles importantes.
- Todas as páginas críticas têm estado vazio, loading e erro úteis.

## 30. Tabelas, formulários e visualização de dados — P1/P2

### Melhorias recomendadas

- Concluir os débitos de design documentados para o componente de tabela e os primitivos que faltam.
- Padronizar ordenação, paginação, filtros, seleção de linha e ações.
- Informar quando o resultado está filtrado e oferecer limpeza dos filtros.
- Diferenciar “sem dados cadastrados” de “nenhum resultado encontrado”.
- Em indicadores financeiros, mostrar período, moeda e regra de cálculo.
- Não usar gráficos decorativos sem decisão que eles ajudem a tomar.
- Garantir que números exibidos no dashboard sejam derivados do servidor e reconciliáveis com os registros de origem.
- Mostrar estados de erro de consulta em vez de valores zero enganosos.

### Critérios de aceite

- Indicadores têm definição documentada e reproduzível.
- Tabelas se comportam da mesma forma entre módulos.
- Filtros e paginação não vazam dados entre tenants.

---

# PARTE G — Documentação e engenharia de software

## 31. Documentação como fonte confiável — P1

O projeto já tem documentação extensa. O risco não é apenas faltar documentação, mas **existirem instruções antigas que contradigam o estado atual**.

### Melhorias recomendadas

- Manter `docs/operations/PROJECT_STATUS.md` como fonte única do estado atual, conforme a própria convenção do projeto.
- Marcar planos concluídos como históricos e linkar para a implementação vigente.
- Exigir atualização da documentação quando uma rota, variável, migration, módulo, política ou comando mudar.
- Adicionar data, versão/commit de referência e status a documentos operacionais críticos.
- Validar links internos no CI.
- Documentar cada variável de ambiente com finalidade, obrigatoriedade, ambiente, valor padrão seguro e risco.
- Documentar comandos de setup, migração, teste, seed, build, validação, backup, restore e deploy.
- Manter diagramas simples de arquitetura, fluxo de autenticação, isolamento de tenant, cobrança e processamento de webhooks.
- Incluir decisões arquiteturais (ADRs) para escolhas de impacto, como RLS, modelo de deploy, billing e retenção.
- Evitar copiar contagens de testes e migrations em vários documentos; apontar para a fonte canônica.

### Critérios de aceite

- Links e comandos documentados são verificados automaticamente quando possível.
- Um novo desenvolvedor consegue preparar o ambiente seguindo o README.
- Cada documento crítico deixa claro se está atual ou histórico.

## 32. Runbooks operacionais — P0/P1

Criar e testar instruções para:

- Deploy e rollback.
- Aplicar migrations.
- Restaurar banco a partir de backup.
- Banco indisponível ou sem espaço.
- Falha de login/cadastro.
- Vazamento ou rotação de segredo.
- Incidente de isolamento entre empresas.
- Webhook de pagamento não recebido.
- Divergência de assinatura/pagamento.
- Worker/fila parada.
- Solicitação LGPD.
- Cancelamento de empresa e exportação de dados.
- Indisponibilidade do provedor de WhatsApp.
- Resposta a incidente de segurança.

Cada runbook deve conter: sinais de detecção, impacto, passos de diagnóstico, ação segura, validação de recuperação, comunicação, responsável e link para logs/dashboards.

## 33. Testes automatizados e qualidade — P0/P1

A suíte de 538 testes documentada é um bom ponto de partida. O próximo objetivo é cobrir os riscos reais de operação e integração.

### Melhorias recomendadas

- Preservar a suíte unitária e de integração existente.
- Adicionar testes E2E para as jornadas críticas do usuário, especialmente onboarding, venda/estoque/caixa, importação e billing.
- Adicionar testes de regressão para cada falha encontrada em staging ou piloto.
- Cobrir autorização por tenant em todas as rotas novas.
- Testar concorrência e idempotência nas operações financeiras, de estoque e webhooks.
- Testar falhas de dependências externas, timeouts e retentativas.
- Testar migrations desde um banco vazio e desde a versão anterior suportada.
- Manter testes determinísticos, sem depender de serviços pagos reais.
- Usar mocks/sandbox para integrações externas e reservar teste real para uma etapa controlada.
- Definir cobertura por risco, não perseguir apenas uma porcentagem global.
- Rodar análise estática, auditoria de dependências e detecção de segredos na CI.
- Fazer revisão humana de mudanças que afetem autorização, cobrança, dados pessoais ou migrations.

### Critérios de aceite

- CI bloqueia merge quando testes, typecheck, lint, build ou validação de schema falham.
- Fluxos críticos têm testes de integração/E2E.
- Falhas são reproduzíveis localmente.
- Exceções de segurança são aprovadas e documentadas.

## 34. Processo de desenvolvimento com IA — P1

Como o projeto pode evoluir com assistência de ferramentas de IA, é importante manter limites claros de autonomia.

### Regras recomendadas para agentes de código

- Primeiro inspecionar `AGENTS.md`, status, árvore de arquivos, scripts e estado Git.
- Antes de codificar, apresentar plano, arquivos afetados, riscos e testes.
- Não inventar rotas, modelos, variáveis ou scripts; verificar no repositório.
- Não alterar banco, migrations, autenticação, cobrança ou deploy sem autorização explícita para essa tarefa.
- Não instalar dependências sem explicar motivo, alternativa e impacto.
- Fazer mudanças pequenas e revisáveis.
- Executar validações reais e reportar comandos e resultados, sem afirmar que testes passaram se não foram executados.
- Não modificar secrets, ambientes externos ou produção automaticamente.
- Produzir resumo final com diff, testes, riscos remanescentes e instruções para revisão.
- Parar e pedir decisão quando houver ambiguidade de produto ou risco de dados.

### Critérios de aceite

- Cada entrega tem escopo limitado e diff revisável.
- O agente diferencia fatos observados de hipóteses.
- O proprietário mantém controle sobre alterações destrutivas e custos.

---

# PARTE H — Operação comercial e suporte

## 35. Suporte e incidentes — P1

### Melhorias recomendadas

- Definir canal de suporte, horários, escopo e expectativa de resposta.
- Criar classificação simples de incidentes: indisponibilidade, perda/inconsistência de dados, segurança, cobrança e dúvida funcional.
- Registrar ticket com tenant, versão, horário, impacto e request ID; evitar anexar dados pessoais desnecessários.
- Criar procedimento de comunicação para incidentes que afetem vários clientes.
- Manter status page simples quando a operação justificar.
- Criar política de manutenção programada.
- Definir processo de correção urgente e comunicação de atualização.
- Documentar limites do suporte incluído em cada plano.

### Critérios de aceite

- Um cliente sabe onde reportar problema.
- Um incidente pode ser priorizado, acompanhado e encerrado com histórico.
- A equipe consegue identificar clientes afetados sem acessar dados além do necessário.

## 36. Cancelamento, portabilidade e encerramento — P1

### Melhorias recomendadas

- Implementar fluxo claro para cancelar assinatura e encerrar conta.
- Explicar data efetiva de encerramento, cobrança final e o que acontece com acesso e dados.
- Permitir exportar os dados relevantes em formato documentado antes do encerramento, respeitando regras de segurança.
- Definir período de retenção e processo de eliminação após o prazo aplicável.
- Revogar sessões, convites e credenciais de integração quando necessário.
- Garantir que encerramento de um tenant não afete outros.
- Auditar ações de exclusão e encerramento.

### Critérios de aceite

- O cliente consegue entender e iniciar cancelamento sem depender de contato informal.
- Exportação é validada e restrita ao tenant.
- O encerramento é idempotente e não altera dados de outras empresas.

## 37. Indicadores operacionais do SaaS — P1/P2

Acompanhar um conjunto pequeno de métricas:

- Disponibilidade e taxa de erros.
- Latência p95 das rotas críticas.
- Falhas de login/cadastro e sinais de abuso.
- Backups concluídos e último restore testado.
- Falhas e atrasos de webhooks.
- Assinaturas ativas, pendentes, canceladas e em atraso.
- Conversão do onboarding, ativação e cancelamento.
- Tickets por categoria e tempo de resolução.
- Custo mensal total e custo aproximado por tenant ativo.
- Erros de importação e abandono de onboarding.

As métricas devem ser agregadas e minimizadas; não devem capturar conteúdo sensível desnecessário.

---

# PARTE I — Plano de execução sugerido

## 38. Fase 0 — Congelar e estabelecer a linha de base

**Objetivo:** confirmar o estado real do checkout antes de executar mudanças.

- [ ] Conferir branch, commit e árvore Git limpa.
- [ ] Ler `AGENTS.md`, `PROJECT_STATUS.md` e `CHECKLIST_PRE_PRODUCAO.md`.
- [ ] Executar `npm run validate` no ambiente de desenvolvimento atual.
- [ ] Rodar `npm audit` e salvar o resultado datado.
- [ ] Confirmar se o CI atual está verde.
- [ ] Confirmar versões de Node, npm, PostgreSQL e dependências.
- [ ] Atualizar o status com as diferenças entre o documento e o checkout.
- [ ] Criar branch para o trabalho de preparação de produção.

**Aceite:** linha de base documentada e sem alteração funcional inadvertida.

## 39. Fase 1 — Bloqueadores de segurança e dados (P0)

- [ ] Tratar vulnerabilidades de produção e definir plano para vulnerabilidades de desenvolvimento.
- [ ] Desabilitar em produção reset de senha inseguro e cadastro público sem proteção.
- [ ] Configurar secrets e cookies de produção corretamente.
- [ ] Definir e implementar backup automático.
- [ ] Restaurar backup em ambiente isolado e registrar evidência.
- [ ] Definir RPO/RTO e retenção.
- [ ] Desenhar e implementar processo de direitos LGPD conforme análise jurídica/operacional.
- [ ] Revisar permissões e isolamento multiempresa, incluindo jobs e exportações.
- [ ] Decidir e testar estratégia de defesa adicional de banco, incluindo avaliação de RLS.
- [ ] Documentar resposta a incidentes.

**Aceite:** nenhum bloqueador P0 conhecido fica sem mitigação aprovada e registrada.

## 40. Fase 2 — Staging, deploy e monitoramento (P0)

- [ ] Definir provedor, domínio e ambiente.
- [ ] Configurar HTTPS, secrets e variáveis.
- [ ] Preparar PostgreSQL de staging separado.
- [ ] Transformar CD placeholder em pipeline real, com gates e aprovação.
- [ ] Testar migrations e rollback/recuperação.
- [ ] Configurar logs estruturados, monitoramento e alertas.
- [ ] Simular falha de banco, worker e aplicação.
- [ ] Executar smoke tests após deploy.
- [ ] Documentar runbooks.

**Aceite:** staging pode ser implantado e recuperado de forma repetível, com alertas funcionando.

## 41. Fase 3 — Cobrança e regras comerciais (P0)

- [ ] Executar E2E de checkout e webhook em sandbox.
- [ ] Testar idempotência, eventos fora de ordem e reconciliação.
- [ ] Validar enforcement de limites.
- [ ] Exibir plano e consumo na tela `/faturamento`.
- [ ] Definir estados e políticas de inadimplência/cancelamento.
- [ ] Revisar termos de assinatura e privacidade.
- [ ] Aprovar explicitamente a ativação de credenciais reais.
- [ ] Fazer teste controlado de produção.

**Aceite:** ciclo de assinatura é testado ponta a ponta e auditável; cobrança real só é ativada com aprovação.

## 42. Fase 4 — Piloto controlado (P1)

- [ ] Selecionar um pequeno grupo de empresas piloto com consentimento e expectativas alinhadas.
- [ ] Usar dados reais somente depois dos bloqueadores P0.
- [ ] Não importar dados sensíveis sem necessidade e autorização.
- [ ] Acompanhar erros, latência, custos, tickets e onboarding.
- [ ] Validar backup/restore durante o período de piloto.
- [ ] Registrar feedback por fluxo, não apenas opiniões genéricas.
- [ ] Definir critério de pausa caso haja perda de dados, falha de isolamento, cobrança incorreta ou indisponibilidade relevante.

**Aceite:** critérios de go/no-go são atendidos e os problemas críticos encontrados foram corrigidos.

## 43. Fase 5 — Lançamento público gradual (P1/P2)

- [ ] Publicar página de produto com escopo e limitações claros.
- [ ] Publicar preços, termos, privacidade e canais de suporte.
- [ ] Ativar cadastro público somente com proteções aprovadas.
- [ ] Acompanhar capacidade e custos.
- [ ] Revisar incidentes e tickets semanalmente no início.
- [ ] Adiar funcionalidades novas até a operação estar estável.
- [ ] Reavaliar preço e limites com base no custo real e uso.

**Aceite:** operação sustentável, cobrança reconciliada, suporte definido e indicadores de saúde disponíveis.

---

## 44. Matriz de go/no-go para venda

| Área | GO quando… | NO-GO se… |
|---|---|---|
| Dados | Backup automático e restauração testada | Backup não existe ou restore falha |
| Segurança | Vulnerabilidades graves tratadas/mitigadas; configuração revisada | Vulnerabilidade grave conhecida sem decisão ou segredo exposto |
| Autenticação | HTTPS, cookies seguros e recuperação de senha adequada | Reset inseguro ou sessão sem proteção adequada |
| Multiempresa | Testes de isolamento e autorização cobrem fluxos críticos | Há acesso cruzado ou risco não avaliado em fluxo crítico |
| Operação | Deploy reproduzível, monitoramento e runbooks | Deploy manual desconhecido ou sem recuperação |
| Privacidade | Inventário, canal e processos mínimos definidos | Não há processo para solicitação/incidentе de dados |
| Cobrança | E2E sandbox, idempotência e reconciliação validadas | Pagamento pode ativar plano incorretamente |
| Produto | Limitações, plano, cancelamento e suporte claros | Promessa comercial excede o que o sistema entrega |
| Custos | Custo observado e limites monitorados | Não há controle de gasto ou risco de cobrança inesperada |

**A venda deve ser bloqueada se qualquer item crítico de dados, isolamento, cobrança ou recuperação estiver em NO-GO.**

---

## 45. Decisões que o proprietário precisa tomar

Essas decisões não devem ser inventadas pela implementação:

1. Qual provedor de hospedagem e região usar.
2. Qual domínio será usado e quem administrará DNS.
3. Qual orçamento mensal máximo será destinado a hospedagem, banco, backups, e-mail, monitoramento e integrações.
4. Se o primeiro piloto será por convite ou cadastro público.
5. Qual segmento será usado para validar o produto primeiro.
6. Quais planos, preços, limites e periodicidade de cobrança serão oferecidos.
7. Qual política de inadimplência, tolerância, cancelamento e exportação será adotada.
8. Quais RPO/RTO e retenção de backups são aceitáveis.
9. Como será feito suporte e resposta a incidentes.
10. Quem revisará os documentos jurídicos e o enquadramento LGPD.
11. Se RLS será implementada como defesa em profundidade antes de produção e qual desenho técnico será usado.
12. Qual conjunto de funcionalidades será explicitamente excluído da promessa comercial inicial.

---

## 46. Melhorias que eu não priorizaria agora

Para reduzir custo e complexidade, não recomendo começar por:

- Reescrever todo o sistema em outra stack.
- Migrar para microsserviços sem gargalo comprovado.
- Adotar Kubernetes para uma primeira instalação pequena sem necessidade operacional.
- Criar muitos módulos específicos antes de validar os fluxos principais.
- Adicionar gráficos sofisticados sem decisão de negócio que os justifique.
- Construir aplicativo mobile nativo antes de validar uso responsivo.
- Implementar contabilidade/fiscal/frota/produção sem escopo e validação específicos.
- Introduzir várias plataformas pagas de uma vez.
- Refatorar identificadores legados apenas por estética se isso exigir migrações arriscadas; planejar uma migração dedicada se houver benefício real.
- Aumentar o número de testes sem considerar se cobrem os riscos críticos.

A regra é: **primeiro confiabilidade, proteção de dados, cobrança e operação; depois aquisição e expansão funcional.**

---

## 47. Fontes e fundamentos

As recomendações abaixo foram elaboradas a partir do estado documentado do projeto e de boas práticas públicas. As referências são guias técnicos, não certificações do Akylla Gestão.

### Fontes primárias do projeto

1. Repositório Akylla Gestão:  
   https://github.com/Tanattos18/Akylla-Gestao

2. Status do projeto:  
   https://github.com/Tanattos18/Akylla-Gestao/blob/main/docs/operations/PROJECT_STATUS.md

3. Checklist pré-produção:  
   https://github.com/Tanattos18/Akylla-Gestao/blob/main/docs/akylla/CHECKLIST_PRE_PRODUCAO.md

4. Catálogo de melhorias técnicas:  
   https://github.com/Tanattos18/Akylla-Gestao/blob/main/upgrade/MELHORIAS.md

5. Catálogo de melhorias de design:  
   https://github.com/Tanattos18/Akylla-Gestao/blob/main/upgrade/MELHORIAS_DESIGN.md

6. Índice de documentação:  
   https://github.com/Tanattos18/Akylla-Gestao/blob/main/docs/README.md

### Segurança e desenvolvimento seguro

7. OWASP ASVS — requisitos verificáveis de segurança de aplicações web, incluindo autorização e isolamento entre tenants:  
   https://owasp.org/www-project-application-security-verification-standard/

8. OWASP ASVS — seção de autorização, com requisito de controles contra acesso entre tenants:  
   https://github.com/OWASP/ASVS/blob/master/5.0/en/0x17-V8-Authorization.md

9. NIST SP 800-218 — Secure Software Development Framework (SSDF), práticas para desenvolver, proteger e manter software seguro:  
   https://csrc.nist.gov/pubs/sp/800/218/final

### Privacidade e LGPD

10. ANPD — Guia orientativo de segurança da informação para agentes de tratamento de pequeno porte:  
    https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte

11. ANPD — Checklist de medidas de segurança para agentes de tratamento de pequeno porte:  
    https://www.gov.br/anpd/pt-br/centrais-de-conteudo/checklist-vf.pdf

12. ANPD — Resolução CD/ANPD nº 2/2022, regulamento de aplicação da LGPD para agentes de tratamento de pequeno porte (consultar versão vigente e alterações):  
    https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022

### Como usar essas referências

- OWASP ASVS/WSTG: transformar riscos de aplicação em requisitos e testes verificáveis.
- NIST SSDF: estruturar um processo de desenvolvimento seguro, revisão e resposta a vulnerabilidades.
- ANPD: orientar medidas administrativas e técnicas proporcionais ao risco e à operação real.
- Documentação do repositório: validar o que já existe e evitar reimplementar funcionalidades sem necessidade.

---

## 48. Conclusão final

O Akylla Gestão não parece estar no estágio de uma ideia vazia: o repositório descreve uma aplicação com módulos reais, arquitetura multiempresa, integração de cobrança em sandbox, documentação e uma suíte de testes considerável. Isso é uma base importante.

Mas **“o código compila e os testes passam” não é o mesmo que “o SaaS está pronto para receber dinheiro e dados de clientes”**. A documentação atual reconhece essa diferença e lista os bloqueadores.

A rota mais segura e econômica é:

1. Confirmar a linha de base atual.
2. Resolver segurança, backup/restore e privacidade.
3. Preparar staging, deploy, logs e alertas.
4. Validar Mercado Pago de ponta a ponta.
5. Fazer piloto controlado.
6. Corrigir problemas observados.
7. Só então liberar a comercialização geral.

O objetivo não é tornar o sistema perfeito antes de vender. É evitar que uma falha previsível de segurança, perda de dados, cobrança ou isolamento destrua a confiança dos primeiros clientes. Priorize as melhorias por risco e evidência, registre cada decisão e mantenha o escopo inicial pequeno o suficiente para operar bem.
