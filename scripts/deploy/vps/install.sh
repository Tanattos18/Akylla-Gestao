#!/usr/bin/env bash
# Instalação do Akylla Gestão numa VPS Ubuntu 24.04 (Hostinger KVM ou similar).
#
# Uso (como root, no terminal da VPS):
#   curl -fsSL https://raw.githubusercontent.com/Tanattos18/Akylla-Gestao/main/scripts/deploy/vps/install.sh -o install.sh
#   sudo bash install.sh app.akyllagestao.com.br voce@email.com
#
# O que faz (pode rodar de novo sem estragar nada):
#   - Node 22, PostgreSQL 17 e Caddy (HTTPS automático, Let's Encrypt)
#   - banco "akylla" com o role "akylla_app" SEM superusuário e SEM BYPASSRLS
#   - gera TODAS as senhas e chaves aqui mesmo (nada passa por chat/e-mail)
#   - compila API, web e worker, aplica as migrations
#   - serviços systemd: akylla-api, akylla-web, akylla-worker
#   - firewall (22, 80, 443), 2 GB de swap e backup diário às 02:00 (com trava)
#
# Segredos ficam em /etc/akylla/akylla.env (só root e o usuário akylla leem).
set -euo pipefail

DOMAIN="${1:-}"
ACME_EMAIL="${2:-}"
REPO_URL="${REPO_URL:-https://github.com/Tanattos18/Akylla-Gestao.git}"
BRANCH="${BRANCH:-main}"
APP_USER="akylla"
APP_DIR="/opt/akylla"
ENV_DIR="/etc/akylla"
ENV_FILE="$ENV_DIR/akylla.env"
DATA_DIR="/var/lib/akylla"
BACKUP_DIR="/var/backups/akylla"
DB_NAME="akylla"
DB_ROLE="akylla_app"

log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERRO: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "rode como root (sudo bash install.sh ...)"
[[ -n "$DOMAIN" ]] || die "informe o domínio. Ex.: sudo bash install.sh app.akyllagestao.com.br voce@email.com"
grep -q 'VERSION_ID="24.04"' /etc/os-release || echo "Aviso: testado no Ubuntu 24.04."

rand() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "${1:-32}"; }

log "1/9 Pacotes do sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ca-certificates gnupg ufw openssl build-essential debian-keyring debian-archive-keyring apt-transport-https

# Auditoria (bloco 9): 2 GB de swap — o build do Next numa VPS de 4 GB pode
# estourar a memória; sem swap o processo é morto no meio da atualização
if ! swapon --show | grep -q .; then
  if [[ ! -f /swapfile ]]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-akylla-swap.conf
fi

log "2/9 Node.js 22"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

log "3/9 PostgreSQL 17"
if ! command -v psql >/dev/null || ! psql --version | grep -q " 17"; then
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo "$VERSION_CODENAME")-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -y
  apt-get install -y postgresql-17 postgresql-client-17
fi
systemctl enable --now postgresql

log "4/9 Caddy (HTTPS)"
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

log "5/9 Usuário, pastas e código"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "/home/$APP_USER" --shell /bin/bash "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" -m 750 "$APP_DIR" "$DATA_DIR" "$DATA_DIR/uploads" "$BACKUP_DIR"
install -d -o root -g "$APP_USER" -m 750 "$ENV_DIR"
if [[ -d "$APP_DIR/.git" ]]; then
  runuser -u "$APP_USER" -- git -C "$APP_DIR" fetch origin "$BRANCH"
  runuser -u "$APP_USER" -- git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
else
  runuser -u "$APP_USER" -- git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

log "6/9 Banco e segredos"
if [[ ! -f "$ENV_FILE" ]]; then
  DB_PASS="$(rand 32)"
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_ROLE') THEN
    -- CREATEDB: o backup diário testa o restore num banco temporário
    CREATE ROLE $DB_ROLE LOGIN PASSWORD '$DB_PASS' NOSUPERUSER NOBYPASSRLS NOCREATEROLE CREATEDB;
  ELSE
    ALTER ROLE $DB_ROLE WITH LOGIN PASSWORD '$DB_PASS' NOSUPERUSER NOBYPASSRLS CREATEDB;
  END IF;
END \$\$;
SQL
  runuser -u postgres -- psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 \
    || runuser -u postgres -- createdb -O "$DB_ROLE" "$DB_NAME"
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "ALTER SCHEMA public OWNER TO $DB_ROLE;"

  umask 027
  cat > "$ENV_FILE" <<ENV
# Gerado por scripts/deploy/vps/install.sh em $(date -Iseconds). NÃO versionar.
NODE_ENV=production
API_HOST=127.0.0.1
API_PORT=3001
DATABASE_URL=postgresql://$DB_ROLE:$DB_PASS@127.0.0.1:5432/$DB_NAME
APP_ORIGINS=https://$DOMAIN
API_INTERNAL_URL=http://127.0.0.1:3001
AUTH_COOKIE_SECURE=true
AUTH_SESSION_TTL_HOURS=12
# Cadastro aberto exige SMTP configurado (preencha SMTP_* e mude para true)
REGISTRATION_ENABLED=false
REGISTER_RATE_LIMIT_MAX=3
PASSWORD_RESET_ENABLED=false
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Akylla Gestão <no-reply@akyllagestao.com.br>"
# Fiscal: GUARDE uma cópia desta chave fora do servidor (perder = recadastrar token/certificado)
FISCAL_ENCRYPTION_KEY=$(openssl rand -hex 32)
FISCAL_WEBHOOK_SECRET=$(rand 48)
UPLOADS_DIR=$DATA_DIR/uploads
BACKUP_DIR=$BACKUP_DIR
RETENTION_DAYS=30
# WhatsApp (docs/akylla/WHATSAPP.md): troque para meta e preencha o token e o app secret da Meta
WHATSAPP_PROVIDER=mock
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=$(rand 32)
MERCADOPAGO_ENV=sandbox
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
# Cobrança (Fase 8): teste grátis e dono da plataforma (preenchido pelo create-admin.sh)
TRIAL_DAYS=14
PLATFORM_ADMIN_EMAILS=
NEXT_PUBLIC_SALES_WHATSAPP=5562981517002
ENV
  chown root:"$APP_USER" "$ENV_FILE"
  chmod 640 "$ENV_FILE"
  echo "Segredos gerados em $ENV_FILE"
else
  echo "$ENV_FILE já existe: mantido (senhas e chaves não mudam)."
fi
# Backup testa o restore num banco temporário: o role precisa de CREATEDB
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "ALTER ROLE $DB_ROLE CREATEDB;" >/dev/null
# O código lê .env da raiz: link para o arquivo protegido
ln -sf "$ENV_FILE" "$APP_DIR/.env"

log "7/9 Dependências, build e migrations (pode levar alguns minutos)"
runuser -u "$APP_USER" -- bash -c "
  set -euo pipefail
  cd '$APP_DIR'
  set -a; source '$ENV_FILE'; set +a
  npm ci --include=dev --no-audit --no-fund
  npm run build
  npm run db:deploy
"

log "8/9 Serviços (systemd) e HTTPS (Caddy)"
unit() {
  local name="$1" workspace="$2" after="$3"
  cat > "/etc/systemd/system/akylla-$name.service" <<UNIT
[Unit]
Description=Akylla Gestão - $name
After=network.target postgresql.service $after
Requires=postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/npm run start --workspace $workspace
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
}
unit api @petflow/api ""
unit web @petflow/web "akylla-api.service"
unit worker @petflow/worker "akylla-api.service"
# Next em produção: porta 3000 só local (o Caddy publica)
sed -i "s|^ExecStart=/usr/bin/npm run start --workspace @petflow/web|ExecStart=/usr/bin/npm run start --workspace @petflow/web -- -H 127.0.0.1 -p 3000|" /etc/systemd/system/akylla-web.service
systemctl daemon-reload
systemctl enable akylla-api akylla-web akylla-worker
systemctl restart akylla-api akylla-web akylla-worker

{
  [[ -n "$ACME_EMAIL" ]] && printf '{\n\temail %s\n}\n\n' "$ACME_EMAIL"
  cat <<CADDY
$DOMAIN {
	encode zstd gzip
	# Health check público para o UptimeRobot (só /health e /health/ready)
	@health path /health /health/ready
	reverse_proxy @health 127.0.0.1:3001
	reverse_proxy 127.0.0.1:3000
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		-Server
	}
}
CADDY
} > /etc/caddy/Caddyfile
systemctl enable caddy
systemctl reload caddy || systemctl restart caddy

ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

log "9/9 Backup diário (02:00) e verificação"
cat > /etc/cron.d/akylla-backup <<CRON
# Backup diário do Akylla (dump + verificação + retenção), com trava contra execução dupla. Log em $BACKUP_DIR/backup.log
0 2 * * * $APP_USER cd $APP_DIR && /usr/bin/flock -n $DATA_DIR/backup.lock /usr/bin/npm run db:backup >> $BACKUP_DIR/cron.log 2>&1
CRON
chmod 644 /etc/cron.d/akylla-backup
# Trava em $DATA_DIR (não em /var/lock: com fs.protected_regular=2 o root
# não abre arquivo de outro usuário em diretório sticky)
touch "$DATA_DIR/backup.lock" && chown "$APP_USER:$APP_USER" "$DATA_DIR/backup.lock"

for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3001/health/ready 2>/dev/null | grep -q '"database":"ok"' \
    && curl -fsS -o /dev/null http://127.0.0.1:3000/login 2>/dev/null; then break; fi
  sleep 2
done
curl -fsS http://127.0.0.1:3001/health/ready && echo
curl -fsS -o /dev/null -w "web (3000): HTTP %{http_code}\n" http://127.0.0.1:3000/login || echo "web (3000) ainda não respondeu: journalctl -u akylla-web -n 50"
runuser -u postgres -- psql -tAc "SELECT 'role akylla_app: superuser=' || rolsuper || ' bypassrls=' || rolbypassrls FROM pg_roles WHERE rolname='$DB_ROLE'"

cat <<FIM

Pronto. Próximos passos:
  1. No painel do domínio, crie o registro A:  ${DOMAIN%%.*}  →  $(curl -fsS -4 https://ifconfig.me 2>/dev/null || echo "<IP da VPS>")
     (o HTTPS é emitido sozinho assim que o domínio apontar para cá)
  2. Crie a primeira empresa e o administrador (a senha é digitada, não fica salva):
       sudo bash $APP_DIR/scripts/deploy/vps/create-admin.sh
  3. Abra https://$DOMAIN e entre.
Atualizar para a versão nova do GitHub:  sudo bash $APP_DIR/scripts/deploy/vps/update.sh
Logs:  journalctl -u akylla-api -f   (ou akylla-web / akylla-worker)
FIM
