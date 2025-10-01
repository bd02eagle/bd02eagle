// routes/video.js
import { Router } from "express";
import { cached } from "../lib/cache.js";
import { resolveWnbaGameId } from "../lib/game_id_resolver.js";
import {
  wnbaVideoStatus,
  wnbaVideoEvents,
  wnbaVideoDetails,
  wnbaVideoDetailsAsset,
} from "../lib/wnba_stats_video.js";

// Optional auth middleware (uncomment if you have one):
// import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Health check (optional)
router.get("/healthz", (_, res) => res.json({ ok: true, service: "wnba-video" }));

/**
 * Resolve GAME_ID from date + teams
 * GET /api/wnba/game-id?date=YYYY-MM-DD&home=TEAM_ID&away=TEAM_ID
 */
router.get("/game-id", async (req, res) => {
  const { date, home, away } = req.query;
  if (!date || !home || !away) {
    return res.status(400).json({ error: "Required: date, home, away" });
  }
  try {
    const key = `gid:${date}:${home}:${away}`;
    const gameId = await cached(key, 86_400_000, () =>
      resolveWnbaGameId({ gameDate: String(date), homeTeamId: String(home), awayTeamId: String(away) })
    );
    res.json({ gameId });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

/**
 * Video status proxy
 * GET /api/wnba/video/status?game_id=GAME_ID
 */
router.get("/video/status", async (req, res) => {
  const { game_id } = req.query;
  if (!game_id) return res.status(400).json({ error: "Required: game_id" });
  try {
    const data = await cached(`vstat:${game_id}`, 60_000, () => wnbaVideoStatus({ game_id: String(game_id) }));
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

/**
 * Video events proxy
 * GET /api/wnba/video/events?game_id=GAME_ID&game_event_id=10
 */
router.get("/video/events", async (req, res) => {
  const { game_id, game_event_id } = req.query;
  if (!game_id || !game_event_id) {
    return res.status(400).json({ error: "Required: game_id, game_event_id" });
  }
  try {
    const key = `vev:${game_id}:${game_event_id}`;
    const data = await cached(key, 60_000, () =>
      wnbaVideoEvents({ game_id: String(game_id), game_event_id: String(game_event_id) })
    );
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

/**
 * Video details proxies (optional but handy)
 * GET /api/wnba/video/details?PlayerID=...&TeamID=...&SeasonType=Regular%20Season
 * GET /api/wnba/video/details-asset?PlayerID=...&TeamID=...
 */
router.get("/video/details", async (req, res) => {
  try {
    const data = await wnbaVideoDetails(req.query);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

router.get("/video/details-asset", async (req, res) => {
  try {
    const data = await wnbaVideoDetailsAsset(req.query);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

export default router;
