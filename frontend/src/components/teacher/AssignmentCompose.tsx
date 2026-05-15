import { Alert, Button, Card, Col, DatePicker, Divider, Form, Input, Row, Select, Space, Tag, Typography, message } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { coursesApi, experimentsApi, teacherApi } from '../../apis';
import { ASSIGNMENT_TEMPLATES, renderTemplate, type AssignmentTemplate } from '../../data/assignment-templates';

interface Props { onSent?: () => void }

export default function AssignmentCompose({ onSent }: Props) {
  const [tplId, setTplId] = useState<string>('lab-attack');
  const [courses, setCourses] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [caseId, setCaseId] = useState<number | undefined>();
  const [courseId, setCourseId] = useState<number | undefined>();
  const [deadline, setDeadline] = useState<Dayjs | null>(dayjs().add(7, 'day').hour(23).minute(59));
  const [form] = Form.useForm();

  const currentTpl: AssignmentTemplate =
    ASSIGNMENT_TEMPLATES.find((t) => t.id === tplId) ?? ASSIGNMENT_TEMPLATES[0];

  useEffect(() => {
    Promise.all([coursesApi.list(), experimentsApi.cases()]).then(([cs, cas]) => {
      setCourses(cs.data ?? []);
      setCases(cas.data ?? []);
    });
  }, []);

  // 模板切换或上下文变化时，自动填充标题/内容
  useEffect(() => {
    const c = cases.find((x) => x.caseId === caseId);
    const co = courses.find((x) => x.courseId === courseId);
    const { title, content } = renderTemplate(currentTpl, {
      caseName: c?.name,
      courseName: co?.title,
    });
    form.setFieldsValue({ title, content });
  }, [tplId, caseId, courseId, cases, courses, currentTpl, form]);

  const linkSuggest = caseId ? `/experiments/${caseId}` : (courseId ? `/courses/${courseId}` : '');

  const submit = async () => {
    const v = await form.validateFields();
    if (currentTpl.needsCase && !caseId) return message.warning('请选择关联案例');
    if (currentTpl.needsCourse && !courseId) return message.warning('请选择关联课程');
    if (!deadline) return message.warning('请选择截止时间');

    const r = await teacherApi.postAssignment({
      title: v.title, content: v.content,
      caseId: caseId ?? null, courseId: courseId ?? null,
      deadline: deadline.toISOString(),
    });
    if (r?.code === 200) {
      message.success(`已发布作业 #${r.data.assignmentId}`);
      // 立即触发一次扫描，让学生 24h 内能立刻看到提醒
      await teacherApi.broadcast({
        title: `[新作业] ${v.title}`,
        content: `截止时间：${deadline.format('YYYY-MM-DD HH:mm')}\n${v.content.slice(0, 200)}`,
        link: linkSuggest,
      });
      message.info('同步给所有学生发了一条通知');
      form.resetFields();
      setCaseId(undefined); setCourseId(undefined);
      onSent?.();
    }
  };

  return (
    <Card title="发布作业" extra={<Tag color="processing">带截止时间 · 自动提醒</Tag>}>
      <Alert
        className="mb-4" showIcon type="info"
        message="模板会自动填好标题与正文，你也能继续修改。截止前 24 小时系统会自动发提醒。"
      />

      <Typography.Title level={5} className="!mt-0">1) 选择作业类型</Typography.Title>
      <Row gutter={[12, 12]}>
        {ASSIGNMENT_TEMPLATES.map((t) => (
          <Col xs={24} sm={12} lg={8} key={t.id}>
            <Card
              hoverable
              size="small"
              onClick={() => setTplId(t.id)}
              style={{
                borderColor: tplId === t.id ? '#1677ff' : undefined,
                borderWidth: tplId === t.id ? 2 : 1,
                background: tplId === t.id ? '#e6f4ff' : undefined,
              }}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">{t.name}</span>
                {tplId === t.id && <CheckOutlined style={{ color: '#1677ff' }} />}
              </div>
              <div className="text-xs text-slate-500 mt-1 min-h-[36px]">{t.desc}</div>
              <Space size={[4, 4]} wrap className="mt-1">
                {t.needsCase && <Tag color="orange">需选案例</Tag>}
                {t.needsCourse && <Tag color="purple">需选课程</Tag>}
                {!t.needsCase && !t.needsCourse && <Tag>自定义</Tag>}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Divider />
      <Typography.Title level={5}>2) 选择关联资源</Typography.Title>
      <Row gutter={12}>
        <Col xs={24} md={12}>
          <Form.Item label={<span>关联案例 {currentTpl.needsCase && <Tag color="red">必填</Tag>}</span>}>
            <Select
              placeholder="选择案例（实验）"
              allowClear value={caseId}
              onChange={setCaseId}
              options={cases.map((x: any) => ({
                value: x.caseId,
                label: `#${x.caseId} ${x.name} (${x.vulnType})`,
              }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label={<span>关联课程 {currentTpl.needsCourse && <Tag color="red">必填</Tag>}</span>}>
            <Select
              placeholder="选择课程"
              allowClear value={courseId}
              onChange={setCourseId}
              options={courses.map((x: any) => ({
                value: x.courseId,
                label: `#${x.courseId} ${x.title}`,
              }))}
            />
          </Form.Item>
        </Col>
      </Row>

      <Divider />
      <Typography.Title level={5}>3) 编辑标题与正文</Typography.Title>
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '标题必填' }]}>
          <Input placeholder="作业标题" />
        </Form.Item>
        <Form.Item name="content" label="正文">
          <Input.TextArea rows={6} placeholder="详细要求" maxLength={2000} showCount />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item label="截止时间" required>
              <DatePicker
                showTime style={{ width: '100%' }}
                value={deadline}
                onChange={setDeadline}
                disabledDate={(d) => d && d < dayjs().startOf('day')}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label={<span>提醒链接 <span className="text-xs text-slate-400">（自动推断）</span></span>}>
              <Input value={linkSuggest} disabled placeholder="（按关联资源自动生成）" />
            </Form.Item>
          </Col>
        </Row>

        <Space>
          <Button type="primary" onClick={submit}>发布作业 + 立即提醒</Button>
          <Button onClick={() => { form.resetFields(); setCaseId(undefined); setCourseId(undefined); }}>
            清空
          </Button>
        </Space>
      </Form>
    </Card>
  );
}
