# Onboarding por perfil — regras (Fase 4)

> Depois de criar a conta, o cliente escolhe o perfil do negócio e o
> Akylla liga os módulos certos. Atende à promessa do site de um sistema
> para comércio, serviços ou os dois.

## Perfis (`OnboardingPreset`, dados de referência da migration)

| Perfil | Módulos ligados | Extra |
|---|---|---|
| **Comércio** (`COMERCIO`) | Nota fiscal, Comissões, Crediário, WhatsApp | cria a configuração fiscal (emissora simulada, **inativa**) |
| **Serviços** (`SERVICOS`) | Serviços, Agendamentos, Ordens de serviço, WhatsApp, Comissões | — |
| **Comércio e serviços** (`HIBRIDO`) | Serviços, Agendamentos, Ordens de serviço, Comissões, Crediário, WhatsApp | — |
| **Personalizado** (`PERSONALIZADO`) | não mexe nos módulos | leva a Configurações |

PDV, estoque, caixa, financeiro, clientes e relatórios são o núcleo e
estão sempre disponíveis. O catálogo de perfis é **global** (sem
`companyId`, sem RLS) e só é alterado por migration.

## Regras

- Só **ADMIN** aplica o perfil (`POST /api/onboarding/apply`); MEMBER → 403.
- **Idempotente:** módulos do perfil → ACTIVE e demais → DISABLED (linha
  explícita em `CompanyModule`). Reaplicar não duplica nada; trocar de
  perfil é permitido a qualquer momento.
- Desligar um módulo **não apaga dados**: só esconde o menu e bloqueia as
  rotas (`ModuleGuard`).
- Grava `Company.segment` e `Company.onboardingCompletedAt`. Empresas que
  já existiam antes da Fase 4 foram marcadas como concluídas na migration
  (não são forçadas a passar pelo onboarding).
- O onboarding **não bloqueia** o uso: a tela inicial mostra um aviso ao
  ADMIN enquanto o perfil não for escolhido, e "Pular por enquanto" está
  sempre disponível.

## Telas

- `/onboarding`: os 4 perfis com os módulos de cada um. A confirmação de
  e-mail leva direto para cá.
- `/configuracoes` (ADMIN, menu Administração): perfil atual, trocar
  perfil e ligar/desligar cada módulo.
- **Páginas públicas** `/para/comercio`, `/para/servicos` e
  `/para/hibrido`: o que o Akylla oferece para cada perfil, com "Criar
  conta". Ficaram em `/para/…` porque `/servicos` já é o catálogo de
  serviços do sistema.
- `/termos` e `/privacidade` passaram a abrir sem login (antes exigiam
  sessão, o que impedia ler os termos durante o cadastro).
