
import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

const r = Router();

r.post("/:tagId", requireAuth(["ANALYST","ADMIN"]), async (req, res) => {
  const { action, comment } = req.body || {};
  const created = await prisma.analystAction.create({
    data: { tagId: req.params.tagId, analystId: req.user.sub, action, comment }
  });
  res.status(201).json(created);
});

export default r;
