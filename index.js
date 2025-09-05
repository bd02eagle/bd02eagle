
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pino from "pino";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import client from "prom-client";

import { login } from "./auth.js";
import games from "./routes/games.js";
import events from "./routes/events.js";
import tags from "./routes/tags.js";
import analystActions from "./routes/analyst-actions.js";

dotenv.config();
const app = express();
const log = pino();

// Prometheus setup
const register = new client.Registry();
register.setDefaultLabels({ service: "refintel-api" });
client.collectDefaultMetrics({ register });

app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger: log })); // minimal request logging

// docs
const swaggerDoc = YAML.load("./api/openapi.yaml");
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// metrics
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// auth
app.post("/api/auth/login", login);

// domain routes
app.use("/api/games", games);
app.use("/api/events", events);
app.use("/api", tags); // handles /api/events/:eventId/tags and /api/tags/:tagId
app.use("/api/tags", tags); // handles /api/tags and /api/tags/:tagId routes
app.use("/api/tags", analystActions); // handles /api/tags/:tagId/analyst-actions

const port = process.env.PORT || 3000;

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => log.info(`API listening on ${port}`));
}

export default app;
