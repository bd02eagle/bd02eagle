
import jwt from "jsonwebtoken";

export function requireAuth(roles = []) {
  return (req, res, next) => {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || "dev");
      if (roles.length && !roles.includes(payload.role)) return res.status(403).json({ error: "Forbidden" });
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: "Unauthorized" });
    }
  };
}
