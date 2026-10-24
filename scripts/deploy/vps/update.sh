#!/usr/bin/env bash
# Atualiza o Akylla na VPS e reinicia os serviços, com volta automática.
#
# Uso:
#   sudo bash /opt/akylla/scripts/deploy/vps/update.sh          # última versão da main
#   sudo bash /opt/akylla/scripts/deploy/vps/update.sh <REF>    # versão específica
#        (REF = commit, tag ou branch; ex.: 9601d85 — também serve para voltar)
#
# O que faz:
#   1. backup do banco (com trava: não roda junto com o backup das 02:00);
#   2. baixa o código da REF, compila e aplica as migrations;
#   3. reinicia e confere a API (3001) e a web (3000);
#   4. se algo falhar, VOLTA SOZINHO para a versão anterior e avisa.
#      Migrations já aplicadas não são desfeitas: para voltar o banco, use o
#      backup feito no passo 1 (npm run db:restore).
set -euo pipefail
APP_USER="akylla"
APP_DIR="/opt/akylla"
ENV_FILE="/etc/akylla/akylla.env"
BACKUP_DIR="/var/backups/akylla"
# Trava do backup fora de /var/lock: lá (diretório sticky) o Ubuntu, com
# fs.protected_regular=2, impede o root de abrir o arquivo do usuário akylla
LOCK_FILE="/var/lib/akylla/backup.lock"
BRANCH="${BRANCH:-main}"
REF="${1:-${REF:-}}"

[[ $EUID -eq 0 ]] || { echo "rode com sudo" >&2; exit 1; }

# O git checkout abaixo troca este arquivo enquanto ele roda: executa uma
# cópia temporária para o bash não ler a versão nova pela metade.
if [[ -z "${AKYLLA_UPDATE_COPY:-}" ]]; then
  copy="$(mktemp /tmp/akylla-update.XXXXXX)"
  cp "$0" "$copy"
  AKYLLA_UPDATE_COPY="$copy" exec bash "$copy" "$@"
fi
trap 'rm -f "$AKYLLA_UPDATE_COPY"' EXIT

as_app() { runuser -u "$APP_USER" -- "$@"; }
git_app() { as_app git -C "$APP_DIR" "$@"; }

healthy() {
  local i
  for i in $(seq 1 60); do
    if curl -fsS http://127.0.0.1:3001/health/ready 2>/dev/null | grep -q '"database":"ok"' \
      && curl -fsS -o /dev/null http://127.0.0.1:3000/login 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# Compila e aplica migrations da versão já em $APP_DIR (processo separado,
# então o "set -e" de dentro vale).
build() {
  as_app bash -c "
    set -euo pipefail
    cd '$APP_DIR'
    set -a; source '$ENV_FILE'; set +a
    npm ci --include=dev --no-audit --no-fund
    npm run build
    npm run db:deploy
  "
}

deploy() {
  local target="$1"
  git_app checkout -B "$BRANCH" "$target" || return 1
  build || return 1
  systemctl restart akylla-api akylla-web akylla-worker || return 1
  healthy
}

before="$(git_app rev-parse HEAD)"

echo "==> Backup antes de atualizar"
runuser -u postgres -- psql -c "ALTER ROLE akylla_app CREATEDB;" >/dev/null 2>&1 || true
# Mesma trava do backup diário (cron): espera até 10 min se ele estiver rodando
flock -w 600 "$LOCK_FILE" runuser -u "$APP_USER" -- bash -c "cd '$APP_DIR' && npm run db:backup"

# Backup diário com trava (instalações antigas não tinham)
cat > /etc/cron.d/akylla-backup <<CRON
# Backup diário do Akylla (dump + verificação + retenção), com trava contra execução dupla
0 2 * * * $APP_USER cd $APP_DIR && /usr/bin/flock -n $LOCK_FILE /usr/bin/npm run db:backup >> $BACKUP_DIR/cron.log 2>&1
CRON
chmod 644 /etc/cron.d/akylla-backup
touch "$LOCK_FILE" && chown "$APP_USER:$APP_USER" "$LOCK_FILE"

echo "==> Código"
git_app fetch --tags origin "$BRANCH"
if [[ -n "$REF" ]]; then
  git_app fetch origin "$REF" >/dev/null 2>&1 || true
  target="$(git_app rev-parse --verify --quiet "$REF^{commit}" || git_app rev-parse --verify --quiet "origin/$REF^{commit}" || true)"
  [[ -n "$target" ]] || { echo "Versão não encontrada: $REF" >&2; exit 1; }
else
  target="$(git_app rev-parse "origin/$BRANCH")"
fi

echo "==> Atualizando ${before:0:7} → ${target:0:7}"
if deploy "$target"; then
  echo "OK: versão ${target:0:7} no ar (API e web respondendo)."
  exit 0
fi

echo "FALHOU: a versão ${target:0:7} não subiu. Voltando para ${before:0:7}..." >&2
if [[ "$target" != "$before" ]] && deploy "$before"; then
  echo "Voltou para ${before:0:7}: o sistema está no ar com a versão anterior." >&2
  echo "Atenção: migrations da versão nova que chegaram a rodar continuam no banco." >&2
  echo "Se precisar voltar o banco também: backup do passo 1 em $BACKUP_DIR." >&2
else
  echo "Não consegui voltar sozinho. Veja: journalctl -u akylla-api -n 100 e journalctl -u akylla-web -n 100" >&2
fi
exit 1
