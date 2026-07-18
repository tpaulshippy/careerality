# Careerality Server

Rails 8 API for the Careerality app.

## Setup

    bin/setup

Requires Ruby (see `.ruby-version`) and PostgreSQL.

## Running the app

    bin/rails server

## Running the tests

    bin/rails test

## Environment variables

### All environments

- `CORS_ORIGINS` — comma-separated list of allowed CORS origins.
  Defaults to `https://careerality.app`.

### Production

- `DATABASE_URL` — full connection URL for the primary database. When set,
  Rails uses it and ignores the individual settings below.
- `CAREERALITY_DATABASE_USERNAME` — database user (default: `careerality`).
- `CAREERALITY_DATABASE_PASSWORD` — database password (no default).
- `CAREERALITY_DATABASE_HOST` — database host (default: `localhost`).
