# Local PostgreSQL with Docker

MOONDAY uses PostgreSQL with the pgvector extension for its memory schema. The local Docker setup runs it at `localhost:5433`, so it does not conflict with a PostgreSQL instance that may already use port `5432`.

## Start the database

```sh
docker compose -f docker-compose.postgres.yml up -d
```

Or use the project shortcut:

```sh
bun run db:up
```

If a prior local MOONDAY container named `moonday-postgres` already exists, `db:up` starts and reuses it instead of replacing it. This preserves its local database data.

Check that it is ready:

```sh
docker compose -f docker-compose.postgres.yml ps
```

The `postgres` service should report `healthy`.

## Configure MOONDAY

Copy the environment template if needed, then use this local connection string:

```env
DATABASE_URL="postgres://moonday:moonday@localhost:5433/moonday"
```

The Compose credentials are intentionally development-only. Change them before exposing the database outside your local machine.

## Apply the schema and run the app

```sh
bun run db:migrate
bun run db:seed
bun run dev
```

`db:seed` is optional but creates the initial character profiles.

## Stop or inspect the database

```sh
# Stop while keeping local data
bun run db:down

# Follow database logs
docker compose -f docker-compose.postgres.yml logs -f postgres
```

## Reset local database data

This deletes the Docker volume and all local MOONDAY conversations, memories, and mood data. It cannot be undone.

```sh
docker compose -f docker-compose.postgres.yml down -v
docker compose -f docker-compose.postgres.yml up -d
bun run db:migrate
bun run db:seed
```

## Connect with psql

```sh
psql "postgres://moonday:moonday@localhost:5433/moonday"
```
