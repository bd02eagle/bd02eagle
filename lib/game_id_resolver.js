// lib/game_id_resolver.js
const STATS = "https://stats.wnba.com/stats";
const headers = {
  accept: "application/json, text/plain, */*",
  origin: "https://stats.wnba.com",
  referer: "https://stats.wnba.com/",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
};

function qs(obj) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v != null) u.set(k, v);
  return u.toString();
}

async function fetchJson(url) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

export async function resolveWnbaGameId({ gameDate, homeTeamId, awayTeamId }) {
  const tryDates = [gameDate]; // add +/- one day if you want resiliency
  for (const d of tryDates) {
    const url = `${STATS}/scoreboardv2?${qs({ LeagueID: "10", GameDate: d, DayOffset: 0 })}`;
    const data = await fetchJson(url);
    const sets = data?.resultSets;
    const H = sets?.GameHeader?.headers;
    const R = sets?.GameHeader?.rowSet;
    if (Array.isArray(H) && Array.isArray(R)) {
      const idx = Object.fromEntries(H.map((h, i) => [h, i]));
      const match = R.find(
        (row) =>
          String(row[idx.HOME_TEAM_ID]) === String(homeTeamId) &&
          String(row[idx.VISITOR_TEAM_ID]) === String(awayTeamId)
      );
      if (match) return String(match[idx.GAME_ID]);

      // fallback: ignore home/away if needed
      const want = [String(homeTeamId), String(awayTeamId)].sort().join("-");
      const loose = R.find((row) => {
        const pair = [String(row[idx.HOME_TEAM_ID]), String(row[idx.VISITOR_TEAM_ID])]
          .sort()
          .join("-");
        return pair === want;
      });
      if (loose) return String(loose[idx.GAME_ID]);
    }
  }
  throw new Error(`Could not resolve GAME_ID for ${gameDate} ${awayTeamId}@${homeTeamId}`);
}
