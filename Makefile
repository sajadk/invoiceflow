.PHONY: setup up down logs test test-db seed shell tinker fresh

## First run: build images, generate Laravel, install Sanctum, migrate
setup:
	docker compose build
	docker compose run --rm api bootstrap-api

## Start everything (API :8000, web :5173, MySQL :3307 or MYSQL_HOST_PORT)
up:
	docker compose up

down:
	docker compose down

logs:
	docker compose logs -f

## Runs against the separate invoiceflow_testing database (see api/.env.testing)
test:
	docker compose exec api php artisan test

## Create the testing database on an existing MySQL volume (new volumes do this automatically)
test-db:
	docker compose exec -T mysql mysql -uroot -proot < docker/mysql/init/01-testing-database.sql

## Create/refresh the demo account (demo@invoiceflow.test / password)
seed:
	docker compose exec api php artisan db:seed

shell:
	docker compose exec api bash

tinker:
	docker compose exec api php artisan tinker

## Drop and recreate the dev database, then seed
fresh:
	docker compose exec api php artisan migrate:fresh --seed
