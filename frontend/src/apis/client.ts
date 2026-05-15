import axios from 'axios';
import { message } from 'antd';

export const api = axios.create({
  baseURL: '/api',
  timeout: 60_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('xcr_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const msg = err?.response?.data?.message ?? err.message ?? '请求失败';
    if (status === 401) {
      message.warning('登录已过期，请重新登录');
      localStorage.removeItem('xcr_token');
      localStorage.removeItem('xcr_user');
      if (location.pathname !== '/login') location.href = '/login';
    } else if (status === 403) {
      message.error(msg || '没有权限');
    } else if (status >= 400) {
      message.error(msg);
    }
    return Promise.reject(err);
  },
);

export type Resp<T> = { code: number; message: string; data: T };
