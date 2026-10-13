# Study Sprint API — Docker Compose

A small study-task API built with Node.js/Express and PostgreSQL. It supports creating, listing, completing, and deleting study tasks. The API reads from and writes to PostgreSQL; database data is stored in a named Docker volume.

## Requirements

- Docker Desktop (or Docker Engine) with the Compose plugin
- Git (optional)

## Start the application

From this directory, create your local environment file, then start both containers:

```bash
cp .env.example .env
```

Edit `.env` and replace `DB_PASSWORD` with a local development password. The `.env` file is ignored by Git.

```bash
docker compose up --build
```

Open `http://localhost:3000/` or `http://localhost:3000/health`. Stop with `Ctrl+C`. To start in the background, use `docker compose up --build -d`.

## API examples

Create a task (writes to PostgreSQL):

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Review Docker Compose","description":"Practice services, networks, and volumes"}'
```

List tasks (reads from PostgreSQL):

```bash
curl http://localhost:3000/api/tasks
```

List only incomplete tasks:

```bash
curl 'http://localhost:3000/api/tasks?completed=false'
```

Mark task `1` complete:

```bash
curl -X PATCH http://localhost:3000/api/tasks/1 \
  -H 'Content-Type: application/json' \
  -d '{"completed":true}'
```

Delete task `1`:

```bash
curl -X DELETE http://localhost:3000/api/tasks/1
```

The API returns JSON. `POST /api/tasks` validates the title and description; `PATCH` validates the ID and boolean completion state.

## How the Docker requirements are met

- **Two services:** `backend` (custom Node.js image) and `db` (PostgreSQL).
- **Networking:** both services join the private `app-network`; backend connects to hostname `db` on port `5432`. The database port is not exposed to the host.
- **Startup dependency:** Compose waits for the database health check before starting the backend. The backend also retries database initialization.
- **Configuration/secrets:** `.env.example` documents required variables; copy it to `.env`. `.env` is excluded from Git and Docker build context. Do not commit real credentials.
- **Persistent data:** named volume `postgres-data` stores PostgreSQL files. Recreating containers does not delete this volume.
- **Health check:** `GET /health` verifies the database connection.

## Verify persistence

1. Create a task with the `POST` example above.
2. Run `docker compose down` (do **not** add `-v`).
3. Run `docker compose up --build -d`.
4. Run `curl http://localhost:3000/api/tasks`; the task should still be present.

`docker compose down -v` explicitly removes named volumes and will delete the stored database data. Use it only when you intentionally want a clean database.

## Useful commands

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f db
docker compose down
```
