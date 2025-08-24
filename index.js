import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pino from "pino";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

dotenv.config();
const app = express();
const log = pino();

app.use(cors());
app.use(express.json());

// Swagger (serves the contract you just wrote)
const swaggerDoc = YAML.load("./api/openapi.yaml");
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Simple health
app.get("/api/health", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => log.info(`API listening on ${port}`));
