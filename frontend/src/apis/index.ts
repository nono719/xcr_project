import { api } from './client';

export const authApi = {
  login: (account: string, password: string) =>
    api.post('/auth/login', { account, password }).then((r) => r.data),
  register: (data: { username: string; password: string; email: string; role?: 'student' | 'teacher' }) =>
    api.post('/auth/register', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  updateProfile: (data: { email?: string; oldPassword?: string; newPassword?: string }) =>
    api.put('/auth/profile', data).then((r) => r.data),
};

export const coursesApi = {
  list: () => api.get('/courses').then((r) => r.data),
  detail: (id: number) => api.get(`/courses/${id}`).then((r) => r.data),
  myProgress: () => api.get('/courses/progress/me').then((r) => r.data),
  markProgress: (courseId: number, moduleId: number) =>
    api.post('/courses/progress', { courseId, moduleId }).then((r) => r.data),
  create: (data: any) => api.post('/courses', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/courses/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/courses/${id}`).then((r) => r.data),
  addModule: (data: any) => api.post('/courses/modules', data).then((r) => r.data),
};

export const experimentsApi = {
  cases: () => api.get('/experiment/cases').then((r) => r.data),
  caseDetail: (id: number) => api.get(`/experiment/cases/${id}`).then((r) => r.data),
  start: (caseId: number) => api.post('/experiment/start', { caseId }).then((r) => r.data),
  stop: (sandboxId: string) => api.post('/experiment/stop', { sandboxId }).then((r) => r.data),
  compile: (source: string, filename = 'Contract.sol') =>
    api.post('/experiment/compile', { source, filename }).then((r) => r.data),
  deploy: (data: { sandboxId: string; abi: any[]; bytecode: string; args?: any[]; fromIndex?: number }) =>
    api.post('/experiment/deploy', data).then((r) => r.data),
  call: (data: {
    sandboxId: string; contractAddress: string; abi: any[]; method: string;
    args?: any[]; fromIndex?: number; value?: string; send?: boolean;
  }) => api.post('/experiment/call', data).then((r) => r.data),
};

export const evaluationApi = {
  submit: (data: { caseId: number; mode: 'attack' | 'fix'; code: string }) =>
    api.post('/evaluation/submit', data).then((r) => r.data),
  records: () => api.get('/evaluation/records/me').then((r) => r.data),
  report: (id: number) => api.get(`/evaluation/report/${id}`).then((r) => r.data),
};

export const teacherApi = {
  overview: () => api.get('/teacher/overview').then((r) => r.data),
  students: () => api.get('/teacher/students').then((r) => r.data),
  studentRecords: (id: number) => api.get(`/teacher/student/${id}/records`).then((r) => r.data),
  cases: () => api.get('/teacher/cases').then((r) => r.data),
  createCase: (data: any) => api.post('/teacher/cases', data).then((r) => r.data),
  updateCase: (id: number, data: any) => api.put(`/teacher/cases/${id}`, data).then((r) => r.data),
  deleteCase: (id: number) => api.delete(`/teacher/cases/${id}`).then((r) => r.data),
  assignments: () => api.get('/teacher/assignments').then((r) => r.data),
  postAssignment: (data: any) => api.post('/teacher/assignments', data).then((r) => r.data),
};

export const adminApi = {
  users: (params?: { role?: string; q?: string }) =>
    api.get('/admin/users', { params }).then((r) => r.data),
  setStatus: (id: number, status: number) =>
    api.put(`/admin/users/${id}/status`, { status }).then((r) => r.data),
  resetPassword: (id: number, password: string) =>
    api.post(`/admin/users/${id}/reset-password`, { password }).then((r) => r.data),
  remove: (id: number) => api.delete(`/admin/users/${id}`).then((r) => r.data),
  logs: (limit = 200) => api.get('/admin/logs', { params: { limit } }).then((r) => r.data),
};

export const statisticsApi = {
  me: () => api.get('/statistics/me').then((r) => r.data),
};
