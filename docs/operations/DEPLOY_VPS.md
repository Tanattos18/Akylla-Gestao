# Deploy numa VPS (Hostinger KVM, Ubuntu 24.04)

> Caminho escolhido pelo proprietário em 2026-10-18. O site de divulgação
> continua no plano Premium (`akyllagestao.com.br`); o sistema vai para a
> VPS num subdomínio (ex.: `app.akyllagestao.com.br`).

## 0. Situação atual (2026-10-18)

| Item | Valor |
|---|---|
| Provedor / plano | Hostinger **VPS KVM 1** (1 vCPU, 4 GB RAM, 50 GB NVMe). Upgrade para KVM 2 pelo painel, sem reinstalar, quando passar de ~20–30 empresas ativas ou ficar lento no pico |
| Sistema | **Ubuntu 26.04 LTS** puro ("Apenas SO": sem painel, sem aplicativos, sem Docker). O `install.sh` funciona nele: PGDG tem `resolute-pgdg`, NodeSource `nodistro` e Caddy genérico |
| Extras | scanner Monarx (grátis); backup diário da Hostinger recomendado (cópia fora da VPS) |
| IP | no painel da Hostinger (VPS › Visão geral). **Não versionado**: o repositório é público |
| DNS | nameservers da Hostinger (`*.dns-parking.com`); registro **A** `app` → IP da VPS |
| Endereço do sistema | `https://app.akyllagestao.com.br` (site de divulgação continua no plano Premium) |
| Status | ✅ **No ar desde 2026-10-18**: `install.sh` e `create-admin.sh` executados; `https://app.akyllagestao.com.br` com HTTPS válido, `/health/ready` com `database: ok`, role `akylla_app` sem superuser/BYPASSRLS, `/api/docs` desligado em produção. Conta do dono criada (empresa isenta) |
| Próximos | ativar 2FA do dono; reiniciar a VPS uma vez (kernel); SMTP para abrir o cadastro; UptimeRobot em `/health/ready`; backup da Hostinger |

## 1. Contratar e preparar

1. Hostinger → VPS **KVM 2** (ou KVM 1 para começar), sistema **Ubuntu 24.04**.
2. Anotar o **IP** da VPS.
3. No painel do domínio `akyllagestao.com.br` → DNS → registro **A**:
   nome `app`, valor = IP da VPS.

## 2. Instalar (uma vez)

No terminal da VPS (Hostinger → VPS → *Terminal do navegador*), como root:

```bash
curl -fsSL https://raw.githubusercontent.com/Tanattos18/Akylla-Gestao/main/scripts/deploy/vps/install.sh -o install.sh
sudo bash install.sh app.akyllagestao.com.br seu@email.com
sudo bash /opt/akylla/scripts/deploy/vps/create-admin.sh
```

O `install.sh` (pode rodar de novo sem estragar nada):

- instala **Node 22**, **PostgreSQL 17** e **Caddy** (HTTPS automático);
- cria o banco `akylla` e o role **`akylla_app` sem SUPERUSER/BYPASSRLS**
  (exigência da RLS);
- **gera as senhas e chaves no próprio servidor**, em
  `/etc/akylla/akylla.env` (permissão 640, root:akylla). Nada passa por
  chat ou e-mail. **Guarde uma cópia da `FISCAL_ENCRYPTION_KEY` fora do
  servidor**;
- compila, aplica as migrations e sobe os serviços `akylla-api`,
  `akylla-web` e `akylla-worker` (systemd, reinício automático);
- configura o firewall (22, 80, 443; a API só responde localmente) e o
  backup diário às 02:00 em `/var/backups/akylla`.

O cadastro aberto começa **desligado** (`REGISTRATION_ENABLED=false`)
porque exige SMTP. Para ligar: preencha `SMTP_*` no arquivo, mude para
`true` e rode `sudo systemctl restart akylla-api`.

## 2b. Empresa de demonstração (apresentações)

```bash
sudo bash /opt/akylla/scripts/deploy/vps/create-demo.sh comercio   # ou servicos, alimentacao
```

Cria "Demonstração - <marca>" com login `demo-<preset>@akyllagestao.com.br`
(a senha é digitada na hora), isenta de cobrança, populada com dados
fictícios: catálogo, clientes, 30 dias de vendas e caixa, agenda,
assinaturas e WhatsApp. O membro de equipe recebe uma senha aleatória
mostrada no fim. Para demonstrar a importação ao vivo, use as planilhas
fictícias de `docs/demo/`.

## 3. Atualizar

```bash
sudo bash /opt/akylla/scripts/deploy/vps/update.sh
```

O script faz backup, baixa a `main`, compila, aplica as migrations,
reinicia e confere o `/health/ready`. Se a API não responder em 2 minutos,
ele mostra o comando para voltar à versão anterior.

## 4. Operação

| O quê | Comando |
|---|---|
| Situação | `systemctl status akylla-api akylla-web akylla-worker` |
| Logs | `journalctl -u akylla-api -f` |
| Editar configuração | `sudo nano /etc/akylla/akylla.env` e depois `sudo systemctl restart akylla-api akylla-web akylla-worker` (as variáveis `NEXT_PUBLIC_*` exigem rodar o `update.sh`) |
| Backup manual | `sudo -u akylla bash -c 'cd /opt/akylla && npm run db:backup'` |
| Saúde | `curl http://127.0.0.1:3001/health/ready` |

Monitoramento externo: UptimeRobot em
`https://app.akyllagestao.com.br/health/ready` com a palavra-chave
`"database":"ok"` (o Caddy publica só `/health` e `/health/ready` da API;
o resto passa pela web).

## 5. Instalar como aplicativo no Windows (PWA)

Com o sistema no ar em HTTPS, abra `https://app.akyllagestao.com.br` no
**Edge** ou no **Chrome** e use o ícone **"Instalar aplicativo"** na barra
de endereço (Edge: *… › Aplicativos › Instalar este site como
aplicativo*). Ele cria o ícone no menu Iniciar e abre em janela própria.
Clique com o botão direito no ícone para chegar aos atalhos (PDV, Vendas,
Caixa, Agenda). Os dados continuam no servidor; sem internet aparece a
tela "Sem conexão".
