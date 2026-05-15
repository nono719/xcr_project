import { Button, Card, Form, Input, message, Radio } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { authApi } from '../apis';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (v: any) => {
    setLoading(true);
    try {
      const r = await authApi.register({
        username: v.username, password: v.password, email: v.email, role: v.role,
      });
      if (r?.code === 200) {
        message.success('注册成功，跳转登录');
        navigate('/login');
      } else { message.error(r?.message ?? '注册失败'); }
    } catch { /* interceptor already showed */ } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md glass-panel" style={{ background: 'transparent', boxShadow: '0 12px 40px rgba(22,119,255,0.18)' }}>
        <h1 className="text-xl font-semibold mb-4 text-center">注册新账号</h1>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false} initialValues={{ role: 'student' }}>
          <Form.Item name="username" label="用户名"
            rules={[{ required: true }, { pattern: /^[a-zA-Z0-9_]{3,20}$/, message: '3-20 位字母数字下划线' }]}>
            <Input placeholder="username" />
          </Form.Item>
          <Form.Item name="email" label="邮箱"
            rules={[{ required: true }, { type: 'email', message: '邮箱格式错误' }]}>
            <Input placeholder="email@xcr.local" />
          </Form.Item>
          <Form.Item name="password" label="密码"
            rules={[
              { required: true },
              { min: 8, message: '密码至少 8 位' },
              { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: '密码强度不足，需包含字母与数字' },
            ]}>
            <Input.Password placeholder="至少 8 位，含字母与数字" />
          </Form.Item>
          <Form.Item name="role" label="身份">
            <Radio.Group>
              <Radio value="student">学生</Radio>
              <Radio value="teacher">教师</Radio>
            </Radio.Group>
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>注册</Button>
        </Form>
        <div className="text-center mt-3 text-sm">
          已有账号？<Link to="/login" className="text-brand-500">去登录</Link>
        </div>
      </Card>
    </div>
  );
}
