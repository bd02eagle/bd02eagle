import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

const r = Router();

r.get("/", requireAuth(["ADMIN","ANALYST","CHARTER"]), async (_req, res) => {
  const games = await prisma.game.findMany({ 
    orderBy: { date: "desc" },
    include: {
      homeTeam: {
        select: {
          id: true,
          name: true,
          shortName: true,
          primaryColor: true,
          secondaryColor: true
        }
      },
      awayTeam: {
        select: {
          id: true,
          name: true,
          shortName: true,
          primaryColor: true,
          secondaryColor: true
        }
      },
      events: {
        select: {
          id: true,
          type: true,
          timestampMs: true
        }
      },
      assignments: {
        where: {
          isActive: true
        },
        select: {
          id: true,
          priority: true,
          dueDate: true
        }
      }
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

r.post("/", requireAuth(["ADMIN", "ANALYST"]), async (req, res) => {
  try {
    const { 
      date, 
      homeTeamId, 
      awayTeamId, 
      status = "SCHEDULED",
      homeScore,
      awayScore,
      venue,
      season,
      gameType,
      thumbnail
    } = req.body || {};
    
    if (!date || !homeTeamId || !awayTeamId) {
      return res.status(400).json({ error: 'Missing required fields: date, homeTeamId, awayTeamId' });
    }
    
    const game = await prisma.game.create({ 
      data: { 
        date: new Date(date), 
        homeTeamId,
        awayTeamId,
        status,
        homeScore,
        awayScore,
        venue,
        season,
        gameType,
        thumbnail
      },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });
    
    res.status(201).json(game);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Get game events
r.get("/:gameId/events", requireAuth(), async (req, res) => {
  const { gameId } = req.params;
  try {
    console.log('Fetching events for game:', gameId);

    const events = await prisma.event.findMany({
      where: { gameId },
      orderBy: { timestampMs: 'asc' },
      include: {
        tags: {
          include: {
            createdBy: {
              select: { firstName: true, lastName: true, email: true }
            }
          }
        }
      }
    });

    console.log(`Found ${events.length} events for game ${gameId}`);
    res.json(events);
  } catch (error) {
    console.error('Error fetching game events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

export default r;