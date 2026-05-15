import { Card, Col, Row, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { experimentsApi } from '../apis';

const diffMap: Record<number, { text: string; color: string }> = {
  1: { text: 'Easy', color: 'green' },
  2: { text: 'Medium', color: 'gold' },
  3: { text: 'Hard', color: 'red' },
};

export default function ExperimentListPage() {
  const [list, setList] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => { experimentsApi.cases().then((r) => setList(r.data ?? [])); }, []);

  return (
    <Row gutter={[16, 16]}>
      {list.map((c) => (
        <Col xs={24} md={12} lg={8} key={c.caseId}>
          <Card hoverable className="card-hover h-full" onClick={() => navigate(`/experiments/${c.caseId}`)}>
            <div className="flex items-start justify-between mb-2">
              <div className="text-lg font-semibold">{c.name}</div>
              <Tag color={diffMap[c.difficulty]?.color}>{diffMap[c.difficulty]?.text}</Tag>
            </div>
            <Tag color="processing">{c.vulnType}</Tag>
            {c.swcId && <Tag>{c.swcId}</Tag>}
            <p className="text-slate-500 text-sm mt-3 line-clamp-3 min-h-[48px]">{c.description}</p>
            <div className="text-xs text-slate-400 mt-2">权重 {c.scoreWeight}</div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
