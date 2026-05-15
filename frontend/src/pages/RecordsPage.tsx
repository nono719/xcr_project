import { Card, Table, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { evaluationApi } from '../apis';

export default function RecordsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const navigate = useNavigate();
  useEffect(() => { evaluationApi.records().then((r) => setRows(r.data ?? [])); }, []);

  return (
    <Card title="我的实验提交">
      <Table
        rowKey="recordId"
        size="middle"
        dataSource={rows}
        pagination={{ pageSize: 15 }}
        columns={[
          { title: '#', dataIndex: 'recordId', width: 80 },
          { title: '案例', dataIndex: 'caseName' },
          { title: '漏洞类型', dataIndex: 'vulnType', render: (v) => <Tag color="processing">{v}</Tag> },
          { title: '模式', dataIndex: 'mode', render: (v) => <Tag>{v}</Tag> },
          { title: '得分', dataIndex: 'score', width: 100 },
          {
            title: '结果', dataIndex: 'result', width: 100,
            render: (v) => <Tag color={v === 'success' ? 'green' : 'red'}>{v}</Tag>,
          },
          {
            title: '提交时间', dataIndex: 'submitTime',
            render: (v) => new Date(v).toLocaleString(),
          },
          {
            title: '操作', width: 100,
            render: (_, r) => <a onClick={() => navigate(`/report/${r.recordId}`)}>查看</a>,
          },
        ]}
      />
    </Card>
  );
}
