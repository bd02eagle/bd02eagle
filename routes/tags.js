
import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

const r = Router();

// get all tags for review management (analyst/admin)
r.get("/", requireAuth(["ANALYST","ADMIN"]), async (req, res) => {
  const tags = await prisma.tag.findMany({
    include: { 
      analystActions: {
        include: {
          analyst: { select: { id: true, email: true, role: true } }
        }
      },
      createdBy: { select: { id: true, email: true, role: true } },
      event: {
        include: {
          game: { select: { id: true, date: true, homeTeam: true, awayTeam: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(tags);
});

// list tags for an event
r.get("/events/:eventId", requireAuth(["ADMIN","ANALYST","CHARTER"]), async (req, res) => {
  const tags = await prisma.tag.findMany({ 
    where: { eventId: req.params.eventId },
    include: { analystActions: true, createdBy: { select: { id: true, email: true, role: true } } }
  });
  res.json(tags);
});

// create tag on an event (charter/admin)
r.post("/events/:eventId", requireAuth(["CHARTER","ADMIN"]), async (req, res) => {
  const { label, notes } = req.body || {};
  const tag = await prisma.tag.create({
    data: { eventId: req.params.eventId, createdById: req.user.sub, label, notes }
  });
  res.status(201).json(tag);
});

// edit tag (owner/admin)
r.patch("/:tagId", requireAuth(["CHARTER","ADMIN"]), async (req, res) => {
  const tag = await prisma.tag.update({ where: { id: req.params.tagId }, data: req.body });
  res.json(tag);
});

// delete tag (owner/admin)
r.delete("/:tagId", requireAuth(["CHARTER","ADMIN"]), async (req, res) => {
  await prisma.tag.delete({ where: { id: req.params.tagId } });
  res.status(204).end();
});

// create analyst action on a tag (analyst/admin)
r.post("/:tagId/analyst-actions", requireAuth(["ANALYST","ADMIN"]), async (req, res) => {
  const { action, comment } = req.body || {};
  const analystAction = await prisma.analystAction.create({
    data: { 
      tagId: req.params.tagId, 
      analystId: req.user.sub, 
      action, 
      comment 
    }
  });
  res.status(201).json(analystAction);
});

export default r;
