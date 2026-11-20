import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { config } from './src/server/core/config.ts';
import { getDb } from './src/server/db/pglite.ts';
import authRoutes from './src/server/routes/authRoutes.ts';
import dashboardRoutes from './src/server/routes/dashboardRoutes.ts';
import analyticsRoutes from './src/server/routes/analyticsRoutes.ts';
import databaseRoutes from './src/server/routes/databaseRoutes.ts';
import reportsRoutes from './src/server/routes/reportsRoutes.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));

  // Initialize embedded PostgreSQL database before serving requests
  await getDb();

  // Health check endpoint
  app.get('/api/health', async (_req, res) => {
    try {
      const pg = await getDb();
      await pg.query('SELECT 1');
      res.json({
        status: 'ok',
        service: 'IntelliBI',
        database: 'postgresql-pglite',
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'unavailable' });
    }
  });

  // Mount REST API routers
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/database', databaseRoutes);
  app.use('/api/reports', reportsRoutes);

  // Unknown API route handler
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Centralized error handler
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error('Unhandled API error:', err);
      res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
  );

  // Vite middleware for development or static dist for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`IntelliBI full-stack server running on http://0.0.0.0:${config.port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
