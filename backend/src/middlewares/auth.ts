import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload, type Role } from '../utils/jwt';
import { fail } from '../utils/response';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const auth = req.header('authorization');
  if (!auth?.startsWith('Bearer ')) return fail(res, 401, '未授权');
  const token = auth.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return fail(res, 401, 'Token 无效或已过期');
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return fail(res, 401, '未授权');
    if (!roles.includes(req.user.role)) return fail(res, 403, '没有权限');
    next();
  };
}
