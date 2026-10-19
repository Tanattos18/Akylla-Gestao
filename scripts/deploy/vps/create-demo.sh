#!/usr/bin/env bash
# Cria uma EMPRESA DE DEMONSTRAÇÃO já populada (dados fictícios) para
# apresentações: catálogo, clientes, 30 dias de vendas e caixa, agenda,
# assinaturas e WhatsApp de exemplo. A empresa fica isenta de cobrança e
# separada das empresas reais.
#
# Uso: sudo bash /opt/akylla/scripts/deploy/vps/create-demo.sh [comercio|servicos|alimentacao]
set -euo pipefail
APP_USER="akylla"
APP_DIR="/opt/akylla"
ENV_FILE="/etc/akylla/akylla.env"
PRESET="${1:-comercio}"

[[ $EUID -eq 0 ]] || { echo "rode com sudo" >&2; exit 1; }
case "$PRESET" in
  comercio) NAME="Demonstração - Empório Central" ;;
  servicos) NAME="Demonstração - Studio Beleza" ;;
  alimentacao) NAME="Demonstração - Padaria Pão Quente" ;;
  *) echo "preset inválido: use comercio, servicos ou alimentacao" >&2; exit 1 ;;
esac
EMAIL="demo-${PRESET}@akyllagestao.com.br"

echo "Empresa: $NAME"
echo "Login:   $EMAIL"
while true; do
  read -r -s -p "Senha para esse login (mín. 12 caracteres): " PASS; echo
  read -r -s -p "Repita a senha: " PASS2; echo
  [[ "$PASS" == "$PASS2" && ${#PASS} -ge 12 ]] && break
  echo "Senhas diferentes ou curtas demais. Tente de novo."
done

runuser -u "$APP_USER" -- env \
  BOOTSTRAP_COMPANY_NAME="$NAME" BOOTSTRAP_COMPANY_SLUG="demo-$PRESET" \
  BOOTSTRAP_ADMIN_NAME="Demonstração" BOOTSTRAP_ADMIN_EMAIL="$EMAIL" BOOTSTRAP_ADMIN_PASSWORD="$PASS" \
  bash -c "cd '$APP_DIR' && set -a && source '$ENV_FILE' && set +a && npm run bootstrap:admin"
unset PASS PASS2

echo "==> Populando com dados fictícios ($PRESET)…"
runuser -u "$APP_USER" -- bash -c "cd '$APP_DIR' && set -a && source '$ENV_FILE' && set +a && npm run db:seed:demo -- --company=demo-$PRESET --preset=$PRESET"

cat <<FIM

Pronto. Entre em https://$(grep -oP '(?<=^APP_ORIGINS=https://)[^,]+' "$ENV_FILE" || echo app.akyllagestao.com.br)/login
  Login: $EMAIL  (senha que você digitou)
Também foi criado o usuário de equipe da demonstração (perfil membro), mostrado acima.
FIM
