import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import coursesRouter from './routes/courses';
import experimentsRouter from './routes/experiments';
import evaluationRouter from './routes/evaluation';
import teacherRouter from './routes/teacher';
import adminRouter from './routes/admin';
import statisticsRouter from './routes/statistics';
import notificationsRouter from './routes/notifications';
import assignmentsRouter from './routes/assignments';
import { errorHandler, notFound } from './middlewares/error';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => res.json({ code: 200, message: 'ok', data: { ts: Date.now() } }));

  app.use('/api/auth', authRouter);
  app.use('/api/courses', coursesRouter);
  app.use('/api/experiment', experimentsRouter);
  app.use('/api/evaluation', evaluationRouter);
  app.use('/api/teacher', teacherRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/statistics', statisticsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/assignments', assignmentsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
