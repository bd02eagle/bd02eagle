import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pino from "pino";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import client from "prom-client";
import { PrismaClient } from '@prisma/client';

import { login } from "./auth.js";
import gamesRoutes from "./routes/games.js";
import eventsRoutes from "./routes/events.js";
import tagsRoutes from "./routes/tags.js";
import analystActionsRoutes from "./routes/analyst-actions.js";
import assignmentsRoutes from "./routes/assignments.js";
import teamsRoutes from "./routes/teams.js";

// Import the requireAuth middleware
import { requireAuth } from "./auth.js";

dotenv.config();
const app = express();
const log = pino();
const prisma = new PrismaClient();

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
app.use("/api/games", gamesRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/tags", tagsRoutes);
app.use("/api/analyst-actions", analystActionsRoutes);
app.use("/api/assignments", assignmentsRoutes);
app.use("/api/teams", teamsRoutes);

// Users endpoint for fetching user details
app.get('/api/users/:userId', requireAuth(), async (req, res) => {
  try {
    const { userId } = req.params;

    // Only allow users to fetch their own details (or admins to fetch any)
    if (req.user.sub !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


const port = process.env.PORT || 3000;

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, '0.0.0.0', () => log.info(`API listening on ${port}`));
}

export default app;