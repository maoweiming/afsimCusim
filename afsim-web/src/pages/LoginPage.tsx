/**
 * LoginPage - 登录页
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert } from 'antd';
import { RocketOutlined, UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '../modules/user/store/userStore';
import type { LoginCredentials } from '../modules/user/types';

export default function LoginPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginCredentials>();

  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/portal', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (values: LoginCredentials) => {
    clearError();
    const ok = await login(values);
    if (ok) navigate('/portal', { replace: true });
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <RocketOutlined className="login-logo-icon" />
          <Typography.Title level={3} className="login-title">
            TrueSim 仿真平台
          </Typography.Title>
          <Typography.Text type="secondary">AFSIM Web 化分布式仿真系统</Typography.Text>
        </div>

        {error && (
          <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} closable onClose={clearError} />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ username: 'admin', password: 'admin123' }}
        >
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="admin" size="large" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="admin123" size="large" autoComplete="current-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>

        <div className="login-hint">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Mock 模式：admin / admin123
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            其他账号：operator1、analyst1、viewer1（密码同用户名）
          </Typography.Text>
        </div>
      </div>
    </div>
  );
}
