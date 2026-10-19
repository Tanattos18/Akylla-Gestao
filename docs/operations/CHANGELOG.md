# Changelog — Akylla Gestão

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

> **Escopo:** este changelog cobre a era do **Akylla Gestão** (adaptação e
> roteiro das Etapas 0–12, a partir de 2026-10-12). O histórico anterior à
> adaptação não é mantido aqui — está preservado no histórico do Git.

## [Akylla Gestão] - 2026-10-19 - WhatsApp, modelos prontos, nova tela inicial e modo escuro

### Adicionado

- **Visualização clara/noturna:** botão sol/lua no topo, como no site. A
  escolha fica salva no navegador; sem escolha, segue o tema do sistema.
  Implementado remapeando os tokens de cor em `globals.css`, então vale
  para todas as telas, sem flash ao carregar.
- **Modelos prontos de WhatsApp:** 10 textos no padrão da Meta (lembrete de
  agendamento, pedido, OS pronta, orçamento, parcelas, assinatura,
  pós-venda, aniversário e promoção). Opções "Usar e editar" e "Adicionar
  todos".
- **Edição de templates:** botão "Editar". Mudar o texto de um template
  aprovado volta ele para "aguardando aprovação", como a Meta exige.
- `docs/akylla/WHATSAPP.md`: passo a passo para ligar a API oficial da Meta
  na VPS e solução de problemas. `install.sh` passa a gravar
  `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET` e `WHATSAPP_VERIFY_TOKEN`.

### Alterado

- **Nova tela Início:**
  - saudação com data;
  - atalhos rápidos;
  - módulos agrupados por objetivo (Vender e controlar, Atender e
    fidelizar, Prestar serviços, Acompanhar resultados), com ícones;
  - módulos fora do plano aparecem com cadeado e levam para contratar.
- **WhatsApp:** aviso claro de **modo simulação**. Antes a tela mostrava
  "Ativo" sem enviar nada de verdade.
  - O campo "Phone Number ID" explica que é o ID da Meta, não o telefone,
    e alerta se for digitado um telefone.
  - O provedor simulado deixou de se chamar "PetFlow Mock".

## [Akylla Gestão] - 2026-10-19 - Módulo Pets retirado (gestão empresarial genérica)

### Removido

- **Pets** (pedido do proprietário: o produto é só gestão empresarial):
  - tela `/pets`, item do menu, ficha de pets na tela do cliente, coluna
    "Pets" na lista de clientes, campo "Pet" na agenda/agendamento, pets
    na busca global e no painel;
  - rotas `/api/pets*` e `GET /api/clients/:id/pets`; `petId` sai do
    agendamento (o lembrete de WhatsApp usa o nome do cliente);
  - módulo `PETS` dos kits, dos preços avulsos e do enum `BusinessModule`
    (migration `20261019180000_remove_pets_module`); o kit Avançado passa
    a ter 8 módulos;
  - preset de demonstração "Mundo Pet" (`seed-demo`, `create-demo.sh`);
  - textos de pet shop (perfil Comércio e serviços, modelo de importação
    de serviços, PRD, README) e dados de teste com vocabulário de pet shop.
- Arquivos retirados foram para `Arquivos Sem USO/modulo-pets-removido-2026-10-19/`
  (fora do Git), sem apagar nada.

### Preservado

- Tabela `Pet` e `Appointment.petId` no banco, como **legado** (dados
  antigos não são apagados; entram na exportação e na anonimização LGPD).

## [Akylla Gestão] - 2026-10-19 - Pagamento por Pix no Faturamento

### Adicionado

- **Faturamento › Pagar com Pix:** chave Pix de recebimento da Akylla
  (Mercado Pago), favorecido, "Copiar chave Pix" e "Enviar comprovante"
  pelo WhatsApp; atalho "Pagar com Pix" no aviso de vencido/somente leitura.
  Configurável por `NEXT_PUBLIC_PIX_KEY` / `NEXT_PUBLIC_PIX_RECEIVER`.

## [Akylla Gestão] - 2026-10-18 - Fase 8b: kits de acesso e módulos avulsos

### Adicionado

- **Kits:** Básico (WhatsApp + Crediário), Intermediário (+ Serviços,
  Agendamentos, Comissões) e Avançado (todos os módulos). Mesmos ids e
  preços dos antigos Essencial/Profissional/Completo.
- **Preço por módulo avulso** (`ModuleOffer`) para combos personalizados:
  mensal = kit + avulsos; anual = kit anual + 10× cada avulso
  (`computeComboPrice` no pacote compartilhado).
- **Faturamento:** kits com os módulos incluídos e limites, "Módulos
  contratados" e a calculadora **Monte seu plano**, que envia o resumo
  pelo WhatsApp.
- **Plataforma (dono):**
  - aba **Kits e módulos** para editar preços, módulos de cada kit e
    limites, e o preço/"à venda" de cada módulo;
  - botão **Módulos** por empresa (troca kit/avulsos na hora, sem
    pagamento);
  - **Registrar pagamento** com avulsos e valor sugerido do combo;
  - a lista mostra o kit + avulsos de cada empresa.
- Rotas novas documentadas em `API.md`; `tests/integration/kits.test.ts`.

### Alterado

- O acesso aos módulos passa a seguir o contratado: com assinatura, só o
  kit + avulsos; teste grátis e isentas continuam com tudo. Módulo não
  contratado some do menu e a API responde 403 `MODULE_NOT_CONTRACTED`
  (dados preservados).
- `GET /api/company-modules` traz `entitled`; `GET /api/billing/access`
  traz `modules` (`null` = todos).

## [Akylla Gestão] - 2026-10-18 - Auditoria completa (site + app)

Auditoria em produção (de fora) e local, varrendo 41 telas em desktop e
celular, como admin, membro e visitante; revisão de código da cobrança;
re-auditoria do site de divulgação.

### Corrigido

- **Recuperação de senha quebrada em produção:**
  - a tela usava uma rota de desenvolvimento (desligada em produção), e o
    link enviado por e-mail (`/redefinir-senha?token=`) ignorava o token;
  - agora há uma tela com três caminhos: com token define a nova senha;
    com SMTP pede o link; sem e-mail orienta falar com o suporte.
- **Senha provisória sem depender de e-mail:**
  - o admin gera para alguém da equipe (`POST /api/users/:id/reset-password`,
    botão "Nova senha" em Usuários);
  - o dono gera para o admin do cliente (`POST /api/platform/companies/:id/reset-password`).
- **Login e cadastro com links quebrados:**
  - o login mostrava "Cadastre-se" mesmo com o cadastro desligado;
  - agora `GET /api/auth/options` informa o que está disponível;
  - sem cadastro aberto, o login mostra "Fale com a gente" e a tela de
    cadastro orienta pelo WhatsApp.
  - O texto do login dizia "usuário administrador", mas a equipe também
    entra por ele.
- **Cobrança (bug latente para quando o Mercado Pago entrar):**
  - um checkout aberto e não pago (`EXPIRED` com data futura) contava
    como período pago;
  - renovar uma assinatura cancelada ainda vigente perdia os dias
    restantes.
  - A isenção ficou explícita (`billingExempt`) para empresas criadas pela
    CLI e para as demonstrações (migration
    `20261019130000_billing_exempt_backfill`).
- **Membro (não admin) abria Configurações e Faturamento** pela URL;
  agora vê "acesso restrito" (o servidor já bloqueava salvar).
- **Faturamento:** fazia uma chamada que respondia 404 (erro no console)
  quando a empresa não tem plano.
- **Dashboard no celular:** cartões vazavam 4 px da tela (`min-w-0` no
  `Card`).

### Segurança

- **Cabeçalhos nas páginas do app** (antes só a API tinha):
  - `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` e
    `Permissions-Policy`;
  - **CSP** em produção (só o próprio site, Sentry e Turnstile;
    `frame-ancestors 'none'`).
  - Verificado: 0 violações em todas as telas.
- **Sem `X-Powered-By`** (Next e Express).
- **`robots.txt`** do app: só as páginas públicas podem ser indexadas.
  Também entrou o `favicon.ico`.

### Verificação

- 733 testes; 7 fluxos E2E; 0 violações de acessibilidade.
- Varredura de 41 telas sem erro de console nem vazamento no celular.

## [Akylla Gestão] - 2026-10-18 - Liberação de clientes sem terminal

- **Plataforma › + Nova empresa** (`POST /api/platform/companies`):
  - cadastra a empresa cliente e o responsável (e-mail já verificado, sem
    depender de SMTP), com teste de N dias;
  - gera uma senha provisória mostrada uma vez, com mensagem pronta para
    o WhatsApp e atalho para registrar o pagamento.
- **Minha conta** (`/conta`, no menu do usuário): troca da própria senha
  (`POST /api/auth/change-password`). Encerra as outras sessões e tem
  limite de tentativas.
- **Testes:** +2 em `platform-billing.test.ts`; 729 no total.
- **Passo a passo** de liberação de clientes em `docs/akylla/COBRANCA.md`.

## [Akylla Gestão] - 2026-10-18 - Demonstração e correção do backup na VPS

- **`scripts/deploy/vps/create-demo.sh`:** cria uma empresa de
  demonstração isenta, já populada com dados fictícios por segmento.
- **`docs/demo/`:** planilhas CSV fictícias (categorias, fornecedores, 25
  produtos, 30 clientes, serviços), validadas na simulação de importação,
  para demonstrar a importação ao vivo.
- **Seed:** a empresa de demonstração fica isenta de cobrança (nunca vence).
- **Seed em produção:** o membro de equipe da demonstração recebe senha
  aleatória (antes era sempre a mesma senha pública).
- **Corrigido:** o role `akylla_app` não tinha `CREATEDB`, e o backup
  diário (que testa o restore num banco temporário) e o `update.sh`
  falhariam. O `install.sh` e o `update.sh` agora garantem a permissão.
  `CREATEDB` não dá superusuário nem ignora a RLS.

## [Akylla Gestão] - 2026-10-18 - Sistema no ar

- **Endereço:** `https://app.akyllagestao.com.br`, na VPS Hostinger KVM 1
  com Ubuntu 26.04 LTS, instalada pelo `install.sh` em cerca de 15
  minutos.
- **Verificado de fora:**
  - HTTPS válido (Let's Encrypt via Caddy) e HTTP → HTTPS (308);
  - HSTS ativo;
  - `/health/ready` com `database: ok`;
  - `/api/docs` desligado em produção (404).
- **Banco:** role `akylla_app` com `superuser=false` e `bypassrls=false`
  (RLS efetiva).
- **Conta do dono:** criada pelo `create-admin.sh`, que preencheu
  `PLATFORM_ADMIN_EMAILS`.
- **Compatibilidade:** o `install.sh` funciona no Ubuntu 26.04
  (`resolute-pgdg`).

## [Akylla Gestão] - 2026-10-18 - Fase 8: Cobrança do SaaS e painel do dono

Decisões do proprietário:
- preços aprovados: R$ 79,90 / 149,90 / 249,90 por mês, e o anual com 2
  meses grátis;
- teste de 14 dias;
- inadimplente fica em somente leitura;
- Mercado Pago em produção fica para quando a conta com CNPJ estiver
  pronta.

Regras em `docs/akylla/COBRANCA.md`.

### Adicionado

- **Situação de acesso** por empresa:
  - os estados são isenta, teste, ativa, tolerância (5 dias), somente
    leitura e suspensa (`billing/access.ts`, regra pura e testada);
  - `GET /api/billing/access` informa a situação;
  - `AccessGuard` global: em somente leitura, alterações respondem **402**
    `SUBSCRIPTION_READ_ONLY`; consulta, exportação, faturamento e saída
    continuam liberados.
- **Teste grátis no cadastro:** `TRIAL_DAYS`, padrão 14.
- **Painel do dono** (`/plataforma`, `/api/platform/*`), protegido por
  `PLATFORM_ADMIN_EMAILS`, papel ADMIN e 2FA obrigatório em produção:
  - lista todas as empresas, com situação, uso e último acesso;
  - registra pagamentos (Pix, boleto, cartão, Mercado Pago, outro), que
    ativam ou renovam o plano;
  - estende o teste, isenta, suspende (derruba as sessões) e reativa;
  - mostra o histórico de pagamentos (`PlatformPayment`, com RLS).
- **Faturamento:** situação de acesso, preço anual, botões "Contratar
  mensal/anual" pelo WhatsApp de vendas (`NEXT_PUBLIC_SALES_WHATSAPP`) e
  aviso no topo do sistema (fim do teste, vencida, somente leitura).
- **Configurações › Segurança:** ativar e desativar a verificação em duas
  etapas, com QR code (`qrcode-generator`, MIT, sem dependências).
- **Migration** `20261019110000_platform_billing`, que inclui:
  - os campos `Company.trialEndsAt`, `billingExempt`, `suspendedAt` e
    `suspendedReason`;
  - `TenantPlan.priceYearly` e `TenantSubscription.billingCycle`;
  - `PlatformPayment`, com RLS;
  - os preços e as descrições dos planos alinhados ao site.
- **VPS:** o `create-admin.sh` torna a primeira conta dona da plataforma
  (empresa isenta) e o `install.sh` grava as variáveis novas.
- **Testes:** `platform-billing.test.ts` (12).

### Corrigido (segurança)

- **A empresa conseguia ativar e renovar o próprio plano sem pagar**
  (`PUT /api/billing/subscription` e `POST /api/billing/subscription/renew`).
  As rotas foram removidas: a assinatura agora só nasce pelo dono da
  plataforma ou pelo gateway.

## [Akylla Gestão] - 2026-10-18 - Infraestrutura de produção contratada

- **VPS Hostinger KVM 1, com Ubuntu 24.04 LTS puro** (sem painel, sem
  Docker), contratada pelo proprietário.
- **DNS:** o domínio usa os nameservers da Hostinger. O sistema vai para
  `app.akyllagestao.com.br` e o site de divulgação continua no plano
  Premium.
- **Situação e próximos passos** em `docs/operations/DEPLOY_VPS.md` §0.
  O IP da VPS **não** é versionado, porque o repositório é público.

## [Akylla Gestão] - 2026-10-18 - Aplicativo instalável (PWA) e deploy em VPS

### Adicionado

- **PWA:** no Windows, o Edge ou o Chrome oferecem "Instalar Akylla
  Gestão", que cria o ícone no menu Iniciar e na área de trabalho e abre o
  sistema em janela própria. A peça inclui:
  - `app/manifest.ts`, com atalhos para PDV, Vendas, Caixa e Agenda;
  - ícones em `public/icons`;
  - `public/sw.js`, que **não guarda dados**: só mostra
    `public/offline.html` quando a internet cai.
  O app é registrado só em produção e o Chromium o confirmou como
  instalável. Os dados continuam no servidor.
- **Deploy em VPS** (`scripts/deploy/vps/`, `docs/operations/DEPLOY_VPS.md`):
  - instalação com Node 22, PostgreSQL 17, Caddy (HTTPS), systemd,
    firewall e backup diário;
  - segredos gerados no próprio servidor;
  - role `akylla_app` sem SUPERUSER/BYPASSRLS;
  - `update.sh` com backup antes de atualizar e `create-admin.sh`, que
    pede a senha sem gravá-la.

## [Akylla Gestão] - 2026-10-18 - Fase 7: Produto

Última fase do roteiro do Prompt Mestre.

### Adicionado

- **Dados da empresa (7.1):**
  - `GET/PATCH /api/company` (nome, CNPJ/CPF, telefone, endereço) e
    `PATCH /api/company/slug` (único entre empresas → 409);
  - aba "Empresa" em `/configuracoes`;
  - o comprovante mostra CNPJ/CPF, endereço e telefone e passa a dizer
    "sem valor fiscal";
  - migration `20261019090000_company_profile`.
- **Uso do plano (7.2):** as barras e o alerta de 80% já existiam em
  `/faturamento`; entrou o link "Ver planos maiores".
- **Busca global (7.3):**
  - `GET /api/search?q=` devolve até 5 resultados por tipo: clientes
    (nome, e-mail, telefone, CPF), produtos (nome, SKU, código de
    barras), vendas (código), OS (número ou título), serviços e pets;
  - só traz dados da empresa e respeita os módulos desligados;
  - na barra do topo vira um combobox WAI-ARIA, com ↑ ↓ Enter Esc e
    debounce de 300 ms. Uma chamada substitui as 5 de antes.
- **Agenda (7.4):** abas Dia, Semana e Mês. A semana mostra colunas de
  segunda a domingo; o mês, um calendário com pontos por situação. Clicar
  no dia abre a visão Dia. Não houve mudança no backend.
- **Seeds por segmento (7.5):** `--preset=comercio|servicos|alimentacao|pet`,
  com as marcas Empório Central, Studio Beleza, Padaria Pão Quente e
  Mundo Pet (`apps/api/src/cli/seed-datasets.ts`). O seed também marca o
  perfil da empresa.
- **Impressão de relatórios (7.6):** botão "Imprimir"; o filtro some e
  entra um cabeçalho com período, aba e data.
- **Testes:**
  - `tests/integration/company-profile-search.test.ts` (8);
  - E2E 6 (CNPJ no comprovante e busca pelo teclado) e 7 (agenda semana e
    mês).

### Corrigido

- `useToast`/`useDialog` passaram a devolver objetos estáveis. Antes, uma
  tela que usasse `toast` como dependência de efeito podia entrar em
  repetição.

## [Akylla Gestão] - 2026-10-18 - Fase 6: Testes e qualidade

### Adicionado

- **Cobertura na CI** (`npm run test:coverage`, `@vitest/coverage-v8`):
  - 93,7% das linhas dos services e controllers da API (meta do roteiro:
    70%);
  - mínimos em `config/vitest.config.ts` logo abaixo do medido, que
    travam regressão no lugar do diff-cover;
  - relatório publicado como artefato da CI.
- **E2E com Playwright** (`npm run test:e2e`, `config/playwright.config.ts`,
  `tests/e2e/`). Cada execução cria uma empresa própria. São 5 fluxos:
  - login → painel;
  - criar cliente → aparece na lista;
  - abrir caixa → vender no PDV → emitir NFC-e (simulada) → fechar caixa
    sem diferença;
  - importar CSV: simular → importar → produto na lista;
  - rota protegida sem sessão → login.
- **OpenAPI em `/api/docs`** (`@nestjs/swagger` + `zod-to-json-schema`):
  - rotas descobertas pelo Nest;
  - corpos e filtros gerados dos schemas Zod das próprias rotas;
  - sessão, ADMIN e módulo vindos dos decorators;
  - em produção, só com `API_DOCS_ENABLED=true`.
- **Teste de contrato** (`tests/integration/contract.test.ts`): o código e
  a tabela de rotas do `API.md` precisam bater nos dois sentidos.
- **CI:** o job "Navegador" sobe API e web e roda a auditoria de
  acessibilidade e o E2E.

### Corrigido

- `API.md` não documentava 12 rotas que existiam: 2FA (4), pedido e
  confirmação de redefinição de senha, uso do plano, LGPD (4) e
  exportação da empresa. O teste de contrato achou todas.

### Dependências

- **Novas:**
  - `@nestjs/swagger` 11.4.7 (MIT);
  - `zod-to-json-schema` 3.25.2 (ISC);
  - `@playwright/test` 1.64.1 (Apache-2.0, dev);
  - `@vitest/coverage-v8` 4.1.11 (MIT, dev).
- **`overrides`:** `js-yaml` 5.4.1 dentro do `@nestjs/swagger`. A versão
  fixada por ele (5.3.0) tem um alerta moderado (GHSA-r3ph-w7gj-g6xm), e
  o swagger 12, que corrige, exige Nest 12.

## [Akylla Gestão] - 2026-10-18 - Fase 5: Design, UX e acessibilidade

Padroniza tabelas, diálogos, avisos e abas, e leva o painel a **0
violações** de acessibilidade (axe-core, WCAG 2.1 AA) em 36 telas. Regras
em `docs/akylla/DESIGN_SYSTEM.md`.

### Adicionado

- **Componentes** (estilo shadcn/ui, sem Radix):
  - `DataTable`: colunas tipadas, moeda à direita, cartões no celular,
    totais, linha expansível, linha clicável por teclado;
  - `Dialog`/`useDialog`: confirmação e motivo, sobre o `<dialog>` nativo;
  - `Toast`/`useToast`: lê os `issues[]` da API;
  - `Tabs`: padrão WAI-ARIA.
- **Tokens** semânticos de cor, foco visível único, link "Pular para o
  conteúdo" e CSS de impressão.
- **`npm run test:a11y`** (`scripts/a11y.mjs`) e o job "Acessibilidade"
  na CI. Dependência nova: `@axe-core/playwright` (MPL-2.0, dev), prevista
  no roteiro.

### Alterado

- **Tabelas (débitos D-4 e D-6):** 31 tabelas passaram para o
  `DataTable`; o carrinho do PDV virou lista.
- **Diálogos:** os 33 `window.confirm`/`window.prompt` viraram diálogos
  acessíveis. O motivo é validado antes de enviar; a justificativa da
  nota fiscal, por exemplo, exige de 15 a 255 caracteres.
- **Avisos:** toasts em criar ou atualizar cliente, liquidar, cancelar ou
  estornar título, enfileirar WhatsApp, emitir nota e ligar ou desligar
  módulo.
- **Abas** em `/relatorios` e `/configuracoes`.
- **Contraste:**
  - botões principais em `primary-700`;
  - texto colorido nos tons 700;
  - texto cinza no mínimo `slate-500`;
  - links dentro de texto sublinhados.

### Corrigido

- **Barra do topo:** era mais larga que a tela em 1280 px (rolagem
  horizontal e nome do usuário fora da tela).
- **Botão do menu do usuário:** o nome acessível não continha o texto
  visível.
- **Arquivo de importação:** o campo estava sem rótulo.
- **Tela Financeiro:** os acentos estavam quebrados (codificação).
- **Listas de botões:** agora quebram linha no celular.
- **Vendas:** o total usa o formato de moeda e fica alinhado à direita.

## [Akylla Gestão] - 2026-10-18 - Fase 4: Perfis no cadastro (onboarding)

Depois de criar a conta, o cliente escolhe **Comércio**, **Serviços**,
**Comércio e serviços** ou **Personalizado**, e o sistema liga os módulos
certos. Regras em `docs/akylla/ONBOARDING.md`.

### Adicionado

- **Modelo** `OnboardingPreset` (catálogo global) e os campos
  `Company.segment` e `Company.onboardingCompletedAt`. A migration
  `20261018230000_onboarding_presets` é aditiva, cadastra os 4 perfis e
  marca as empresas existentes como já configuradas.
- **API:** `GET /api/onboarding/presets`, `GET /api/onboarding/status` e
  `POST /api/onboarding/apply` (ADMIN, idempotente). Comércio também
  prepara a configuração fiscal com a emissora simulada, inativa.
- **Web:**
  - `/onboarding`, a escolha do perfil; a confirmação de e-mail leva
    direto para cá;
  - aviso na tela inicial enquanto o perfil não for escolhido;
  - `/configuracoes` (ADMIN), com o perfil atual e chaves liga/desliga
    por módulo;
  - páginas públicas `/para/comercio`, `/para/servicos` e
    `/para/hibrido`.
- `tests/integration/onboarding.test.ts` (8 testes).

### Corrigido

- `/termos` e `/privacidade` exigiam login, o que impedia ler os termos
  durante o cadastro. Agora são públicas.

## [Akylla Gestão] - 2026-10-18 - Fase 3: Fiscal por integração (NFC-e / NF-e / NFS-e)

Último item "em breve" do site. A emissão é feita por **integradora
autorizada**, sem emissor próprio, como manda o roteiro. O módulo está
pronto e funciona com a **emissora simulada**. A emissão real depende de
contratar a integradora e de fazer o cadastro fiscal dos produtos (ver
`docs/akylla/FISCAL.md`).

### Referência avaliada

- **FinOpenPOS** (MIT) é um emissor próprio, então **não foi integrado**.
  A extração de certificado de lá **não foi reaproveitada**: ela chama
  `openssl` com a senha do PFX na linha de comando (risco de injeção de
  comando e senha exposta) e usa um caminho fixo em `/tmp`. Aqui o PFX é
  validado com `tls.createSecureContext` do Node, sem processo externo.

### Adicionado

- **Modelos:** `FiscalConfig` e `FiscalDocument`, mais os enums de
  ambiente, tipo e situação. `BusinessModule` ganhou `FISCAL`. Migration
  aditiva `20261018210000_fiscal`, com RLS.
- **`FiscalProvider`:** emissora simulada em três modos (autoriza,
  assíncrona via webhook, rejeita). Gera chave de 44 dígitos no layout
  oficial com **DV módulo 11** e XML "SEM VALOR FISCAL". Integradora não
  implementada → erro explícito.
- **Segredos AES-256-GCM** (`fiscal-crypto.ts`):
  - token da API, certificado A1 e senha ficam cifrados e nunca são
    devolvidos;
  - sem `FISCAL_ENCRYPTION_KEY` → 503, nunca grava em claro;
  - o certificado é validado pelo Node (senha, formato, validade) e a tela
    mostra titular e validade.
- **Emissão:**
  - NFC-e e NF-e a partir da venda concluída (NF-e exige cliente com CPF);
    NFS-e a partir da OS concluída;
  - numeração sequencial por série, com `FOR UPDATE` na configuração;
  - chamada à emissora fora da transação; falha → REJECTED com o motivo;
  - duplicada ativa → 409; sem configuração ativa → 400 explícito.
- **Cancelamento:** justificativa de 15 a 255 caracteres; a venda com nota
  pendente ou autorizada **não pode ser cancelada** até cancelar a nota.
- **Webhook** `/api/webhooks/fiscal`: HMAC-SHA256 de `timestamp.corpo`
  comparado em tempo constante, janela anti-replay de 5 min, fail-closed
  sem segredo e transições idempotentes.
- **Telas:**
  - `/fiscal`: configuração, certificado e notas com XML e cancelar;
  - botão **Emitir NFC-e/NF-e** no comprovante do PDV e no detalhe da
    venda, e **Emitir NFS-e** na OS concluída;
  - selo "simulada — sem valor fiscal";
  - menu e card da home.
- **Testes:** `tests/integration/fiscal.test.ts` (17). A fixture
  `tests/fixtures/fiscal/certificado-teste.pfx` é autoassinada, só para
  testes, e está documentada no README da pasta.

### Alterado

- `SalesService.cancel` bloqueia venda com nota ativa (`FiscalService`).
- `.env.example` e `DEPLOY.md`: `FISCAL_ENCRYPTION_KEY` e
  `FISCAL_WEBHOOK_SECRET`. `tests/helpers/setup-env.ts` usa chaves de
  teste.
- `rls.test` cobre 35 tabelas; `company-modules.test` espera 9 módulos.

### Verificação

- `npm run validate` verde: lint · typecheck · **698/698** (38 arquivos)
  · build · db:validate. `check:migrations` sem drift.
- **Navegador (servidores reais, banco de dev):** com a emissora simulada
  ativada, o botão "Emitir NFC-e" no detalhe da venda PF-ZYKW32WQ gerou a
  NFC-e nº 1 autorizada, com chave e XML. Cancelar essa venda → 409
  "Cancele antes a NFC-e autorizada desta venda". A página `/fiscal` foi
  conferida. A empresa de teste do banco de dev ficou com a emissão
  simulada ativa.

## [Akylla Gestão] - 2026-10-18 - Fase 2 · 2.3: Ordem de serviço — **Fase 2 concluída**

Terceiro e último item "em breve" da Fase 2. As regras foram escritas
antes do código em `docs/akylla/ORDEM_DE_SERVICO.md`, com OCA/repair e
ERPNext estudados só como referência.

### Adicionado

- **Modelos:** `ServiceOrder` (número sequencial por empresa),
  `ServiceOrderItem`, `ServiceOrderAttachment`;
  `Commission.serviceOrderId`; `WhatsAppMessage.originId`; enums
  `ServiceOrderStatus`, `SERVICE_ORDER` (financeiro/WhatsApp) e
  `SERVICE_ORDERS` (módulo). Migration aditiva
  `20261018190000_service_orders`, com RLS.
- **Estados estritos:** rascunho → orçamento → aprovada → em execução →
  concluída, com cancelamento por motivo. Pular etapa → 400; concorrência
  → 409 (`updateMany` condicional); orçamento exige itens.
- **Itens:** preço do catálogo para serviço e produto; item livre com
  valor informado; totais no servidor. Ficam travados após a aprovação,
  e as observações continuam editáveis.
- **Conclusão** (uma transação):
  - baixa de estoque dos produtos (locks em ordem; estoque insuficiente →
    nada gravado);
  - conta a receber do cliente;
  - comissão do técnico (ON_SALE libera agora; ON_PAYMENT ao receber,
    pela sincronia do financeiro).
- **Anexos:**
  - JPG/PNG/PDF até 5 MB, com o tipo detectado pelos bytes;
  - nome saneado e caminho montado só com ids (`attachment-storage.ts`);
  - download com `nosniff`/`no-store`;
  - remoção só antes de concluir ou cancelar.
- **WhatsApp:** `serviceOrderId` no envio vincula a mensagem à OS;
  histórico em `GET /:id/messages`.
- **Telas:**
  - `/os`: lista com filtro por situação (contagens) e busca por
    nº/cliente/equipamento;
  - `/os/nova`: editor de itens com prévia;
  - `/os/[id]`: próxima etapa, cancelar, imprimir, itens (editáveis até
    aprovar), observações, anexos com miniatura, mensagens;
  - menu e card da home.
- **Testes:** `tests/integration/service-orders.test.ts` (18).

### Alterado

- `CommissionsService`: `createForDocument` (venda ou OS); a liberação
  pendente por OS fica em `commission-release.ts`.
- `FinancialService`: título `SERVICE_ORDER` não pode ser editado; ao
  receber, libera comissões pendentes da OS.
- **Operação:** os anexos ficam fora do dump do banco. `backup/README.md`,
  `RUNBOOK.md` e `DEPLOY.md` (volume persistente, `UPLOADS_DIR`) foram
  atualizados, e `/uploads/` está no `.gitignore`.
- `rls.test` cobre 33 tabelas; `company-modules.test` espera 8 módulos.

### Verificação

- `npm run validate` verde: lint · typecheck · **681/681** (37 arquivos)
  · build · db:validate. `check:migrations` sem drift.
- **Navegador (servidores reais):** OS aberta pela tela `/os/nova`
  (produto R$ 80 + item livre R$ 45,50, desconto R$ 5) → **OS-00001,
  total R$ 120,50**. Pela API: anexo PNG enviado e etapas até concluir.
  Comissão de **R$ 27,41**, conferida à mão: 30% de 76,81 + 10% de 43,69,
  com o desconto rateado. A tela da OS concluída mostra o aviso da conta a
  receber, os itens travados e a miniatura do anexo carregada pelo proxy.

## [Akylla Gestão] - 2026-10-18 - Fase 2 · 2.2: Crediário

Segundo item "em breve" do site entregue. As regras foram escritas antes
do código em `docs/akylla/CREDIARIO.md`, com OCA/account-payment e ERPNext
estudados só como referência.

### Adicionado

- **Modelos:** `CreditAccount` (um por cliente: limite, saldo, situação) e
  `CreditInstallment`; `PaymentMethod` ganhou `CREDIARIO`,
  `FinancialOrigin` ganhou `CREDIT_SALE` e `BusinessModule` ganhou `CREDIT`.
  Migration aditiva `20261018170000_credit`, com RLS.
- **Venda a prazo no PDV:**
  - o cliente informa só o nº de parcelas (1–24) e o 1º vencimento;
  - valores e datas saem do servidor (`installment-plan.ts`): centavos na
    última parcela, mensal, com último dia em meses curtos;
  - a conta do cliente é travada com `FOR UPDATE`, em ordem fixa depois de
    caixa e produtos;
  - sem aprovação, bloqueada ou acima do limite → 403;
  - um a receber por parcela; **sem entrada no caixa** na venda.
- **Vencimento marcado na leitura** (`OVERDUE`).
- **Recebimento:** passa pelo financeiro (caixa aberto, entrada no caixa),
  com sincronia nos dois sentidos. Estornar o recebimento devolve a
  parcela ao saldo. O título da parcela não pode ser editado nem cancelado
  avulso.
- **Cancelamento:** parcelas em aberto/vencidas são canceladas e saem do
  saldo; **só o valor já pago** é devolvido pelo caixa.
- **Comissões:** `ON_PAYMENT`/`SPLIT_50_50` ficam pendentes na venda a
  prazo e são liberadas quando a última parcela é paga. A liberação foi
  extraída para `commission-release.ts` (sem dependência circular).
- **API:** `/api/credit-accounts` (carteira com totais a receber e
  vencido, detalhe, aprovar/ajustar) e `/api/credit-installments` (lista,
  receber).
- **Telas:**
  - no PDV: forma "Crediário" com parcelas, prévia do valor e 1º
    vencimento (some se o módulo estiver desativado);
  - `/crediario`: totais, cliente, aprovar limite, bloquear/liberar,
    parcelas com "Receber" e carteira;
  - atalho "Crediário" na ficha do cliente; menu e card da home.
- **Testes:** `tests/integration/credit.test.ts` (14).

### Alterado

- `sales.service`: crediário na criação e no cancelamento; a comissão usa
  `paidNow = forma ≠ CREDIARIO`.
- `financial.service`: sincronia com parcelas e liberação de comissão na
  quitação.
- `company-modules.test` agora espera 7 módulos; `rls.test` cobre 30
  tabelas; `resetDatabase` apaga as tabelas novas.

### Verificação

- `npm run validate` verde: lint · typecheck · **663/663** (36 arquivos)
  · build · db:validate. `check:migrations` sem drift.
- **Fluxo real no navegador (PDV):** venda de 2 × R$ 80 no crediário em
  3x → `/crediario` mostrou 53,33/53,33/53,34 mensais, saldo R$ 160 e
  disponível R$ 140. Pela API: parcela recebida (saldo 106,67) e venda
  acima do limite → 403 "disponível R$ 33,33". Dados de teste ficaram no
  banco de dev (cliente "Carla Crediário").

## [Akylla Gestão] - 2026-10-18 - Fase 2 · 2.1: Comissões

Primeiro módulo "em breve" do site entregue. As regras foram escritas antes
do código em `docs/akylla/COMISSOES.md`, com OCA/commission e ERPNext
estudados só como referência (AGPL/GPL, sem copiar código).

### Adicionado

- **Modelos:** `Professional`, `CommissionRule`, `Commission` e
  `Sale.professionalId`; enums `ReleasePolicy`, `CommissionStatus`;
  `FinancialOrigin` ganhou `COMMISSION` e `COMMISSION_REVERSAL`;
  `BusinessModule` ganhou `COMMISSIONS`. Migration aditiva
  `20261018150000_commissions`, já com RLS nas 3 tabelas novas, conforme
  a regra do AGENTS.
- **Cálculo no servidor** (`commission-calculator.ts`, função pura):
  - o desconto da venda é rateado proporcionalmente;
  - precedência: produto (do profissional > geral) → categoria → regra do
    profissional → padrão do profissional → regra geral;
  - o total é arredondado uma vez e as linhas fecham exatamente nele.
- **Venda:** `professionalId` opcional no PDV. A comissão é calculada e
  liberada na mesma transação, gerando uma conta a pagar.
- **Pagamento:** usa o fluxo do financeiro (exige caixa aberto e gera
  saída no caixa), com sincronia nos dois sentidos (liquidar e estornar).
  Títulos de comissão não podem ser editados nem cancelados avulsos.
- **Cancelamento da venda:** comissão não paga → cancelada junto com a
  conta a pagar; já paga → cancelada e é gerada uma conta a receber do
  profissional (estorno auditado).
- **API:** `/api/professionals`, `/api/commission-rules` e
  `/api/commissions` (lista com totais, `summary` por profissional,
  `release`, `pay`).
- **Telas:**
  - `/profissionais`;
  - `/comissoes` (fechamento do período por profissional, lista com itens,
    liberar e pagar);
  - `/comissoes/regras`;
  - seletor de profissional no PDV, profissional no detalhe da venda,
    menu e card da home.
- **Testes:** `tests/integration/commissions.test.ts` (19).

### Alterado

- `tests/helpers/app.ts` (`resetDatabase`) apaga as tabelas novas na ordem
  das FKs; `company-modules.test.ts` agora espera 6 módulos;
  `rls.test.ts` cobre as 28 tabelas.
- `FinancialService`: sincronia com comissões e bloqueio de edição e
  cancelamento de títulos de comissão.
- Guard ORM de tenant inclui os 3 modelos novos.

### Bug evitado durante a implementação

- Arredondar linha a linha gerava um centavo a mais (3 × R$ 6,67 a 10% =
  R$ 2,01). O total passou a ser arredondado uma vez só, com o resto de
  centavos lançado no último item; há teste para isso.

### Verificação

- `npm run validate` verde: lint · typecheck · **649/649** (35 arquivos)
  · build · db:validate. `check:migrations` sem drift.
- Teste no navegador com servidores reais (banco de dev): venda de
  R$ 160 com desconto de R$ 10 e regra de categoria de 30% → comissão de
  **R$ 45,00** em `/comissoes`, com itens detalhados; pagamento → "Paga" e
  fechamento atualizado; seletor de profissional presente no PDV.

## [Akylla Gestão] - 2026-10-18 - Fase 1 · 1G: CI corrigida + pipeline de deploy pronto

### Corrigido: a CI estava vermelha desde N1

Nenhuma das últimas 100 execuções no GitHub tinha passado. Reproduzi num
clone limpo e encontrei três causas:

1. **Typecheck sem Prisma Client:** o job de typecheck não rodava
   `prisma generate`. Agora o `postinstall` da raiz gera o client em todo
   `npm ci`, o que vale também para os provedores de hospedagem.
2. **`check:migrations` sempre falhava:** usava `migrate diff
   --from-migrations` sem banco shadow e `--script`, cuja saída nunca vem
   vazia. Reescrito: cria `<banco>_shadow`, compara com `--exit-code` e
   remove o shadow. Testei que detecta drift (coluna temporária → exit 1)
   e passa sem drift.
3. **Postgres superusuário anularia a RLS:** a CI cria o role
   `akylla_app` (sem SUPERUSER/BYPASSRLS) e roda migrations e testes com
   ele. Também trocou `db:migrate` (dev, pode gerar migration) por
   `db:deploy` e passou a usar Node 22.

### Adicionado

- **`cd.yml` real:**
  - roda depois do CI verde na `main` ou manualmente;
  - usa o environment `production` (com aprovação);
  - sequência: migrations (`PRODUCTION_DATABASE_URL`) → deploy hooks de
    API, worker e web → health check (`/health/ready` com
    `"database":"ok"` e `/login`, até 10 min);
  - fica parado enquanto a variável `DEPLOY_ENABLED` não for `true`.
- **`docs/operations/DEPLOY.md`:** peças, role do banco sem bypass (RLS),
  comandos de build/start por serviço, variáveis de produção, configuração
  do GitHub e checklist pós-deploy.

### Alterado

- `apps/web/next.config.ts`: destino do proxy `/api/*` vem de
  `API_INTERNAL_URL` no build (padrão `localhost:3001`). Antes era fixo, o
  que impedia web e API em serviços separados. Conferido no
  `routes-manifest.json`.
- API: `API_PORT` usa `PORT` do provedor quando ausente.
- `package.json`: `postinstall` (Prisma generate) e `engines.node >=20.9`
  (exigência do Next 16).
- `RUNBOOK.md` e `CHECKLIST_PRE_PRODUCAO` (L7) atualizados.

### Pendente (proprietário)

- Escolher o provedor, criar os serviços (API, worker, web, Postgres e
  Redis), configurar os secrets e fazer o primeiro deploy.

## [Akylla Gestão] - 2026-10-18 - Fase 1 · 1F: `npm audit --omit=dev` = 0

Três upgrades, um por commit, com `npm run validate` verde depois de
cada um:

| Pacote | De → para | Corrige | Observação |
|---|---|---|---|
| `nodemailer` | 8.0.11 → **10.0.16** | GHSA-p6gq-j5cr-w38f (alta) | a versão vulnerável tinha entrado no 1D; a 10.x traz tipos próprios (saiu `@types/nodemailer`) |
| `next` | 15.5.28 → **16.4.2** | `postcss` GHSA-qx2v-qp2m-jg93 e GHSA-6g55-p6wh-862q (alta) | build com Turbopack sem avisos e sem mudança de código; páginas, 404 e o proxy `/api` testados com servidor real; login + `/clientes` testados no navegador |
| `vitest` | 2.1.x → **4.1.11** | `tinypool` (crítica), `vite`/`esbuild`/`@vitest/mocker` | o `vite` 8 também satisfaz o peer do `@sentry/nextjs`, que estava puxando o `vite` 5 vulnerável para a árvore de produção; `config/vitest.config.ts` sem mudanças |

- **Resultado:** `npm audit --omit=dev` → **0 vulnerabilidades**.
- **Risco aceito:** 1 moderada só de teste (`sprintf-js` ← `fengari` ←
  `ioredis-mock`), sem versão corrigida publicada. O npm propõe rebaixar
  o `ioredis-mock` para 4.7.0, que não executa os scripts Lua do
  `rate-limiter-flexible` e quebraria os testes do 1C. Não vai para
  produção e roda com entradas fixas.
- **Verificação:** `npm run validate` verde (630/630) depois de cada
  upgrade.

## [Akylla Gestão] - 2026-10-18 - Fase 1 · 1E: RLS nativa do PostgreSQL (defesa em profundidade)

Referência usada (`upgrade/REFERENCIAS_GIT.md`, Fase 1 · 1E):
`prisma/prisma-client-extensions › row-level-security` (Apache-2.0), cujo
padrão `[set_config, consulta]` foi adaptado. Detalhes em
`docs/architecture/ADR-0001-tenant-defense.md`.

### Adicionado

- **Migration `20261018120000_row_level_security`:** `ENABLE` + `FORCE ROW
  LEVEL SECURITY` e a política `tenant_isolation` em 25 tabelas (as 24 com
  `companyId` e mais `Company` por `id`). Uma linha só aparece ou é
  gravada se `app.company_id` bater ou se `app.rls_bypass = 'on'`. Sem
  nenhum dos dois, nada aparece.
- **`apps/api/src/common/tenant/rls.extension.ts`:**
  - `rlsExtension`: toda consulta fora de transação roda numa transação em
    lote que primeiro define o contexto;
  - `withRlsTransactions`: `$transaction` interativa e em lote definem o
    contexto no primeiro statement;
  - consultas já dentro de transação não são re-embrulhadas, o que
    preserva a atomicidade;
  - `systemDatabaseUrl()`: conexão de sistema com bypass via `options`.
- **`withTenantContext(tenantContext, companyId, fn)`** para jobs que agem
  em nome de uma empresa.
- **`tests/integration/rls.test.ts`** (16 testes): políticas e FORCE nas
  25 tabelas, role sem bypass, conexão crua vê 0 linhas, WITH CHECK contra
  outra empresa, contexto local à transação, conexão de sistema, SQL bruto
  confinado à empresa, transação interativa e em lote, caminho HTTP pelo
  `TenantContextInterceptor` e atomicidade.

### Alterado

- `PrismaService`: guard ORM + RLS + transações com contexto.
- Worker e CLI (`bootstrap-admin`, `seed-demo`) usam conexão de sistema.
- `scripts/db-backup.mjs`: `PGOPTIONS=-c app.rls_bypass=on` em todos os
  binários e `pg_dump --enable-row-security`. Sem isso, o `pg_dump`
  aborta com RLS + FORCE.
- `AGENTS.md`: regra permanente nova (tabela com `companyId` recebe a
  política na mesma migration; DML em migration liga o bypass).
- ADR-0001 atualizada (status: RLS implementada), `DATABASE.md`,
  `RUNBOOK.md` (role da aplicação sem SUPERUSER/BYPASSRLS; `psql` manual)
  e `CHECKLIST_PRE_PRODUCAO` (L3 resolvido).

### Bugs encontrados e corrigidos durante a implementação

- **Atomicidade:** embrulhar cada consulta numa transação própria, como
  no exemplo, tirava as consultas de dentro das transações da aplicação
  (rollback deixava dados gravados). Corrigido detectando a transação
  corrente; há teste para isso.
- **Contexto preguiçoso:** uma `PrismaPromise` só executa no `await`; se
  for aguardada fora do contexto, roda sem tenant. Nas rotas o `await`
  acontece dentro do interceptor, e há teste do caminho HTTP.

### Verificação

- `npm run validate` verde: lint · typecheck · **630/630** (34 arquivos)
  · build · db:validate. **A suíte inteira roda com a RLS ativa**, e o
  tempo não piorou (30,0 s contra 31,9 s).
- Migration aplicada no banco de dev. `npm run db:backup` com RLS ativa:
  restore validado (32 tabelas, 18 migrations).
- API e worker compilados rodando no banco de dev com RLS: login, `/me` e
  `/api/clients` 200; worker iniciou normalmente.

## [Akylla Gestão] - 2026-10-18 - Fase 1 · 1D: cadastro anti-abuso (verificação de e-mail + Turnstile)

Referências usadas (`upgrade/REFERENCIAS_GIT.md`, Fase 1 · 1D):
`nodemailer` (MIT) como biblioteca de envio e a documentação de validação
no servidor do Cloudflare Turnstile. Nenhum código de terceiros copiado.

### Adicionado

- **Verificação de e-mail obrigatória no cadastro aberto:**
  - a empresa nasce `PENDING_VERIFICATION` e o cadastro não abre sessão;
  - o link `/confirmar-email?token=…` (24 h, uso único) ativa a empresa e
    entra no sistema;
  - login com senha certa e conta pendente → 403 `EMAIL_NOT_VERIFIED`, e a
    tela oferece reenviar o link.
- **Endpoints:** `POST /api/auth/verify-email` e
  `POST /api/auth/resend-verification` (este responde igual exista ou não a
  conta).
- **Modelo `EmailVerificationToken`** (hash SHA-256, mesmo padrão do
  `PasswordResetToken`) e `User.emailVerifiedAt`. Migration aditiva
  `20261018090000_email_verification`; usuários existentes ficam
  confirmados na data de criação.
- **E-mail real:** `SmtpMailProvider` (nodemailer), com HTML e texto em
  pt-BR e nome escapado no HTML. Sem `SMTP_HOST`, segue o
  `LogMailProvider`, que em produção não registra o link.
- **Turnstile opcional:** liga com `TURNSTILE_SECRET_KEY` na API e
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no web. Sem token, ou com o serviço
  fora do ar, responde 400 (falha fechada).
- **Telas:** `/cadastro` mostra "Confirme seu e-mail" com reenvio;
  `/confirmar-email` tira o token da barra de endereço assim que o lê;
  `/login` mostra o reenvio quando a conta está pendente.
- **Testes:** `tests/integration/email-verification.test.ts` (12) e
  `register.test.ts` reescrito para o fluxo novo.

### Alterado

- O rate limit do cadastro **não zera mais no sucesso**: conta todos os
  cadastros do IP (produção: `REGISTER_RATE_LIMIT_MAX=3` por hora).
- Validação de produção: com `REGISTRATION_ENABLED=true`, a API exige
  `SMTP_HOST`. Antes, o cadastro aberto era proibido em produção.
- `ApiError` do web carrega `code`. `companyStatusSchema` inclui
  `PENDING_VERIFICATION`.
- Dependências fixas: `nodemailer@8.0.11` e `@types/nodemailer@8.0.2`
  (dev) em `apps/api`.
- Documentação: `.env.example` (`SMTP_*`, `MAIL_FROM`,
  `EMAIL_VERIFICATION_TTL_HOURS`, `TURNSTILE_*`), `API.md`, `DATABASE.md`
  (com registro dos modelos N1–N4), `RUNBOOK.md` e
  `CHECKLIST_PRE_PRODUCAO` (L6 resolvido no código).

### Verificação

- `npm run validate` verde: lint · typecheck · **614/614** (33 arquivos)
  · build · db:validate. Migration conferida com `prisma migrate diff`
  (sem diferença) e aplicada no banco de dev.
- Teste no navegador (API e web compilados): cadastro → tela
  "Confirme seu e-mail" → link → painel logado como ADMIN da empresa
  nova. Conta de teste `teste-ui@exemplo.test` criada no banco de dev.

## [Akylla Gestão] - 2026-10-18 - Fase 1 · 1C: rate limit distribuído (Redis) com fallback em memória

Referência usada (`upgrade/REFERENCIAS_GIT.md`, Fase 1 · 1C):
`animir/node-rate-limiter-flexible` (ISC), usado como biblioteca, não
copiado. O `nestjs-throttler-storage-redis` foi descartado por estar
descontinuado.

### Adicionado

- **`RedisRateLimitStore`** (`apps/api/src/common/rate-limit/rate-limit-store.ts`):
  janela fixa por chave no Redis (`RateLimiterRedis`). As chaves são
  `akylla:rl:<limite>:<janela>:<chave>`, com TTL igual à janela. Um
  limitador por par (limite, janela), então login e cadastro não se
  misturam.
- **Fallback:** `insuranceLimiter` em memória com o mesmo limite. Com o
  Redis fora do ar, o cliente (`enableOfflineQueue: false`) falha na hora
  e a memória assume: sem erro 500 e sem esperar timeout. Um único aviso
  vai para o log ("Redis indisponível…") e outro na reconexão.
- **`createRateLimitStore(REDIS_URL)`:** sem URL → `InMemoryRateLimitStore`
  (comportamento anterior); com URL → Redis. Encerra a conexão no
  shutdown.
- **`tests/integration/rate-limit.test.ts`** (10 testes): escolha do backend,
  429 com `retryAfterSeconds`, chave prefixada e TTL no Redis, contador
  compartilhado entre duas instâncias, reset, limites independentes,
  limite 0 desliga e queda do Redis (porta fechada) mantendo o limite.

### Alterado

- Interface `RateLimitStore` agora **assíncrona** (`hit`/`reset` →
  `Promise`); os chamadores em `auth.controller.ts` (login, cadastro,
  reset de senha e 2FA) usam `await`.
- Mensagem do 429 generalizada para "Muitas tentativas. Tente novamente
  em alguns minutos." (antes dizia "de login" também no cadastro).
- Dependências (versões publicadas há mais de 2 semanas, fixas):
  `rate-limiter-flexible@11.2.1` e `ioredis@5.11.1` em `apps/api`;
  `ioredis-mock@8.13.1` (dev, só testes, Redis simulado sem servidor).
- `.env.example` (`REDIS_URL`), `RUNBOOK.md` (Redis em §1),
  `CHECKLIST_PRE_PRODUCAO` (L2 resolvido no código).

### Verificação

- `npm run validate` verde: lint · typecheck · **602/602** (32 arquivos)
  · build · db:validate.
- API compilada com `REDIS_URL` apontando para um Redis desligado:
  aviso no log, 5× 401 e 429 na 6ª tentativa de login (limite 5).

### Observação para o 1D

- O cadastro zera o contador quando o cadastro dá certo, então o limite
  por IP só conta tentativas com falha. Para anti-abuso real (3
  cadastros/hora), o 1D deve contar também os cadastros bem-sucedidos.

## [Akylla Gestão] - 2026-10-18 - Fase 1 · 1B: monitoramento (Sentry) + readiness + RUNBOOK

Referência usada (`upgrade/REFERENCIAS_GIT.md`, Fase 1): guias oficiais do
Sentry para Node/NestJS e Next.js (`getsentry/sentry-javascript`, MIT).
Nenhum código de terceiros copiado.

### Adicionado

- **API:** `apps/api/src/monitoring/sentry.ts` + `instrument.ts` (primeiro
  import do `main.ts`). Liga só com `SENTRY_DSN`. `AllExceptionsFilter`
  reporta **apenas 5xx** com método, rota, `companyId` (tag) e id do
  usuário. Falha de boot também é reportada. Profiling opcional
  (`SENTRY_PROFILES_SAMPLE_RATE`, padrão 0).
- **Privacidade:** `dataCollection` mínimo do SDK v11 (sem cookies, corpo,
  query string, cabeçalhos além de user-agent/content-type/accept, sem
  dados do usuário) + `scrubEvent` como segunda camada +
  `includeLocalVariables: false`.
- **Worker:** `apps/worker/src/monitoring.ts` (erros de ciclo, provedor e
  boot com tag `stage`; flush no encerramento). O log de início mostra
  `monitoramento=sentry|desligado`.
- **Web:** `@sentry/nextjs` via `src/instrumentation.ts` (servidor/edge,
  `onRequestError`), `src/instrumentation-client.ts` (navegador, sem
  replay), captura em `error.tsx` e novo `global-error.tsx`. Remove a
  query string de URLs e breadcrumbs (o link de redefinição leva o token
  nela). Sem `withSentryConfig` por enquanto: o upload de source maps
  fica para quando houver conta e token.
- **`GET /health/ready`:** processo + banco (`SELECT 1`, limite de 2 s) →
  200 ou 503 sem detalhes internos. É a URL do UptimeRobot. `/health`
  continua igual (liveness).
- **`npm run monitoring:test`** (`scripts/sentry-test.mjs`): envia um
  erro "[TESTE]" para validar o alerta (critério de aceite da Fase 1).
- **`docs/operations/RUNBOOK.md`:** serviços e saúde, Sentry (variáveis,
  o que é reportado, alertas), UptimeRobot (keyword `"database":"ok"`,
  1 min, alerta após 2 falhas), resposta a incidentes (S1–S3, LGPD art.
  48), rollback (app, migrations com `prisma migrate resolve`, feature
  flags), backup, restauração (RTO ≤ 4 h / RPO ≤ 24 h), rotina e
  registro de testes de alerta.
- **`tests/integration/monitoring.test.ts`** (8 testes): desligado sem DSN,
  scrub de PII, 5xx reportado × 4xx não, envio real com transporte falso
  (tags de tenant presentes; token da query e variáveis locais ausentes),
  `/health/ready` 200 e 503 sem vazar host, `/health` inalterado.

### Alterado

- Dependências: `@sentry/node` e `@sentry/profiling-node` saíram da raiz
  e foram para `apps/api` (e `@sentry/node` também para `apps/worker`);
  `@sentry/nextjs@11.8.0` entrou em `apps/web`, que é o pacote oficial
  para Next.js. Versões fixas em 11.8.0.
- `.env.example`: `SENTRY_*` e `NEXT_PUBLIC_SENTRY_*` (vazios).
- `docs/architecture/API.md`: `/health/ready`. `CHECKLIST_PRE_PRODUCAO`:
  L8 e L9 marcados como parciais.

### Verificação

- `npm run validate` verde: lint · typecheck · **592/592** (31
  arquivos) · build · db:validate.
- API compilada iniciada de verdade: `/health/ready` → 200
  (`database: ok`). Worker iniciado: `monitoramento=desligado`.

### Pendente (depende do proprietário)

- Criar as contas Sentry e UptimeRobot, configurar os DSNs no servidor e
  registrar os alertas de teste em `RUNBOOK.md` §9.

## [Akylla Gestão] - 2026-10-18 - Referências no GitHub por módulo

### Adicionado

- **`upgrade/REFERENCIAS_GIT.md`**: repositórios de apoio para cada fase
  e módulo do roteiro (Fase 1: Sentry, rate limit Redis, e-mail,
  Turnstile, RLS com Prisma; Fase 2: comissões, crediário e OS; Fase 3:
  fiscal, com FinOpenPOS/MIT como referência de código e integradoras;
  Fases 4–7: CRM, UI, testes e comparação de produto). Para cada um:
  licença, estrelas, onde olhar e o que pode ser copiado
  (MIT/Apache/ISC) ou só estudado (GPL/AGPL). Estrelas, licença e
  atividade conferidas pela API do GitHub em 2026-10-18; todos os links
  respondem 200.
- Links em `README.md` e `docs/README.md`.

## [Akylla Gestão] - 2026-10-18 - Organização: itens fora de uso movidos para `Arquivos Sem USO/`

Pedido do proprietário: deixar no projeto só o que será usado, **sem
apagar nada**. Tudo foi movido para `Arquivos Sem USO/`, uma pasta
local que o `.gitignore` exclui (para que credenciais e materiais
comerciais nunca subam ao GitHub). Os itens que eram versionados
continuam no histórico do Git até o commit `672463f`.

### Movido

- `automação do whatsapp/` (base histórica; o WhatsApp do produto está
  em `apps/worker` e `packages/whatsapp`).
- Entregáveis do roteiro antigo: `docs/PASSO_A_PASSO_OPENCODE_AKYLLA.md`,
  `docs/AKYLLA_GESTAO_DIRETRIZES_OPENCODE.md` e 11 arquivos de
  `docs/akylla/` (ficam em uso: `GO_NO_GO`, `CHECKLIST_PRE_PRODUCAO`,
  `PDV`, `DICIONARIO_INDICADORES`).
- Rascunhos em `upgrade/` (deepseek ×2, GEMINI, GPT,
  `COMPILADO_MELHORIAS`), substituídos pelo `Prompt_Mestre.md`.
- Não versionados: a apresentação `.pptx`, o arquivo de credencial
  (em `credenciais/`, sem ser lido), `coverage/` e `test-results/`.
- Trabalho não commitado da Fase 6 (`config/playwright.config.ts`,
  `tests/e2e/`, `tests/integration/concurrency.test.ts`) e um `.patch`
  com as alterações dele em `ci.yml`, `cd.yml`, `vitest.config.ts`,
  `package.json` e `package-lock.json`, que voltaram ao estado do Git.

### Alterado

- `.gitignore`: `/Arquivos Sem USO/`.
- `AGENTS.md`: introdução e regra 12 (a pasta arquivada substitui a
  antiga regra de `automação do whatsapp/`).
- `config/eslint.config.mjs` e `scripts/check-secrets.mjs`: exclusão
  passa a ser `Arquivos Sem USO/`.
- `docs/README.md`: índice sem links quebrados e seção "Arquivados".
- `README.md`, `ARCHITECTURE.md`, `AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md`
  e `PROJECT_STATUS.md`: menções atualizadas.

## [Akylla Gestão] - 2026-10-18 - Fase 1 (Confiabilidade) · 1A: backup com restore testado + registro de N1–N4c

Primeira entrega do roteiro `upgrade/Prompt_Mestre.md` (Fase 1 §1.1),
autorizada pelo proprietário. Também registra aqui os commits N1–N4c
(2026-10-15), que não tinham entrada neste changelog.

### Corrigido

- **`scripts/db-backup.mjs`** (criado em N1) não funcionava:
  - a `DATABASE_URL` do Prisma (`?schema=public`) era passada direto ao
    `pg_dump`, que rejeita o parâmetro;
  - `--retain=30` (forma documentada) não era lido;
  - `createdb`/`dropdb` ignoravam a URL (usavam o servidor/usuário
    padrão) e uma falha neles encerrava o processo antes do `catch`;
  - a "validação" do restore rodava só `prisma validate` (checa o
    arquivo `schema.prisma`, não o banco restaurado);
  - a senha ia na linha de comando.

### Alterado

- **`scripts/db-backup.mjs`** reescrito: `db:backup` = dump
  (`--format=custom --compress=6`, nome `akylla_YYYY-MM-DD_HHmm.dump`,
  sem sobrescrever no mesmo minuto) → retenção (`RETENTION_DAYS`/
  `--retain`, padrão 30) → restore em banco efêmero
  (`RESTORE_TEST_DB`, padrão `akylla_restore_test`) com validação real:
  contagem de linhas de todas as tabelas = origem, mesmas migrations e
  `prisma migrate diff --exit-code` sem diferenças. Banco efêmero
  sempre removido; log em `<BACKUP_DIR>/backup.log`; exit ≠ 0 em falha;
  senha só via `PGPASSWORD`; detecção dos binários em `PG_BIN` ou
  `C:\Program Files\PostgreSQL\<versão>\bin`.
- **`package.json`**: novo `db:restore-test` (nome do roteiro);
  `db:restore:test` mantido como alias.
- **`.env.example`**: `BACKUP_DIR`, `RETENTION_DAYS`, `RESTORE_TEST_DB`,
  `PG_BIN` (sem valores sensíveis).
- **`backup/README.md`**: comandos, validação, agendamento (cron
  `0 2 * * *` e Agendador do Windows), offsite S3/B2, RPO ≤ 24 h,
  RTO ≤ 4 h, drill mensal.

### Adicionado

- **`tests/integration/backup.test.ts`** (7 testes): dump + restore
  validado + remoção do efêmero; senha ausente do log; dois dumps no
  mesmo minuto; retenção; dump corrompido → exit ≠ 0 e efêmero
  removido; retenção inválida; sem `DATABASE_URL`. A suíte pula com
  aviso se os binários do PostgreSQL não estiverem na versão do
  servidor (ex.: runner de CI sem `postgresql-client-17` contra o
  serviço `postgres:17`).

### Verificação manual

- `npm run db:backup` no banco de desenvolvimento: dump de 149 KB,
  restore validado (31 tabelas, 16 migrations), efêmero removido.

### Registro retroativo — N1 a N4c (2026-10-15, já commitados)

- **N1** — LGPD (`/api/lgpd`: consentimento, `data-export` e
  `anonymize` de cliente com `AdminGuard`; modelo `LegalConsent`;
  páginas `/termos` e `/privacidade`; aceite no cadastro), primeira
  versão do script de backup, `scripts/check-secrets.mjs`,
  `scripts/check-migrations.mjs`, matriz `docs/akylla/GO_NO_GO.md`.
- **N2/N3** — dependências do Sentry (`@sentry/node`,
  `@sentry/profiling-node`, ainda **não inicializadas**), esqueleto do
  `cd.yml`, webhook Mercado Pago com comparação em tempo constante,
  anti-replay por `ts` e fail-closed, uso do plano em `/faturamento`.
- **N3** — `GET /api/company/export` (portabilidade da empresa, sem
  segredos, isolamento A×B).
- **N4** — rate limit atrás de interface (`rate-limit-store.ts`, store
  em memória), redefinição de senha por token de e-mail
  (`PasswordResetToken`, `mail.module.ts`), cabeçalhos de segurança,
  2FA TOTP para ADMIN.
- **N4c** — guard ORM de tenant (`ADR-0001`; RLS nativa registrada como
  pré-requisito de produção) e rate limit dedicado de cadastro
  (`REGISTER_RATE_LIMIT_MAX`). L1 (next 16) pendente.

## [Akylla Gestão] - 2026-10-15 - Débitos de design D-1, D-2, D-3, D-5 e D-7

Sexta entrega única autorizada. Primeira execução de código desde a
Etapa 12. **Só frontend** — nenhum arquivo de backend, teste ou
migration alterado.

Executa o lote "uma tarde" do `upgrade/MELHORIAS_DESIGN.md` §0 e §Sequência,
que o próprio catálogo classifica como *correção de débito, não
melhoria: podem ser executados assim que autorizados, sem design
review*.

### Adicionado

- **`apps/web/src/app/not-found.tsx`** — página 404 própria com caminho
  de volta. Fecha o caso que o catálogo aponta: recurso de outra
  empresa **deve** responder 404 (regra permanente) e antes caía na
  página branca do Next.
- **`apps/web/src/app/error.tsx`** — boundary de erro global. Mensagem
  genérica em produção; `error.message` só em dev; `error.digest`
  sempre exibido; botão `reset`. Não vaza stack em produção.
- **`apps/web/src/app/loading.tsx`** — esqueleto de carregamento
  reaproveitando `Skeleton.tsx` já existente, com `role="status"` e
  `aria-label`.

### Alterado

- **`globals.css` — D-1:** `color: var(--foreground)` referenciava uma
  variável **que nunca foi definida**; a cor do texto caía no default
  do browser. Criado o token `--color-foreground: #0f172a` no `@theme`
  (slate-900; ~17:1 sobre o `--color-background`).
- **`globals.css` — D-2:** `--font-sans` usava a string literal
  `"Inter"` enquanto o `next/font` injetava a variável `--font-inter`
  no `<html>` **sem que ninguém a lesse**. Agora
  `var(--font-inter), ui-sans-serif, system-ui, ...` — a fonte
  otimizada pelo Next passa a ser a usada de fato.
- **`globals.css` — D-3:** removido o bloco `.sidebar-scroll`, morto
  desde que a sidebar foi substituída pela topbar (opção B).
  **Preservados** os tokens `--color-sidebar*` (§0, linhas 16-21) —
  são usados pela topbar escura e pelo drawer mobile. O catálogo os
  listava junto, mas inspeção confirmou uso ativo.
- **D-7 — contraste (WCAG AA):** regra "texto só nos stops 700+"
  aplicada em **7 ocorrências** de texto informativo:
  - `dashboard/page.tsx` ×2 (`text-primary-600`, `text-amber-600`)
  - `assinaturas/nova/page.tsx` ×2 (`text-amber-600`)
  - `relatorios/page.tsx` (`text-amber-600`)
  - `whatsapp/mensagens/[id]/page.tsx` (`text-amber-500` → era rótulo
    `<dt>`)
  - `shell/Header.tsx` ×2 (ícones `AlertTriangle`/`CalendarClock`
    a 16px sobre fundo claro: 2.15:1 reprovava até no mínimo 3:1 de
    WCAG 1.4.11)

### Preservado (não eram violações)

| Local | Valor | Motivo |
|---|---|---|
| `Header.tsx:712` | `text-primary-400` | avatar sobre a topbar **escura** (`bg-primary-500/20` sobre `#0f172a`) — âmbar claro sobre fundo escuro é o correto |
| `StatCard.tsx:8,10` | `text-amber-600`, `text-primary-600` | **cor de ícone** (`iconBackgrounds`), não texto — 3.19:1, acima do mínimo 3:1 de WCAG 1.4.11 para componentes não-texto |

### Não alterado nesta entrega

- **D-4** (32 `<table>` inline) e **D-6** (faltam `Table`, `Modal`,
  `Select`, `Toast`, `Tabs`) — dependem do componente `Table`
  (`MELHORIAS_DESIGN.md` §2.1), lote "uma semana".
- Limites de *loading* por rota: 31/39 páginas são client-side com
  `useEffect`, então o `loading.tsx` de raiz cobre o segmento raiz;
  skeletons por tela é §3.2 do catálogo.

### Verificação

- `npm run validate` **verde**: lint · typecheck · **538/538** ·
  build · `db:validate`.
- Rota `/_not-found` agora renderiza o componente próprio.
- **Nenhum teste de backend alterado** — a suíte permanece em 538.

---

## [Akylla Gestão] - 2026-10-14 - Documentação técnica consolidada (29 seções)

Quinta entrega única autorizada. `AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md`
passa de 841 para **1503 linhas** e de 23 para **29 seções**, virando
a **fonte única consolidada do projeto** — pronta para leitura por
outra IA.

### Alterado

- **Cabeçalho e §1**: estado atualizado (538/538 · 26 controllers ·
  28 models · 32 enums · 39 páginas · 13 migrations · CI ativa ·
  2 vulnerabilidades em produção). Novo **§1.1 Resumo executivo** para
  quem lê pela primeira vez.
- **§2 Stack**: árvore do monorepo atualizada (`config/`, `scripts/`,
  `tests/`, `backup/`, `upgrade/`, `.github/`); todos os comandos
  (`validate`, `db --`, `db:deploy`); tabela de **CI/CD** com o
  placeholder do `cd.yml` apontado por linha.
- **§17 Testes**: explícito o que os 538 testes **não** cobrem
  (componentes React, rewrites do Next, navegador) e que a validação
  E2E de interface é manual.
- **§21 Pendências**: reorganizada em "bloqueiam produção" (L1, L4,
  L7, L8, L9, L13) / "degradam a operação" (L2, L3, L5, L6, L10, L12,
  L14) / "menores", cada uma com ponteiro para a solução.

### Adicionado

- **§24 Módulo importação de planilhas CSV** — rotas, 5 tipos,
  fluxo completo de `upload` (detecção de delimitador, normalização
  de cabeçalho, formato BR de decimal, deduplicação por empresa,
  limite de plano só com assinatura `ACTIVE`, dry run, transação
  única), relatório, segurança e tela.
- **§25 Entregas fora do roteiro** — as 5 entregas de outubro com
  commits, pastas `backup/` e `upgrade/`.
- **§26 Catálogo de melhorias** (backend/segurança/operação/produto)
  — 29 ideias P0–P3 em tabelas com "que lacuna fecha".
- **§27 Catálogo de design** — 7 débitos medidos (D-1..D-7) com
  **tabela de contraste WCAG** e os valores reais (2.15 / 2.49 / 3.19
  reprovados, 5.02 aprovado), + 8 categorias de melhoria, regras de
  ouro e sequência.
- **§28 Plano do primeiro cliente** — veredito comercial, semanas
  1–3, modelo de piloto e **critério go/no-go de 9 verificações**.
- **§29 Mapa de documentos** — índice das fontes (ops, akylla,
  upgrade, backup) e as regras permanentes do `AGENTS.md`.
- **Índice de navegação** no topo separando o que é **Fato** (§1–§25)
  do que é **Proposta** (§26–§28).

### Preservado

- Numeração das seções §1–§23 **inalterada** — são referenciadas por
  `CHANGELOG.md`, `IMPLEMENTATION_CHECKLIST.md`,
  `MELHORIAS.md`, `REDESIGN_PAINEL.md` e `DIRETRIZES_OPENCODE.md`.
  As novas entraram como §24–§29.

### Alterado (referências)

- `docs/README.md` e `README.md`: contagem 23 → 29 seções.

### Verificação

- 34 arquivos `.md`, 64 links relativos — **0 quebrados**.
- UTF-8 limpo (0 U+FFFD; único match de `Ã` é o `NÃO` legítimo).

---

## [Akylla Gestão] - 2026-10-14 - Plano executável: primeiro cliente pagante

Quarta entrega única autorizada. Transforma as ideias dos catálogos
`upgrade/` em **plano de execução testável**. Nenhum item do plano foi
executado — apenas o documento foi criado.

### Adicionado

- **`docs/operations/CHECKLIST_PRIMEIRO_CLIENTE.md`** — roteiro de 3
  semanas até o primeiro cliente **pago em produção**:
  - **Semana 1 (poder hospedar):** definir hosting, fechar o
    `cd.yml` (placeholders em `cd.yml:40` e `:75`), backup com
    **restore testado**, monitoramento e alerta.
  - **Semana 2 (poder confiar):** zerar `npm audit --omit=dev`
    (`next`→16.4.1, `vitest`), endpoint LGPD de anonimização
    (`apps/api/src/lgpd/`, hoje inexistente), D-7 do contraste,
    termos de uso e política de privacidade com aceite registrado.
  - **Semana 3 (poder cobrar):** E2E real do Mercado Pago em sandbox
    (assinatura `ACTIVE` por **pagamento real**, não pelo mock), seed
    neutro (fecha L11) e roteiro comercial de migração ensaiado.
- Cada item traz **comando ou arquivo concreto** e **critério de
  aceite testável**; o documento fecha com **critério go/no-go de 9
  verificações**, modelo comercial de piloto (setup + 90 dias, sem
  recorrente no cliente 1) e tabela de riscos aceitos.

### Alterado

- **`docs/README.md`**: checklist indexado em "Estado atual do
  produto".
- **`docs/operations/PROJECT_STATUS.md`**: bloco de Próximos passos
  aponta o plano como plano de execução proposto, aguardando
  autorização.
- **`docs/operations/IMPLEMENTATION_CHECKLIST.md`**: seção "Fora do
  roteiro — Plano: primeiro cliente pagante" com os itens `[ ]`
  pendentes.

### Verificação

- Links relativos verificados (0 quebrados).
- Nenhum arquivo de código alterado; nenhum item do plano executado.

### Estado

**Aguardando autorização** para iniciar a Semana 1 (regra 2 do
`AGENTS.md`).

---

## [Akylla Gestão] - 2026-10-14 - Catálogo de melhorias e pasta de backup

Terceira entrega única autorizada pelo proprietário (fora do roteiro
0–12). Cria a base de decisão para evolução do produto — **nenhum
código de aplicação alterado**, nenhuma ideia executada.

### Adicionado

- **`upgrade/MELHORIAS.md`** — catálogo com **29 ideias** de melhoria
  em 6 categorias (segurança e compliance, operação e resiliência,
  desempenho e escala, qualidade e testes, produto e UX, plataforma e
  DX). Cada item traz função, o que melhora **neste projeto** (com
  arquivo ou limitação L1–L14 real), ponto de partida e prioridade
  P0–P3, mais tabela-resumo e sequência sugerida.
- **`upgrade/MELHORIAS_DESIGN.md`** — catálogo de **design de
  interface** (tokens/CSS, componentes, movimento/JS, a11y,
  responsividade, estados, dados e visualização, performance
  percebida, impressão), no mesmo formato. Inclui regras de ouro
  (servidor manda; dinheiro não otimiza UI; acessível por padrão;
  `prefers-reduced-motion`).
- **`backup/README.md`** — estrutura e regras de uso da pasta de
  cópias de segurança locais (dump/restore, drill obrigatório, nada
  sensível no Git).

### Achados medidos no frontend (catálogo de design, §0)

Inspeção de `apps/web/` produziu 7 débitos concretos, **D-1 a D-7**:

| | Achado |
|---|---|
| D-1 | `color: var(--foreground)` em `globals.css:39` — variável nunca definida |
| D-2 | fonte: `--font-inter` injetada no `<html>` mas não lida; CSS usa a string `"Inter"` |
| D-3 | CSS e comentários de sidebar mortos (topbar opção B removeu a sidebar) |
| D-4 | 32 `<table>` escritos inline nas páginas |
| D-5 | nenhum `loading.tsx`/`error.tsx`/`not-found.tsx` no App Router |
| D-6 | `components/ui/` sem `Table`, `Modal`, `Select`, `Toast`, `Tabs` |
| D-7 | **contraste reprovado**: `text-amber-500`/branco = 2.15, `text-success-500`/branco = 2.49, `text-amber-600`/branco = 3.19 (AA = 4.5), em 194 usos de `text-primary`/`text-amber` |

### Alterado

- **`.gitignore`**: `/backup/*` ignorado com exceção de
  `!/backup/README.md` (mesmo padrão do `.env.example`). Testado:
  dump `.sql` simulado fica ignorado, o README não.
- **`docs/README.md`**: seção "Fora de `docs/` — pastas da raiz"
  indexando as duas pastas novas; `MELHORIAS.md` ganhou linha de
  escopo apontando o catálogo de design.

### Verificação

- 33 arquivos `.md`, 60 links relativos — **0 quebrados**.
- UTF-8 validado byte a byte nos arquivos novos (0 U+FFFD, 0 mojibake).
- Nenhum arquivo sensível versionado.

### Preservado

- Nenhum arquivo existente sobrescrito; `automação do whatsapp/`
  intocado; `AGENTS.md` intocado.

---

## [Akylla Gestão] - 2026-10-14 - Documentação: correção de erros factuais e banners

Segunda entrega única autorizada pelo proprietário (fora do roteiro
0–12). Auditoria da documentação encontrou erros factuais; este registro
os corrige nos documentos de **estado atual** e sinaliza os entregáveis
**datados**. Nenhum código de aplicação foi alterado.

### Alterado — fatos corrigidos

- **`docs/architecture/API.md`**: nova seção **Financial** (rotas reais
  de `financial.controller.ts`, incl. `AdminGuard` em `reverse`/`cancel`);
  webhook WhatsApp `/api/whatsapp/webhook` → **`/api/webhooks/whatsapp`**;
  templates: `PATCH /:id/approval` removido (não existe) e `status`
  corrigido para `ACTIVE`/`INACTIVE`; consents: `POST /consents`
  removido (não existe); adicionado `GET /templates/:id`.
- **`docs/architecture/DATABASE.md`**: roles `ADMIN`/`STAFF` →
  **`ADMIN`/`MEMBER`** (enum real `UserRole`); heading
  "Migrations e seeds" → "Migrations e dados iniciais".
- **`docs/architecture/ARCHITECTURE.md`**: worker descrito como stub →
  implementado (Etapa 6, fila WhatsApp); `database/` sem pasta de seeds.
- **`docs/operations/PROJECT_STATUS.md`**: evidências 509/509 →
  **538/538**; "CI e deploy" → só deploy/CD pendente.
- **`docs/operations/DEVELOPMENT.md`**: path do webhook corrigido.
- **`docs/akylla/CHECKLIST_PRE_PRODUCAO.md`**: `login-rate.limit.ts` →
  `login-rate-limit.ts`; linha "nenhum endpoint de upload" corrigida
  (existe `FileInterceptor` ≤ 5 MB em `imports`); defaults de
  `PASSWORD_RESET_ENABLED`/`REGISTRATION_ENABLED` agora refletem o
  `.env.example`; alvo do upgrade de vitest corrigido.
- **`README.md`**: "12 de 12 etapas" → **Etapas 0–12 (13 etapas)**;
  evidências 490 → 538; mapa de páginas com `/importacoes`.
- **Achado novo:** `npm audit --omit=dev` reporta **2 vulnerabilidades
  em produção** (`postcss` transitivo do `next`, alta) — a doc dizia
  "todas em dev-dependências". Corrigido em `CHECKLIST_PRE_PRODUCAO.md`
  (L1) e `AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md` (§21).
- **`docs/AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md`**: contagens
  (538/538 em 24 arquivos, 13 migrations, 39 páginas), migration
  `import_batch` na tabela, financeiro com estados `OPEN`/`PAID`/
  `CANCELLED` e rotas reais, upload documentado, webhook corrigido,
  papéis `ADMIN`/`MEMBER`, typecheck nos workspaces `apps/*`.

### Alterado — redução de duplicação

- **Fonte única das contagens correntes** = `PROJECT_STATUS.md`;
  `AKYLLA_COMPLETA` §17 e `CHECKLIST_PRE_PRODUCAO` §9 agora apontam
  para ela em vez de competir com o número.
- **`docs/README.md`**: AUDITORIA_MULTIEMPRESA não aparece mais em duas
  seções; entregáveis datados (Etapas 8–12 + redesign + importação)
  completam a tabela; seções separadas em "Produto (sempre atual)" e
  "Entregáveis de etapa".

### Alterado — banners de obsolescência

Banner curto no topo de: `PLANO_IMPORTACAO.md` (status
"AGUARDANDO APROVAÇÃO" → implementado), `PLANO_DE_ADAPTACAO.md`,
`MAPA_DE_MODULOS.md`, `MODELO_FINANCEIRO.md`, `PDV.md`,
`PLANO_BILLING.md` (enforcement implementado), `AUDITORIA_MULTIEMPRESA.md`,
`PLANO_MODULARIZACAO.md`, `REDESIGN_PAINEL.md`.

### Alterado — nomenclatura

- **Rename:** `docs/akylla_gestao_diretrizes_opencode.md` →
  **`docs/AKYLLA_GESTAO_DIRETRIZES_OPENCODE.md`** (padrão do repositório);
  7 referências atualizadas (`DIAGNOSTICO_INICIAL`, `PLANO_DE_ADAPTACAO`,
  `PRD` ×2, `PASSO_A_PASSO` ×2, `docs/README.md`). Banner no topo
  indicando que o §10 (plano 0–5) foi superado pelo roteiro 0–12.

### Verificação

- 51 links relativos verificados em 30 arquivos `.md` — **0 quebrados**.
- `npm run validate` completo: lint OK · typecheck OK · 538/538 ·
  build OK · db:validate OK.

### Preservado

- Histórico do CHANGELOG; `automação do whatsapp/`; conteúdo dos
  entregáveis datados (apenas banner e correções pontuais, sem reescrita).

---

## [Akylla Gestão] - 2026-10-14 - Reorganização estrutural do repositório

Tarefa autorizada pelo proprietário como entrega única (fora do roteiro
0–12). Fecha a migração de layout iniciada anteriormente e deixa a raiz,
o código e a documentação consistentes.

### Adicionado

- **`config/`** — `eslint.config.mjs` e `vitest.config.ts` movidos da
  raiz; o ESLint ganha bloco de globals para os scripts ESM de
  `scripts/`. Scripts da raiz apontam via `--config`.
- **`scripts/`** — `setup-dev.mjs` (`npm run setup:dev`: cria `.env`,
  `npm ci`, `db:generate`, `db:migrate`, `bootstrap:admin`),
  `db.mjs` (`npm run db -- reset|studio|seed|status`) e `validate.mjs`
  (`npm run validate`: lint → typecheck → test → build → db:validate).
- **`.github/`** — `workflows/ci.yml` (lint, typecheck, test com service
  container PostgreSQL 17, build, `db:validate` em push/PR),
  `workflows/cd.yml` (placeholder de staging/production) e
  `dependabot.yml` (npm + github-actions, semanal).
- **`tests/helpers/` + `tests/integration/`** — layout de testes
  organizado por papel; `helpers/global-setup.ts` e
  `helpers/setup-env.ts` passam a ser o `globalSetup`/`setupFiles` do
  Vitest; `helpers/mercadopago-mock.ts` recebe o
  `MockMercadoPagoProvider`.

### Alterado

- **Imports dos testes**: os 24 arquivos de `tests/integration/` ainda
  apontavam para o layout antigo (`./helpers/app`, `../apps/...`) —
  corrigidos para `../helpers/app` e `../../apps/...` (53 imports).
- **`apps/api/package.json`**: `@petflow/whatsapp` declarado em
  `dependencies` (era usado em 6 arquivos sem declaração) e `@types/node`
  em devDependencies.
- **API — organização**: `login-rate.limit.ts` → `login-rate-limit.ts`;
  `clientNameKey` extraído de `clients.service.ts` para
  `common/utils/client-name-key.ts` (remove import cruzado
  `whatsapp-templates → clients`); `tenant-limits.{module,service}.ts`
  saem de `billing/` para o módulo próprio `src/tenant-limits/`;
  imports de `crypto` padronizados em `node:crypto`.
- **`MockMercadoPagoProvider`** sai de
  `apps/api/src/billing/mercadopago-provider.ts` para
  `tests/helpers/mercadopago-mock.ts` (código de teste não é mais
  compilado no build de produção).
- **`.gitignore`**: cobre `.env.*` (exceto `!.env.example`), `.idea/` e
  `.vscode/` — antes, um `.env.production` seria versionado.
- **Documentação**: caminhos de teste atualizados em 14 documentos para
  `tests/integration/` e `tests/helpers/`; `database/README.md` com as
  13 migrations (última `import_batch`) e sem a pasta `seeds/`
  inexistente; `PLANO_IMPORTACAO.md` indexado em `docs/README.md`;
  CI descrita no `README.md`, `DEVELOPMENT.md`,
  `AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md` e na limitação L7 do
  `CHECKLIST_PRE_PRODUCAO.md`; `PROJECT_STATUS.md` com a nova entrega.

### Removido

- **`.env.local.example`** — redundante com `.env.example` (mesmas 29
  chaves); `setup-dev.mjs` usa apenas `.env.example`.
- **`eslint.config.mjs`, `vitest.config.ts` e os 26 arquivos de teste
  da raiz** (para `config/` e `tests/`).
- **Pastas vazias** `tests/e2e`, `tests/fixtures`, `tests/unit`.

### Corrigido

- **`cd.yml`** — `needs: [ci]` referenciava um job inexistente no mesmo
  workflow (o CI é outro arquivo); removido. O gate de deploy passa a
  ser o approval do Environment.

---

## [Akylla Gestão] - 2026-10-14 - Importação de planilhas (CSV)

Nova capacidade autorizada fora do roteiro 0–12, conforme
`docs/akylla/PLANO_IMPORTACAO.md` (decisões D1–D8 aprovadas).

### Adicionado

- **Modelo `ImportBatch`** + enums `ImportType` (CATEGORY, SUPPLIER,
  PRODUCT, CLIENT, SERVICE) e `ImportStatus` (COMPLETED, FAILED);
  migration aditiva `20261014114855_import_batch`.
- **Módulo da API** `apps/api/src/imports`:
  `GET /api/imports/template` (modelo CSV), `POST /api/imports`
  (upload multipart, `type` + `dryRun`) e `GET /api/imports`
  (histórico paginado) — todos `AdminGuard`, sem rota pública.
- **Regras de importação** em `imports.service.ts`: transação por lote
  (falha → rollback + `FAILED` fora da transação), skip de duplicidade
  por tipo (SKU/código de barras em produtos — nome não bloqueia),
  categoria/fornecedor referenciados por nome na planilha de produtos
  (inexistente → erro na linha, sem auto-criação — D7), estoque inicial
  gera `StockMovement IN`, delimitador `,`/`;` detectado, BOM UTF-8 e
  preços em formato BR, limites de 5 MB / 5000 linhas / 100
  `errorDetails`.
- **Checagem única de limites de plano (D8):** assinatura `ACTIVE` com
  `clientLimit`/`productLimit` excedidos → 403 "Limite do plano …";
  sem assinatura não há limite (regra preservada).
- **Schemas** `importTypeSchema`, `importUploadFormSchema`,
  `importReportSchema`, `importBatchSchema`, `listImportsQuerySchema`
  e templates em `@petflow/shared`.
- **UI `/importacoes`** (`apps/web/src/app/importacoes/page.tsx`):
  download do modelo, upload com dry-run, resultado com tabela de
  erros e histórico paginado; item "Importações" na navegação apenas
  para ADMIN (`Header.tsx`).
- **Testes** `tests/integration/imports.test.ts` (29 cenários: autorização, validação
  de arquivo, as 5 entidades, idempotência, dry-run, limites de plano,
  BOM/`;`, tenancy A×B, histórico); `resetDatabase` agora apaga
  `ImportBatch` antes de `user`.
- **413** para arquivo > 5 MB (`LIMIT_FILE_SIZE` tratado em
  `AllExceptionsFilter`).

### Dependências

- `csv-parse` e `multer` (workspace `@petflow/api`) + `@types/multer`
  (raiz) — justificativa: parse CSV robusto (delimiter/BOM/aspas) e
  upload multipart suportado nativamente pelo Nest.

## [Akylla Gestão] - 2026-10-13 - Reorganização da documentação

### Removido

- Pasta histórica de prompts de escopo do projeto anterior (8 arquivos)
  e o PRD do projeto anterior.
- Todas as menções à marca antiga nos documentos; `CHANGELOG.md` e
  `IMPLEMENTATION_CHECKLIST.md` reescritos cobrindo apenas a era Akylla
  (Etapas 0–12).

### Adicionado

- `docs/requirements/PRD.md` novo: PRD do **Akylla Gestão**, derivado das
  diretrizes do produto e do mapa de módulos aprovados.

### Alterado

- Marca padronizada como **Akylla Gestão** em `README.md`, `AGENTS.md`,
  `docs/README.md`, `PROJECT_STATUS.md`, docs de arquitetura e
  entregáveis de etapa.
- `package.json` (raiz): `name` e `description` atualizados para o
  produto atual.

### Nota

- Identificadores técnicos legados permanecem **no código** por decisão
  registrada e são documentados como compatibilidade técnica: cookie
  `petflow_session`, pacotes `@petflow/*`, bancos `petflow`/`petflow_test`,
  `service: "petflow-api"` e prefixo de comprovante `PF-`.
- Pasta `automação do whatsapp/` **não foi alterada** (base histórica
  preservada conforme `AGENTS.md`).

## [Akylla Gestão] - 2026-10-12 - Organização dos READMEs

### Alterado

- `database/README.md`: reescrito para Akylla (layout atual, 12
  migrations, bootstrap/seed via CLI da API, link para DATABASE.md);
  removidas referências legadas à marca anterior e ao texto "Etapa 0 sem
  tabelas".
- `README.md` (raiz): seção Documentação explicita papéis — raiz =
  vitrine do produto, `docs/README.md` = índice técnico; enxugada a
  tabela (lista completa no índice).
- `docs/README.md`: título e convenções deixam claro o papel de cada
  README.

### Removido

- `database/seeds/README.md` e pasta `database/seeds/` vazia (seeds
  reais são CLI: `bootstrap:admin` / `db:seed:demo`).
- `database/prisma/migrations/README.md` (boilerplate desatualizado;
  migrations documentadas em `database/README.md` e `DATABASE.md`).

### Nota

- `automação do whatsapp/README.md` preservado (base histórica).

## [Akylla Gestão] - 2026-10-12 - Organização da documentação

### Adicionado

- `docs/README.md`: índice único da documentação, organizado por
  finalidade (estado atual, produto, arquitetura, operação, histórico
  das etapas, requisitos) com ordem de leitura sugerida.

### Alterado

- `README.md`: status corrigido para 12/12 etapas; tabela de
  documentação atualizada (PDV, checklist pré-produção, doc técnica
  completa); link para o índice.
- `docs/akylla/REDESIGN_PAINEL.md`: estado atual (topbar B) no topo;
  proposta de sidebar marcada como histórica; §12 documenta a
  evolução fase 1 → fase 2 (opção B).
- `docs/AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md` §16: seção de layout
  global (topbar B) antes do mapa de páginas.

## [Akylla Gestão] - 2026-10-12 - Layout B: topbar única (sem sidebar)

### Alterado

- **Layout global trocado para o paradigma B** (topbar escura única,
  sem sidebar), decisão do proprietário entre as opções apresentadas.
- `Header.tsx` reescrito como **TopNav**: barra escura (slate-900) com
  logo, links diretos (Início, Dashboard), **menus dropdown agrupados**
  (Operação, Estoque, Relacionamento, Gestão, Administração), busca
  global (produtos/clientes/pets/serviços/vendas), sino de
  notificações e menu de perfil — tudo no mesmo chrome superior.
- **Menu mobile**: painel acordeão sob a topbar (mesmos grupos e
  filtros de módulo/permissão).
- Breadcrumb em barra fina sob a topbar (desktop).
- `AppShell`: conteúdo full-width com `max-w-[1440px]` centralizado;
  removido padding lateral da sidebar e estado de colapso.
- Removido `Sidebar.tsx` (substituído pelo topbar; nenhum
  funcionalidade perdida).

### Validações

- lint 0 · typecheck OK · 509/509 testes · build OK.

## [Akylla Gestão] - 2026-10-12 - Continuação da reformulação do painel

### Alterado

- **Busca global** do header agora inclui **pets** e **serviços** além
  de produtos, clientes e vendas (receiptCode).
- **Notificações** recarregadas ao abrir o sino (além do load inicial do
  shell) — contagem sempre atual no clique.
- `/produtos` e `/clientes` leem `?search=` da URL na carga inicial —
  "Ver todos os resultados" da busca global pré-preenche o filtro da
  página de listagem.

### Validações

- lint 0 · typecheck OK · 509/509 testes · build OK.

## [Akylla Gestão] - 2026-10-12 - Reformulação profissional do painel

### Alterado

- **Sidebar** reorganizada em 6 grupos (somente páginas reais): Visão
  geral (Início, Dashboard) · Operação (PDV, Vendas, Caixa, Financeiro,
  Serviços, Agenda) · Estoque e compras (Produtos, Categorias,
  Fornecedores) · Relacionamento (Clientes, Pets, WhatsApp,
  Assinaturas) · Gestão (Relatórios) · Administração (Usuários,
  Faturamento, Planos). Removida entrada duplicada "Estoque" →
  `/produtos`. Destaque de página ativa (`aria-current`).
- **Sidebar recolhível** no desktop (260 px ↔ 72 px, só ícones) com
  persistência em `localStorage` (`akylla:sidebar-collapsed`); drawer
  mobile com overlay e botão fechar.
- **Header** com busca global (debounce 300 ms → produtos, clientes,
  vendas por receiptCode com navegação aos detalhes), sino de
  notificações (estoque sem saldo / abaixo do mínimo + contas a
  receber/pagar vencidas, com links), menu de perfil (nome, papel,
  sair) e botão hambúrguer no mobile. Data no canto (xl+).
- **Dashboard** com KPIs de gestão: Vendas, Recebido, Pago, A receber
  (destaca vencidas), A pagar, Saldo do caixa; faixa compacta
  (pedidos, canceladas, ticket médio, clientes novos, vencidas,
  resultado); alertas de estoque baixo e contas vencidas; próximos
  agendamentos (14 dias, SCHEDULED/CONFIRMED); atividades recentes
  (últimas vendas); atalhos (PDV, produto, agenda, clientes, caixa,
  relatórios); saúde do caixa com recebido/pago; WhatsApp. Período,
  combo chart e donut mantidos.
- `AppShell` gerencia colapso/drawer e padding dinâmico do conteúdo;
  main com padding responsivo (`px-4` → `xl:px-8`).

### Notas

- Remote real: `Tanattos18/Akylla-Gestao.git` (remoto anterior
  descontinuado).
- Nenhuma API, regra de negócio, migration ou permissão alterada.
- Validações: lint 0 · typecheck OK · 509/509 testes · build OK.

## [Akylla Gestão] - 2026-10-12 - Documentação — Módulo PDV

### Adicionado

- `docs/akylla/PDV.md`: **documento funcional do Ponto de Venda** —
  fluxo da tela `/pdv`, API (`POST/GET /api/sales`,
  `POST /api/sales/:id/cancel`), regras de negócio (preço no servidor,
  idempotência por `clientRequestId`, lock de caixa → produtos,
  snapshot de itens), modelo de dados (`Sale`/`SaleItem`), comprovante e
  impressão de cupom, integração com caixa/estoque/financeiro,
  permissões (cancelar = ADMIN), garantias de testes e limitações
  conhecidas (L1–L9, sem NFC-e/adquirente/conciliação).

## [Akylla Gestão] - 2026-10-12 - Redesign do painel de gestão (implementado)

### Adicionado

- Sidebar escura (slate-900) + Header com breadcrumb + AppShell
  (`components/shell/`) — rotas de auth sem shell.
- Design tokens `@theme` Tailwind v4: primária amber, sidebar, sucesso
  teal, fonte Inter via `next/font/google`.
- Componentes UI (`components/ui/`): Card, Button, Input/Textarea/
  Select, Badge, StatCard, EmptyState, Skeleton, **ComboChart** (barras
  + linha SVG), **DonutChart** (distribuição %), **Progress**.
- Dashboard redesenhado inspirado no `DimersonJr/dashboard-supermercado`
  (Power BI): 6 KPIs (Vendas, Pedidos, Ticket médio, Clientes novos, A
  receber, A pagar), combo chart (vendas/dia + ticket médio/dia), donut
  de formas de pagamento, saúde do caixa (entradas vs saídas), widgets
  (Catálogo, Estoque, Agenda, WhatsApp).
- `formatBrlCompact` para eixos de gráfico; alias `@/*` no tsconfig web.

### Alterado

- Migração `teal-*` → `primary-*` em 56 arquivos (~232 ocorrências).
- `docs/akylla/REDESIGN_PAINEL.md` marcado como IMPLEMENTADO (R1–R6).

## [Akylla Gestão] - 2026-10-12 - Documentação — Redesign do painel (proposta)

### Adicionado

- `docs/akylla/REDESIGN_PAINEL.md`: **proposta visual do painel de
  gestão** — layout com sidebar fixa escura + header com breadcrumb/data/
  avatar + dashboard redesenhado (KPIs, gráfico de atividade, widgets,
  atividade recente). Diagnóstico do estado atual (sem sidebar, sem
  design system, teal inline em ~40 arquivos), design tokens
  (`@theme` Tailwind v4 com cor primária amber), componentes a criar
  (`components/ui/`), plano de implementação em 5 fases e 6 decisões de
  aprovação (R1–R6) aguardando proprietário. **Nenhum código alterado.**

## [Akylla Gestão] - 2026-10-12 - Etapa 12 — Qualidade, segurança e preparação para produção

### Adicionado

- `docs/akylla/CHECKLIST_PRE_PRODUCAO.md`: **entregável da etapa** —
  evidências de qualidade (lint 0 · typecheck OK · **509/509 testes** ·
  build OK · db:validate OK), revisão de segurança (segredos, logs,
  auth, autorização, tenant, uploads, exportações, webhooks), limitações
  conhecidas classificadas (L1–L14, preexistentes), ambientes
  (dev/teste/produção), variáveis de ambiente sem segredos, estimativa
  de custos de hospedagem (R$ 55–250/mês conforme opção), checklist de
  itens obrigatórios antes da comercialização e **decisão recomendada:
  não declarar pronto para produção** (faltam backups com restore
  testado, LGPD, CI, monitoramento, E2E Mercado Pago e resolução de
  vulnerabilidades de dev-dependencies).

### Notas

- Nenhuma regressão introduzida pela adaptação (509 testes verdes).
- 8 vulnerabilidades `npm audit` preexistentes — todas em
  dependências de desenvolvimento (vitest/esbuild/postcss/tinypool);
  correção exige upgrade do vitest (breaking change, janela dedicada).
- Roteiro Akylla Gestão (Etapas 0–12) **concluído**. Deploy proibido
  sem aprovação explícita do proprietário.

## [Akylla Gestão] - 2026-10-12 - Etapa 11 — Planos e assinatura SaaS

### Adicionado

- `docs/akylla/PLANO_BILLING.md`: **entregável da etapa** — separação
  billing-SaaS × assinaturas de negócio, estado atual dos modelos,
  lacunas, avaliação de gateway, proposta de limites e plano de
  implementação. Decisões D1–D4 registradas pelo proprietário.
- **Decisão D1 — planos do seed mantidos** (Essencial R$ 79,90/3 usuários ·
  Profissional R$ 149,90/10 usuários · Completo R$ 249,90/ilimitado;
  30 dias). Não publicados fora do sistema.
- **Decisão D2 — todos os limites** (`userLimit`/`clientLimit`/
  `productLimit` em `TenantPlan`, `NULL` = ilimitado): Essencial
  3/200/100; Profissional 10/1000/500; Completo ilimitado. Migration
  `database/prisma/migrations/20261012173450_tenant_plan_limits` aplica
  colunas + UPDATE dos planos seed.
- **Decisão D3 — enforcement só com assinatura ACTIVE** (status quo):
  `TenantLimitsService` (`apps/api/src/billing/tenant-limits.service.ts`)
  verifica limites no `create` de Users/Clients/Products apenas quando a
  empresa tem `TenantSubscription` com status `ACTIVE`; sem assinatura,
  expirada ou cancelada — nenhum bloqueio. 403 com nome do plano e
  limite atingido. Módulo `TenantLimitsModule` injetado em
  UsersModule/ClientsModule/ProductsModule.
- **Decisão D4 — gateway Mercado Pago (sandbox)**: SDK oficial
  `mercadopago` (npm workspace `@petflow/api`); provider
  `mercadopago-provider.ts` (mock/Failing/Sdk) com override para testes;
  `MercadoPagoService` (`POST /api/billing/checkout` cria preapproval e
  vincula `gateway`/`gatewaySubscriptionId` na assinatura, status
  `EXPIRED` até webhook confirmar pagamento); webhook
  `POST /api/webhooks/mercadopago` (`@Public` + assinatura HMAC
  `x-signature` verificada com `MERCADOPAGO_WEBHOOK_SECRET`, idempotente
  por `gatewaySubscriptionId`); `GET /api/billing/gateway` descreve
  ambiente e presença de credenciais. Sem `MERCADOPAGO_ACCESS_TOKEN`, o
  checkout retorna 400 com mensagem explícita (nunca cobra por engano).
- Env vars (`MERCADOPAGO_ENV`/`_ACCESS_TOKEN`/`_PUBLIC_KEY`/
  `_WEBHOOK_SECRET`) em `env.ts` e `.env.example` (sem segredos reais).
- Schema compartilhado `createCheckoutSchema` (`planId`, `payerEmail`).
- `TenantPlan.userLimit/clientLimit/productLimit` e
  `TenantSubscription.gateway/gatewaySubscriptionId @unique` no Prisma
  schema e no `planSelect`/`subscriptionSelect` do billing service.
- Testes: `tests/integration/tenant-limits.test.ts` (7 — sem assinatura, ativa no
  Essencial bloqueia 4º usuário, cliente limite ajustado, Completo sem
  trava, EXPIRED/CANCELLED sem trava, isolamento cross-tenant) e
  `tests/integration/mercadopago.test.ts` (12 — checkout admin/member/anon, plano
  inexistente, sem credenciais, webhook assinado ativa, idempotência,
  cancelamento, gateway desconhecido, tipo diferente, describe).
  Suíte completa: **509 testes, 23 arquivos, 0 falhas**.

### Alterado

- `UsersService.create`/`ClientsService.create`/`ProductsService.create`
  chamam `limits.assertCanCreate` antes do insert.
- `BillingController` ganha `POST /checkout` e `GET /gateway`
  (ambos `AdminGuard`); `BillingModule` registra `MercadoPagoService` e
  `MercadoPagoWebhookController`; importa `PrismaModule`.
- `docs/architecture/DATABASE.md` e `docs/architecture/API.md`
  atualizados (novas colunas, rotas e comportamentos).

### Notas

- Cobrança recorrente real **não ativada**: sandbox por padrão; ativação
  exige testes E2E em sandbox com cartão de teste do Mercado Pago +
  aprovação do proprietário (instrução 7 da Etapa 11).
- Escrita do catálogo global de planos continua pendente (exige papel de
  plataforma — fora do escopo desta etapa).
- UI `/faturamento` ainda não exibe limites/uso — pendência registrada.

## [Akylla Gestão] - 2026-10-12 - Etapa 10 — Módulos de pet shop (modularização)

### Adicionado

- `docs/akylla/PLANO_MODULARIZACAO.md`: **entregável da etapa** — plano
  de modularização com impacto e reversão, baseado em mapeamento de
  dependências com evidência `file:line` (rotas, tabelas, FKs Restrict,
  testes, relatórios). Recomendação por módulo: **pets** = opcional de
  nicho, fora da navegação inicial (sem exclusão); **agenda, serviços,
  WhatsApp e assinaturas de clientes** = reutilizar de forma genérica;
  **seed "Mundo Pet"** = reescrever com dados de comércio variado após
  aprovação (etapa futura).
- **Ativação por segmento — decisão D3 = opção B, implementada**
  (autorização do proprietário em 2026-10-12): migration aditiva
  `database/prisma/migrations/20261012154010_company_module` (enums
  `BusinessModule`/`CompanyModuleStatus` + tabela `CompanyModule`,
  `@@unique([companyId, module])`); **`ModuleGuard`** (APP_GUARD após
  `AuthGuard`) retorna 403 para rotas de módulos `DISABLED`
  (`@RequireModule` em pets, services, appointments, whatsapp
  config/templates/consents/messages, subscriptions e
  subscription-plans; webhook permanece `@Public`); API
  `GET /api/company-modules` (sessão) e `PATCH /api/company-modules`
  (`AdminGuard`, upsert); home oculta cards de módulos desativados
  (`plannedModules` com `module` + fetch em `/api/company-modules`).
  Ausência de linha = módulo ativo (nenhuma empresa existente muda de
  comportamento); núcleo nunca é desativável. `DATABASE.md` e `API.md`
  atualizados.
- `tests/integration/company-modules.test.ts` (**+13 testes**): listagem padrão
  (5 módulos ACTIVE), AdminGuard (400 inválido, 403 para MEMBER),
  upsert idempotente, bloqueio 403 das rotas do módulo desativado,
  isolamento cross-tenant, núcleo nunca bloqueado, webhook público
  assinado não recebe 403 de módulo e agenda acessível com WhatsApp
  desativado; `resetDatabase` apaga `companyModule`.

### Alterado

- **Rótulo do lembrete generalizado** (MAPA item 21, escopo da Etapa 10):
  mensagem de erro da API (`whatsapp-config.service.ts:88`) e ajuda da UI
  (`whatsapp/page.tsx:373`) agora descrevem `{{1}}` como **cliente** em
  vez de "tutor/pet". O comportamento de `{{1}}`
  (`pet?.name || client.name`) e a exigência de 3 variáveis
  (`APPOINTMENT_REMINDER_VARIABLE_COUNT`) não mudaram — só o texto.
  Grep `tutor` em `apps/`, `packages/` e `tests/` = 0.
- `docs/akylla/MAPA_DE_MODULOS.md`: §6.2, §6.3 e §7 atualizados —
  **D2 CONFIRMADA** (nenhuma exclusão) e **D3 DECIDIDA: opção B**
  (implementada na etapa).

### Decisões do proprietário (2026-10-12)

- **D2 — confirmada**: recomendações por módulo do plano (nenhuma
  exclusão; seed reescrito só em etapa futura com nova aprovação).
- **D3 — opção B escolhida** (tabela `CompanyModule` + guard no
  backend), implementada nesta etapa com migration aditiva autorizada.

## [Akylla Gestão] - 2026-10-12 - Etapa 9 — Dashboard e relatórios

### Adicionado

- `docs/akylla/DICIONARIO_INDICADORES.md`: **entregável da etapa** —
  dicionário completo dos indicadores (definição exata, fórmula, fonte
  no banco, período, estado vazio e consulta SQL de rastreabilidade),
  cobrindo os 4 exigidos pelo roteiro (**faturamento** =
  `reports/summary.sales.net`; **receita recebida** =
  `financial/summary.paidInTotal`; **contas vencidas** =
  `overdueReceivables/Payables`; **saldo de caixa** =
  `openSession.expectedBalance` e `cash/summary.net`), a separação
  conceitual entre eles e a separação billing-SaaS × financeiro do
  cliente, mais as regras de CSV/paginação/gráficos.
- `tests/integration/reports.test.ts` (**+3 testes**): **empresa vazia** (summary,
  vendas, clientes, `financial/summary` e `cash/summary` zerados sem
  inventar números, `ticketAverage: null`); **CSV com caracteres
  especiais** (acentos, vírgulas, aspas duplas escapadas, quebra de
  linha, fórmulas `=`/`@` e fórmula **após espaço inicial** neutralizadas
  com apóstrofo); **coerência indicadores × dados-fonte** (vendas,
  clientes, estoque, WhatsApp, títulos AP/AR e entradas de caixa
  conferidos contra o banco via Prisma).

### Alterado

- **Indicadores de nicho removidos (genéricos)**: `clients.newPets` sai
  do `summary` do dashboard; `newPets` e `petsBySpecies` saem de
  `GET /api/reports/clients` — substituídos pelos já existentes
  `newClients` (clientes novos), vendas e estoque (PLANO §9). UI: card
  "Novos clientes" do `/dashboard` e aba Clientes do `/relatorios`
  perderam "Novos pets"/"Novos pets por espécie"; DTOs
  (`DashboardSummaryDto.clients`, `ClientsReportDto`) atualizados.
  Modelos `Pet`/`PetSpecies` intactos (destino na Etapa 10).
- `apps/api/src/common/utils/csv.ts`: proteção de injeção agora também
  neutraliza sinal de fórmula **após espaço inicial** (`" =1+1"`),
  mantendo a cobertura original de `= + - @ TAB CR`.
- `docs/architecture/API.md`: prefixo de arquivo CSV corrigido para
  `akylla_*`, descrição da neutralização atualizada, seção de
  relatórios sem menção a pets e link para o dicionário.

### Verificado

- `lint` 0 → `typecheck` OK → **477/477 testes** (20 arquivos; +3
  novos, 5 assertions atualizados para o fim do nicho) → `build` OK →
  `db:validate` OK (nenhuma migration na etapa).

## [Akylla Gestão] - 2026-10-12 - Etapa 8 — Financeiro básico (AP/AR)

### Adicionado

- `docs/akylla/MODELO_FINANCEIRO.md`: detalhamento prévio aprovado —
  inspeção do modelo atual, 6 conceitos separados (títulos → liquidação
  → caixa → fluxo previsto/realizado → billing), modelo `FinancialEntry`,
  transições de status só no servidor (`OVERDUE` derivado), escopo
  aditivo da migration e plano de reversão; decisões D1 (modelo único
  com `direction`), D2 (venda vira caixa, sem título liquidado), D3
  (origem `ACCOUNT`) e D4 (aprovação da migration) registradas.
- **Schema** (`database/prisma/schema.prisma`): enums
  `FinancialDirection`/`FinancialStatus`/`FinancialOrigin`;
  `CashMovementOrigin` ganha `ACCOUNT`; modelo `FinancialEntry`
  (`Decimal(12,2)`, contrapartes `SetNull`, `@@unique([companyId,
  origin, originId])`, `@@unique([companyId, clientRequestId])`,
  4 índices por empresa, `createdByUserId` `Restrict`); relações
  inversas em `Company`/`Category`/`Supplier`/`Client`/`CashMovement`/
  `User`.
- **Migration** `20261012164040_financial_entry` (aditiva: 3
  `CREATE TYPE`, `ALTER TYPE ... ADD VALUE 'ACCOUNT'`, `CREATE TABLE`,
  índices e FKs; coluna `clientRequestId` + unique index incluídos na
  migration); aplicada em `petflow` (dev) e `npm run db:validate` OK.
- **Schemas Zod** em `@petflow/shared`: `financialDirectionSchema`,
  `financialStatusSchema`, labels, `createFinancialEntrySchema`
  (description 2..200, `positivePriceFieldSchema`, `dateField`,
  contrapartes opcionais, `clientRequestId` 8..64),
  `updateFinancialEntrySchema` (parcial, sem `direction`/
  `clientRequestId`), `financialReasonSchema` (motivo 3..500),
  `listFinancialQuerySchema` (direção/status/search/período +
  paginação), `financialSummaryQuerySchema`; `cashMovementOriginSchema`
  e `cashMovementOriginLabels` ganham `ACCOUNT`.
- **Módulo API** `apps/api/src/financial` (`FinancialModule`, com
  `@Inject()` explícito): `POST /api/financial` (201; valida
  contrapartes da empresa → 400; `P2002` → 409), `GET /api/financial`
  (direção/status/período/search + paginação), `GET /financial/summary`
  (abertos, vencidos, liquidados e cancelados — calculado no
  servidor), `GET/PATCH /:id` (só `OPEN` → 409), `POST /:id/pay`
  (transação `OPEN → PAID` + `lockOpenCashSession` → 409 se fechado +
  movimento `ACCOUNT` `IN`/`OUT`), `POST /:id/reverse` e `POST
  /:id/cancel` (`AdminGuard`, motivo obrigatório → 400, duplo → 409);
  cross-tenant → 404.
- **UI** `/financeiro` com abas **Resumo | A pagar | A receber**:
  resumo ganha cards de títulos abertos/vencidos/liquidados no período;
  novo componente `apps/web/src/components/FinancialEntries.tsx`
  (criar/editar/liquidar, cancelar/estornar para admin, filtros por
  status, paginação, badge "Vencido"); DTOs financeiros em
  `apps/web/src/lib/types.ts`.
- `tests/integration/financial.test.ts` (**+30 testes**): criação e validações
  (valor/3 casas, zero, negativo, data fora de formato, contraparte
  inválida, idempotência `clientRequestId` → 409), liquidação e saldos
  (`/cash/summary` coerente, movimento `ACCOUNT`, membro pode liquidar,
  dupla liquidação → 409, caixa fechado → 409), cancelamento/estorno
  auditáveis (motivo registrado no banco, 400 sem motivo, 403 membro,
  409 em estado inválido, movimento `REVERSAL` compensatório), filtros
  por período/status, isolamento A×B (leitura/escrita/resumo → 404/0) e
  arredondamento/decimais (12,2, `toFixed(2)`).

### Corrigido

- `apps/api/src/financial/financial.service.ts`: no `summary`,
  `dueRange`/`paidRange` colidiam na chave do filtro (o `to`
  sobrescrevia o `from`), ignorando o limite inferior do período.
- `tests/helpers/app.ts`: `resetDatabase` agora apaga `FinancialEntry`
  antes de `user` (FK `Restrict` em `createdByUserId`) — sem isso
  nenhum teste iniciava após a nova tabela.

### Verificado

- `lint` 0 → `typecheck` OK → **474/474 testes** (20 arquivos; +30
  novos) → `build` OK → `db:validate` OK.

## [Akylla Gestão] - 2026-10-12 - Etapa 8 — detalhamento (aprovado)

### Adicionado (detalhamento; sem alteração de código)

- `docs/akylla/MODELO_FINANCEIRO.md`: detalhamento prévio exigido pelo
  roteiro — inspeção do modelo atual, 6 conceitos separados (títulos →
  liquidação → caixa → fluxo previsto/realizado → billing), modelo
  Prisma `FinancialEntry` (Decimal 12,2, contrapartes SetNull, unique
  `(companyId, origin, originId)`), transições de status só no servidor
  (`OVERDUE` derivado, não armazenado), relação com o caixa
  (`CashMovement` da venda = registro de recebimento), 6 testes
  planejados, escopo **aditivo** da migration e plano de reversão.
- **Decisões D1–D4** submetidas e aprovadas pelo proprietário:
  modelo único `direction`, venda só no caixa, origem `ACCOUNT`,
  aprovação da migration aditiva.

## [Akylla Gestão] - 2026-10-12 - Etapa 7 — Vendas e recebimentos

### Adicionado

- `docs/akylla/LIMITACOES_VENDAS.md`: **entregável** da etapa — fluxo
  validado item a item do roteiro com evidências `[Código]/[Teste]`,
  cobertura dos 7 testes exigidos e **lista explícita de 9 limitações**
  (sem fiscal/adquirente/conciliação, cancelamento total apenas, uma
  forma de pagamento por venda, venda exige caixa aberto, origem MANUAL
  em pagamentos de assinatura, estoque sem chave de idempotência, sem
  lote/validade, sem PDV offline, recibo comercial `PF-`).

### Verificado (sem alteração de código)

- Itens 1–9 do roteiro confirmados no código (recálculo no servidor,
  transação única venda+itens+estoque+caixa, snapshots, idempotência
  `clientRequestId`, cancelamento auditável com devolução única,
  nenhuma menção a fiscal/adquirente na UI).
- **Decisão de caixa: mantida abertura/fechamento por turno** (regra
  original; não alterada silenciosamente conforme roteiro).

### Verificado

- `lint` 0 · `typecheck` OK · **444/444 testes** (sem variação — etapa
  de conferência/entregável documental).

## [Akylla Gestão] - 2026-10-12 - Etapa 6 — Produtos, categorias e estoque

### Corrigido

- `apps/api/src/products/products.service.ts`: filtro `lowStock` da
  listagem agora exige `minimumStock > 0` (antes, produto com mínimo 0 e
  saldo 0 era listado como "estoque baixo", divergindo do endpoint
  `/stock/low-stock` e do flag `lowStock` por item).

### Adicionado

- `tests/integration/stock.test.ts` (+2): **requisição repetida** de movimento gera
  movimentos independentes, mantém saldo coerente e nunca deixa saldo
  negativo (terceira tentativa → 400); filtro `lowStock` exclui produtos
  **sem estoque mínimo configurado** (regressão da correção acima).

### Verificado (sem alteração de código)

- Unicidade de SKU/código de barras **por empresa** (`@@unique([companyId,
  sku])`/`[companyId, barcode]`) + testes de conflito;
- categoria/fornecedor de outra empresa rejeitados (400) + testes;
- recálculo de saldo no servidor dentro de transação com `FOR UPDATE`
  (saídas concorrentes aprovadas=1/rejeitadas=4);
- histórico auditável (autor, motivo, referência, data);
- bloqueio de saldo negativo (saída e ajuste);
- precisão decimal: preços 2 casas, quantidades 3 casas (`decimalField(3)`,
  aceita fracionárias);
- alerta de estoque mínimo: endpoint `low-stock`, flag por item e UI
  (banner + filtro + badges) com dados reais;
- rótulos de produtos/categorias/fornecedores sem textos de nicho;
- limitação registrada: movimentos de estoque **não têm chave de
  idempotência** (coluna nova exigiria migration — decisão futura).

### Verificado

- `lint` 0 · `typecheck` OK · **444/444 testes** (+2).

## [Akylla Gestão] - 2026-10-12 - Etapa 5 — Cadastros, clientes e fornecedores

### Alterado

- `apps/api/src/suppliers/suppliers.service.ts`: busca de fornecedores
  ampliada de apenas nome para **nome, email, telefone e documento**
  (paridade com clientes; roteiro, instrução 7 — filtros).

### Adicionado

- `tests/integration/clients.test.ts` (+2): criação de cliente somente com nome
  (CPF/telefone/email não obrigatórios) e **inativação preserva histórico
  de vendas** (venda com cliente → inativar → ficha com `_count.sales` e
  venda consultável).
- `tests/integration/catalog.test.ts` (+4): fornecedor somente com nome, busca por
  email/telefone/documento, paginação e **inativação preserva produtos
  vinculados**.

### Verificado (sem alteração de código)

- Formulários de clientes/fornecedores/categorias **genéricos**: apenas
  nome obrigatório; CPF validado quando preenchido (11 dígitos), nunca
  obrigatório; sem textos de nicho (`grep cachorro|gato|raça|tutor|banho|
  tosa` vazio).
- Duplicidade: bloqueia apenas nome+contato iguais entre ativos;
  homônimos e contatos compartilhados permitidos; inativos não bloqueiam.
- Inativação por status (sem DELETE): FKs `Restrict`/`SetNull` preservam
  vendas, produtos e histórico.
- Isolamento por tenant confirmado (tenancy-audit + CRUD próprio).
- Elementos de navegação de pets na tela de clientes diferidos para a
  **Etapa 10** (conforme MAPA_DE_MODULOS §6.2 — decisão do proprietário).

### Verificado

- `lint` 0 · `typecheck` OK · **442/442 testes** (+6).
- Commits por etapa (aprovado pelo proprietário): Etapa 4 e Etapa 5
  separados; push para `main`.

## [Akylla Gestão] - 2026-10-12 - Etapa 4 — Definição do núcleo genérico

### Adicionado

- `docs/akylla/MAPA_DE_MODULOS.md`: matriz de classificação dos 23 itens
  do inventário nas 4 categorias do roteiro (núcleo comum · opcional
  futuro genérico · específico de pet shop · obsoleto/duplicado), com
  localização, dependências (API/UI/models/testes), evidências
  `[Código]/[Teste]`, destino recomendado e conferência de completude
  (22/22 controllers, 25/25 models, 38/38 páginas, 19/19 arquivos de
  teste).
- Diferenciação billing SaaS da Akylla × financeiro da empresa cliente;
  registro das decisões futuras de navegação, destino do pet shop e
  **opções de ativação por segmento (somente documentação — Decisão 2)**.

### Notas

- Etapa de análise/documentação: **nenhum código, teste, schema,
  migration, dado ou configuração alterado**; nenhum módulo excluído,
  ocultado, renomeado ou migrado; nenhuma dependência adicionada.
- Pendências registradas: D1 (construção de "configurações da empresa" —
  etapa a definir), D2/D3 (destino do pet shop e ativação por segmento →
  Etapa 10), D4 (confirmação da leitura de opcionais genéricos).

### Verificado

- `lint` 0 · `typecheck` OK · **436/436 testes** (sem variação em
  relação à Etapa 3) · `git status` restrito a arquivos de documentação.
- Conclusão da etapa **pendente de revisão e aprovação da matriz pelo
  proprietário** (Etapa 5 não iniciada).

## [Akylla Gestão] - 2026-10-12 - Etapa 3 — Auditoria multiempresa e permissões

### Adicionado

- `tests/integration/tenancy-audit.test.ts` (+56 cenários Empresa Alfa × Empresa Bravo):
  identificação do tenant pela sessão, injeção de `companyId`
  (corpo/query/cabeçalho), leitura cruzada por ID (18 recursos), escrita
  cruzada com verificação pós-condição no banco, referências FK de outra
  empresa rejeitadas, relatórios/CSV por empresa, perfis ADMIN × MEMBER e
  ausência de dados de B em respostas de erro.
- `docs/akylla/AUDITORIA_MULTIEMPRESA.md`: relatório completo (escopo,
  matriz A×B, permissões, evidências, riscos e recomendações).

### Verificado

- Suíte completa **436/436 aprovados** (base 380 + 56 novos; nenhum teste
  existente alterado), `lint` 0, `typecheck` OK, `build` OK.
- **Nenhuma falha de isolamento entre empresas nem de autorização por
  perfil confirmada.** Comportamentos intencionais documentados (MEMBER na
  operação diária, planos SaaS globais, consentimento `OPTED_IN` restrito a
  ADMIN). Nenhuma correção de segurança implementada (etapa de auditoria).

## [Akylla Gestão] - 2026-10-12 - Etapa 2 — Identidade

### Alterado

- Produto renomeado visualmente para **Akylla Gestão** ("Gestão para
  pequenos negócios"): `layout.tsx` (título/metadados/subtítulo/rodapé;
  removidos o emoji de pata e o badge "Etapa 9"), `/login`, `/cadastro`,
  `/faturamento` (3 textos), cards da home ("Clientes", "Agendamentos",
  "Faturamento"), `Receipt.tsx`, fallbacks de impressão em `/pdv` e
  `/vendas/[id]`, log de boot da API e constante `APP_NAME`
  (`@petflow/shared`).
- Exportações CSV: prefixos padronizados em `akylla_*` (servidor em
  `reports.service.ts` e nomes de fallback em `/relatorios`); asserção
  correspondente atualizada em `tests/integration/reports.test.ts` (mesma cobertura).
- Moeda no comprovante impresso (`Receipt.tsx`, `lib/print.ts`)
  padronizada em BRL via `formatBrl()` (antes `R$ x.xx` com ponto).
- Textos de nicho removidos de módulos genéricos (card "Clientes e
  animais" → "Clientes"; "banho e tosa" → "atendimentos"; placeholder de
  template neutro). Exemplos do CLI `bootstrap-admin` genéricos.

### Preservado (de propósito)

- Identificadores internos `@petflow/*`, cookie `petflow_session`,
  `service: "petflow-api"`, nome legado do fixture do provedor mock,
  prefixo de
  comprovante `PF-`, bancos/tabelas/migrations, pasta legada
  `automação do whatsapp/`, seed de demonstração. Nenhum módulo excluído;
  nenhum item removido da navegação (análise em
  `docs/akylla/IDENTIDADE_E_NAVEGACAO.md`).

### Verificado

- `lint` 0 erros · `typecheck` OK · **380/380 testes aprovados** · `build`
  OK · `db:validate` OK (linha de base da Etapa 1 reproduzida sem falhas).

