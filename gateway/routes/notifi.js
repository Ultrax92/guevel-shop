// gateway/routes/notifi.js
/** @module gateway/routes/notifi */
const express = require('express');
const proxy = require('express-http-proxy');

const router = express.Router();

router.use(
  '/',
  proxy(() => process.env.NOTIFI_SERVICE_URL, {
    proxyReqPathResolver: (req) => req.originalUrl,
  })
);

module.exports = router;
