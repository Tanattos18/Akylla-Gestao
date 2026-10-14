# Akylla Gestão — Diretrizes do Produto e Plano de Adaptação do Projeto

**Documento-base para o OpenCode**  
**Versão:** 1.0  
**Data:** 12/10/2026  
**Objetivo:** orientar a adaptação da base existente para o Akylla Gestão, preservando componentes técnicos úteis e substituindo o foco exclusivo em pet shops por uma plataforma de gestão para pequenos negócios de diferentes segmentos.

> **Uso atual (2026-10-14).** As partes **2 (visão de produto), 3–9
> (regras, escopo, UI, arquitetura, segurança)** seguem valendo como
> requisitos. O **§10 "Plano de adaptação por etapas" foi superado**: a
> execução seguiu o roteiro `PASSO_A_PASSO_OPENCODE_AKYLLA.md`
> (Etapas 0–12, concluído em 2026-10-12), com plano detalhado em
> `akylla/PLANO_DE_ADAPTACAO.md`. Papéis implementados são
> `ADMIN`/`MEMBER` (o `OWNER/ADMIN` e `MEMBER/STAFF` do §3.8 nunca
> existiram no schema).

---

## 1. Instrução principal ao agente de desenvolvimento

Analise o repositório existente antes de alterar qualquer arquivo. Use o código-fonte, as migrations, os testes e a documentação real como fonte de verdade. Não presuma que tudo o que consta na documentação esteja implementado ou funcionando.

Adapte o projeto gradualmente para se tornar o **Akylla Gestão**, um SaaS multiempresa de gestão empresarial para pequenos negócios brasileiros. Não reconstrua o projeto do zero sem demonstrar uma necessidade técnica concreta.

### Regras obrigatórias de trabalho

1. Antes de editar, inspecione a árvore de arquivos, `package.json`, aplicações, pacotes compartilhados, schema do banco, migrations, autenticação, autorização, testes e documentação.
2. Gere um diagnóstico inicial com:
   - funcionalidades que existem no código;
   - funcionalidades descritas, mas não confirmadas;
   - funcionalidades específicas da base original;
   - componentes reutilizáveis;
   - riscos e dependências;
   - plano de adaptação por etapas.
3. Não apague a pasta legada `automação do whatsapp/` nem outros componentes sem autorização explícita.
4. Não substitua tecnologias ou integrações existentes sem justificar os custos, riscos e benefícios.
5. Não crie tabelas, módulos, endpoints ou integrações duplicadas. Reutilize e migre o que fizer sentido.
6. Não invente dados de demonstração nos indicadores de produção.
7. Não afirme que testes passaram sem executá-los. Registre os comandos executados e os resultados reais.
8. Faça alterações pequenas, verificáveis e reversíveis. Não avance para a próxima etapa se os testes relevantes falharem.
9. Não realize deploy, não publique credenciais, não altere serviços pagos e não faça commits sem autorização do proprietário.
10. Ao terminar cada etapa, atualize a documentação de arquitetura, o status do projeto, o changelog e a lista de pendências.

---

## 2. Visão do produto

### Nome

**Akylla Gestão**

### Posicionamento

Sistema de gestão simples, acessível e organizado para pequenos negócios brasileiros que desejam centralizar sua operação em um só lugar.

### Proposta de valor

Ajudar pequenos empreendedores a controlar clientes, fornecedores, produtos, estoque, vendas e finanças sem depender de diversas planilhas ou ferramentas desconectadas.

### Modelo comercial

SaaS por assinatura mensal, com planos que podem variar conforme recursos, número de usuários, volume de registros e módulos habilitados. Os limites comerciais só devem ser anunciados depois que forem implementados e testados tecnicamente.

### Público inicial

Priorizar pequenos negócios com processos comuns de comércio e gestão de produtos:

1. lojas de variedades, roupas, acessórios e utilidades;
2. pet shops e lojas de produtos para animais;
3. pequenas distribuidoras;
4. pequenos negócios de serviços que precisem de clientes e controle financeiro básico.

Esses segmentos são uma hipótese inicial a validar com usuários reais, não uma garantia de demanda.

### Limites do posicionamento

O Akylla Gestão não deve ser apresentado inicialmente como um ERP completo para qualquer setor. Transportadoras com frota, roteirização e rastreamento, indústrias com planejamento de produção, e empresas que dependem de operações fiscais ou contábeis complexas precisam de módulos e validações específicos.

O produto deve ter um **núcleo comum reutilizável** e, no futuro, **módulos opcionais por segmento**. Não implementar todas as particularidades de cada setor na primeira versão.

---

## 3. Princípio arquitetural: multiempresa de verdade

O Akylla Gestão deverá permitir que diversas empresas utilizem a mesma aplicação, mantendo os dados isolados.

### Entidades conceituais

- **Conta de usuário:** identidade de uma pessoa que acessa o sistema.
- **Empresa/organização:** tenant proprietário dos dados de negócio.
- **Membro da empresa:** associação entre usuário, empresa, papel e permissões.
- **Plano da plataforma:** plano comercial oferecido pela Akylla.
- **Assinatura da plataforma:** assinatura da empresa cliente com a Akylla.

Não confundir a assinatura comercial da empresa com assinaturas, contratos ou cobranças que a própria empresa possa administrar em seu negócio. Se um recurso futuro permitir que um cliente do lojista tenha uma assinatura, isso será um módulo de negócio separado.

### Requisitos de isolamento e segurança

1. Toda informação de negócio deve estar vinculada à empresa correta.
2. A empresa ativa deve ser determinada pela sessão e pelas associações autorizadas no servidor, nunca confiada cegamente a um `companyId` enviado pelo navegador.
3. Toda leitura, atualização e exclusão deve validar a empresa proprietária e as permissões do usuário.
4. Registros de outra empresa não devem ser revelados. Usar respostas consistentes, por exemplo `404`, quando isso fizer sentido para o endpoint.
5. Se houver acesso direto do frontend ao banco, configurar e testar políticas RLS para todas as tabelas multiempresa. Se o acesso for feito por API, validar autorização no backend e impedir caminhos alternativos que ignorem essa autorização.
6. Não expor chaves privilegiadas, segredos, tokens ou credenciais no bundle do navegador, logs ou respostas da API.
7. Testar explicitamente que um usuário da Empresa A não consegue ler, alterar, excluir ou associar registros da Empresa B.
8. Definir e testar papéis iniciais, como `OWNER/ADMIN` e `MEMBER/STAFF`, sem depender somente de ocultar botões na interface.
9. Toda ação administrativa sensível deve ser autorizada no backend.
10. Registrar operações relevantes para auditoria quando aplicável.

**Não considerar o sistema multiempresa seguro apenas porque existe uma coluna `companyId`. O isolamento precisa ser imposto e testado na camada de autorização e, quando aplicável, no banco de dados.**

---

## 4. Escopo funcional

### 4.1 Núcleo da primeira versão (MVP)

O MVP deve priorizar os seguintes recursos:

1. Cadastro e autenticação de usuários.
2. Cadastro de empresa e perfil inicial do proprietário.
3. Associação de usuários a uma empresa e controle de permissões.
4. Dashboard com indicadores calculados a partir de dados reais.
5. Cadastro de clientes.
6. Cadastro de fornecedores.
7. Cadastro de produtos e categorias.
8. Controle de estoque com histórico de movimentações.
9. Registro de vendas simples, com itens, quantidades, descontos e forma de pagamento.
10. Controle financeiro básico: contas a pagar, contas a receber e movimentações financeiras.
11. Relatórios básicos e exportação CSV segura, quando aplicável.
12. Configurações da empresa, preferências regionais e usuários.
13. Estrutura inicial de planos e assinaturas da plataforma, sem simular cobrança automática não implementada.

A ordem final de execução deve ser definida depois do diagnóstico do repositório e da verificação das funcionalidades que já existem.

### 4.2 Funcionalidades que podem ser aproveitadas da base herdada

Avaliar e reutilizar, quando tecnicamente apropriado:

- autenticação por sessão;
- cadastro de empresa e usuários;
- isolamento multiempresa;
- validação compartilhada;
- produtos, categorias e fornecedores;
- movimentações de estoque;
- vendas e itens de venda;
- caixa e movimentações financeiras;
- clientes;
- dashboard e relatórios;
- auditoria e histórico de operações;
- testes de integração com PostgreSQL;
- documentação e migrations versionadas;
- filas e abstração de provedores de integração, se houver necessidade real.

A reutilização depende da inspeção do código real, não apenas do documento de referência.

### 4.3 Recursos específicos de pet shop

Não devem ser obrigatórios no núcleo genérico:

- cadastro de pets;
- vínculo entre tutor e animal;
- agenda de banho, tosa ou outros serviços para pets;
- templates e lembretes específicos de pet shop;
- planos ou assinaturas oferecidos pelo pet shop aos seus próprios clientes.

Esses recursos podem ser removidos da navegação principal, isolados como módulo opcional ou mantidos fora do escopo inicial. Antes de remover código, avaliar dependências, testes e migrações. Não apagar automaticamente funcionalidades que podem ser reutilizadas.

### 4.4 Recursos de segmentos futuros

Projetar extensibilidade, mas não implementar sem necessidade validada:

- ordens de serviço e agenda para prestadores de serviços;
- compras e recebimento de mercadorias;
- preços diferenciados e vendas por atacado;
- gestão de entregas;
- logística com motoristas, frota, rotas e comprovantes;
- serviços recorrentes;
- integração com WhatsApp;
- integrações fiscais ou contábeis.

---

## 5. Regras essenciais de negócio

### Produtos e estoque

- SKU e código de barras, quando preenchidos, devem ter regras de unicidade por empresa.
- Categoria e fornecedor associados ao produto devem pertencer à mesma empresa.
- Quantidades devem usar precisão decimal apropriada.
- Toda entrada, saída, ajuste, devolução ou correção deve gerar histórico auditável.
- Evitar editar ou apagar movimentações históricas; preferir movimentos compensatórios autorizados.
- Bloquear estoque negativo por padrão, salvo decisão explícita e documentada.
- O saldo e a disponibilidade são calculados/validados no servidor.
- Prever alertas de estoque mínimo, sem criar alertas fictícios.

### Vendas

- Preços, descontos permitidos, subtotais e totais devem ser validados e recalculados no servidor.
- Registrar snapshots de nome, SKU, quantidade e preço dos itens para preservar o histórico da venda.
- A venda e as movimentações de estoque/financeiras relacionadas devem ser consistentes e transacionais.
- Prevenir duplicidade em operações sujeitas a repetição de requisições.
- Cancelamentos devem ser auditáveis, com motivo, autor e data quando aplicável.
- Definir explicitamente como devoluções, cancelamentos e reembolsos afetam estoque e financeiro.

### Financeiro

- Usar tipo decimal para dinheiro no banco; não usar ponto flutuante binário como fonte de verdade.
- Separar contas a pagar, contas a receber, lançamentos e saldo de caixa.
- Definir claramente a diferença entre fluxo de caixa previsto, realizado e saldo disponível.
- Não considerar automaticamente uma venda como dinheiro recebido sem registrar sua forma e situação de pagamento.
- Toda correção de lançamento deve deixar histórico.
- Relatórios financeiros devem ser calculados no servidor ou em consultas autorizadas e consistentes.
- Definir fuso horário e períodos de relatórios sem ambiguidades.

### Clientes e fornecedores

- Todos os registros pertencem à empresa.
- Normalizar os dados adequadamente sem eliminar informações necessárias.
- Evitar duplicidade de forma cuidadosa, sem bloquear indevidamente homônimos ou contatos compartilhados por famílias.
- Preservar referências históricas ao inativar registros.
- Coletar apenas dados necessários e aplicar controles compatíveis com a LGPD.

### Dashboard e relatórios

- Exibir valores reais derivados do banco.
- Quando ainda não houver dados, exibir estado vazio, zero ou “sem dados suficientes”, conforme o significado do indicador.
- Não apresentar dados de demonstração como se fossem reais.
- Aplicar filtros de empresa e autorização no servidor.
- Proteger exportações contra injeção de fórmulas em CSV.
- Definir e testar paginação, filtros, intervalos de datas e limites de exportação.

---

## 6. Assinaturas e planos da Akylla

A plataforma deverá futuramente oferecer planos de assinatura às empresas clientes.

### Separação obrigatória

- **Billing da Akylla:** quanto a empresa cliente paga à plataforma pelo uso do SaaS.
- **Financeiro da empresa cliente:** vendas, despesas, recebimentos, pagamentos e caixa da própria empresa.
- **Assinaturas de negócio da empresa cliente:** recurso opcional futuro para negócios que vendem planos ou serviços recorrentes aos próprios clientes.

Essas operações devem ter modelos e permissões distintos.

### Implementação gradual

1. Definir catálogo de planos e recursos.
2. Definir limites de usuários, registros e módulos.
3. Implementar verificação de acesso a recursos no backend.
4. Implementar estados de assinatura e períodos de vigência.
5. Integrar um provedor de pagamento somente depois de avaliar custos, requisitos legais, webhooks, idempotência e ambiente de testes.
6. Não declarar que existe cobrança recorrente automática enquanto ela não estiver integrada e testada.
7. Não confiar em uma tela que esconde funcionalidades como único mecanismo de aplicação dos limites do plano.

O plano gratuito e os limites exatos ainda são decisões de produto; não os inventar no código sem aprovação do proprietário.

---

## 7. Interface e experiência do usuário

- Idioma padrão: português brasileiro.
- Moeda: BRL (R$).
- Datas visíveis: `DD/MM/AAAA`.
- Interface responsiva para desktop, tablet e celular.
- Design profissional e consistente, com identidade visual da Akylla.
- Menu de navegação simples, agrupado por áreas: Visão geral, Cadastros, Operação, Financeiro, Relatórios e Configurações.
- Mostrar apenas módulos habilitados e acessíveis para a empresa.
- Criar estados de carregamento, vazio, sucesso e erro.
- Mensagens de erro devem ser compreensíveis e não expor dados internos.
- Não criar botões decorativos sem funcionalidade.
- Não preencher o dashboard com números inventados.
- Preservar acessibilidade básica, navegação por teclado e rótulos de formulário.

---

## 8. Arquitetura e custos

O repositório de referência descreve Next.js, NestJS, TypeScript, PostgreSQL, Prisma, Zod, testes de integração e worker. Primeiro, confirmar quais tecnologias estão realmente presentes no projeto.

Não migrar de stack por preferência pessoal do agente. Avaliar a arquitetura existente em função de:

- custo mensal de desenvolvimento e hospedagem;
- simplicidade de implantação e manutenção;
- segurança multiempresa;
- capacidade de testar regras de negócio;
- facilidade de backup e recuperação;
- possibilidade de crescimento;
- dependência de serviços pagos;
- capacidade do proprietário de manter o projeto.

O orçamento inicial é limitado. Priorizar ferramentas gratuitas ou de baixo custo durante desenvolvimento e validação. Não adicionar Redis, serviços de fila, provedores pagos ou infraestrutura extra sem necessidade demonstrada.

A escolha de infraestrutura para produção deve ser documentada com custos estimados e limitações. Não usar ambiente local como se fosse produção e não armazenar dados reais de clientes em ambientes de teste sem proteção apropriada.

---

## 9. Segurança, privacidade e operação

Antes de disponibilizar comercialmente, planejar e validar:

- armazenamento seguro de senhas e sessões;
- limitação de tentativas de login e proteção contra abuso;
- verificação de origem/CORS/CSRF conforme a arquitetura;
- proteção de segredos e variáveis de ambiente;
- autorização server-side para cada recurso;
- RLS, se houver acesso direto ao PostgreSQL/Supabase pelo cliente;
- isolamento entre empresas;
- validação de entradas e tratamento consistente de erros;
- logs sem senhas, tokens ou dados pessoais desnecessários;
- backups automatizados e teste real de restauração;
- monitoramento e alertas de falhas;
- política de retenção e exclusão de dados;
- termos, política de privacidade e processos de atendimento compatíveis com a LGPD;
- plano para incidentes e recuperação;
- ambientes separados de desenvolvimento, teste e produção.

A documentação técnica e os testes não substituem uma revisão de segurança antes do lançamento.

---

## 10. Plano de adaptação por etapas

O agente deve confirmar ou ajustar as etapas após o diagnóstico inicial. Não presumir que uma etapa esteja concluída apenas porque consta na documentação anterior.

### Etapa 0 — Diagnóstico e plano

- Inspecionar o repositório real.
- Identificar o que funciona e o que não foi validado.
- Mapear dependências da base herdada e módulos específicos do segmento.
- Listar migrações necessárias e riscos.
- Apresentar o plano antes de realizar mudanças amplas.

**Critério de saída:** diagnóstico documentado e plano aprovado pelo proprietário.

### Etapa 1 — Identidade e estrutura do produto

- Renomear elementos visíveis do produto para Akylla Gestão.
- Atualizar textos, títulos, documentação e navegação.
- Remover referências visuais exclusivas de pet shop da área comum.
- Preservar componentes internos reutilizáveis e a pasta legada protegida.
- Não renomear tudo de uma vez se isso quebrar imports, pacotes ou migrações.

**Critério de saída:** aplicação identificada como Akylla Gestão sem regressões.

### Etapa 2 — Núcleo multiempresa

- Validar cadastro, login, logout, sessão e associação à empresa.
- Validar papéis e permissões.
- Auditar consultas e mutações por tenant.
- Testar acesso cruzado entre duas empresas.
- Confirmar políticas RLS quando aplicáveis.

**Critério de saída:** testes de isolamento e autorização aprovados, com evidências.

### Etapa 3 — MVP operacional

- Clientes.
- Fornecedores.
- Produtos e categorias.
- Estoque e histórico de movimentos.
- Vendas.
- Financeiro básico.
- Dashboard e relatórios essenciais.

Reutilizar módulos existentes quando adequados; não duplicá-los.

**Critério de saída:** fluxos completos testados de ponta a ponta, incluindo concorrência e erros esperados.

### Etapa 4 — Experiência, configurações e qualidade

- Melhorar responsividade e navegação.
- Garantir estados vazios e mensagens claras.
- Validar formatos brasileiros.
- Executar lint, typecheck, testes, build e validação de banco.
- Revisar acessibilidade e desempenho básico.

**Critério de saída:** todas as verificações executadas e resultados registrados.

### Etapa 5 — Planos comerciais e preparação para produção

- Definir planos e limites com aprovação do proprietário.
- Aplicar limites no backend.
- Avaliar gateway de pagamento e webhooks.
- Planejar implantação, domínio, backups, monitoramento e recuperação.
- Revisar segurança, privacidade e documentação comercial.

**Critério de saída:** checklist de lançamento concluído e pendências conhecidas explicitadas.

---

## 11. Estratégia de testes obrigatória

Criar ou manter testes para:

1. Cadastro, login, logout e expiração de sessão.
2. Empresa A não consegue acessar registros da Empresa B.
3. Usuário sem permissão não executa operações administrativas.
4. Produto, categoria, fornecedor e cliente de outra empresa não podem ser associados.
5. Venda recalcula preços e totais no servidor.
6. Vendas simultâneas não causam estoque inconsistente.
7. Repetição da mesma requisição não duplica efeitos financeiros ou de estoque.
8. Cancelamentos e estornos deixam histórico consistente.
9. Relatórios respeitam a empresa e o intervalo de datas.
10. CSV não permite injeção de fórmulas.
11. Limites de plano, quando implementados, são aplicados no backend.
12. Erros não vazam segredos nem dados de outras empresas.

Executar os comandos disponíveis no repositório para lint, typecheck, testes, build e validação do banco. Informar exatamente o que foi executado e o resultado de cada comando. Não declarar sucesso quando um teste não foi executado.

---

## 12. Decisões que exigem aprovação do proprietário

Não inventar decisões comerciais definitivas. Apresentar opções e aguardar aprovação para:

- preços e nomes dos planos;
- limites de usuários e registros;
- módulos pagos e gratuitos;
- cobrança recorrente e provedor de pagamento;
- política de teste grátis;
- nichos e funcionalidades prioritários após o MVP;
- exclusão definitiva de módulos específicos da base original;
- deploy, domínio, custos e serviços pagos;
- importação ou exclusão de dados existentes.

---

## 13. Entrega exigida ao final de cada etapa

Apresentar um resumo objetivo contendo:

- o que foi alterado;
- arquivos e módulos afetados;
- migrations criadas ou modificadas;
- funcionalidades implementadas;
- testes realmente executados e resultados;
- riscos e limitações conhecidos;
- tarefas pendentes;
- custos ou serviços externos necessários;
- próximos passos sugeridos.

Atualizar os documentos de status, changelog e checklist. Não fazer commit sem autorização explícita.

---

## 14. Primeira tarefa do OpenCode

**Não comece implementando todas as mudanças.**

Comece pela **Etapa 0 — Diagnóstico e plano**. Exame da base existente e produção de um relatório de adaptação para o Akylla Gestão. Diferencie claramente:

- o que o código confirma;
- o que a documentação afirma;
- o que ainda precisa ser testado;
- o que deve ser reaproveitado;
- o que deve ser adaptado;
- o que pode ficar fora do MVP.

Ao final, apresente o plano por etapas e aguarde aprovação antes de executar alterações amplas.
