const SUPPORTED_LOCALES = (process.env.SUPPORTED_LOCALES || 'zh-TW,en-US,ja-JP')
  .split(',')
  .map((locale) => locale.trim())
  .filter(Boolean);

const DEFAULT_LOCALE = process.env.DEFAULT_LOCALE || 'zh-TW';
const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'UTC';

function normalizeLocale(locale) {
  if (!locale) return DEFAULT_LOCALE;
  const normalized = String(locale).trim();
  const exact = SUPPORTED_LOCALES.find((supported) => supported.toLowerCase() === normalized.toLowerCase());
  if (exact) return exact;

  const language = normalized.split('-')[0].toLowerCase();
  const byLanguage = SUPPORTED_LOCALES.find((supported) => supported.split('-')[0].toLowerCase() === language);
  return byLanguage || DEFAULT_LOCALE;
}

function parseAcceptLanguage(headerValue) {
  if (!headerValue) return null;
  return String(headerValue)
    .split(',')
    .map((entry) => {
      const [locale, qValue] = entry.trim().split(';q=');
      return { locale, quality: qValue ? Number(qValue) : 1 };
    })
    .filter((entry) => entry.locale)
    .sort((a, b) => b.quality - a.quality)[0]?.locale;
}

function normalizeTimezone(timezone) {
  const candidate = timezone || DEFAULT_TIMEZONE;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

module.exports = {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  normalizeLocale,
  normalizeTimezone,
  parseAcceptLanguage,
};
