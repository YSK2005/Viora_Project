import { Router, Request, Response } from 'express';
import { sendSuccess } from '../utils/response';
import { env } from '../config/env';
import { checkDatabaseConnection } from '../config/prisma';

const router = Router();

/**
 * GET /api/health
 * Production-ready health check endpoint
 */
router.get('/', async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseConnection();

  const healthData = {
    status: dbHealth.isConnected ? 'healthy' : 'unhealthy',
    service: 'viora-bills-api',
    version: '0.1.0',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: dbHealth.isConnected ? 'connected' : 'disconnected',
      message: dbHealth.message,
    },
  };

  return sendSuccess(res, healthData, dbHealth.isConnected ? 'System is operating normally' : 'Database unavailable', dbHealth.isConnected ? 200 : 503);
});

export const healthRouter = router;
