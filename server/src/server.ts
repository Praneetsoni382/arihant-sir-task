// ============================================================
// SERVER ENTRY POINT
// ============================================================

import { PORT } from './config.js';
import app from './app.js';
import { seedStore } from './repositories/inMemoryStore.js';

async function start() {
  try {
    await seedStore();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Task Management Platform API`);
      console.log(`   Server running on http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health`);
      console.log(`\n📋 Development Accounts:`);
      console.log(`   Admin:      admin@company.com   / Admin@2024!`);
      console.log(`   Employee 1: priya.mehta@company.com   / Emp@56789`);
      console.log(`   Employee 2: rahul.gupta@company.com   / Emp@34512`);
      console.log(`   Employee 3: sneha.patel@company.com   / Emp@78234`);
      console.log(`   Employee 4: vikram.nair@company.com   / Emp@91823`);
      console.log(`\n⚠️  Data resets on server restart (development mode)\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

