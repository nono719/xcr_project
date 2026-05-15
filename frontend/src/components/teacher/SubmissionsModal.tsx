import { Alert, Button, Card, Col, Descriptions, Drawer, Empty, Form, Input, InputNumber, Modal, Progress, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { teacherApi } from '../../apis';
import Markdown from '../Markdown';

interface Props {
  assignmentId: number | null;
  onClose: () => void;
}

export default function SubmissionsDrawer({ assignmentId, onClose }: Props) {
  const [data, setData] = useState<any>(null);
  const [picked, setPicked] = useState<any>(null);
  const [gradeForm] = Form.useForm();

  const load = () => {
    if (!assignmentId) return;
    teacherApi.assignmentSubmissions(assignmentId).then((r) => setData(r.data));
  };

  useEffect(() => {
    if (assignmentId) load();
    else setData(null);
  }, [assignmentId]);

  const grade = async () => {
    const v = await gradeForm.validateFields();
    await teacherApi.gradeSubmission(picked.submissionId, {
      score: v.score === undefined ? null : Number(v.score),
      feedback: v.feedback ?? '',
    });
    message.success('已批阅');
    setPicked(null); gradeForm.resetFields();
    load();
  };

  if (!assignmentId || !data) {
    return (
      <Drawer open={!!assignmentId} onClose={onClose} width="80%" title="加载中..." />
    );
  }

  const { assignment, stats, submissions } = data;
  const pct = stats.total ? Math.round((stats.submitted / stats.total) * 100) : 0;

  return (
    <Drawer
      open={!!assignmentId}
      onClose={onClose}
      width="86%"
      title={<span>作业提交详情：<b>{assignment.title}</b></span>}
    >
      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={8}><Card size="small"><Statistic title="班级人数" value={stats.total} /></Card></Col>
        <Col xs={8}><Card size="small"><Statistic title="已提交" value={stats.submitted} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={8}><Card size="small"><Statistic title="未提交" value={stats.missing} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
      </Row>
      <Card size="small" className="mb-4">
        <Progress percent={pct} format={(p) => `提交率 ${p}%`} />
      </Card>

      <Descriptions size="small" column={{ xs: 1, md: 3 }} bordered className="mb-4">
        <Descriptions.Item label="截止时间">
          {assignment.deadline ? new Date(assignment.deadline).toLocaleString() : '无'}
        </Descriptions.Item>
        <Descriptions.Item label="关联案例">
          {assignment.caseId ? `#${assignment.caseId} ${assignment.caseName}` : '无'}
        </Descriptions.Item>
        <Descriptions.Item label="关联课程">
          {assignment.courseId ? `#${assignment.courseId} ${assignment.courseName}` : '无'}
        </Descriptions.Item>
      </Descriptions>

      <Table
        rowKey="userId" dataSource={submissions} size="middle" pagination={{ pageSize: 20 }}
        columns={[
          { title: '学生', dataIndex: 'username', width: 140 },
          { title: '邮箱', dataIndex: 'email' },
          {
            title: '状态', width: 110,
            render: (_, r) => {
              if (!r.submissionId) return <Tag color="default">未提交</Tag>;
              if (r.status === 'graded') return <Tag color="green">已批阅</Tag>;
              return <Tag color="processing">已提交</Tag>;
            },
          },
          {
            title: '提交时间', dataIndex: 'submittedAt', width: 170,
            render: (v) => v ? new Date(v).toLocaleString() : '-',
          },
          {
            title: '附评测', width: 200,
            render: (_, r) => r.expRecordId
              ? (
                <span>
                  <Link to={`/report/${r.expRecordId}`}>#{r.expRecordId}</Link>
                  <Tag color={r.expScore >= 70 ? 'green' : 'red'} className="!ml-2">{r.expScore ?? '-'}/100</Tag>
                  <Tag>{r.expMode}</Tag>
                </span>
              ) : <span className="text-slate-400">-</span>,
          },
          {
            title: '教师评分', dataIndex: 'score', width: 100,
            render: (v) => v === null || v === undefined ? '-' : <Tag color="blue">{v}</Tag>,
          },
          {
            title: '操作', width: 130,
            render: (_, r) => r.submissionId
              ? <Button size="small" onClick={() => { setPicked(r); gradeForm.setFieldsValue({ score: r.score, feedback: r.feedback }); }}>查看 / 批阅</Button>
              : <Tag color="orange">待提交</Tag>,
          },
        ]}
      />

      <Modal
        open={!!picked}
        onCancel={() => { setPicked(null); gradeForm.resetFields(); }}
        onOk={grade}
        title={picked ? `批阅：${picked.username}` : ''}
        width={760}
        okText="保存评分"
      >
        {picked && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="学生">{picked.username}</Descriptions.Item>
              <Descriptions.Item label="提交时间">{new Date(picked.submittedAt).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="状态">{picked.status}</Descriptions.Item>
              <Descriptions.Item label="附评测记录">
                {picked.expRecordId
                  ? <Link to={`/report/${picked.expRecordId}`}>#{picked.expRecordId} ({picked.expScore}/100, {picked.expMode})</Link>
                  : '无'}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="学生提交内容">
              {picked.content
                ? <div className="text-sm whitespace-pre-wrap">{picked.content}</div>
                : <Typography.Text type="secondary">（学生未填写文字内容）</Typography.Text>}
            </Card>

            <Card size="small" title="教师评分">
              <Form form={gradeForm} layout="vertical">
                <Form.Item name="score" label="分数 (0-100)" extra="留空则只保存反馈不打分">
                  <InputNumber min={0} max={100} style={{ width: 160 }} />
                </Form.Item>
                <Form.Item name="feedback" label="反馈">
                  <Input.TextArea rows={4} maxLength={2000} showCount placeholder="给学生的反馈" />
                </Form.Item>
              </Form>
            </Card>
          </Space>
        )}
      </Modal>
    </Drawer>
  );
}
