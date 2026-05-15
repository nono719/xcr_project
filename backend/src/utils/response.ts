import type { Response } from 'express';

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
}

export const ok = <T>(res: Response, data: T, message = 'ok') =>
  res.json({ code: 200, message, data } satisfies ApiResponse<T>);

export const fail = (res: Response, code: number, message: string) =>
  res.status(code).json({ code, message, data: null } satisfies ApiResponse);

export class ApiError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}
