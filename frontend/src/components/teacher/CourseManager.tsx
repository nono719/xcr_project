import { Button, Card, Col, Empty, Form, Input, InputNumber, List, Modal, Popconfirm, Row, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { coursesApi } from '../../apis';
import Markdown from '../Markdown';

export default function CourseManager() {
  const [list, setList] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  const reload = () => coursesApi.manageList().then((r) => setList(r.data ?? []));
  useEffect(() => { reload(); }, []);

  if (activeId === null) {
    return <CourseList list={list} reload={reload} onPick={setActiveId} />;
  }
  return (
    <CourseEditor
      courseId={activeId}
      onBack={() => { setActiveId(null); reload(); }}
    />
  );
}

/* ---------------- Course List ---------------- */
function CourseList({ list, reload, onPick }: { list: any[]; reload: () => void; onPick: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form] = Form.useForm();

  const save = async () => {
    const v = await form.validateFields();
    if (editing?.courseId) await coursesApi.update(editing.courseId, v);
    else await coursesApi.create(v);
    message.success('已保存');
    setOpen(false); setEditing(null); form.resetFields();
    reload();
  };

  return (
    <Card
      title="课程管理"
      extra={
        <Button
          type="primary" icon={<PlusOutlined />}
          onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}
        >
          新建课程
        </Button>
      }
    >
      <Table
        rowKey="courseId" dataSource={list} size="middle" pagination={{ pageSize: 10 }}
        columns={[
          { title: 'ID', dataIndex: 'courseId', width: 60 },
          { title: '标题', dataIndex: 'title' },
          { title: '描述', dataIndex: 'description', ellipsis: true },
          { title: '章节数', dataIndex: 'moduleCount', width: 80 },
          { title: '严重度', dataIndex: 'severity', width: 90, render: (v) => <Tag>{v}</Tag> },
          { title: '难度', dataIndex: 'difficulty', width: 110, render: (v) => <Tag color="blue">{v}</Tag> },
          {
            title: '状态', dataIndex: 'status', width: 90,
            render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? '已发布' : '未发布'}</Tag>,
          },
          {
            title: '操作', width: 220,
            render: (_, r) => (
              <Space>
                <Button type="link" onClick={() => onPick(r.courseId)}>编辑章节</Button>
                <Button type="link" onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }}>编辑信息</Button>
                <Popconfirm title="确认删除？章节会一并删除"
                  onConfirm={async () => { await coursesApi.remove(r.courseId); message.success('已删除'); reload(); }}>
                  <Button type="link" danger>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={open} title={editing?.courseId ? '编辑课程' : '新建课程'}
        onCancel={() => { setOpen(false); setEditing(null); }}
        onOk={save} width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="课程标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="cover" label="封面 URL（可选）"><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="severity" label="严重度">
                <Select options={['low','medium','high','critical'].map(v => ({ value: v }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="difficulty" label="难度">
                <Select options={['beginner','intermediate','advanced'].map(v => ({ value: v }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="orderNo" label="排序号"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            </Col>
          </Row>
          <Form.Item name="status" label="发布状态">
            <Select options={[{ value: 1, label: '已发布' }, { value: 0, label: '未发布（仅自己可见）' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

/* ---------------- Course Editor (Modules) ---------------- */
function CourseEditor({ courseId, onBack }: { courseId: number; onBack: () => void }) {
  const [data, setData] = useState<any>(null);
  const [activeKey, setActiveKey] = useState<string | undefined>();
  const [editing, setEditing] = useState<any | null>(null);
  const [modOpen, setModOpen] = useState(false);
  const [modForm] = Form.useForm();
  const [modContent, setModContent] = useState('');

  const reload = () => coursesApi.manageDetail(courseId).then((r) => {
    setData(r.data);
    if (r.data.modules.length && !activeKey) setActiveKey(String(r.data.modules[0].moduleId));
  });
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [courseId]);

  const newModule = () => {
    setEditing(null);
    modForm.resetFields();
    modForm.setFieldsValue({ type: 'text', orderNo: (data?.modules?.length ?? 0) + 1 });
    setModContent('');
    setModOpen(true);
  };

  const editModule = (m: any) => {
    setEditing(m);
    modForm.setFieldsValue(m);
    setModContent(m.content ?? '');
    setModOpen(true);
  };

  const saveModule = async () => {
    const v = await modForm.validateFields();
    const payload = { ...v, content: modContent, courseId };
    if (editing?.moduleId) await coursesApi.updateModule(editing.moduleId, payload);
    else await coursesApi.addModule(payload);
    message.success('已保存');
    setModOpen(false); setEditing(null); modForm.resetFields(); setModContent('');
    reload();
  };

  if (!data) return <Card>加载中...</Card>;
  const active = data.modules.find((m: any) => String(m.moduleId) === activeKey);

  return (
    <Card
      title={
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>返回</Button>
          <span>编辑：<b>{data.course.title}</b></span>
          <Tag color={data.course.status ? 'green' : 'default'}>
            {data.course.status ? '已发布' : '未发布'}
          </Tag>
        </Space>
      }
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={newModule}>新增章节</Button>
      }
    >
      {data.modules.length === 0
        ? <Empty description="还没有章节，点右上「新增章节」开始" />
        : (
          <Tabs
            tabPosition="left"
            type="card"
            activeKey={activeKey}
            onChange={setActiveKey}
            items={data.modules.map((m: any) => ({
              key: String(m.moduleId),
              label: <span>{m.orderNo}. {m.title}</span>,
              children: (
                <div>
                  <Space className="mb-3">
                    <Button onClick={() => editModule(m)}>编辑此章节</Button>
                    <Popconfirm title="删除此章节？" onConfirm={async () => {
                      await coursesApi.removeModule(m.moduleId);
                      message.success('已删除');
                      setActiveKey(undefined);
                      reload();
                    }}>
                      <Button danger>删除</Button>
                    </Popconfirm>
                    <Tag>类型：{m.type}</Tag>
                    <Tag>排序：{m.orderNo}</Tag>
                  </Space>
                  <Card size="small">
                    {m.content
                      ? <Markdown source={m.content} />
                      : <Typography.Text type="secondary">（暂无内容）</Typography.Text>}
                  </Card>
                </div>
              ),
            }))}
          />
        )
      }

      <Modal
        open={modOpen}
        title={editing?.moduleId ? '编辑章节' : '新增章节'}
        onCancel={() => setModOpen(false)}
        onOk={saveModule}
        width={'90%'}
        okText="保存"
      >
        <Form form={modForm} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} md={14}>
              <Form.Item name="title" label="章节标题" rules={[{ required: true }]}><Input /></Form.Item>
            </Col>
            <Col xs={12} md={5}>
              <Form.Item name="type" label="类型">
                <Select options={[{ value: 'text', label: '图文 (Markdown)' }, { value: 'video', label: '视频说明' }, { value: 'code', label: '代码示例' }]} />
              </Form.Item>
            </Col>
            <Col xs={12} md={5}>
              <Form.Item name="orderNo" label="排序号">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <div className="text-sm font-medium mb-1">章节内容（支持 Markdown / 代码块 / 表格 / 引用）</div>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <div className="text-xs text-slate-400 mb-1">编辑</div>
            <Input.TextArea
              rows={22}
              value={modContent}
              onChange={(e) => setModContent(e.target.value)}
              placeholder="# 一级标题
## 二级标题

正文段落。

```solidity
contract Hello { }
```

- 列表项 1
- 列表项 2

| 列 A | 列 B |
|---|---|
| 1 | 2 |
"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}
            />
          </Col>
          <Col xs={24} md={12}>
            <div className="text-xs text-slate-400 mb-1">实时预览</div>
            <div style={{
              border: '1px solid #f0f0f0', borderRadius: 8, padding: 16,
              height: '498px', overflowY: 'auto', background: '#fafbfc',
            }}>
              {modContent
                ? <Markdown source={modContent} />
                : <Typography.Text type="secondary">在左侧输入内容即可预览</Typography.Text>}
            </div>
          </Col>
        </Row>
      </Modal>
    </Card>
  );
}
