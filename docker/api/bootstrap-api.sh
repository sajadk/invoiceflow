#!/usr/bin/env bash
# One-time setup for the Laravel API. Safe to re-run: every step checks first.
set -euo pipefail
cd /var/www/html

# 1. Generate the Laravel skeleton around the files already in ./api
#    (cp -n never overwrites, so our HealthController, routes, config and tests win).
if [ ! -f artisan ]; then
  echo "==> Creating Laravel skeleton"
  rm -rf /tmp/skeleton
  composer create-project laravel/laravel /tmp/skeleton --prefer-dist --no-install --no-scripts --no-interaction
  cp -Rn /tmp/skeleton/. .
fi

echo "==> Installing PHP dependencies"
composer install --no-interaction

[ -f .env ] || cp .env.example .env
if grep -q '^APP_KEY=$' .env; then
  php artisan key:generate --no-interaction
fi

# 2. Sanctum + API routing. install:api skips wiring bootstrap/app.php when
#    routes/api.php already exists, so move ours aside and restore it afterwards.
if ! grep -q '"laravel/sanctum"' composer.json; then
  echo "==> Installing Sanctum (php artisan install:api)"
  mv routes/api.php /tmp/api.php.keep
  php artisan install:api --without-migration-prompt --no-interaction
  mv -f /tmp/api.php.keep routes/api.php
fi

echo "==> Running migrations"
php artisan migrate --force --no-interaction

echo "==> API ready"
