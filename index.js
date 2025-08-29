
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pino from "pino";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

import { login } from "./auth.js";
import games from "./routes/games.js";
import tags from "./routes/tags.js";
import analystActions from "./routes/analyst-actions.js";

dotenv.config();
const app = express();
const log = pino();

app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger: log })); // minimal request logging

// docs
const swaggerDoc = YAML.load("./api/openapi.yaml");
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// auth
app.post("/api/auth/login", login);

// domain routes
app.use("/api/games", games);
app.use("/api", tags); // handles /api/events/:eventId/tags and /api/tags/:tagId
app.use("/api/tags", analystActions); // handles /api/tags/:tagId/analyst-actions

const port = process.env.PORT || 3000;
app.listen(port, () => log.info(`API listening on ${port}`));
