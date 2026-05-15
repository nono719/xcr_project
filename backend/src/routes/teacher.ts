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

export default router;
