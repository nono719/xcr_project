import { Button, Card, List, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { coursesApi } from '../apis';
import Markdown from '../components/Markdown';

export default function CourseDetailPage() {
  const { id } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [progress, setProgress] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!id) return;
    coursesApi.detail(Number(id)).then((r) => {
      setCourse(r.data.course);
      setModules(r.data.modules);
      setActive(r.data.modules?.[0] ?? null);
    });
    coursesApi.myProgress().then((r) => {
      setProgress(new Set((r.data ?? []).map((p: any) => p.moduleId)));
    });
  }, [id]);

  const markDone = async () => {
    if (!active) return;
    await coursesApi.markProgress(Number(id), active.moduleId);
    setProgress((s) => new Set(s).add(active.moduleId));
    message.success('已标记完成');
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="col-span-12 md:col-span-4 h-fit">
        <Typography.Title level={4}>{course?.title}</Typography.Title>
        <Typography.Paragraph type="secondary">{course?.description}</Typography.Paragraph>
        <List
          dataSource={modules}
          renderItem={(m) => (
            <List.Item
              className="!cursor-pointer hover:bg-slate-50 rounded-md !px-2"
              onClick={() => setActive(m)}
            >
              <div className="flex justify-between w-full">
                <span style={{ color: active?.moduleId === m.moduleId ? '#1677ff' : undefined }}>
                  {m.orderNo}. {m.title}
                </span>
                {progress.has(m.moduleId) && <Tag color="green">已完成</Tag>}
              </div>
            </List.Item>
          )}
        />
      </Card>

      <Card className="col-span-12 md:col-span-8">
        {active ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <Typography.Title level={3} style={{ margin: 0 }}>{active.title}</Typography.Title>
              <Button type="primary" onClick={markDone} disabled={progress.has(active.moduleId)}>
                {progress.has(active.moduleId) ? '已完成' : '标记完成'}
              </Button>
            </div>
            <Tag color="blue">{active.type}</Tag>
            <div className="mt-3">
              {active.content
                ? <Markdown source={active.content} />
                : <Typography.Text type="secondary">（暂无内容）</Typography.Text>}
            </div>
          </>
        ) : <div className="text-slate-400">请选择左侧章节</div>}
      </Card>
    </div>
  );
}
