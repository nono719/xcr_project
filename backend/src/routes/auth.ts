import { Router } from 'express';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import { pool } from '../config/db';
import { env } from '../config/env';
import { signToken } from '../utils/jwt';
import { ApiError, ok } from '../utils/response';
import { logOperation } from '../utils/logger';
import { authRequired } from '../middlewares/auth';

const router = Router();

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(20).pattern(/^[a-zA-Z0-9_]+$/).required(),
  password: Joi.string().min(8).max(64).pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/).required()
    .messages({ 'string.pattern.base': '密码强度不足，至少 8 位且含字母与数字' }),
  email: Joi.string().email().required(),
  role: Joi.string().valid('student', 'teacher').default('student'),
});

router.post('/register', async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) throw new ApiError(400, error.message);

    const [exists] = await pool.query<any[]>('SELECT userId FROM user WHERE username=? OR email=?',
      [value.username, value.email]);
    if (exists.length) throw new ApiError(400, '用户名或邮箱已存在');

    const salt = await bcrypt.genSalt(env.bcrypt.saltRounds);
    const hash = await bcrypt.hash(value.password, salt);
    const [result] = await pool.query<any>(
      'INSERT INTO user(username,password,salt,role,email) VALUES(?,?,?,?,?)',
      [value.username, hash, salt, value.role, value.email],
    );
    logOperation('register', result.insertId, { username: value.username, role: value.role });
    return ok(res, { userId: result.insertId, username: value.username, role: value.role });
  } catch (e) { next(e); }
});

const loginSchema = Joi.object({
  account: Joi.string().required(), // username or email
  password: Joi.string().required(),
});

router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) throw new ApiError(400, error.message);

    const [rows] = await pool.query<any[]>(
      'SELECT * FROM user WHERE username=? OR email=? LIMIT 1',
      [value.account, value.account],
    );
    const u = rows[0];
    if (!u) throw new ApiError(401, '账号或密码错误');
    if (u.status === 1) throw new ApiError(403, '账号已被禁用');
    if (u.lockUntil && new Date(u.lockUntil).getTime() > Date.now()) {
      throw new ApiError(403, '账号已锁定，请稍后再试');
    }

    const okPwd = await bcrypt.compare(value.password, u.password);
    if (!okPwd) {
      const fail = u.failCount + 1;
      let lockUntil: Date | null = null;
      if (fail >= 5) lockUntil = new Date(Date.now() + 15 * 60_000);
      await pool.query('UPDATE user SET failCount=?, lockUntil=? WHERE userId=?',
        [fail, lockUntil, u.userId]);
      throw new ApiError(401, lockUntil ? '连续失败 5 次，账号锁定 15 分钟' : '账号或密码错误');
    }

    await pool.query('UPDATE user SET failCount=0, lockUntil=NULL, lastLoginTime=NOW() WHERE userId=?',
      [u.userId]);
    const token = signToken({ userId: u.userId, username: u.username, role: u.role });
    logOperation('login', u.userId, { ip: req.ip });
    return ok(res, {
      token,
      user: { userId: u.userId, username: u.username, role: u.role, email: u.email },
    });
  } catch (e) { next(e); }
});

router.get('/me', authRequired, async (req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      'SELECT userId,username,role,email,createTime,lastLoginTime FROM user WHERE userId=?',
      [req.user!.userId],
    );
    return ok(res, rows[0] ?? null);
  } catch (e) { next(e); }
});

const profileSchema = Joi.object({
  email: Joi.string().email().optional(),
  oldPassword: Joi.string().optional(),
  newPassword: Joi.string().min(8).max(64).pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/).optional(),
});

router.put('/profile', authRequired, async (req, res, next) => {
  try {
    const { error, value } = profileSchema.validate(req.body);
    if (error) throw new ApiError(400, error.message);
    if (value.email) {
      await pool.query('UPDATE user SET email=? WHERE userId=?', [value.email, req.user!.userId]);
    }
    if (value.oldPassword && value.newPassword) {
      const [rows] = await pool.query<any[]>('SELECT password FROM user WHERE userId=?',
        [req.user!.userId]);
      const okPwd = await bcrypt.compare(value.oldPassword, rows[0].password);
      if (!okPwd) throw new ApiError(400, '原密码错误');
      const salt = await bcrypt.genSalt(env.bcrypt.saltRounds);
      const hash = await bcrypt.hash(value.newPassword, salt);
      await pool.query('UPDATE user SET password=?, salt=? WHERE userId=?',
        [hash, salt, req.user!.userId]);
    }
    logOperation('updateProfile', req.user!.userId);
    return ok(res, { updated: true });
  } catch (e) { next(e); }
});

export default router;
