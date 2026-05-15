import { Button, Card, Input, Modal, Select, Table, Tag, message } from 'antd';
import { useEffect, useState } from 'react';
import { adminApi } from '../apis';

const STATUS_MAP: Record<number, { text: string; color: string }> = {
  0: { text: '正常', color: 'green' },
  1: { text: '禁用', color: 'red' },
  2: { text: '锁定', color: 'orange' },
};

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [pwUser, setPwUser] = useState<any | null>(null);
  const [pw, setPw] = useState('');

  const load = () => adminApi.users({ role: role || undefined, q: q || undefined }).then((r) => setUsers(r.data ?? []));
  useEffect(() => { load(); adminApi.logs(100).then((r) => setLogs(r.data ?? [])); /* eslint-disable-next-line */ }, []);

  const setStatus = async (u: any, status: number) => {
    await adminApi.setStatus(u.userId, status);
    message.success('已更新'); load();
  };
  const resetPw = async () => {
    if (!pwUser) return;
    if (pw.length < 8) return message.warning('新密码至少 8 位');
    await adminApi.resetPassword(pwUser.userId, pw);
    message.success('已重置');
    setPwUser(null); setPw('');
  };

  return (
    <div className="space-y-4">
      <Card title="用户管理"
        extra={
          <div className="flex gap-2">
            <Select className="w-32" placeholder="角色" value={role || undefined} onChange={(v) => setRole(v ?? '')} allowClear
              options={[{ value: 'student' }, { value: 'teacher' }, { value: 'admin' }]} />
            <Input.Search placeholder="搜索用户名/邮箱" onSearch={() => load()} onChange={(e) => setQ(e.target.value)} allowClear />
            <Button onClick={load}>刷新</Button>
          </div>
        }>
        <Table
          rowKey="userId" dataSource={users} size="middle"
          columns={[
            { title: 'ID', dataIndex: 'userId', width: 80 },
            { title: '用户名', dataIndex: 'username' },
            { title: '角色', dataIndex: 'role', render: (v) => <Tag>{v}</Tag> },
            { title: '邮箱', dataIndex: 'email' },
            {
              title: '状态', dataIndex: 'status', width: 120,
              render: (v) => <Tag color={STATUS_MAP[v].color}>{STATUS_MAP[v].text}</Tag>,
            },
            {
              title: '操作', width: 260,
              render: (_, r) => (
                <span className="space-x-2">
                  {r.status !== 0 && <a onClick={() => setStatus(r, 0)}>启用</a>}
                  {r.status !== 1 && <a onClick={() => setStatus(r, 1)}>禁用</a>}
                  <a onClick={() => setPwUser(r)}>重置密码</a>
                </span>
              ),
            },
          ]}
        />
      </Card>

      <Card title="操作日志（最近 100 条）">
        <Table
          rowKey="logId" dataSource={logs} size="small" pagination={{ pageSize: 20 }}
          columns={[
            { title: 'ID', dataIndex: 'logId', width: 80 },
            { title: '用户ID', dataIndex: 'userId', width: 100 },
            { title: '操作', dataIndex: 'action' },
            { title: '详情', dataIndex: 'detail' },
            { title: '时间', dataIndex: 'createTime', render: (v) => new Date(v).toLocaleString() },
          ]}
        />
      </Card>

      <Modal open={!!pwUser} title={`重置密码：${pwUser?.username}`} onCancel={() => { setPwUser(null); setPw(''); }} onOk={resetPw}>
        <Input.Password value={pw} onChange={(e) => setPw(e.target.value)} placeholder="新密码至少 8 位" />
      </Modal>
    </div>
  );
}
