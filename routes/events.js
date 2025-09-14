import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

const r = Router();

// create event for a game (admin only)
r.post("/", requireAuth(["ADMIN"]), async (req, res) => {
  const { gameId, timestampMs, videoUrl, type } = req.body || {};
  const event = await prisma.event.create({
    data: { gameId, timestampMs, videoUrl, type }
  });
  res.status(201).json(event);
});

// Get tags for an event
r.get("/:eventId/tags", requireAuth(), async (req, res) => {
  const { eventId } = req.params;
  try {
    console.log('Fetching tags for event:', eventId);

    const tags = await prisma.tag.findMany({
      where: { eventId },
      include: {
        createdBy: {
          select: { firstName: true, lastName: true, email: true, role: true }
        },
        analystActions: {
          include: {
            analyst: {
              select: { firstName: true, lastName: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${tags.length} tags for event ${eventId}`);
    res.json(tags);
  } catch (error) {
    console.error('Error fetching event tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Create a tag for an event
r.post("/:eventId/tags", requireAuth(["CHARTER", "ADMIN", "ANALYST"]), async (req, res) => {
  const { eventId } = req.params;
  const { label, notes } = req.body || {};
  const userId = req.user.sub;

  try {
    console.log('Creating tag for event:', eventId, 'by user:', userId);

    const tag = await prisma.tag.create({
      data: {
        eventId,
        createdById: userId,
        label,
        notes: notes || null
      },
      include: {
        createdBy: {
          select: { firstName: true, lastName: true, email: true, role: true }
        }
      }
    });

    console.log('Tag created successfully:', tag.id);
    res.status(201).json(tag);
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

export default r;