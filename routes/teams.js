
import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

const r = Router();

// Get all teams
r.get("/", requireAuth(), async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      orderBy: { name: "asc" }
    });
    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Create a new team
r.post("/", requireAuth(["ADMIN", "ANALYST"]), async (req, res) => {
  try {
    const { name, shortName, primaryColor, secondaryColor, logo } = req.body;
    
    // Check if team already exists
    const existingTeam = await prisma.team.findUnique({
      where: { name }
    });
    
    if (existingTeam) {
      return res.status(409).json({ error: 'Team with this name already exists' });
    }
    
    const team = await prisma.team.create({
      data: {
        name,
        shortName,
        primaryColor,
        secondaryColor,
        logo
      }
    });
    
    res.status(201).json(team);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Update a team
r.patch("/:teamId", requireAuth(["ADMIN"]), async (req, res) => {
  try {
    const { teamId } = req.params;
    const { name, shortName, primaryColor, secondaryColor, logo } = req.body;
    
    const team = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(name && { name }),
        ...(shortName && { shortName }),
        ...(primaryColor && { primaryColor }),
        ...(secondaryColor && { secondaryColor }),
        ...(logo && { logo })
      }
    });
    
    res.json(team);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Delete a team
r.delete("/:teamId", requireAuth(["ADMIN"]), async (req, res) => {
  try {
    const { teamId } = req.params;
    
    // Check if team is used in any games
    const gamesCount = await prisma.game.count({
      where: {
        OR: [
          { homeTeamId: teamId },
          { awayTeamId: teamId }
        ]
      }
    });
    
    if (gamesCount > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete team that is used in games' 
      });
    }
    
    await prisma.team.delete({
      where: { id: teamId }
    });
    
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

export default r;
