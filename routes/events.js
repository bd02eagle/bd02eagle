
import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

const r = Router();

// create event for a game
r.post("/", requireAuth(["ADMIN"]), async (req, res) => {
  const { gameId, timestampMs, videoUrl, type } = req.body || {};
  const event = await prisma.event.create({
    data: { gameId, timestampMs, videoUrl, type }
  });
  res.status(201).json(event);
});

export default r;
