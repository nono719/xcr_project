import { Alert, Button, Card, Col, Descriptions, Divider, Empty, Input, Row, Select, Space, Tag, Typography, message } from 'antd';
import { CheckCircleTwoTone } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { assignmentsApi } from '../apis';
import Markdown from '../components/Markdown';

export default function AssignmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [content, setContent] = useState('');
  const [recordId, setRecordId] = useState<number | undefined>();

  const load = () => {
    if (!id) return;
    assignmentsApi.detail(Number(id)).then((r) => {
      setData(r.data);
      setContent(r.data.submission?.content ?? '');
      setRecordId(r.data.submission?.experimentRecordId ?? undefined);
    });
  };
  useEffect(load, [id]);

  if (!data) return <Card>加载中...</Card>;
  const { assignment, submission, recordOptions } = data;

  const dl = assignment.deadline ? new Date(assignment.deadline).getTime() : null;
  const overdue = dl ? dl < Date.now() : false;

  const submit = async () => {
    if (overdue) return message.error('作业已过截止时间');
    const r = await assignmentsApi.submit(Number(id), { content, experimentRecordId: recordId ?? null });
    message.success(submission ? '已更新提交' : '提交成功');
    load();
  };

  const statusTag = submission
    ? (submission.status === 'graded'
        ? <Tag color="green">已批阅 {submission.score ?? '-'} 分</Tag>
        : <Tag color="processing">已提交</Tag>)
    : <Tag>未提交</Tag>;

  return (
    <div className="space-y-4">
      <Card
        title={<span>{assignment.title}</span>}
        extra={<Space>{statusTag}{overdue && <Tag color="red">已过截止</Tag>}</Space>}
      >
        <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }}>
          <Descriptions.Item label="教师">{assignment.teacherName}</Descriptions.Item>
          <Descriptions.Item label="截止时间">
            {assignment.deadline ? new Date(assignment.deadline).toLocaleString() : '无'}
          </Descriptions.Item>
          <Descriptions.Item label="发布时间">{new Date(assignment.createTime).toLocaleString()}</Descriptions.Item>
          {assignment.caseId && (
            <Descriptions.Item label="关联案例">
              <Link to={`/experiments/${assignment.caseId}`}>
                #{assignment.caseId} {assignment.caseName} ({assignment.vulnType})
              </Link>
            </Descriptions.Item>
          )}
          {assignment.courseId && (
            <Descriptions.Item label="关联课程">
              <Link to={`/courses/${assignment.courseId}`}>
                #{assignment.courseId} {assignment.courseName}
              </Link>
            </Descriptions.Item>
          )}
        </Descriptions>

        <Divider />
        <Typography.Title level={5}>作业内容</Typography.Title>
        {assignment.content
          ? <Markdown source={assignment.content} />
          : <Typography.Text type="secondary">（教师未填写正文）</Typography.Text>}
      </Card>

      <Card title="我的提交" extra={submission && (
        <Typography.Text type="secondary">
          {submission.submittedAt && `提交于 ${new Date(submission.submittedAt).toLocaleString()}`}
        </Typography.Text>
      )}>
        {submission?.status === 'graded' && (
          <Alert
            className="mb-3" type="success" showIcon
            message={`教师评分：${submission.score ?? '-'} 分`}
            description={submission.feedback || '（无反馈）'}
          />
        )}

        {assignment.caseId && (
          <div className="mb-4">
            <div className="mb-1 text-slate-700 font-medium">附加评测记录（可选）</div>
            <div className="text-xs text-slate-400 mb-2">
              选一条你在 <Link to={`/experiments/${assignment.caseId}`}>该实验</Link> 上的评测提交作为佐证。教师可以直接看到这次评测的得分。
            </div>
            <Select
              className="w-full"
              placeholder="选一条评测记录（可选）"
              value={recordId}
              onChange={setRecordId}
              allowClear
              options={(recordOptions ?? []).map((r: any) => ({
                value: r.recordId,
                label: `#${r.recordId} · ${r.mode} · ${r.score}/100 · ${r.result} · ${new Date(r.submitTime).toLocaleString()}`,
              }))}
            />
            {(recordOptions?.length ?? 0) === 0 && (
              <div className="text-amber-600 text-xs mt-1">
                还没在该案例做过实验？
                <Button type="link" size="small" onClick={() => navigate(`/experiments/${assignment.caseId}`)}>
                  去做实验
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="mb-1 text-slate-700 font-medium">心得 / 思路 / 补充说明</div>
        <Input.TextArea
          rows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={8000} showCount
          placeholder="写一下你的攻击思路、关键代码片段、踩过的坑..."
        />

        <div className="mt-3">
          <Button
            type="primary" size="large"
            icon={<CheckCircleTwoTone twoToneColor="#fff" />}
            onClick={submit}
            disabled={overdue}
          >
            {submission ? '更新提交' : '提交作业'}
          </Button>
          {overdue && <span className="ml-3 text-red-500 text-sm">已过截止时间，不能再提交</span>}
        </div>
      </Card>
    </div>
  );
}
