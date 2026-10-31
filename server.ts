import path from 'path';
import app from './server/src/app.js';
import { seedStore } from './server/src/repositories/inMemoryStore.js';

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  try {
    await seedStore();

    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: path.resolve(process.cwd(), 'client'),
        configFile: path.resolve(process.cwd(), 'client/vite.config.ts'),
      });

      app.use(vite.middlewares);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Task Management Platform API running on http://0.0.0.0:${PORT}`);
      console.log(`   Health check: http://0.0.0.0:${PORT}/api/health`);
      console.log(`\n👑 System Administrator Account:`);
      console.log(`   Email:      admin@company.com`);
      console.log(`   Password:   Admin@2024!`);
      console.log(`\n👥 Employee Accounts:`);
      console.log(`   Create employees in Admin Dashboard (/admin/employees)\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

