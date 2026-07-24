const { verifyToken, COOKIE_NAME } = require("../lib/jwt");

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ ok: false, error: "not authenticated" });
  }
  try {
    req.staff = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "invalid or expired session" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.staff || !roles.includes(req.staff.role)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
