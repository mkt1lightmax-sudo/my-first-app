const app = require("../server/app");

// ✅ Vercel Serverless: export handler
module.exports = (req, res) => app(req, res);
