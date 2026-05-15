import { Button, Card, Form, Input, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

interface FormVals { account: string; password: string }

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: FormVals) => {
    setLoading(true);
    try {
      const okLogin = await login(values.account, values.password);
      if (okLogin) {
        message.success('登录成功');
        navigate('/');
      } else {
        message.error('账号或密码错误');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md glass-panel" style={{ background: 'transparent', boxShadow: '0 12px 40px rgba(22,119,255,0.18)' }}>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold mb-1">智能合约安全教学与实训平台</h1>
          <p className="text-slate-500 text-sm">XCR Security Training Platform</p>
        </div>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="account" label="账号 / 邮箱" rules={[{ required: true, message: '请输入账号或邮箱' }]}>
            <Input size="large" prefix={<UserOutlined />} placeholder="username 或 email" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password size="large" prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>登录</Button>
        </Form>
        <div className="text-center mt-4 text-sm text-slate-500">
          还没有账号？<Link to="/register" className="text-brand-500">立即注册</Link>
        </div>
        <div className="text-center mt-2 text-xs text-slate-400">
          测试账号：admin / Admin@123 · teacher01 / Teacher@123 · student01 / Student@123
        </div>
      </Card>
    </div>
  );
}
