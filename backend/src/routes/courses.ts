import { Router } from 'express';
import Joi from 'joi';
import { pool } from '../config/db';
import { ApiError, ok } from '../utils/response';
import { authRequired, requireRole } from '../middlewares/auth';

const router = Router();

router.get('/', authRequired, async (req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT c.*, u.username AS teacherName
       FROM course c LEFT JOIN user u ON u.userId = c.teacherId
       WHERE c.status = 1 ORDER BY c.orderNo ASC, c.courseId DESC`,
    );
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get('/:id', authRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [crows] = await pool.query<any[]>(
      'SELECT * FROM course WHERE courseId=? AND status=1', [id]);
    if (!crows.length) throw new ApiError(404, '课程不存在');
    const [mods] = await pool.query<any[]>(
      'SELECT * FROM course_module WHERE courseId=? ORDER BY orderNo ASC', [id]);
    return ok(res, { course: crows[0], modules: mods });
  } catch (e) { next(e); }
});

router.post('/progress', authRequired, async (req, res, next) => {
  try {
    const schema = Joi.object({
      courseId: Joi.number().required(),
      moduleId: Joi.number().required(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) throw new ApiError(400, error.message);
    await pool.query(
      `INSERT INTO learning_progress(studentId,courseId,moduleId)
       VALUES(?,?,?) ON DUPLICATE KEY UPDATE completedTime=NOW()`,
      [req.user!.userId, value.courseId, value.moduleId],
    );
    return ok(res, { updated: true });
  } catch (e) { next(e); }
});

router.get('/progress/me', authRequired, async (req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      'SELECT * FROM learning_progress WHERE studentId=?', [req.user!.userId],
    );
    return ok(res, rows);
  } catch (e) { next(e); }
});

const upsertSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  cover: Joi.string().allow('').optional(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
  orderNo: Joi.number().optional(),
  status: Joi.number().valid(0, 1).optional(),
});

router.post('/', authRequired, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const { error, value } = upsertSchema.validate(req.body);
    if (error) throw new ApiError(400, error.message);
    const [r] = await pool.query<any>(
      `INSERT INTO course(title,description,cover,teacherId,severity,difficulty,orderNo,status)
       VALUES(?,?,?,?,?,?,?,?)`,
      [value.title, value.description ?? '', value.cover ?? '', req.user!.userId,
        value.severity ?? 'medium', value.difficulty ?? 'beginner', value.orderNo ?? 0, value.status ?? 1],
    );
    return ok(res, { courseId: r.insertId });
  } catch (e) { next(e); }
});

router.put('/:id', authRequired, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { error, value } = upsertSchema.validate(req.body);
    if (error) throw new ApiError(400, error.message);
    await pool.query(
      `UPDATE course SET title=?,description=?,cover=?,severity=?,difficulty=?,orderNo=?,status=?
       WHERE courseId=?`,
      [value.title, value.description ?? '', value.cover ?? '',
        value.severity ?? 'medium', value.difficulty ?? 'beginner',
        value.orderNo ?? 0, value.status ?? 1, id],
    );
    return ok(res, { updated: true });
  } catch (e) { next(e); }
});

router.delete('/:id', authRequired, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM course WHERE courseId=?', [Number(req.params.id)]);
    return ok(res, { deleted: true });
  } catch (e) { next(e); }
});

const moduleSchema = Joi.object({
  courseId: Joi.number().required(),
  title: Joi.string().required(),
  content: Joi.string().allow('').optional(),
  type: Joi.string().valid('text', 'video', 'code').default('text'),
  orderNo: Joi.number().default(0),
});

router.post('/modules', authRequired, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const { error, value } = moduleSchema.validate(req.body);
    if (error) throw new ApiError(400, error.message);
    const [r] = await pool.query<any>(
      `INSERT INTO course_module(courseId,title,content,type,orderNo) VALUES(?,?,?,?,?)`,
      [value.courseId, value.title, value.content ?? '', value.type, value.orderNo],
    );
    return ok(res, { moduleId: r.insertId });
  } catch (e) { next(e); }
});

const moduleUpdateSchema = Joi.object({
  title: Joi.string().required(),
  content: Joi.string().allow('').optional(),
  type: Joi.string().valid('text', 'video', 'code').optional(),
  orderNo: Joi.number().optional(),
});

router.put('/modules/:id', authRequired, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { error, value } = moduleUpdateSchema.validate(req.body);
    if (error) throw new ApiError(400, error.message);
    await pool.query(
      `UPDATE course_module SET title=?, content=?, type=?, orderNo=? WHERE moduleId=?`,
      [value.title, value.content ?? '', value.type ?? 'text', value.orderNo ?? 0, id]);
    return ok(res, { updated: true });
  } catch (e) { next(e); }
});

router.delete('/modules/:id', authRequired, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM course_module WHERE moduleId=?', [Number(req.params.id)]);
    return ok(res, { deleted: true });
  } catch (e) { next(e); }
});

/** 教师专用：返回未发布课程也包含在内的完整列表 */
router.get('/manage/list', authRequired, requireRole('teacher', 'admin'), async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT c.*, u.username AS teacherName,
              (SELECT COUNT(*) FROM course_module m WHERE m.courseId = c.courseId) AS moduleCount
       FROM course c LEFT JOIN user u ON u.userId = c.teacherId
       ORDER BY c.orderNo ASC, c.courseId DESC`);
    return ok(res, rows);
  } catch (e) { next(e); }
});

/** 教师专用：单门课程详情（不限定发布状态）*/
router.get('/manage/:id', authRequired, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [crows] = await pool.query<any[]>('SELECT * FROM course WHERE courseId=?', [id]);
    if (!crows.length) throw new ApiError(404, '课程不存在');
    const [mods] = await pool.query<any[]>(
      'SELECT * FROM course_module WHERE courseId=? ORDER BY orderNo ASC, moduleId ASC', [id]);
    return ok(res, { course: crows[0], modules: mods });
  } catch (e) { next(e); }
});

export default router;
