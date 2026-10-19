#!/usr/bin/env bash
# Cria a primeira empresa e o administrador. A senha é digitada (não aparece
# na tela e não fica gravada em arquivo nem no histórico).
# Uso: sudo bash /opt/akylla/scripts/deploy/vps/create-admin.sh
set -euo pipefail
APP_USER="akylla"
APP_DIR="/opt/akylla"
ENV_FILE="/etc/akylla/akylla.env"

[[ $EUID -eq 0 ]] || { echo "rode com sudo" >&2; exit 1; }

read -r -p "Nome da empresa: " COMPANY
read -r -p "Seu nome: " NAME
read -r -p "Seu e-mail (login): " EMAIL
while true; do
  read -r -s -p "Senha (mín. 12 caracteres): " PASS; echo
  read -r -s -p "Repita a senha: " PASS2; echo
  [[ "$PASS" == "$PASS2" && ${#PASS} -ge 12 ]] && break
  echo "Senhas diferentes ou curtas demais. Tente de novo."
done

runuser -u "$APP_USER" -- env \
  BOOTSTRAP_COMPANY_NAME="$COMPANY" BOOTSTRAP_ADMIN_NAME="$NAME" \
  BOOTSTRAP_ADMIN_EMAIL="$EMAIL" BOOTSTRAP_ADMIN_PASSWORD="$PASS" \
  bash -c "cd '$APP_DIR' && set -a && source '$ENV_FILE' && set +a && npm run bootstrap:admin"
unset PASS PASS2

# Fase 8: a primeira conta criada vira a dona da plataforma (painel /plataforma).
# A empresa criada aqui fica isenta de cobrança.
grep -q '^PLATFORM_ADMIN_EMAILS=' "$ENV_FILE" || echo 'PLATFORM_ADMIN_EMAILS=' >> "$ENV_FILE"
if grep -q '^PLATFORM_ADMIN_EMAILS=$' "$ENV_FILE"; then
  sed -i "s|^PLATFORM_ADMIN_EMAILS=$|PLATFORM_ADMIN_EMAILS=${EMAIL,,}|" "$ENV_FILE"
  systemctl restart akylla-api
  echo "Você é o dono da plataforma: menu Administração › Plataforma."
  echo "Ative a verificação em duas etapas em Configurações › Segurança (obrigatória para o painel)."
fi
