import { Router } from 'express';
import { pool } from '../config/db';
import { ok } from '../utils/response';
import { authRequired } from '../middlewares/auth';

const router = Router();

router.get('/me', authRequired, async (req, res, next) => {
  try {
    const uid = req.user!.userId;
    const [[exp]] = await pool.query<any[]>(
      `SELECT COUNT(*) AS submissions, IFNULL(AVG(score),0) AS avgScore,
              IFNULL(MAX(score),0) AS maxScore, IFNULL(SUM(score),0) AS totalScore
       FROM experiment_record WHERE studentId=?`, [uid]);
    const [[prog]] = await pool.query<any[]>(
      'SELECT COUNT(DISTINCT courseId) AS courses FROM learning_progress WHERE studentId=?', [uid]);

    const [byType] = await pool.query<any[]>(
      `SELECT c.vulnType, IFNULL(AVG(r.score),0) AS avgScore, COUNT(r.recordId) AS attempts
       FROM experiment_record r LEFT JOIN vulnerability_case c ON c.caseId=r.caseId
       WHERE r.studentId=? GROUP BY c.vulnType`, [uid]);

    return ok(res, {
      submissions: Number(exp.submissions),
      avgScore: Number(Number(exp.avgScore).toFixed(1)),
      maxScore: Number(exp.maxScore),
      totalScore: Number(exp.totalScore),
      finishedCourses: Number(prog.courses),
      radar: byType.map((r) => ({
        vulnType: r.vulnType ?? 'other',
        score: Number(Number(r.avgScore).toFixed(1)),
        attempts: Number(r.attempts),
      })),
    });
  } catch (e) { next(e); }
});

export default router;
