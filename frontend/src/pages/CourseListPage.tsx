import { Card, Col, Input, Row, Select, Tag, Empty } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { coursesApi } from '../apis';

export default function CourseListPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [sev, setSev] = useState('all');
  const [diff, setDiff] = useState('all');

  useEffect(() => { coursesApi.list().then((r) => setCourses(r.data ?? [])).catch(() => {}); }, []);

  const filtered = useMemo(() => courses.filter((c) => {
    const matchQ = !q || c.title?.toLowerCase().includes(q.toLowerCase());
    const matchSev = sev === 'all' || c.severity === sev;
    const matchDiff = diff === 'all' || c.difficulty === diff;
    return matchQ && matchSev && matchDiff;
  }), [courses, q, sev, diff]);

  return (
    <div className="space-y-4">
      <Card>
        <Row gutter={12}>
          <Col xs={24} md={10}><Input.Search placeholder="搜索课程标题" onChange={(e) => setQ(e.target.value)} allowClear /></Col>
          <Col xs={12} md={7}>
            <Select value={sev} onChange={setSev} className="w-full" options={[
              { value: 'all', label: '全部严重等级' },
              { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' },
            ]} />
          </Col>
          <Col xs={12} md={7}>
            <Select value={diff} onChange={setDiff} className="w-full" options={[
              { value: 'all', label: '全部难度' },
              { value: 'beginner', label: 'Beginner' },
              { value: 'intermediate', label: 'Intermediate' },
              { value: 'advanced', label: 'Advanced' },
            ]} />
          </Col>
        </Row>
      </Card>

      {filtered.length === 0 ? <Empty description="暂无课程" /> : (
        <Row gutter={[16, 16]}>
          {filtered.map((c) => (
            <Col xs={24} sm={12} lg={8} key={c.courseId}>
              <Card hoverable className="card-hover h-full"
                onClick={() => navigate(`/courses/${c.courseId}`)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="text-lg font-semibold">{c.title}</div>
                  <Tag color={c.severity === 'critical' ? 'red' : c.severity === 'high' ? 'volcano' : 'blue'}>
                    {c.severity}
                  </Tag>
                </div>
                <div className="text-slate-500 text-sm line-clamp-3 min-h-[48px]">{c.description}</div>
                <div className="mt-3 flex items-center justify-between">
                  <Tag>{c.difficulty}</Tag>
                  <span className="text-slate-400 text-xs">{c.teacherName ?? ''}</span>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
