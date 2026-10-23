.PHONY: setup up down logs test shell tinker fresh

## First run: build images, generate Laravel, install Sanctum, migrate
setup:
	docker compose build
	docker compose run --rm api bootstrap-api

## Start everything (API :8000, web :5173, MySQL :3307)
up:
	docker compose up

down:
	docker compose down

logs:
	docker compose logs -f

test:
	docker compose exec api php artisan test

shell:
	docker compose exec api bash

tinker:
	docker compose exec api php artisan tinker

## Drop and recreate the database
fresh:
	docker compose exec api php artisan migrate:fresh --seed
