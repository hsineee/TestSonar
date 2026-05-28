const dashboardRepo = require('../repositories/dashboardRepo');

// ─── Helper: aggregate goals into statistics ────────────────────────────────

/**
 * Given an array of goals, compute all dashboard statistics.
 */
function aggregateGoals(goals) {
  const total = goals.length;

  // Status distribution
  const statusDistribution = {
    ACTIVE: 0,
    COMPLETED: 0,
    REJECTED: 0,
    DISPUTED: 0,
    DISPUTE_RESOLVED: 0,
  };
  for (const g of goals) {
    if (statusDistribution[g.status] !== undefined) {
      statusDistribution[g.status]++;
    }
  }

  // Completion rate (COMPLETED / non-REJECTED total)
  const nonRejected = goals.filter((g) => g.status !== 'REJECTED').length;
  const completionRate =
    nonRejected > 0
      ? Math.round((statusDistribution.COMPLETED / nonRejected) * 100)
      : 0;

  // Average progress (across all goals)
  const avgProgress =
    total > 0
      ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / total)
      : 0;

  // Progress distribution buckets
  const progressDistribution = {
    '0-25': 0,
    '26-50': 0,
    '51-75': 0,
    '76-100': 0,
  };
  for (const g of goals) {
    const p = g.progress;
    if (p <= 25) progressDistribution['0-25']++;
    else if (p <= 50) progressDistribution['26-50']++;
    else if (p <= 75) progressDistribution['51-75']++;
    else progressDistribution['76-100']++;
  }

  return { total, statusDistribution, completionRate, avgProgress, progressDistribution };
}

/**
 * Given goals and a list of all users in scope, compute per-KPI alignment.
 * "aligned" = user has at least one non-REJECTED goal for that KPI.
 */
function computeKpiAlignment(goals, allUserIds) {
  const kpiMap = new Map(); // kpiId → { kpi, userIdsWithGoal: Set, goalCount }

  for (const g of goals) {
    const kpiId = g.kpi.id;
    if (!kpiMap.has(kpiId)) {
      kpiMap.set(kpiId, { kpi: g.kpi, userIdsWithGoal: new Set(), goalCount: 0 });
    }
    const entry = kpiMap.get(kpiId);
    entry.goalCount++;
    if (g.status !== 'REJECTED') {
      entry.userIdsWithGoal.add(g.userId);
    }
  }

  return Array.from(kpiMap.values()).map(({ kpi, userIdsWithGoal, goalCount }) => ({
    kpiId: kpi.id,
    kpiTitle: kpi.title,
    quarter: kpi.quarter,
    goalCount,
    alignedUsers: userIdsWithGoal.size,
    totalUsers: allUserIds.length,
    alignmentRate:
      allUserIds.length > 0
        ? Math.round((userIdsWithGoal.size / allUserIds.length) * 100)
        : 0,
  }));
}

/**
 * Given goals and a list of direct reports, compute per-person breakdown.
 */
function computeTeamBreakdown(goals, directReports) {
  return directReports.map((member) => {
    const memberGoals = goals.filter((g) => g.userId === member.id);
    const stats = aggregateGoals(memberGoals);
    return {
      userId: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      ...stats,
    };
  });
}

// ─── Service functions ───────────────────────────────────────────────────────

/**
 * Main dashboard summary for a manager.
 * Includes stats for the manager's entire reporting hierarchy.
 *
 * @param {string} managerId — the logged-in manager's userId
 * @param {object} options
 * @param {string} [options.quarter] — optional KPI quarter filter (e.g. "2026Q2")
 * @returns {object} full dashboard payload
 */
async function getDashboardSummary(managerId, { quarter } = {}) {
  const [subordinateIds, directReports, quarters] = await Promise.all([
    dashboardRepo.getAllSubordinateIds(managerId),
    dashboardRepo.getDirectReports(managerId),
    dashboardRepo.getAvailableQuarters(),
  ]);

  // If no subordinates, return empty stats
  if (subordinateIds.length === 0) {
    return {
      summary: { total: 0, completionRate: 0, avgProgress: 0 },
      statusDistribution: { ACTIVE: 0, COMPLETED: 0, REJECTED: 0, DISPUTED: 0, DISPUTE_RESOLVED: 0 },
      progressDistribution: { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 },
      kpiAlignment: [],
      teamBreakdown: [],
      availableQuarters: quarters,
      selectedQuarter: quarter || null,
    };
  }

  const goals = await dashboardRepo.getGoalsForUsers(subordinateIds, quarter);

  const { total, statusDistribution, completionRate, avgProgress, progressDistribution } =
    aggregateGoals(goals);

  const kpiAlignment = computeKpiAlignment(goals, subordinateIds);
  const teamBreakdown = computeTeamBreakdown(goals, directReports);

  // Overall KPI alignment rate (at least one non-rejected goal)
  const alignedSubordinates = new Set(
    goals.filter((g) => g.status !== 'REJECTED').map((g) => g.userId)
  ).size;
  const overallAlignmentRate =
    subordinateIds.length > 0
      ? Math.round((alignedSubordinates / subordinateIds.length) * 100)
      : 0;

  return {
    summary: { total, completionRate, avgProgress, overallAlignmentRate },
    statusDistribution,
    progressDistribution,
    kpiAlignment,
    teamBreakdown,
    availableQuarters: quarters,
    selectedQuarter: quarter || null,
  };
}

/**
 * Drill-down: get dashboard summary for a specific sub-manager's team.
 * The requesting manager must be an ancestor of the target manager.
 *
 * @param {string} requestingManagerId — logged-in user
 * @param {string} targetManagerId — the manager to drill into
 * @param {object} options
 * @param {string} [options.quarter]
 */
async function getDrillDown(requestingManagerId, targetManagerId, { quarter } = {}) {
  // Security: verify targetManager is actually in the requester's hierarchy
  const subordinateIds = await dashboardRepo.getAllSubordinateIds(requestingManagerId);
  if (!subordinateIds.includes(targetManagerId) && requestingManagerId !== targetManagerId) {
    const err = new Error('You can only drill down into your own reporting hierarchy');
    err.status = 403;
    throw err;
  }

  return getDashboardSummary(targetManagerId, { quarter });
}

module.exports = { getDashboardSummary, getDrillDown };
