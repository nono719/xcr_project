import { Alert, Button, Card, Col, Descriptions, Divider, Progress, Row, Tag, Typography, message } from 'antd';
import { CheckCircleTwoTone, CloseCircleTwoTone } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import MonacoIDE from '../components/MonacoIDE';
import { evaluationApi } from '../apis';
import { getCriteria } from '../data/criteria';

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

      <Divider orientation="left">分项明细 · 链上事实判定</Divider>
      {(() => {
        const crit = getCriteria(rep.vulnType);
        const rows: Array<{ key: keyof typeof detail; label: string; weight: number; criterion: string }> = [
          { key: 'compile',   label: '编译',     weight: 10, criterion: 'Solidity 代码能被 solc 编译通过' },
          { key: 'deploy',    label: '部署',     weight: 10, criterion: '漏洞合约能成功部署到沙箱' },
          { key: 'execute',   label: '攻击交易', weight: 10, criterion: '你的 attack() 函数能被调用且不 revert' },
          {
            key: 'triggered', label: '漏洞触发', weight: 70,
            criterion: crit?.rubric.find((r) => r.name === '漏洞触发')?.desc ?? '类型相关链上事实',
          },
          {
            key: 'defended', label: '防御有效', weight: 70,
            criterion: '仅 fix 模式打分：修复后的合约能阻止原有攻击',
          },
        ];
        return (
          <div className="space-y-2">
            {rows.map((r) => {
              const v = (detail as any)[r.key] ?? { pass: false, message: '—' };
              const relevant = rep.mode === 'attack' ? r.key !== 'defended' : r.key !== 'triggered';
              const pass = v.pass;
              return (
                <Card
                  key={r.key}
                  size="small"
                  className={relevant ? '' : 'opacity-50'}
                  style={{ borderLeft: `4px solid ${pass ? '#52c41a' : (relevant ? '#ff4d4f' : '#d9d9d9')}` }}
                >
                  <Row gutter={12} align="middle">
                    <Col xs={5} sm={3} className="text-center">
                      {pass
                        ? <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: 22 }} />
                        : <CloseCircleTwoTone twoToneColor={relevant ? '#ff4d4f' : '#d9d9d9'} style={{ fontSize: 22 }} />}
                    </Col>
                    <Col xs={19} sm={7}>
                      <div className="font-medium">{r.label}</div>
                      <Tag color={pass ? 'green' : (relevant ? 'red' : 'default')} className="!mt-1">
                        {pass ? `+${r.weight} 分` : `0 / ${r.weight} 分`}
                      </Tag>
                    </Col>
                    <Col xs={24} sm={14}>
                      <div className="text-slate-500 text-xs mb-1">判定标准：{r.criterion}</div>
                      <div className="text-slate-800 text-sm">
                        <span className="text-slate-400">链上事实：</span>{v.message}
                      </div>
                      {v.txHash && (
                        <div className="text-slate-400 text-xs mt-1 font-mono break-all">tx: {v.txHash}</div>
                      )}
                      {v.contractAddress && (
                        <div className="text-slate-400 text-xs mt-1 font-mono break-all">addr: {v.contractAddress}</div>
                      )}
                    </Col>
                  </Row>
                </Card>
              );
            })}
          </div>
        );
      })()}

      {rep.score < 70 && (
        <Alert
          className="mt-4" type="warning" showIcon
          message="未达到通过线（70 分）"
          description={'评分中 70 分主权重要求在链上看到漏洞真实被触发的事实。请检查上面「漏洞触发」项的『链上事实』，根据提示修改攻击合约后重新提交。'}
        />
      )}

      <Divider orientation="left">提交代码</Divider>
      <Typography.Text type="secondary">如评测失败，请对照下方代码与分项明细修改后再次提交。</Typography.Text>
      <div className="mt-2">
        <MonacoIDE value={rep.code} readOnly height={420} />
      </div>
    </Card>
  );
}
