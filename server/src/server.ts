// ============================================================
// SERVER ENTRY POINT
// ============================================================

import { PORT } from './config.js';
import app from './app.js';
import { seedStore } from './repositories/inMemoryStore.js';
import { startISTClockAndScheduler, getISTClock } from './services/istSchedulerService.js';

async function start() {
  try {
    await seedStore();
    startISTClockAndScheduler();
    const ist = getISTClock();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Task Management Platform API`);
      console.log(`   Server running on http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health`);
      console.log(`   🇮🇳 IST Clock Active: ${ist.timeWithSeconds} (${ist.dateFormatted})`);
      console.log(`\n👑 System Administrator Account:`);
      console.log(`   Email:      admin@company.com`);
      console.log(`   Password:   Admin@2024!`);
      console.log(`\n👥 Employee Accounts:`);
      console.log(`   Create employees dynamically in the Admin Dashboard (/admin/employees)`);
      console.log(`   Employees log in using the exact email and password assigned to them.\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

