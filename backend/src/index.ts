import { createApp } from './app';
import { env } from './config/env';
import { ping } from './config/db';
import { logger } from './utils/logger';
import { startCronJobs } from './services/cron';

// 全局兜底：Ganache 偶尔断连会引发深层 web3 promise rejection；不让进程崩
process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection (suppressed)', {
    err: reason instanceof Error ? reason.message : String(reason),
  });
});
process.on('uncaughtException', (err) => {
  logger.error('uncaughtException (suppressed)', { err: err.stack ?? err.message });
});

async function bootstrap() {
  try {
    await ping();
    logger.info('MySQL connection ok');
  } catch (e) {
    logger.error('MySQL connection failed', { err: (e as Error).message });
  }
  const app = createApp();
  app.listen(env.port, () => {
    logger.info(`xcr-backend listening on :${env.port}`);
    startCronJobs();
  });
}

bootstrap();
