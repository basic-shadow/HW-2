const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const APP_MESSAGE = process.env.APP_MESSAGE || "Study Sprint API is running";
const pool = new Pool({
  host: process.env.DB_HOST || "db",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "study_sprint",
  user: process.env.DB_USER || "study_user",
  password: process.env.DB_PASSWORD,
  max: Number(process.env.DB_POOL_MAX || 10),
  connectionTimeoutMillis: 5000,
});

app.use(express.json({ limit: "32kb" }));

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR(160) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

app.get("/", (_req, res) => {
  res.json({ message: APP_MESSAGE, service: "study-sprint-api" });
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (_error) {
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});

// Read tasks from PostgreSQL. Optional ?completed=true|false filter.
app.get("/api/tasks", async (req, res, next) => {
  try {
    const { completed } = req.query;
    if (completed !== undefined && completed !== "true" && completed !== "false") {
      return res.status(400).json({ error: "completed must be true or false" });
    }
    const result = completed === undefined
      ? await pool.query("SELECT id, title, description, completed, created_at FROM tasks ORDER BY id DESC")
      : await pool.query(
          "SELECT id, title, description, completed, created_at FROM tasks WHERE completed = $1 ORDER BY id DESC",
          [completed === "true"]
        );
    res.json({ count: result.rowCount, tasks: result.rows });
  } catch (error) {
    next(error);
  }
});

// Write a new task to PostgreSQL.
app.post("/api/tasks", async (req, res, next) => {
  try {
    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
    if (!title || title.length > 160) {
      return res.status(400).json({ error: "title is required and must be at most 160 characters" });
    }
    if (description.length > 5000) {
      return res.status(400).json({ error: "description must be at most 5000 characters" });
    }
    const result = await pool.query(
      "INSERT INTO tasks (title, description) VALUES ($1, $2) RETURNING id, title, description, completed, created_at",
      [title, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update the completion state of an existing task.
app.patch("/api/tasks/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ error: "id must be a positive integer" });
    }
    if (typeof req.body.completed !== "boolean") {
      return res.status(400).json({ error: "completed must be a boolean" });
    }
    const result = await pool.query(
      "UPDATE tasks SET completed = $1 WHERE id = $2 RETURNING id, title, description, completed, created_at",
      [req.body.completed, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "task not found" });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/tasks/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ error: "id must be a positive integer" });
    }
    const result = await pool.query("DELETE FROM tasks WHERE id = $1 RETURNING id", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "task not found" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error("Request failed:", error.message);
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  // Wait for PostgreSQL to accept connections, even if it starts slowly.
  let lastError;
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    try {
      await initializeDatabase();
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      console.log(`Database not ready (attempt ${attempt}/15); retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  if (lastError) {
    console.error("Could not initialize database:", lastError.message);
    process.exit(1);
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Study Sprint API listening on port ${PORT}`);
  });
}

async function shutdown() {
  await pool.end();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

start();
