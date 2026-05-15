import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export type Role = 'student' | 'teacher' | 'admin';

export interface JwtPayload {
  userId: number;
  username: string;
  role: Role;
}

export function signToken(payload: JwtPayload): string {
  const opts: SignOptions = { expiresIn: env.jwt.expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwt.secret, opts);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.secret) as JwtPayload;
}
