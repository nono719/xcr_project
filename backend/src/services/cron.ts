import cron from 'node-cron';
import { pool } from '../config/db';
import { logger } from '../utils/logger';

let started = false;

/** 检查 24h 内到期且未通知的作业，写入通知 */
async function checkAssignmentDeadlines(forceWindow = '24 HOUR'): Promise<number> {
  const [assigns] = await pool.query<any[]>(
    `SELECT assignmentId, title, deadline, caseId, courseId
     FROM assignment
     WHERE deadline IS NOT NULL
       AND deadline > NOW()
       AND deadline <= DATE_ADD(NOW(), INTERVAL ${forceWindow})`,
  );
  if (!assigns.length) return 0;

  const [students] = await pool.query<any[]>(
    "SELECT userId FROM user WHERE role='student' AND status=0",
  );
  let inserted = 0;
  for (const a of assigns) {
    const link = a.caseId ? `/experiments/${a.caseId}` : (a.courseId ? `/courses/${a.courseId}` : null);
    const content = `任务即将截止：${new Date(a.deadline).toLocaleString('zh-CN')}`;
    for (const s of students) {
      const [r] = await pool.query<any>(
        `INSERT IGNORE INTO notification(userId,type,title,content,link,refId)
         VALUES(?,?,?,?,?,?)`,
        [s.userId, 'assignment_due', `[作业] ${a.title}`, content, link, a.assignmentId],
      );
      if ((r as any).affectedRows) inserted += 1;
    }
  }
  logger.info('cron: assignment deadline scan', {
    assignments: assigns.length, notifications: inserted,
  });
  return inserted;
}

/** 暴露给手动触发（管理员 / 测试） */
export async function triggerDeadlineCheck() {
  return checkAssignmentDeadlines('72 HOUR');
}

export function startCronJobs() {
  if (started) return;
  started = true;
  // 每小时第 0 分钟检查一次
  cron.schedule('0 * * * *', () => {
    checkAssignmentDeadlines().catch((e) => logger.error('cron error', { err: (e as Error).message }));
  });
  // 启动后 10 秒做一次首跑，便于本地验证
  setTimeout(() => {
    checkAssignmentDeadlines().catch((e) => logger.error('cron error', { err: (e as Error).message }));
  }, 10_000).unref();
  logger.info('cron jobs started');
}
