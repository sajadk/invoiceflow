# Development image for the Laravel API.
# A separate production image (php-fpm + nginx) is added in the AWS milestone.
FROM php:8.3-cli-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip libzip-dev libicu-dev \
    && docker-php-ext-install pdo_mysql zip bcmath intl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY bootstrap-api.sh /usr/local/bin/bootstrap-api
RUN chmod +x /usr/local/bin/bootstrap-api

WORKDIR /var/www/html
