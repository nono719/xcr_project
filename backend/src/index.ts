import { createApp } from './app';
import { env } from './config/env';
import { ping } from './config/db';
import { logger } from './utils/logger';

async function bootstrap() {
  try {
    await ping();
    logger.info('MySQL connection ok');
  } catch (e) {
    logger.error('MySQL connection failed', { err: (e as Error).message });
  }
  const app = createApp();
  app.listen(env.port, () => logger.info(`xcr-backend listening on :${env.port}`));
}

bootstrap();
