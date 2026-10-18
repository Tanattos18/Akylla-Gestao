#!/usr/bin/env bash
# Atualiza o Akylla na VPS para a última versão da main e reinicia os serviços.
# Uso: sudo bash /opt/akylla/scripts/deploy/vps/update.sh
set -euo pipefail
APP_USER="akylla"
APP_DIR="/opt/akylla"
ENV_FILE="/etc/akylla/akylla.env"
BRANCH="${BRANCH:-main}"

[[ $EUID -eq 0 ]] || { echo "rode com sudo" >&2; exit 1; }

before="$(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse --short HEAD)"
echo "==> Backup antes de atualizar"
sudo -u postgres psql -c "ALTER ROLE akylla_app CREATEDB;" >/dev/null 2>&1 || true
sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm run db:backup"

echo "==> Código ($BRANCH)"
sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin "$BRANCH"
sudo -u "$APP_USER" git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
after="$(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse --short HEAD)"

echo "==> Build e migrations ($before → $after)"
sudo -u "$APP_USER" bash -c "
  set -euo pipefail
  cd '$APP_DIR'
  set -a; source '$ENV_FILE'; set +a
  npm ci --include=dev --no-audit --no-fund
  npm run build
  npm run db:deploy
"

echo "==> Reiniciando"
systemctl restart akylla-api akylla-web akylla-worker
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3001/health/ready 2>/dev/null | grep -q '"database":"ok"'; then
    echo "OK: versão $after no ar."
    exit 0
  fi
  sleep 2
done
echo "A API não respondeu em 2 min. Veja: journalctl -u akylla-api -n 100" >&2
echo "Voltar para a versão anterior: sudo -u $APP_USER git -C $APP_DIR checkout $before && sudo bash $0" >&2
exit 1
