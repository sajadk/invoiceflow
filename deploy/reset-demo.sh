#!/usr/bin/env bash
# Rebuilds the public demo's data (demo@invoiceflow.test) from scratch.
# Only touches the "invoiceflow" database: its MySQL user can't see any other.
#
# Optional nightly reset at 03:00 Dubai time (23:00 UTC):
#   echo '0 23 * * * root /opt/invoiceflow/reset-demo.sh >> /var/log/invoiceflow-reset.log 2>&1' | sudo tee /etc/cron.d/invoiceflow-reset
set -euo pipefail

cd "$(dirname "$0")"
docker compose exec -T api php artisan migrate:fresh --seed --force
echo "$(date -u +%FT%TZ) demo data reset"
