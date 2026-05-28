const { z } = require('zod');
const dailyOutputRepo = require('../repositories/dailyOutputRepo');
const userRepo = require('../repositories/userRepo');
const auditService = require('./auditService');

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const createLogSchema = z.object({
  tagId: z.string().min(1, 'tagId is required'),
  value: z.coerce.number().positive('value must be greater than 0'),
  logDate: z.string().regex(DATE_ONLY_RE, 'logDate must be YYYY-MM-DD'),
  note: z.string().max(500, 'note must be <= 500 characters').optional().nullable(),
});

const weekQuerySchema = z.object({
  weekStart: z.string().regex(DATE_ONLY_RE, 'weekStart must be YYYY-MM-DD').optional(),
});

const listQuerySchema = z.object({
  from: z.string().regex(DATE_ONLY_RE, 'from must be YYYY-MM-DD').optional(),
  to: z.string().regex(DATE_ONLY_RE, 'to must be YYYY-MM-DD').optional(),
});

function makeError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseDateOnly(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function startOfUtcWeek(date = new Date()) {
  const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = normalized.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setUTCDate(normalized.getUTCDate() + diff);
  return normalized;
}

function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getWeekRange(weekStart) {
  const start = weekStart ? parseDateOnly(weekStart) : startOfUtcWeek(new Date());
  const end = addUtcDays(start, 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

function buildWeeklyReport({ logs, tags, users, start, end }) {
  const dates = Array.from({ length: 7 }, (_, idx) => formatDateOnly(addUtcDays(start, idx)));
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const userMap = new Map((users || []).map((user) => [user.id, user]));

  const byTag = new Map();
  const byUser = new Map();
  const dailyTotals = dates.map((date) => ({ date, totalValue: 0, count: 0 }));
  const dailyIndex = new Map(dailyTotals.map((item) => [item.date, item]));

  for (const tag of tags) {
    byTag.set(tag.id, {
      tagId: tag.id,
      code: tag.code,
      name: tag.name,
      unit: tag.unit,
      total: 0,
      count: 0,
      avgPerEntry: 0,
      daily: dates.map((date) => ({ date, value: 0, count: 0 })),
    });
  }

  for (const user of users || []) {
    byUser.set(user.id, {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      totalEntries: 0,
      byTag: tags.map((tag) => ({
        tagId: tag.id,
        code: tag.code,
        name: tag.name,
        unit: tag.unit,
        total: 0,
        count: 0,
      })),
    });
  }

  logs.forEach((log) => {
    const tag = log.tag || tagMap.get(log.tagId);
    if (!tag) return;

    const date = formatDateOnly(log.logDate);
    const value = Number(log.value);

    if (!byTag.has(tag.id)) {
      byTag.set(tag.id, {
        tagId: tag.id,
        code: tag.code,
        name: tag.name,
        unit: tag.unit,
        total: 0,
        count: 0,
        avgPerEntry: 0,
        daily: dates.map((d) => ({ date: d, value: 0, count: 0 })),
      });
    }

    const tagSummary = byTag.get(tag.id);
    tagSummary.total += value;
    tagSummary.count += 1;

    const tagDaily = tagSummary.daily.find((item) => item.date === date);
    if (tagDaily) {
      tagDaily.value += value;
      tagDaily.count += 1;
    }

    const daily = dailyIndex.get(date);
    if (daily) {
      daily.totalValue += value;
      daily.count += 1;
    }

    const userId = log.userId;
    if (userId && !byUser.has(userId) && log.user) {
      byUser.set(userId, {
        userId,
        name: log.user.name,
        email: log.user.email,
        role: log.user.role,
        totalEntries: 0,
        byTag: tags.map((t) => ({
          tagId: t.id,
          code: t.code,
          name: t.name,
          unit: t.unit,
          total: 0,
          count: 0,
        })),
      });
    }

    const userSummary = byUser.get(userId);
    if (userSummary) {
      userSummary.totalEntries += 1;
      let userTag = userSummary.byTag.find((item) => item.tagId === tag.id);
      if (!userTag) {
        userTag = { tagId: tag.id, code: tag.code, name: tag.name, unit: tag.unit, total: 0, count: 0 };
        userSummary.byTag.push(userTag);
      }
      userTag.total += value;
      userTag.count += 1;
    }
  });

  const byTagArray = Array.from(byTag.values()).map((item) => ({
    ...item,
    total: Number(item.total.toFixed(2)),
    avgPerEntry: item.count > 0 ? Number((item.total / item.count).toFixed(2)) : 0,
    daily: item.daily.map((day) => ({ ...day, value: Number(day.value.toFixed(2)) })),
  }));

  const byUserArray = Array.from(byUser.values()).map((user) => ({
    ...user,
    byTag: user.byTag.map((tag) => ({ ...tag, total: Number(tag.total.toFixed(2)) })),
  }));

  return {
    weekStart: formatDateOnly(start),
    weekEnd: formatDateOnly(end),
    totalEntries: logs.length,
    byTag: byTagArray,
    dailyTotals: dailyTotals.map((day) => ({ ...day, totalValue: Number(day.totalValue.toFixed(2)) })),
    users: byUserArray,
  };
}

async function getTags() {
  return dailyOutputRepo.findActiveTags();
}

async function createLog(data, userId) {
  const parsed = createLogSchema.safeParse(data);
  if (!parsed.success) {
    throw makeError(parsed.error.errors[0].message, 400);
  }

  const tag = await dailyOutputRepo.findTagById(parsed.data.tagId);
  if (!tag || !tag.isActive) {
    throw makeError('Output tag not found or inactive', 404);
  }

  const log = await dailyOutputRepo.createLog({
    userId,
    tagId: parsed.data.tagId,
    value: parsed.data.value,
    logDate: parseDateOnly(parsed.data.logDate),
    note: parsed.data.note?.trim() || null,
  });

  await auditService.log({
    action: 'DAILY_OUTPUT_LOG_CREATED',
    userId,
    targetId: log.id,
    targetType: 'DailyOutputLog',
    meta: {
      tagCode: tag.code,
      tagName: tag.name,
      value: log.value,
      unit: tag.unit,
      logDate: parsed.data.logDate,
    },
  });

  return log;
}

async function listMyLogs(userId, query = {}) {
  const parsed = listQuerySchema.safeParse(query);
  if (!parsed.success) throw makeError(parsed.error.errors[0].message, 400);

  const now = new Date();
  const defaultFrom = addUtcDays(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())), -30);
  const from = parsed.data.from ? parseDateOnly(parsed.data.from) : defaultFrom;
  const to = parsed.data.to ? parseDateOnly(parsed.data.to) : undefined;
  if (to) to.setUTCHours(23, 59, 59, 999);

  return dailyOutputRepo.findLogsByUserId(userId, { from, to });
}

async function deleteMyLog(logId, userId) {
  const log = await dailyOutputRepo.findLogById(logId);
  if (!log) throw makeError('Daily output log not found', 404);
  if (log.userId !== userId) throw makeError('You can only delete your own output logs', 403);

  await dailyOutputRepo.deleteLog(logId);
  await auditService.log({
    action: 'DAILY_OUTPUT_LOG_DELETED',
    userId,
    targetId: logId,
    targetType: 'DailyOutputLog',
    meta: { tagCode: log.tag?.code, value: log.value, logDate: formatDateOnly(log.logDate) },
  });

  return { ok: true };
}

async function getMyWeeklyReport(userId, query = {}) {
  const parsed = weekQuerySchema.safeParse(query);
  if (!parsed.success) throw makeError(parsed.error.errors[0].message, 400);

  const { start, end } = getWeekRange(parsed.data.weekStart);
  const [tags, logs] = await Promise.all([
    dailyOutputRepo.findActiveTags(),
    dailyOutputRepo.findLogsByUserId(userId, { from: start, to: end }),
  ]);

  return buildWeeklyReport({ logs, tags, users: [], start, end });
}

async function getTeamWeeklyReport(requestor, query = {}) {
  const parsed = weekQuerySchema.safeParse(query);
  if (!parsed.success) throw makeError(parsed.error.errors[0].message, 400);

  const { start, end } = getWeekRange(parsed.data.weekStart);
  const tags = await dailyOutputRepo.findActiveTags();

  let users = [];
  if (requestor.role === 'HR') {
    users = await userRepo.listAll({ isActive: true });
    users = users.filter((user) => user.role !== 'HR');
  } else if (requestor.role === 'MANAGER') {
    const [self, reportIds] = await Promise.all([
      userRepo.findById(requestor.userId),
      userRepo.findAllReportsRecursive(requestor.userId),
    ]);
    if (reportIds.length === 0) {
      return buildWeeklyReport({ logs: [], tags, users: [], start, end });
    }
    const candidates = await userRepo.listAll({ isActive: true });
    users = candidates.filter((user) => reportIds.includes(user.id) && user.departmentId === self?.departmentId);
  }

  const userIds = users.map((user) => user.id);
  const logs = await dailyOutputRepo.findLogsByUserIds(userIds, { from: start, to: end });

  return buildWeeklyReport({ logs, tags, users, start, end });
}

module.exports = {
  getTags,
  createLog,
  listMyLogs,
  deleteMyLog,
  getMyWeeklyReport,
  getTeamWeeklyReport,
};
