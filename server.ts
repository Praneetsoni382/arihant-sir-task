import path from 'path';
import fs from 'fs';

const distServerPath = path.resolve(process.cwd(), 'server/dist/server.js');

async function startServer() {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && fs.existsSync(distServerPath)) {
      // Production deployment (e.g. Render after npm run build)
      await import('./server/dist/server.js');
    } else {
      // Local development environment (via tsx + Vite middleware)
      const appModule = await import('./server/src/app.js');
      const storeModule = await import('./server/src/repositories/inMemoryStore.js');
      const app = appModule.default;
      const { seedStore } = storeModule;

      const { startISTClockAndScheduler, getISTClock } = await import(
        './server/src/services/istSchedulerService.js'
      );

      // In AI Studio / local dev environment, dev server must always run on port 3000
      const PORT = Number(process.env.DEV_PORT || 3000);
      await seedStore();
      startISTClockAndScheduler();
      const ist = getISTClock();

      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: 'spa',
        root: path.resolve(process.cwd(), 'client'),
        configFile: path.resolve(process.cwd(), 'client/vite.config.ts'),
      });

      app.use(vite.middlewares);

      app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 Task Management Platform API running on http://0.0.0.0:${PORT}`);
        console.log(`   Health check: http://0.0.0.0:${PORT}/api/health`);
        console.log(`   🇮🇳 IST Clock Active: ${ist.timeWithSeconds} (${ist.dateFormatted})`);
        console.log(`\n👑 System Administrator Account:`);
        console.log(`   Email:      admin@company.com`);
        console.log(`   Password:   Admin@2024!\n`);
      });
    }
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();


