import { Router } from 'express';
import Joi from 'joi';
import { pool } from '../config/db';
import { ApiError, ok } from '../utils/response';
import { authRequired, requireRole } from '../middlewares/auth';
import { triggerDeadlineCheck } from '../services/cron';

const router = Router();

/** 我的通知列表 */
router.get('/me', authRequired, async (req, res, next) => {
  try {
    const onlyUnread = req.query.unread === '1';
    const where = onlyUnread ? 'AND status=0' : '';
    const [rows] = await pool.query<any[]>(
      `SELECT notiId,type,title,content,link,refId,status,createTime
       FROM notification WHERE userId=? ${where}
       ORDER BY createTime DESC LIMIT 100`,
      [req.user!.userId],
    );
    const [[unread]] = await pool.query<any[]>(
      'SELECT COUNT(*) AS n FROM notification WHERE userId=? AND status=0',
      [req.user!.userId],
    );
    return ok(res, { items: rows, unread: Number(unread.n) });
  } catch (e) { next(e); }
});

/** 单条标记已读 */
router.post('/:id/read', authRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await pool.query(
      'UPDATE notification SET status=1 WHERE notiId=? AND userId=?',
      [id, req.user!.userId],
    );
    return ok(res, { updated: true });
  } catch (e) { next(e); }
});

/** 全部已读 */
router.post('/read-all', authRequired, async (req, res, next) => {
  try {
    await pool.query('UPDATE notification SET status=1 WHERE userId=? AND status=0',
      [req.user!.userId]);
    return ok(res, { updated: true });
  } catch (e) { next(e); }
});

/** 教师/管理员手动触发一次扫描（用于演示/测试） */
router.post('/trigger-scan', authRequired, requireRole('teacher', 'admin'), async (_req, res, next) => {
  try {
    const inserted = await triggerDeadlineCheck();
    return ok(res, { inserted });
  } catch (e) { next(e); }
});

export default router;
