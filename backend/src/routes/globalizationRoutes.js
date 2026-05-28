const express = require('express');
const {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
} = require('../config/globalization');

const router = express.Router();

router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    defaultLocale: DEFAULT_LOCALE,
    defaultTimezone: DEFAULT_TIMEZONE,
    supportedLocales: SUPPORTED_LOCALES,
    request: req.globalization,
  });
});

module.exports = router;
