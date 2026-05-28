require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const goalRoutes = require('./routes/goalRoutes');
const kpiRoutes = require('./routes/kpiRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const calibrationRoutes = require('./routes/calibrationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const dailyOutputRoutes = require('./routes/dailyOutputRoutes');
const auditRoutes = require('./routes/auditRoutes');
const periodRoutes = require('./routes/periodRoutes');
const globalizationRoutes = require('./routes/globalizationRoutes');

const { errorMiddleware } = require('./middleware/errorMiddleware');
const { globalizationMiddleware } = require('./middleware/globalizationMiddleware');
const { SUPPORTED_LOCALES } = require('./config/globalization');

const app = express();

app.disable('x-powered-by');

const corsOrigins = new Set(
  (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const allowAllCorsOrigins = corsOrigins.has('*');

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowAllCorsOrigins || corsOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  exposedHeaders: ['X-Resolved-Locale', 'X-Resolved-Timezone'],
}));

app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes('*') || corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  exposedHeaders: ['X-Resolved-Locale', 'X-Resolved-Timezone'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(globalizationMiddleware);
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    supportedLocales: SUPPORTED_LOCALES,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

if (process.env.NODE_ENV !== 'production') {
  const prisma = require('./repositories/prismaClient');
  app.post('/test/reset', async (req, res) => {
    await prisma.dailyOutputLog.deleteMany({});
    await prisma.feedbackEntry.deleteMany({});
    await prisma.performanceReview.deleteMany({});

    await prisma.auditLog.deleteMany({});
    await prisma.dispute.deleteMany({}); // Clear all disputes
    
    await prisma.goal.deleteMany({ 
      where: { 
        id: { notIn: ['goal-sample-001', 'goal-sample-002'] } 
      } 
    });
    
    // Reset the sample goal to its original ACTIVE state (Employee 1)
    await prisma.goal.update({
      where: { id: 'goal-sample-001' },
      data: {
        status: 'ACTIVE',
        progress: 30,
        rejectReason: null,
      },
    }).catch(() => {});

    await prisma.goal.update({
      where: { id: 'goal-sample-002' },
      data: {
        status: 'ACTIVE',
        progress: 40,
        rejectReason: null,
      },
    }).catch(() => {});

    res.json({ ok: true });
  });
}

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/calibrations', calibrationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/daily-outputs', dailyOutputRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/periods', periodRoutes);
app.use('/api/globalization', globalizationRoutes);

app.use(errorMiddleware);

module.exports = app;
