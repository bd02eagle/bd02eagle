import { LRUCache } from "lru-cache";

export const cache = new LRUCache({ max: 500, ttl: 60_000 }); // 60s default

export function cached(key, ttlMs, compute) {
  const hit = cache.get(key);
  if (hit !== undefined) return Promise.resolve(hit);
  return Promise.resolve(compute()).then((val) => {
    cache.set(key, val, { ttl: ttlMs });
    return val;
  });
}
