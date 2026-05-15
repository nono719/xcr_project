import { Card, Col, Row, Statistic, Table, Tabs, Tag, Button, Modal, Form, Input, Select, InputNumber, message, Space } from 'antd';
import { useEffect, useState } from 'react';
import { teacherApi } from '../apis';
import NotificationCompose from '../components/teacher/NotificationCompose';
import AssignmentCompose from '../components/teacher/AssignmentCompose';

export default function TeacherDashboardPage() {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [form] = Form.useForm();
  const [assignments, setAssignments] = useState<any[]>([]);

  const load = (k: string) => {
    if (k === 'overview') teacherApi.overview().then((r) => setOverview(r.data));
    if (k === 'students') teacherApi.students().then((r) => setStudents(r.data ?? []));
    if (k === 'cases') teacherApi.cases().then((r) => setCases(r.data ?? []));
    if (k === 'assignments' || k === 'publish-assignment') teacherApi.assignments().then((r) => setAssignments(r.data ?? []));
  };

  useEffect(() => { load(tab); }, [tab]);

  const onSaveCase = async () => {
    const v = await form.validateFields();
    if (editing?.caseId) await teacherApi.updateCase(editing.caseId, v);
    else await teacherApi.createCase(v);
    message.success('已保存');
    setEditing(null);
    form.resetFields();
    load('cases');
  };

  return (
    <Tabs
      activeKey={tab}
      onChange={setTab}
      items={[
        {
          key: 'overview', label: '概览',
          children: (
            <Row gutter={[16, 16]}>
              <Col xs={12} md={6}><Card><Statistic title="学生总数" value={overview?.students ?? 0} /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="课程数" value={overview?.courses ?? 0} /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="实验提交" value={overview?.experiments ?? 0} /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="平均分" value={overview?.avgScore ?? 0} /></Card></Col>
            </Row>
          ),
        },
        {
          key: 'students', label: '学生',
          children: (
            <Table
              rowKey="userId" dataSource={students} pagination={{ pageSize: 10 }}
              columns={[
                { title: 'ID', dataIndex: 'userId', width: 80 },
                { title: '用户名', dataIndex: 'username' },
                { title: '邮箱', dataIndex: 'email' },
                { title: '提交数', dataIndex: 'submissions', width: 100, sorter: (a, b) => a.submissions - b.submissions },
                {
                  title: '平均分', dataIndex: 'avgScore', width: 120,
                  render: (v) => Number(v).toFixed(1),
                  sorter: (a, b) => a.avgScore - b.avgScore,
                },
                {
                  title: '最近登录', dataIndex: 'lastLoginTime',
                  render: (v) => (v ? new Date(v).toLocaleString() : '-'),
                },
              ]}
            />
          ),
        },
        {
          key: 'publish-notice', label: '发通知',
          children: <NotificationCompose />,
        },
        {
          key: 'publish-assignment', label: '发作业',
          children: (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <AssignmentCompose onSent={() => load('publish-assignment')} />
              <Card title="已发布作业" size="small">
                <Table
                  rowKey="assignmentId" dataSource={assignments} size="small" pagination={{ pageSize: 10 }}
                  columns={[
                    { title: 'ID', dataIndex: 'assignmentId', width: 60 },
                    { title: '标题', dataIndex: 'title' },
                    { title: '案例', dataIndex: 'caseId', width: 80 },
                    { title: '课程', dataIndex: 'courseId', width: 80 },
                    {
                      title: '截止时间', dataIndex: 'deadline', width: 170,
                      render: (v) => v ? new Date(v).toLocaleString() : '-',
                    },
                    {
                      title: '发布时间', dataIndex: 'createTime', width: 170,
                      render: (v) => new Date(v).toLocaleString(),
                    },
                  ]}
                />
              </Card>
            </Space>
          ),
        },
        {
          key: 'cases', label: '案例管理',
          children: (
            <Card extra={<Button type="primary" onClick={() => { setEditing({}); form.resetFields(); }}>新建案例</Button>}>
              <Table
                rowKey="caseId" dataSource={cases} size="small"
                columns={[
                  { title: 'ID', dataIndex: 'caseId', width: 60 },
                  { title: '名称', dataIndex: 'name' },
                  { title: '漏洞类型', dataIndex: 'vulnType', render: (v) => <Tag>{v}</Tag> },
                  { title: 'SWC', dataIndex: 'swcId', width: 100 },
                  { title: '难度', dataIndex: 'difficulty', width: 80 },
                  { title: '权重', dataIndex: 'scoreWeight', width: 80 },
                  {
                    title: '状态', dataIndex: 'status', width: 80,
                    render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '禁用'}</Tag>,
                  },
                  {
                    title: '操作', width: 140,
                    render: (_, r) => (
                      <>
                        <a onClick={() => { setEditing(r); form.setFieldsValue(r); }}>编辑</a>
                        <span> · </span>
                        <a onClick={async () => { await teacherApi.deleteCase(r.caseId); message.success('已停用'); load('cases'); }}>停用</a>
                      </>
                    ),
                  },
                ]}
              />
              <Modal
                open={!!editing}
                title={editing?.caseId ? '编辑案例' : '新建案例'}
                onCancel={() => setEditing(null)}
                onOk={onSaveCase}
                width={720}
              >
                <Form form={form} layout="vertical">
                  <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
                  <Form.Item name="vulnType" label="漏洞类型" rules={[{ required: true }]}>
                    <Select options={[
                      { value: 'reentrancy', label: '重入' }, { value: 'overflow', label: '整数溢出' },
                      { value: 'frontrunning', label: '抢先交易' }, { value: 'dos', label: '拒绝服务' },
                      { value: 'txorigin', label: 'tx.origin' }, { value: 'shortaddr', label: '短地址' },
                    ]} />
                  </Form.Item>
                  <Form.Item name="swcId" label="SWC 编号"><Input placeholder="如 SWC-107" /></Form.Item>
                  <Form.Item name="difficulty" label="难度 1-3"><InputNumber min={1} max={3} /></Form.Item>
                  <Form.Item name="description" label="描述"><Input.TextArea rows={3} /></Form.Item>
                  <Form.Item name="attackGoal" label="攻击目标"><Input.TextArea rows={2} /></Form.Item>
                  <Form.Item name="vulnerableCode" label="漏洞合约代码" rules={[{ required: true }]}>
                    <Input.TextArea rows={6} />
                  </Form.Item>
                  <Form.Item name="referenceFix" label="参考修复方案"><Input.TextArea rows={5} /></Form.Item>
                  <Form.Item name="scoreWeight" label="分值权重"><InputNumber min={10} max={1000} /></Form.Item>
                </Form>
              </Modal>
            </Card>
          ),
        },
      ]}
    />
  );
}
