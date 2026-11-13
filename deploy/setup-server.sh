#!/usr/bin/env bash
# One-time setup of the EC2 instance for InvoiceFlow. Safe to re-run.
#   curl -fsSL https://raw.githubusercontent.com/sajadk/invoiceflow/main/deploy/setup-server.sh | sudo bash
#
# Leaves the host's nginx (car-listing-api on port 80) untouched.
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/sajadk/invoiceflow/main/deploy"
APP_DIR=/opt/invoiceflow

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo." >&2
  exit 1
fi

echo "==> Swap (1 GB): headroom for a 1 GB instance running two apps"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
# Use swap only under real memory pressure
echo 'vm.swappiness=10' > /etc/sysctl.d/99-invoiceflow-swap.conf
sysctl -q -p /etc/sysctl.d/99-invoiceflow-swap.conf

echo "==> Docker Engine + Compose (Ubuntu packages)"
# One broken third-party source (e.g. a PPA with no release for this Ubuntu version)
# makes `apt-get update` exit non-zero even though Ubuntu's own lists downloaded fine.
apt_update() {
  if ! apt-get update -q; then
    echo "    WARNING: apt-get update reported errors (see above), probably a third-party" >&2
    echo "    source in /etc/apt/sources.list.d/. Continuing with Ubuntu's own packages." >&2
  fi
}
if ! command -v docker >/dev/null 2>&1; then
  apt_update
  apt-get install -y -q docker.io
fi
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y -q docker-compose-v2 || apt-get install -y -q docker-compose-plugin
fi
systemctl enable --now docker
usermod -aG docker ubuntu || true

echo "==> App directory ${APP_DIR}"
install -d -m 750 -o ubuntu -g ubuntu "${APP_DIR}"
curl -fsSL "${REPO_RAW}/docker-compose.yml" -o "${APP_DIR}/docker-compose.yml"
curl -fsSL "${REPO_RAW}/update.sh" -o "${APP_DIR}/update.sh"
curl -fsSL "${REPO_RAW}/reset-demo.sh" -o "${APP_DIR}/reset-demo.sh"
chmod 750 "${APP_DIR}/update.sh" "${APP_DIR}/reset-demo.sh"
if [ ! -f "${APP_DIR}/.env" ]; then
  curl -fsSL "${REPO_RAW}/env.production.example" -o "${APP_DIR}/.env"
  echo "    Created ${APP_DIR}/.env from the example: fill it in before starting."
fi
chmod 600 "${APP_DIR}/.env"
chown -R ubuntu:ubuntu "${APP_DIR}"

echo
docker --version
docker compose version
free -m
echo
echo "Done. Next: edit ${APP_DIR}/.env, then: cd ${APP_DIR} && sudo ./update.sh"
