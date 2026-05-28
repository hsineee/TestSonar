const {
  SUPPORTED_LOCALES,
  normalizeLocale,
  normalizeTimezone,
  parseAcceptLanguage,
} = require('../config/globalization');

function globalizationMiddleware(req, res, next) {
  const requestedLocale = req.get('X-Client-Locale') || parseAcceptLanguage(req.get('Accept-Language'));
  const requestedTimezone = req.get('X-Client-Timezone');

  const locale = normalizeLocale(requestedLocale);
  const timezone = normalizeTimezone(requestedTimezone);

  req.globalization = {
    locale,
    timezone,
    supportedLocales: SUPPORTED_LOCALES,
  };

  res.setHeader('X-Resolved-Locale', locale);
  res.setHeader('X-Resolved-Timezone', timezone);
  next();
}

module.exports = { globalizationMiddleware };
