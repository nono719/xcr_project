import { Router } from 'express';
import { pool } from '../config/db';
import { ok } from '../utils/response';
import { authRequired, requireRole } from '../middlewares/auth';

const router = Router();
router.use(authRequired, requireRole('teacher', 'admin'));

router.get('/overview', async (_req, res, next) => {
  try {
    const [[studs]] = await pool.query<any[]>("SELECT COUNT(*) AS n FROM user WHERE role='student'");
    const [[courses]] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM course');
    const [[exps]] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM experiment_record');
    const [[avg]] = await pool.query<any[]>('SELECT IFNULL(AVG(score),0) AS avgScore FROM experiment_record');
    return ok(res, {
      students: studs.n, courses: courses.n, experiments: exps.n,
      avgScore: Number(avg.avgScore).toFixed(1),
    });
  } catch (e) { next(e); }
});

router.get('/students', async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT u.userId,u.username,u.email,u.createTime,u.lastLoginTime,
              IFNULL(AVG(r.score),0) AS avgScore,
              COUNT(r.recordId) AS submissions
       FROM user u LEFT JOIN experiment_record r ON r.studentId=u.userId
       WHERE u.role='student'
       GROUP BY u.userId ORDER BY u.userId ASC`);
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get('/student/:id/records', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query<any[]>(
      `SELECT r.*, c.name AS caseName, c.vulnType
       FROM experiment_record r LEFT JOIN vulnerability_case c ON c.caseId=r.caseId
       WHERE r.studentId=? ORDER BY r.submitTime DESC LIMIT 200`, [id]);
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get('/cases', async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM vulnerability_case ORDER BY caseId ASC');
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post('/cases', async (req, res, next) => {
  try {
    const b = req.body;
    const [r] = await pool.query<any>(
      `INSERT INTO vulnerability_case
       (name,vulnType,swcId,difficulty,description,attackGoal,vulnerableCode,attackTemplate,referenceFix,scoreWeight,status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [b.name, b.vulnType, b.swcId ?? '', b.difficulty ?? 1, b.description ?? '',
        b.attackGoal ?? '', b.vulnerableCode ?? '', b.attackTemplate ?? '',
        b.referenceFix ?? '', b.scoreWeight ?? 100, b.status ?? 1]);
    return ok(res, { caseId: r.insertId });
  } catch (e) { next(e); }
});

router.put('/cases/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = req.body;
    await pool.query(
      `UPDATE vulnerability_case SET
        name=?,vulnType=?,swcId=?,difficulty=?,description=?,attackGoal=?,
        vulnerableCode=?,attackTemplate=?,referenceFix=?,scoreWeight=?,status=?
       WHERE caseId=?`,
      [b.name, b.vulnType, b.swcId ?? '', b.difficulty ?? 1, b.description ?? '',
        b.attackGoal ?? '', b.vulnerableCode ?? '', b.attackTemplate ?? '',
        b.referenceFix ?? '', b.scoreWeight ?? 100, b.status ?? 1, id]);
    return ok(res, { updated: true });
  } catch (e) { next(e); }
});

router.delete('/cases/:id', async (req, res, next) => {
  try {
    await pool.query('UPDATE vulnerability_case SET status=0 WHERE caseId=?', [Number(req.params.id)]);
    return ok(res, { deleted: true });
  } catch (e) { next(e); }
});

/** 教师向学生群发通知 (区别于 assignment 自动生成的 due 提醒) */
router.post('/notifications/broadcast', async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const title = String(b.title ?? '').trim();
    const content = String(b.content ?? '').trim();
    if (!title) return res.status(400).json({ code: 400, message: '标题必填', data: null });

    // recipients: 'all' | userId[] | undefined
    let userIds: number[];
    if (Array.isArray(b.recipients) && b.recipients.length) {
      userIds = b.recipients.map(Number).filter((n: number) => Number.isFinite(n));
    } else {
      const [rows] = await pool.query<any[]>(
        "SELECT userId FROM user WHERE role='student' AND status=0");
      userIds = rows.map((r) => r.userId);
    }

    const link = b.link ? String(b.link) : null;
    // refId 留空（MySQL UNIQUE 把多个 NULL 视为不冲突），保证每次广播都能发出
    let inserted = 0;
    for (const uid of userIds) {
      const [r] = await pool.query<any>(
        `INSERT INTO notification(userId,type,title,content,link,refId)
         VALUES(?,?,?,?,?,NULL)`,
        [uid, 'teacher_notice', title, content, link]);
      if ((r as any).affectedRows) inserted += 1;
    }
    return ok(res, { inserted, recipients: userIds.length });
  } catch (e) { next(e); }
});

router.get('/assignments', async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT a.*, u.username AS teacherName FROM assignment a
       LEFT JOIN user u ON u.userId=a.teacherId ORDER BY a.createTime DESC`);
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post('/assignments', async (req, res, next) => {
  try {
    const b = req.body;
    const [r] = await pool.query<any>(
      `INSERT INTO assignment(teacherId,courseId,caseId,title,content,deadline)
       VALUES(?,?,?,?,?,?)`,
      [req.user!.userId, b.courseId ?? null, b.caseId ?? null,
        b.title, b.content ?? '', b.deadline ?? null]);
    return ok(res, { assignmentId: r.insertId });
  } catch (e) { next(e); }
});

/** 教师：查看某作业的全员提交情况（含未提交） */
router.get('/assignments/:id/submissions', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [arows] = await pool.query<any[]>(
      `SELECT a.*, c.name AS caseName, c.vulnType, co.title AS courseName
       FROM assignment a
       LEFT JOIN vulnerability_case c ON c.caseId = a.caseId
       LEFT JOIN course co ON co.courseId = a.courseId
       WHERE a.assignmentId = ?`, [id]);
    if (!arows.length) throw new ApiError(404, '作业不存在');

    const [rows] = await pool.query<any[]>(
      `SELECT u.userId, u.username, u.email,
              s.submissionId, s.content, s.experimentRecordId, s.score, s.feedback,
              s.status, s.submittedAt, s.gradedAt,
              r.recordId AS expRecordId, r.score AS expScore, r.result AS expResult,
              r.mode AS expMode, r.submitTime AS expSubmitTime
       FROM user u
       LEFT JOIN assignment_submission s
         ON s.assignmentId = ? AND s.studentId = u.userId
       LEFT JOIN experiment_record r ON r.recordId = s.experimentRecordId
       WHERE u.role = 'student' AND u.status = 0
       ORDER BY (s.submissionId IS NULL), s.submittedAt DESC, u.userId ASC`,
      [id]);

    const submitted = rows.filter((r) => r.submissionId).length;
    const total = rows.length;
    return ok(res, {
      assignment: arows[0],
      stats: { total, submitted, missing: total - submitted },
      submissions: rows,
    });
  } catch (e) { next(e); }
});

/** 教师：评分 / 反馈 */
router.post('/submissions/:id/grade', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const score = req.body?.score === null || req.body?.score === undefined
      ? null : Number(req.body.score);
    const feedback = req.body?.feedback ? String(req.body.feedback) : null;
    if (score !== null && (isNaN(score) || score < 0 || score > 100)) {
      throw new ApiError(400, '分数应在 0-100');
    }
    await pool.query(
      `UPDATE assignment_submission
       SET score=?, feedback=?, status='graded', gradedAt=NOW()
       WHERE submissionId=?`,
      [score, feedback, id]);
    return ok(res, { updated: true });
  } catch (e) { next(e); }
});

export default router;
