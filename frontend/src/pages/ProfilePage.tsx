import { Button, Card, Descriptions, Form, Input, message } from 'antd';
import { useEffect, useState } from 'react';
import { authApi } from '../apis';

export default function ProfilePage() {
  const [me, setMe] = useState<any>(null);
  const [form] = Form.useForm();

  const refresh = () => authApi.me().then((r) => setMe(r.data));
  useEffect(() => { refresh(); }, []);

  const onSave = async (v: any) => {
    const payload: any = {};
    if (v.email) payload.email = v.email;
    if (v.oldPassword && v.newPassword) {
      payload.oldPassword = v.oldPassword;
      payload.newPassword = v.newPassword;
    }
    await authApi.updateProfile(payload);
    message.success('已更新');
    form.resetFields(['oldPassword', 'newPassword']);
    refresh();
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card title="基础信息">
        {me && (
          <Descriptions column={1} size="small">
            <Descriptions.Item label="用户ID">{me.userId}</Descriptions.Item>
            <Descriptions.Item label="用户名">{me.username}</Descriptions.Item>
            <Descriptions.Item label="角色">{me.role}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{me.email}</Descriptions.Item>
            <Descriptions.Item label="注册时间">{new Date(me.createTime).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="最近登录">{me.lastLoginTime ? new Date(me.lastLoginTime).toLocaleString() : '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>
      <Card title="修改资料">
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="email" label="新邮箱" rules={[{ type: 'email' }]}>
            <Input placeholder="email@xcr.local" />
          </Form.Item>
          <Form.Item name="oldPassword" label="原密码">
            <Input.Password />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码"
            rules={[{ min: 8 }, { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: '需包含字母与数字' }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit">保存</Button>
        </Form>
      </Card>
    </div>
  );
}
