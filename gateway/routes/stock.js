// gateway/routes/stock.js
/** @module gateway/routes/stock */
const express = require('express');
const proxy = require('express-http-proxy');

const router = express.Router();

router.use(
  '/',
  proxy(() => process.env.STOCK_SERVICE_URL, {
    proxyReqPathResolver: (req) => req.originalUrl,
  })
);

module.exports = router;
