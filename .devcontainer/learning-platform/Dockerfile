FROM node:24-bookworm@sha256:aca79828f8a4afc627f189387c965625bcc419233946210a3b9522d90a59b5c6 AS node
FROM composer:2.11.2@sha256:c4a7ecd02a3469b6ff2b73930d3911831c5095ae760c3d15065df22cdf40e7f0 AS composer
FROM mcr.microsoft.com/devcontainers/base:1-ubuntu-24.04@sha256:3ba6ebe0668ea528ecd1802d44b394453683f46c8e637671749988f0661750cb
USER root
RUN apt-get update && apt-get install -y --no-install-recommends php8.3-cli php8.3-sqlite3 php8.3-mysql php8.3-mbstring php8.3-curl php8.3-xml php8.3-zip python3 ca-certificates unzip && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local /usr/local
COPY --from=composer /usr/bin/composer /usr/local/bin/composer
RUN php -r 'foreach(["pdo_sqlite","mbstring","openssl","fileinfo","curl","SimpleXML"] as $e) if(!extension_loaded($e)) exit(1);' && node --version && composer --version
USER vscode
