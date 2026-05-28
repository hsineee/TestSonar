const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const table = process.argv[2] || 'all';

async function main() {
  if (table === 'users' || table === 'all') {
    const users = await p.user.findMany({
      select: { id: true, email: true, role: true, managerId: true, name: true },
    });
    console.log('\n=== USERS ===');
    console.table(users);
  }

  if (table === 'kpis' || table === 'all') {
    const kpis = await p.kpi.findMany({
      select: { id: true, title: true, quarter: true, createdById: true },
    });
    console.log('\n=== KPIS ===');
    console.table(kpis);
  }

  if (table === 'goals' || table === 'all') {
    const goals = await p.goal.findMany({
      select: { id: true, title: true, status: true, progress: true, userId: true, kpiId: true },
    });
    console.log('\n=== GOALS ===');
    console.table(goals);
  }

  if (table === 'audit' || table === 'all') {
    const logs = await p.auditLog.findMany({
      select: { id: true, action: true, userId: true, targetId: true, targetType: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    console.log('\n=== AUDIT LOGS (最近 10 筆) ===');
    console.table(logs);
  }
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
