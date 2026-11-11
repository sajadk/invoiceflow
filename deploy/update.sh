#!/usr/bin/env bash
# Pull the latest API image and restart it. Run by the Deploy workflow (through
# AWS Systems Manager, no SSH) or by hand:  cd /opt/invoiceflow && sudo ./update.sh
set -euo pipefail

cd "$(dirname "$0")"

# Keep the compose file in step with the repo.
curl -fsSL https://raw.githubusercontent.com/sajadk/invoiceflow/main/deploy/docker-compose.yml -o docker-compose.yml

docker compose pull --quiet
# The container runs migrations and caches config/routes/views as it starts.
docker compose up -d --remove-orphans

# Wait up to 2 minutes for the API to answer locally.
for _ in $(seq 1 24); do
  if curl -fsS -o /dev/null -H "X-Origin-Verify: $(grep -E '^ORIGIN_SECRET=' .env | cut -d= -f2-)" http://127.0.0.1:8080/api/health; then
    echo "API is healthy."
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 5
done

echo "API did not become healthy. Recent logs:" >&2
docker compose logs --tail=50 api >&2
exit 1
