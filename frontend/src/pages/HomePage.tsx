import { Card, Col, Row, Statistic, Tag, Progress, Button } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { coursesApi, evaluationApi, statisticsApi } from '../apis';
import { useAuth } from '../hooks/useAuth';

export default function HomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([statisticsApi.me(), evaluationApi.records(), coursesApi.list()])
      .then(([s, r, c]) => {
        setStats(s.data);
        setRecords(r.data ?? []);
        setCourses((c.data ?? []).slice(0, 3));
      })
      .catch(() => { /* noop */ });
  }, []);

  const radarOption = {
    tooltip: {},
    radar: {
      indicator: [
        { name: '重入', max: 100 },
        { name: '整数溢出', max: 100 },
        { name: '抢先交易', max: 100 },
        { name: '拒绝服务', max: 100 },
        { name: 'tx.origin', max: 100 },
      ],
    },
    series: [{
      type: 'radar', areaStyle: { opacity: 0.25 },
      data: [{
        value: ['reentrancy', 'overflow', 'frontrunning', 'dos', 'txorigin'].map((t) =>
          stats?.radar?.find((x: any) => x.vulnType === t)?.score ?? 0),
        name: '能力分布',
      }],
    }],
  };

  return (
    <div className="space-y-5">
      <Card className="!rounded-2xl" style={{ background: 'linear-gradient(120deg,#1677ff,#0958d9)' }}>
        <div className="text-white">
          <div className="text-2xl font-semibold">你好，{user?.username} 👋</div>
          <div className="opacity-80 mt-1">欢迎回到智能合约安全教学与实训平台，今天也来挑战漏洞吧。</div>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}><Card><Statistic title="完成课程" value={stats?.finishedCourses ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="总得分" value={stats?.totalScore ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="实验次数" value={stats?.submissions ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="平均得分" value={stats?.avgScore ?? 0} precision={1} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="近期课程" extra={<Link to="/courses">查看全部</Link>}>
            {courses.length === 0 && <div className="text-slate-400">暂无课程，请到课程页面查看</div>}
            <div className="space-y-3">
              {courses.map((c) => (
                <div key={c.courseId} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div>
                    <div className="font-medium">{c.title}</div>
                    <div className="text-slate-500 text-xs">{c.description?.slice(0, 60)}</div>
                  </div>
                  <Tag color="blue">{c.difficulty}</Tag>
                </div>
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="能力雷达图">
            <ReactECharts option={radarOption} style={{ height: 280 }} />
          </Card>
        </Col>
      </Row>

      <Card title="最近提交">
        {records.length === 0 ? (
          <div className="text-slate-400">还没有提交记录，<Link to="/experiments">去做实验</Link></div>
        ) : (
          <div className="space-y-2">
            {records.slice(0, 5).map((r: any) => (
              <div key={r.recordId} className="flex items-center justify-between p-2 rounded bg-slate-50">
                <span>#{r.recordId} {r.caseName}</span>
                <span>
                  <Tag color={r.result === 'success' ? 'green' : 'red'}>{r.result}</Tag>
                  <Progress percent={r.score} size="small" style={{ width: 120 }} />
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col span={8}><Link to="/experiments"><Button type="primary" block size="large">开始做实验</Button></Link></Col>
        <Col span={8}><Link to="/courses"><Button block size="large">学习课程</Button></Link></Col>
        <Col span={8}><Link to="/records"><Button block size="large">查看我的提交</Button></Link></Col>
      </Row>
    </div>
  );
}
