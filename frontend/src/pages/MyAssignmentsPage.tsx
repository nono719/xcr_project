import { Card, Empty, Progress, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { assignmentsApi } from '../apis';

export default function MyAssignmentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => { assignmentsApi.myAssignments().then((r) => setRows(r.data ?? [])); }, []);

  const now = Date.now();

  return (
    <Card title="我的作业" extra={<Typography.Text type="secondary">截止时间近的排在前面</Typography.Text>}>
      {rows.length === 0 ? <Empty description="暂无作业" /> : (
        <Table
          rowKey="assignmentId" dataSource={rows} pagination={{ pageSize: 10 }}
          columns={[
            { title: 'ID', dataIndex: 'assignmentId', width: 70 },
            {
              title: '标题', dataIndex: 'title',
              render: (v, r) => (
                <a onClick={() => navigate(`/assignments/${r.assignmentId}`)}>{v}</a>
              ),
            },
            {
              title: '关联', width: 200,
              render: (_, r) => (
                <>
                  {r.caseId && <Tag color="orange">案例 #{r.caseId} {r.caseName}</Tag>}
                  {r.courseId && <Tag color="purple">课程 #{r.courseId}</Tag>}
                </>
              ),
            },
            {
              title: '截止时间', dataIndex: 'deadline', width: 170,
              render: (v) => {
                if (!v) return '-';
                const t = new Date(v).getTime();
                const left = t - now;
                const overdue = left < 0;
                const soon = !overdue && left < 24 * 3600 * 1000;
                return (
                  <span>
                    {new Date(v).toLocaleString()}
                    {overdue && <Tag color="red" className="!ml-2">已过截止</Tag>}
                    {soon && <Tag color="gold" className="!ml-2">24h 内</Tag>}
                  </span>
                );
              },
            },
            {
              title: '提交状态', dataIndex: 'subStatus', width: 130,
              render: (s, r) => {
                if (!r.submissionId) return <Tag>未提交</Tag>;
                if (s === 'graded') return <Tag color="green">已批阅 {r.score ?? '-'} 分</Tag>;
                return <Tag color="processing">已提交</Tag>;
              },
            },
            { title: '老师', dataIndex: 'teacherName', width: 100 },
            {
              title: '操作', width: 90,
              render: (_, r) => <a onClick={() => navigate(`/assignments/${r.assignmentId}`)}>查看</a>,
            },
          ]}
        />
      )}
      <div className="mt-3">
        <Progress
          percent={
            rows.length
              ? Math.round(rows.filter((r) => r.submissionId).length / rows.length * 100)
              : 0
          }
          format={(p) => `已完成 ${p}% (${rows.filter((r) => r.submissionId).length}/${rows.length})`}
        />
      </div>
    </Card>
  );
}
