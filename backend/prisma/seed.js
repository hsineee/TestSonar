const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { encrypt } = require('../src/utils/cryptoUtils');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with integrated multi-module architecture...');

  await prisma.performancePeriod.deleteMany({});
  await prisma.dailyOutputLog.deleteMany({});
  await prisma.dailyOutputTag.deleteMany({});
  await prisma.feedbackEntry.deleteMany({});
  await prisma.performanceReview.deleteMany({});
  await prisma.levelStandard.deleteMany({});
  await prisma.reviewTemplate.deleteMany({});
  await prisma.goal.deleteMany({});
  await prisma.kpi.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.department.deleteMany({});

  const startOfWeek = (date = new Date()) => {
    const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = normalized.getUTCDay();
    normalized.setUTCDate(normalized.getUTCDate() + (day === 0 ? -6 : 1 - day));
    return normalized;
  };

  const addDays = (date, days) => {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  };

  const passwordHash = await bcrypt.hash('password123', 10);

  // --- Departments ---
  const deptA = await prisma.department.create({ data: { name: '部門A' } });
  const deptB = await prisma.department.create({ data: { name: '部門B' } });

  // --- 部門A users ---
  const hr = await prisma.user.create({
    data: { email: 'hr@test.com', passwordHash, name: 'HR Admin', role: 'HR' },
  });

  const upperManager = await prisma.user.create({
    data: {
      email: 'upper-manager@test.com',
      passwordHash,
      name: encrypt('Upper Manager Chen'),
      role: 'MANAGER',
      departmentId: deptA.id,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@test.com',
      passwordHash,
      name: encrypt('Manager Wang'),
      role: 'MANAGER',
      managerId: upperManager.id,
      departmentId: deptA.id,
    },
  });

  const employee = await prisma.user.create({
    data: {
      email: 'employee@test.com',
      passwordHash,
      name: encrypt('Employee Chen'),
      role: 'EMPLOYEE',
      managerId: manager.id,
      level: 'Junior Engineer',
      departmentId: deptA.id,
    },
  });

  const employee2 = await prisma.user.create({
    data: {
      email: 'employee2@test.com',
      passwordHash,
      name: encrypt('Employee Lin'),
      role: 'EMPLOYEE',
      managerId: manager.id,
      level: 'Senior Engineer',
      departmentId: deptA.id,
    },
  });

  // --- 部門B users ---
  const managerB = await prisma.user.create({
    data: {
      email: 'manager-b@test.com',
      passwordHash,
      name: encrypt('Manager Li (部門B)'),
      role: 'MANAGER',
      departmentId: deptB.id,
    },
  });

  await prisma.user.create({
    data: {
      email: 'employee-b@test.com',
      passwordHash,
      name: encrypt('Employee Wu (部門B)'),
      role: 'EMPLOYEE',
      managerId: managerB.id,
      level: 'Junior Engineer',
      departmentId: deptB.id,
    },
  });


  console.log('Creating daily output preset tags...');
  const outputTagCodeReview = await prisma.dailyOutputTag.create({
    data: {
      code: 'CODE_REVIEW',
      name: 'Code Review',
      unit: '件',
      description: '完成或審閱的 Pull Request / Merge Request 數量',
      sortOrder: 10,
    },
  });

  const outputTagFeature = await prisma.dailyOutputTag.create({
    data: {
      code: 'FEATURE_DELIVERY',
      name: '功能交付',
      unit: '項',
      description: '完成並可被驗收的功能或任務項目',
      sortOrder: 20,
    },
  });

  const outputTagBugFix = await prisma.dailyOutputTag.create({
    data: {
      code: 'BUG_FIX',
      name: 'Bug Fix',
      unit: '件',
      description: '修復並完成驗證的缺陷數量',
      sortOrder: 30,
    },
  });

  const outputTagTestCase = await prisma.dailyOutputTag.create({
    data: {
      code: 'TEST_CASE',
      name: '測試案例',
      unit: '個',
      description: '新增或維護的測試案例數量',
      sortOrder: 40,
    },
  });

  const outputTagIncident = await prisma.dailyOutputTag.create({
    data: {
      code: 'INCIDENT_SUPPORT',
      name: '救火支援',
      unit: '小時',
      description: '處理線上事件、跨部門支援或緊急排障時數',
      sortOrder: 50,
    },
  });

  console.log('Creating sample daily output logs for current week...');
  const weekStart = startOfWeek(new Date());
  await prisma.dailyOutputLog.createMany({
    data: [
      { userId: employee.id, tagId: outputTagCodeReview.id, value: 3, logDate: addDays(weekStart, 0), note: '審閱 authentication flow PR' },
      { userId: employee.id, tagId: outputTagTestCase.id, value: 8, logDate: addDays(weekStart, 0), note: '補上 Goal service unit tests' },
      { userId: employee.id, tagId: outputTagFeature.id, value: 1, logDate: addDays(weekStart, 1), note: '完成績效異議 API 串接' },
      { userId: employee.id, tagId: outputTagBugFix.id, value: 2, logDate: addDays(weekStart, 1), note: '修正草稿提交與狀態顯示問題' },
      { userId: employee2.id, tagId: outputTagCodeReview.id, value: 5, logDate: addDays(weekStart, 0), note: '審閱 dashboard drill-down PR' },
      { userId: employee2.id, tagId: outputTagIncident.id, value: 1.5, logDate: addDays(weekStart, 1), note: '協助排查 staging DB migration 問題' },
    ],
  });

  console.log('Creating performance periods...');
  await prisma.performancePeriod.createMany({
    data: [
      { quarter: '2026Q1' },
      { quarter: '2026Q2' }
    ]
  });

  console.log('Creating base KPIs for Goal tracking...');
  const kpi1 = await prisma.kpi.create({
    data: {
      id: 'kpi-q2-2026-001',
      title: '提升系統測試覆蓋率至 80%',
      description: '所有核心服務的 unit test 覆蓋率需達到 80% 以上',
      quarter: '2026Q2',
      createdById: manager.id,
    },
  });

  await prisma.kpi.create({
    data: {
      id: 'kpi-q2-2026-002',
      title: '完成微服務架構遷移規劃',
      description: '完成 Phase 1 到 Phase 2 的架構遷移技術文件',
      quarter: '2026Q2',
      createdById: upperManager.id,
    },
  });

  await prisma.kpi.create({
    data: {
      id: 'kpi-q2-2026-003',
      title: '客戶滿意度達成 NPS 40+',
      description: '季末客戶滿意度調查 NPS 分數需達 40 分以上',
      quarter: '2026Q2',
      createdById: manager.id,
    },
  });

  console.log('Creating sample goals...');
  await prisma.goal.create({
    data: {
      id: 'goal-sample-001',
      title: '完成績效系統後端 API 實作',
      specific: '實作所有 Auth、Goal、KPI REST API 端點，符合 SPEC.md 規格',
      measurable: '所有 9 個端點通過 integration test，覆蓋率達 80%',
      achievable: '使用 Express + Prisma 技術棧，每天完成 2-3 個端點',
      relevant: '直接對應本季 KPI：提升系統測試覆蓋率至 80%',
      dueDate: new Date('2026-05-31'),
      status: 'ACTIVE',
      progress: 30,
      userId: employee.id,
      kpiId: kpi1.id,
    },
  });
  await prisma.goal.create({
    data: {
      id: 'goal-sample-002',
      title: '前端效能優化與儀表板實作',
      specific: '重構 React 元件，減少 Dashboard 不必要的 re-render',
      measurable: 'Lighthouse 效能分數提升至 90 分以上',
      achievable: '每週重構 2 個核心頁面',
      relevant: '直接對應本季 KPI',
      dueDate: new Date('2026-05-31'),
      status: 'ACTIVE',
      progress: 40,
      userId: employee2.id,
      kpiId: kpi1.id,
    },
  });
  console.log('Creating review templates...');
  const engTemplate = await prisma.reviewTemplate.create({
    data: {
      name: 'Engineering Quarterly Review',
      dimensions: [
        { name: 'test coverage', type: 'quantitative' },
        { name: '技術深度', type: 'qualitative' },
        { name: '商業影響力', type: 'qualitative' }
      ],
      createdById: hr.id,
    },
  });

  console.log('Setting up Level Standards...');
  await prisma.levelStandard.createMany({
    data: [
      { level: 'Junior Engineer', dimensionName: 'test coverage', targetValue: 70.0, setById: upperManager.id },
      { level: 'Senior Engineer', dimensionName: 'test coverage', targetValue: 85.0, setById: upperManager.id }
    ]
  });

  console.log('Creating mock performance reviews & feedback entries...');
  await prisma.performanceReview.create({
    data: {
      userId: employee.id,
      reviewerId: employee.id,
      templateId: engTemplate.id,
      status: 'SUBMITTED',
      feedbacks: {
        create: [
          { dimensionName: 'test coverage', metricType: 'quantitative', quantScore: 75.0 },
          { dimensionName: '技術深度', metricType: 'qualitative', impression: 4, comment: '本季深入研究了事件驅動架構。' },
          { dimensionName: '商業影響力', metricType: 'qualitative', impression: 5, comment: '我認為我的重構大大提升了系統效能。' }
        ]
      }
    }
  });

  await prisma.performanceReview.create({
    data: {
      userId: employee.id,
      reviewerId: manager.id,
      templateId: engTemplate.id,
      status: 'SUBMITTED',
      feedbacks: {
        create: [
          { dimensionName: 'test coverage', metricType: 'quantitative', quantScore: 68.0 },
          { dimensionName: '技術深度', metricType: 'qualitative', impression: 3, comment: '有進步，但在模組解耦上還需加強。' },
          {
            dimensionName: '商業影響力',
            metricType: 'qualitative',
            impression: 2,
            comment: '技術改動尚未實質反應在商業數據上．',
            gapAnalysis: '認知嚴重落差：員工自評印象分為 5，主管評估為 2。'
          }
        ]
      }
    }
  });

  console.log('Seed integrated successfully!');
  console.log('Test accounts:');
  console.log('  hr@test.com (HR, 無部門)');
  console.log('  upper-manager@test.com (MANAGER, 部門A)');
  console.log('  manager@test.com (MANAGER, 部門A)');
  console.log('  employee@test.com (EMPLOYEE, 部門A)');
  console.log('  employee2@test.com (EMPLOYEE, 部門A)');
  console.log('  manager-b@test.com (MANAGER, 部門B)');
  console.log('  employee-b@test.com (EMPLOYEE, 部門B)');
  console.log('  All passwords: password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
