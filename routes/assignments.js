
import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

const r = Router();

// Get assignments for current user
r.get("/my-games", requireAuth(["ANALYST","ADMIN"]), async (req, res) => {
  const assignments = await prisma.gameAssignment.findMany({
    where: { 
      analystId: req.user.sub,
      isActive: true 
    },
    include: {
      game: {
        include: {
          homeTeam: true,
          awayTeam: true,
          events: {
            include: {
              tags: {
                include: {
                  analystActions: {
                    where: { analystId: req.user.sub }
                  }
                }
              }
            }
          }
        }
      }
    },
    orderBy: [
      { priority: 'desc' },
      { game: { date: 'asc' } }
    ]
  });

  res.json(assignments);
});

// Create assignment (Admin only)
r.post("/", requireAuth(["ADMIN"]), async (req, res) => {
  const { gameId, analystId, priority, dueDate } = req.body || {};
  
  const assignment = await prisma.gameAssignment.create({
    data: {
      gameId,
      analystId,
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : null
    },
    include: {
      game: { include: { homeTeam: true, awayTeam: true } },
      analyst: { select: { id: true, email: true, firstName: true, lastName: true } }
    }
  });

  res.status(201).json(assignment);
});

// Update assignment
r.patch("/:assignmentId", requireAuth(["ADMIN"]), async (req, res) => {
  const assignment = await prisma.gameAssignment.update({
    where: { id: req.params.assignmentId },
    data: req.body,
    include: {
      game: { include: { homeTeam: true, awayTeam: true } },
      analyst: { select: { id: true, email: true, firstName: true, lastName: true } }
    }
  });

  res.json(assignment);
});

// Remove assignment
r.delete("/:assignmentId", requireAuth(["ADMIN"]), async (req, res) => {
  await prisma.gameAssignment.update({
    where: { id: req.params.assignmentId },
    data: { isActive: false }
  });

  res.status(204).end();
});

export default r;
import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

const r = Router();

// Get assignments for the current analyst
r.get("/my-games", requireAuth(["ANALYST", "ADMIN"]), async (req, res) => {
  const assignments = await prisma.gameAssignment.findMany({
    where: { 
      analystId: req.user.sub,
      isActive: true
    },
    include: {
      game: {
        include: {
          homeTeam: true,
          awayTeam: true,
          events: {
            include: {
              tags: {
                include: {
                  analystActions: {
                    where: { analystId: req.user.sub }
                  }
                }
              }
            }
          }
        }
      }
    },
    orderBy: [
      { priority: 'desc' },
      { game: { date: 'asc' } }
    ]
  });

  // Calculate progress for each assignment
  const assignmentsWithProgress = assignments.map(assignment => {
    const totalTags = assignment.game.events.reduce((sum, event) => sum + event.tags.length, 0);
    const completedTags = assignment.game.events.reduce((sum, event) => 
      sum + event.tags.filter(tag => tag.analystActions.length > 0).length, 0
    );
    const progress = totalTags > 0 ? (completedTags / totalTags) * 100 : 0;

    return {
      ...assignment,
      totalTags,
      completedTags,
      progress: Math.round(progress)
    };
  });

  res.json(assignmentsWithProgress);
});

// Get all tags for a specific game
r.get("/games/:gameId/tags", requireAuth(["ANALYST", "ADMIN"]), async (req, res) => {
  const tags = await prisma.tag.findMany({
    where: {
      event: {
        gameId: req.params.gameId
      }
    },
    include: {
      event: {
        select: {
          id: true,
          timestampMs: true,
          videoUrl: true,
          type: true
        }
      },
      createdBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      },
      analystActions: {
        include: {
          analyst: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }
    },
    orderBy: {
      event: {
        timestampMs: 'asc'
      }
    }
  });

  res.json(tags);
});

export default r;
