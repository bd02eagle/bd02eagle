import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

const r = Router();

r.get("/", requireAuth(["ADMIN","ANALYST","CHARTER"]), async (_req, res) => {
  const games = await prisma.game.findMany({ 
    orderBy: { date: "desc" },
    include: {
      homeTeam: true,
      awayTeam: true
    }
  });

  // Ensure consistent data format
  const formattedGames = games.map(game => ({
    ...game,
    homeTeam: game.homeTeam || { name: 'Home', shortName: 'HOME' },
    awayTeam: game.awayTeam || { name: 'Away', shortName: 'AWAY' }
  }));

  res.json(formattedGames);
});

r.post("/", requireAuth(["ADMIN"]), async (req, res) => {
  const { date, homeTeam, awayTeam } = req.body || {};
  const game = await prisma.game.create({ data: { date: new Date(date), homeTeam, awayTeam } });
  res.status(201).json(game);
});

r.get("/:gameId/events", requireAuth(["ADMIN","ANALYST","CHARTER"]), async (req, res) => {
  const events = await prisma.event.findMany({ where: { gameId: req.params.gameId } });
  res.json(events);
});

export default r;