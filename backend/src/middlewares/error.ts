import type { Request, Response, NextFunction } from 'express';
import { ApiError, fail } from '../utils/response';
import { logger } from '../utils/logger';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return fail(res, err.code, err.message);
  }
  logger.error('unhandled error', { err: err instanceof Error ? err.stack : String(err) });
  return fail(res, 500, '服务器内部错误');
}

export function notFound(_req: Request, res: Response) {
  return fail(res, 404, '资源不存在');
}
