import { Alert, Button, Card, Form, Input, Radio, Select, Space, Tag, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { teacherApi } from '../../apis';

interface Props { onSent?: () => void }

export default function NotificationCompose({ onSent }: Props) {
  const [students, setStudents] = useState<any[]>([]);
  const [target, setTarget] = useState<'all' | 'pick'>('all');
  const [picked, setPicked] = useState<number[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    teacherApi.students().then((r) => setStudents(r.data ?? []));
  }, []);

  const submit = async () => {
    const v = await form.validateFields();
    const payload: any = { title: v.title, content: v.content, link: v.link };
    if (target === 'pick') payload.recipients = picked;
    const r = await teacherApi.broadcast(payload);
    message.success(`已发送给 ${r.data?.recipients ?? 0} 位学生 (新增 ${r.data?.inserted ?? 0} 条)`);
    form.resetFields();
    setPicked([]);
    onSent?.();
  };

  return (
    <Card title="发布通知" extra={<Tag color="processing">广播给学生</Tag>}>
      <Alert
        className="mb-4" showIcon type="info"
        message="区别于「发布作业」"
        description="通知用于发布课程公告、考试安排、紧急提醒等纯信息；作业带截止时间，并触发自动提醒。"
      />
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '标题必填' }, { max: 200 }]}>
          <Input placeholder="如：本周课程调整通知" />
        </Form.Item>
        <Form.Item name="content" label="正文">
          <Input.TextArea rows={5} placeholder="详细内容（支持换行）" maxLength={2000} showCount />
        </Form.Item>
        <Form.Item name="link" label={<span>跳转链接 <span className="text-slate-400 text-xs">（可选，相对路径如 /courses/1）</span></span>}>
          <Input placeholder="/courses/1 或 /experiments/2" />
        </Form.Item>
        <Form.Item label="接收人">
          <Radio.Group value={target} onChange={(e) => setTarget(e.target.value)}>
            <Radio value="all">全部学生 ({students.length})</Radio>
            <Radio value="pick">指定学生</Radio>
          </Radio.Group>
          {target === 'pick' && (
            <Select
              mode="multiple" className="w-full mt-2"
              placeholder="选择学生"
              value={picked}
              onChange={setPicked}
              maxTagCount={6}
              options={students.map((s) => ({
                value: s.userId,
                label: `${s.username} (${s.email})`,
              }))}
            />
          )}
        </Form.Item>
        <Space>
          <Button type="primary" icon={<SendOutlined />} onClick={submit}>发送通知</Button>
          <Button onClick={() => { form.resetFields(); setPicked([]); }}>清空</Button>
        </Space>
      </Form>
    </Card>
  );
}
