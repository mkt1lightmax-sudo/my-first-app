const app = require("./app");

// ✅ Vercel Serverless: export handler
module.exports = (req, res) => app(req, res);
