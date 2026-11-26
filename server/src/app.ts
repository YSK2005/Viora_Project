import swaggerUi from 'swagger-ui-express';
import {openapi} from './openapi';
import {ErrorCode} from './utils/errorCodes';
import compression from 'compression';
import { createAuthLimiter, apiLimiter, sanitizeBody } from './middlewares/requestSecurity';
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { apiRouter } from './routes/api.route';
import { errorHandler, AppError } from './middlewares/errorHandler';

export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.use(compression({ filter: (req,res) => !/\/auth(?:\/|$)/.test(req.path) && compression.filter(req,res) }));

  // Security headers
  app.use(helmet());

  // CORS configuration supporting single or comma-separated origins
  const allowedOrigins = [
    ...env.CLIENT_URL.split(',').map((u) => u.trim().replace(/\/$/, '')),
    ...(env.NODE_ENV === 'development' ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : []),
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, postman, or server-to-server)
        if (!origin) return callback(null, true);
        const normalized = origin.replace(/\/$/, '');
        const isLocalDevelopment = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized);
        if (allowedOrigins.includes(normalized) || (env.NODE_ENV === 'development' && isLocalDevelopment)) {
          return callback(null, true);
        }
        return callback(new AppError('Origin not permitted',403,ErrorCode.ERR_CORS));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Business-Id', 'X-Viora-Client', 'X-Viora-Portal'],
    })
  );

  // CORS alone does not stop simple cross-origin requests from mutating data.
  // Require our custom header on cookie-authenticated writes, including login/logout.
  app.use((req, _res, next) => {
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const browserRequest = Boolean(req.headers.origin || req.headers.cookie);
    const bearer = req.headers.authorization?.startsWith('Bearer ');
    if (mutation && browserRequest && !bearer && req.get('X-Viora-Client') !== 'web') {
      return next(new AppError('Missing browser request protection header', 403, ErrorCode.ERR_CSRF));
    }
    next();
  });

  // Request logger
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
  }

  app.use(['/api/auth/login','/api/auth/register','/api/v1/auth/login','/api/v1/auth/register'], createAuthLimiter());
  app.use('/api', apiLimiter());

  // Body parsers (allow 10mb for logo base64 payloads)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use(sanitizeBody);
  app.use('/api', (_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});

  // Root welcome / status endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'Viora Bills API',
      version: '0.1.0',
      status: 'active',
      phase: 'Phase 1 - Project Foundation',
      documentation: '/api/health',
    });
  });

  app.get('/api/openapi.json', (_req,res)=>res.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, {swaggerOptions:{supportedSubmitMethods:[]}}));

  // Mount API router at /api
  app.use('/api', apiRouter);

  // 404 Not Found handler
  app.use((req: Request, _res: Response, next) => {
    next(new AppError(`Cannot ${req.method} ${req.path}`, 404, ErrorCode.ERR_NOT_FOUND));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
