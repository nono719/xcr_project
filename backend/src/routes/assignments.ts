import { Router } from 'express';
import Joi from 'joi';
import { pool } from '../config/db';
import { ApiError, ok } from '../utils/response';
import { authRequired } from '../middlewares/auth';

const router = Router();

/** 学生：我的全部作业（含提交状态） */
router.get('/me', authRequired, async (req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT a.assignmentId, a.title, a.content, a.caseId, a.courseId, a.deadline, a.createTime,
              u.username AS teacherName,
              c.name AS caseName, c.vulnType,
              co.title AS courseName,
              s.submissionId, s.status AS subStatus, s.submittedAt, s.score, s.feedback
       FROM assignment a
       LEFT JOIN user u ON u.userId = a.teacherId
       LEFT JOIN vulnerability_case c ON c.caseId = a.caseId
       LEFT JOIN course co ON co.courseId = a.courseId
       LEFT JOIN assignment_submission s
         ON s.assignmentId = a.assignmentId AND s.studentId = ?
       ORDER BY (a.deadline IS NULL), a.deadline ASC, a.createTime DESC`,
      [req.user!.userId],
    );
    return ok(res, rows);
  } catch (e) { next(e); }
});

/** 学生：单个作业详情 + 我的提交状态 */
router.get('/:id', authRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query<any[]>(
      `SELECT a.*, u.username AS teacherName,
              c.name AS caseName, c.vulnType, c.swcId,
              co.title AS courseName
       FROM assignment a
       LEFT JOIN user u ON u.userId = a.teacherId
       LEFT JOIN vulnerability_case c ON c.caseId = a.caseId
       LEFT JOIN course co ON co.courseId = a.courseId
       WHERE a.assignmentId = ?`, [id]);
    if (!rows.length) throw new ApiError(404, '作业不存在');
    const assignment = rows[0];

    const [subRows] = await pool.query<any[]>(
      `SELECT * FROM assignment_submission WHERE assignmentId=? AND studentId=? LIMIT 1`,
      [id, req.user!.userId]);
    const submission = subRows[0] ?? null;

    // 如果案例已关联，列出该学生的相关评测记录供选择附加
    let recordOptions: any[] = [];
    if (assignment.caseId) {
      const [rs] = await pool.query<any[]>(
        `SELECT recordId, mode, score, result, submitTime
         FROM experiment_record
         WHERE studentId=? AND caseId=?
         ORDER BY submitTime DESC LIMIT 20`,
        [req.user!.userId, assignment.caseId]);
      recordOptions = rs;
    }

    return ok(res, { assignment, submission, recordOptions });
  } catch (e) { next(e); }
});

/** 学生：提交 / 更新提交 */
router.post('/:id/submit', authRequired, async (req, res, next) => {
  try {
    if (req.user!.role !== 'student') throw new ApiError(403, '仅学生可提交作业');
    const id = Number(req.params.id);
    const schema = Joi.object({
      content: Joi.string().allow('').max(8000).default(''),
      experimentRecordId: Joi.number().allow(null).optional(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) throw new ApiError(400, error.message);

    const [arows] = await pool.query<any[]>(
      'SELECT assignmentId, deadline FROM assignment WHERE assignmentId=?', [id]);
    if (!arows.length) throw new ApiError(404, '作业不存在');
    const dl = arows[0].deadline ? new Date(arows[0].deadline).getTime() : null;
    if (dl && dl < Date.now()) throw new ApiError(400, '作业已过截止时间');

    // 校验 experimentRecordId 必须属于本人
    if (value.experimentRecordId) {
      const [rrows] = await pool.query<any[]>(
        'SELECT recordId FROM experiment_record WHERE recordId=? AND studentId=?',
        [value.experimentRecordId, req.user!.userId]);
      if (!rrows.length) throw new ApiError(400, '所选评测记录不属于你');
    }

    // upsert
    const [exists] = await pool.query<any[]>(
      'SELECT submissionId FROM assignment_submission WHERE assignmentId=? AND studentId=? LIMIT 1',
      [id, req.user!.userId]);
    if (exists.length) {
      await pool.query(
        `UPDATE assignment_submission
         SET content=?, experimentRecordId=?, status='submitted', submittedAt=NOW()
         WHERE submissionId=?`,
        [value.content, value.experimentRecordId ?? null, exists[0].submissionId]);
      return ok(res, { submissionId: exists[0].submissionId, updated: true });
    }
    const [r] = await pool.query<any>(
      `INSERT INTO assignment_submission(assignmentId,studentId,content,experimentRecordId)
       VALUES(?,?,?,?)`,
      [id, req.user!.userId, value.content, value.experimentRecordId ?? null]);
    return ok(res, { submissionId: r.insertId, updated: false });
  } catch (e) { next(e); }
});

export default router;
