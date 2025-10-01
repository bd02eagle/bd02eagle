// wnba_stats_video.js
// ESM module: Node 18+
// Usage examples:
//   import { wnbaVideoDetailsAsset, wnbaVideoDetails, wnbaVideoEvents, wnbaVideoStatus } from './wnba_stats_video.js';
//   const { videoUrls, playlist } = await wnbaVideoDetailsAsset({ player_id: '1627668', team_id: '1611661328' });
//   const ev = await wnbaVideoEvents({ game_id: '1022200075', game_event_id: '10' });
//
// This mirrors the wehoop::wnba_* video functions that call stats.wnba.com "stats" endpoints.
// Docs: https://wehoop.sportsdataverse.org/reference/index.html (see video functions)
//
// Endpoints (GET):
//   /stats/videodetailsasset
//   /stats/videodetails
//   /stats/videoevents?GameID=1022200075&GameEventID=10
//   /stats/videostatus?GameID=1022200075
//
// Returns (typical):
//   { resultSets: { Meta: { videoUrls: [...] }, playlist: [...] } }
//
// If the API shape changes (sometimes an array of resultSets), we attempt to coerce into
//   { videoUrls: [], playlist: [] } for convenience.

const STATS_BASE = "https://stats.wnba.com/stats";

/** Headers to avoid 403 on stats.wnba.com */
function defaultHeaders() {
  return {
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "origin": "https://stats.wnba.com",
    "referer": "https://stats.wnba.com/",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    // NBA/Stats sometimes inspects these; harmless to include
    "x-nba-stats-origin": "stats",
    "x-nba-stats-token": "true",
  };
}

/** Build URL with query params */
function buildUrl(endpoint, params = {}) {
  const url = new URL(`${STATS_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/** GET JSON helper with robust error info */
async function fetchJson(url) {
  const res = await fetch(url, { headers: defaultHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}\n${text.slice(0, 500)}`);
  }
  return res.json();
}

/** Extract { videoUrls, playlist } from a stats response regardless of minor shape differences */
function coerceVideoResponse(resp) {
  // Primary (wehoop expected) shape
  const rs = resp?.resultSets;
  const metaVideo = rs?.Meta?.videoUrls ?? rs?.meta?.videoUrls ?? rs?.Video ?? rs?.videoUrls ?? null;
  const playlist = rs?.playlist ?? rs?.Playlist ?? rs?.PlayList ?? null;

  const out = { videoUrls: [], playlist: [] };

  if (Array.isArray(metaVideo)) out.videoUrls = metaVideo;
  if (Array.isArray(playlist)) out.playlist = playlist;

  // Some endpoints ship { resultSets: [ { name, headers, rowSet }, ... ] }
  if ((!out.videoUrls.length || !out.playlist.length) && Array.isArray(rs)) {
    for (const set of rs) {
      if (typeof set?.name === "string") {
        if (/video/i.test(set.name) && Array.isArray(set.rowSet)) {
          // Map rowSet to objects via headers if present
          const headers = Array.isArray(set.headers) ? set.headers : [];
          const rows = Array.isArray(set.rowSet) ? set.rowSet : [];
          const objs = rows.map((row) => {
            const obj = {};
            row.forEach((val, i) => (obj[headers[i] ?? `col_${i}`] = val));
            return obj;
          });
          out.videoUrls = out.videoUrls.length ? out.videoUrls : objs;
        }
        if (/playlist/i.test(set.name) && Array.isArray(set.rowSet)) {
          const headers = Array.isArray(set.headers) ? set.headers : [];
          const rows = Array.isArray(set.rowSet) ? set.rowSet : [];
          const objs = rows.map((row) => {
            const obj = {};
            row.forEach((val, i) => (obj[headers[i] ?? `col_${i}`] = val));
            return obj;
          });
          out.playlist = out.playlist.length ? out.playlist : objs;
        }
      }
    }
  }

  return out;
}

/**
 * wnba_videodetailsasset R analog
 * Params mirror the R function (camelCase for JS):
 * ahead_behind, clutch_time, context_filter, context_measure='FGA', date_from, date_to,
 * end_period, end_range, game_id, game_segment, last_n_games=0, league_id='10', location,
 * month=0, opponent_team_id=0, outcome, period=0, player_id, point_diff, position,
 * range_type, rookie_year, season, season_segment, season_type='Regular Season',
 * start_period, start_range, team_id, vs_conference, vs_division
 */
export async function wnbaVideoDetailsAsset(params = {}) {
  const q = {
    AheadBehind: params.ahead_behind ?? "",
    ClutchTime: params.clutch_time ?? "",
    ContextFilter: params.context_filter ?? "",
    ContextMeasure: params.context_measure ?? "FGA",
    DateFrom: params.date_from ?? "",
    DateTo: params.date_to ?? "",
    EndPeriod: params.end_period ?? "",
    EndRange: params.end_range ?? "",
    GameID: params.game_id ?? "",
    GameSegment: params.game_segment ?? "",
    LastNGames: params.last_n_games ?? 0,
    LeagueID: params.league_id ?? "10",
    Location: params.location ?? "",
    Month: params.month ?? 0,
    OpponentTeamID: params.opponent_team_id ?? 0,
    Outcome: params.outcome ?? "",
    Period: params.period ?? 0,
    PlayerID: params.player_id ?? "",
    PointDiff: params.point_diff ?? "",
    Position: params.position ?? "",
    RangeType: params.range_type ?? "",
    RookieYear: params.rookie_year ?? "",
    Season: params.season ?? "",
    SeasonSegment: params.season_segment ?? "",
    SeasonType: params.season_type ?? "Regular Season",
    StartPeriod: params.start_period ?? "",
    StartRange: params.start_range ?? "",
    TeamID: params.team_id ?? "",
    VsConference: params.vs_conference ?? "",
    VsDivision: params.vs_division ?? "",
  };
  const url = buildUrl("videodetailsasset", q);
  const resp = await fetchJson(url);
  return coerceVideoResponse(resp);
}

/** wnba_videodetails R analog */
export async function wnbaVideoDetails(params = {}) {
  // Same params as asset; endpoint differs
  const q = {
    AheadBehind: params.ahead_behind ?? "",
    ClutchTime: params.clutch_time ?? "",
    ContextFilter: params.context_filter ?? "",
    ContextMeasure: params.context_measure ?? "FGA",
    DateFrom: params.date_from ?? "",
    DateTo: params.date_to ?? "",
    EndPeriod: params.end_period ?? "",
    EndRange: params.end_range ?? "",
    GameID: params.game_id ?? "",
    GameSegment: params.game_segment ?? "",
    LastNGames: params.last_n_games ?? 0,
    LeagueID: params.league_id ?? "10",
    Location: params.location ?? "",
    Month: params.month ?? 0,
    OpponentTeamID: params.opponent_team_id ?? 0,
    Outcome: params.outcome ?? "",
    Period: params.period ?? 0,
    PlayerID: params.player_id ?? "",
    PointDiff: params.point_diff ?? "",
    Position: params.position ?? "",
    RangeType: params.range_type ?? "",
    RookieYear: params.rookie_year ?? "",
    Season: params.season ?? "",
    SeasonSegment: params.season_segment ?? "",
    SeasonType: params.season_type ?? "Regular Season",
    StartPeriod: params.start_period ?? "",
    StartRange: params.start_range ?? "",
    TeamID: params.team_id ?? "",
    VsConference: params.vs_conference ?? "",
    VsDivision: params.vs_division ?? "",
  };
  const url = buildUrl("videodetails", q);
  const resp = await fetchJson(url);
  return coerceVideoResponse(resp);
}

/** wnba_videoevents R analog */
export async function wnbaVideoEvents({ game_id, game_event_id }) {
  if (!game_id || typeof game_id !== "string") {
    throw new Error("game_id (string) is required");
  }
  if (!game_event_id) {
    throw new Error("game_event_id is required");
  }
  const url = buildUrl("videoevents", { GameID: game_id, GameEventID: game_event_id });
  const resp = await fetchJson(url);
  return coerceVideoResponse(resp);
}

/** wnba_videostatus R analog */
export async function wnbaVideoStatus({ game_id }) {
  if (!game_id || typeof game_id !== "string") {
    throw new Error("game_id (string) is required");
  }
  const url = buildUrl("videostatus", { GameID: game_id });
  const resp = await fetchJson(url);
  // Status endpoints sometimes include playlist/meta too; coerce if present.
  const coerced = coerceVideoResponse(resp);
  // Also return raw for callers who want status fields
  return { ...coerced, raw: resp };
}

// Simple CLI demo:
//   node --input-type=module wnba_stats_video.js events 1022200075 10
//   node --input-type=module wnba_stats_video.js detailsAsset 1627668 1611661328
if (import.meta && import.meta.url && process.argv[1] === new URL(import.meta.url).pathname) {
  const cmd = (process.argv[2] || "").toLowerCase();
  const arg1 = process.argv[3];
  const arg2 = process.argv[4];

  if (!cmd || cmd === "help") {
    console.error("Usage:");
    console.error("  node --input-type=module wnba_stats_video.js events <GameID> <GameEventID>");
    console.error("  node --input-type=module wnba_stats_video.js status <GameID>");
    console.error("  node --input-type=module wnba_stats_video.js details <PlayerID> <TeamID>");
    console.error("  node --input-type=module wnba_stats_video.js detailsAsset <PlayerID> <TeamID>");
    process.exit(1);
  }

  const ensureFetch = async () => {
    if (typeof fetch === "undefined") {
      const { default: nodeFetch } = await import("node-fetch");
      globalThis.fetch = nodeFetch;
    }
  };

  (async () => {
    await ensureFetch();
    try {
      if (cmd === "events") {
        const out = await wnbaVideoEvents({ game_id: arg1, game_event_id: arg2 });
        process.stdout.write(JSON.stringify(out, null, 2));
      } else if (cmd === "status") {
        const out = await wnbaVideoStatus({ game_id: arg1 });
        process.stdout.write(JSON.stringify(out, null, 2));
      } else if (cmd === "details") {
        const out = await wnbaVideoDetails({ player_id: arg1, team_id: arg2 });
        process.stdout.write(JSON.stringify(out, null, 2));
      } else if (cmd === "detailsasset") {
        const out = await wnbaVideoDetailsAsset({ player_id: arg1, team_id: arg2 });
        process.stdout.write(JSON.stringify(out, null, 2));
      } else {
        throw new Error("Unknown command");
      }
    } catch (e) {
      console.error(e?.stack || String(e));
      process.exit(2);
    }
  })();
}