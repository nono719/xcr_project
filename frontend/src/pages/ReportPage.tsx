import { Button, Card, Col, Descriptions, Divider, Progress, Row, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import MonacoIDE from '../components/MonacoIDE';
import { evaluationApi } from '../apis';

export default function ReportPage() {
  const { id } = useParams();
  const [rep, setRep] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    evaluationApi.report(Number(id)).then((r) => setRep(r.data));
  }, [id]);

  const exportJson = () => {
    if (!rep) return;
    const blob = new Blob([JSON.stringify(rep, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xcr-report-${rep.recordId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('报告已导出');
  };

  if (!rep) return <Card>加载中...</Card>;

  const detail = rep.detail ?? {};

  return (
    <Card
      title={<span>评测报告 #{rep.recordId} · {rep.caseName}</span>}
      extra={<Button type="primary" onClick={exportJson}>输出报告</Button>}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <div className="text-center">
            <Progress type="dashboard" percent={rep.score} format={(p) => `${p}/100`} />
            <div className="mt-2">
              <Tag color={rep.status === 'success' ? 'green' : 'red'}>
                {rep.status === 'success' ? '攻击/防御成功' : '未通过'}
              </Tag>
            </div>
          </div>
        </Col>
        <Col xs={24} md={16}>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="漏洞类型">{rep.vulnType}</Descriptions.Item>
            <Descriptions.Item label="SWC">{rep.swcId || '-'}</Descriptions.Item>
            <Descriptions.Item label="模式">{rep.mode}</Descriptions.Item>
            <Descriptions.Item label="提交时间">{new Date(rep.submitTime).toLocaleString()}</Descriptions.Item>
          </Descriptions>
        </Col>
      </Row>

      <Divider orientation="left">分项明细</Divider>
      {Object.entries(detail).map(([k, v]: any) => (
        <div key={k} className="flex justify-between border-b py-2">
          <span className="font-medium">{k}</span>
          <span>
            <Tag color={v.pass ? 'green' : 'red'}>{v.pass ? 'PASS' : 'FAIL'}</Tag>
            <span className="text-slate-500 text-xs">{v.message}</span>
          </span>
        </div>
      ))}

      <Divider orientation="left">提交代码</Divider>
      <Typography.Text type="secondary">如评测失败，请对照下方代码与分项明细修改后再次提交。</Typography.Text>
      <div className="mt-2">
        <MonacoIDE value={rep.code} readOnly height={420} />
      </div>
    </Card>
  );
}
