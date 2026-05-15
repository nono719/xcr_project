import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db';
import { env } from '../config/env';
import { ApiError, ok } from '../utils/response';
import { authRequired, requireRole } from '../middlewares/auth';
import { logOperation } from '../utils/logger';

const router = Router();
router.use(authRequired, requireRole('admin'));

router.get('/users', async (req, res, next) => {
  try {
    const role = (req.query.role as string) || '';
    const q = (req.query.q as string) || '';
    const sql = `SELECT userId,username,role,email,status,createTime,lastLoginTime
                 FROM user
                 WHERE 1=1
                 ${role ? 'AND role=?' : ''}
                 ${q ? 'AND (username LIKE ? OR email LIKE ?)' : ''}
                 ORDER BY userId DESC`;
    const params: any[] = [];
    if (role) params.push(role);
    if (q) { params.push(`%${q}%`, `%${q}%`); }
    const [rows] = await pool.query<any[]>(sql, params);
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.put('/users/:id/status', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const status = Number(req.body?.status ?? 0);
    if (![0, 1, 2].includes(status)) throw new ApiError(400, 'status 非法');
    await pool.query('UPDATE user SET status=? WHERE userId=?', [status, id]);
    logOperation('admin.setStatus', req.user!.userId, { target: id, status });
    return ok(res, { updated: true });
  } catch (e) { next(e); }
});

router.post('/users/:id/reset-password', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const np = String(req.body?.password ?? '');
    if (np.length < 8) throw new ApiError(400, '新密码长度至少 8 位');
    const salt = await bcrypt.genSalt(env.bcrypt.saltRounds);
    const hash = await bcrypt.hash(np, salt);
    await pool.query('UPDATE user SET password=?, salt=?, failCount=0, lockUntil=NULL WHERE userId=?',
      [hash, salt, id]);
    logOperation('admin.resetPassword', req.user!.userId, { target: id });
    return ok(res, { updated: true });
  } catch (e) { next(e); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await pool.query('DELETE FROM user WHERE userId=?', [id]);
    logOperation('admin.deleteUser', req.user!.userId, { target: id });
    return ok(res, { deleted: true });
  } catch (e) { next(e); }
});

router.get('/logs', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 200), 1000);
    const [rows] = await pool.query<any[]>(
      'SELECT * FROM op_log ORDER BY logId DESC LIMIT ?', [limit]);
    return ok(res, rows);
  } catch (e) { next(e); }
});

export default router;
