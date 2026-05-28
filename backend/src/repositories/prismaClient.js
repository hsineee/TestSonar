const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('../utils/cryptoUtils');

const basePrisma = new PrismaClient();

const prisma = basePrisma.$extends({
  result: {
    user: {
      name: {
        needs: { name: true },
        compute(user) {
          return decrypt(user.name);
        },
      },
    },
    
    performanceReview: {
      overallComment: {
        needs: { overallComment: true },
        compute(review) {
          return decrypt(review.overallComment);
        },
      },
    },
    
    feedbackEntry: {
      comment: {
        needs: { comment: true },
        compute(fb) {
          return decrypt(fb.comment);
        },
      },
      gapAnalysis: {
        needs: { gapAnalysis: true },
        compute(fb) {
          return decrypt(fb.gapAnalysis);
        },
      },
    },
  },
});

module.exports = prisma;