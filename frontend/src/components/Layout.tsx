import { Avatar, Dropdown, Layout as AntLayout, Menu } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppstoreOutlined, BookOutlined, ExperimentOutlined, FileTextOutlined,
  HomeOutlined, LogoutOutlined, SettingOutlined, TeamOutlined, UserOutlined,
} from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import NotificationBell from './NotificationBell';

const { Header, Sider, Content } = AntLayout;

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  const items = [
    { key: '/', icon: <HomeOutlined />, label: <Link to="/">首页</Link> },
    { key: '/courses', icon: <BookOutlined />, label: <Link to="/courses">课程学习</Link> },
    { key: '/experiments', icon: <ExperimentOutlined />, label: <Link to="/experiments">漏洞实验</Link> },
    { key: '/records', icon: <FileTextOutlined />, label: <Link to="/records">我的提交</Link> },
  ];
  if (user?.role === 'teacher' || user?.role === 'admin') {
    items.push({ key: '/teacher', icon: <TeamOutlined />, label: <Link to="/teacher">教师工作台</Link> });
  }
  if (user?.role === 'admin') {
    items.push({ key: '/admin', icon: <SettingOutlined />, label: <Link to="/admin">系统管理</Link> });
  }

  const userMenu = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: '个人中心', onClick: () => navigate('/profile') },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: () => { logout(); navigate('/login'); } },
    ],
  };

  return (
    <AntLayout className="min-h-screen">
      <Header className="glass-header flex items-center justify-between !px-6">
        <div className="flex items-center gap-3">
          <AppstoreOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <span className="text-lg font-semibold">智能合约安全教学与实训平台</span>
        </div>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <Dropdown menu={userMenu} placement="bottomRight">
            <div className="flex items-center gap-2 cursor-pointer">
              <Avatar style={{ backgroundColor: '#1677ff' }}>
                {user?.username?.slice(0, 1)?.toUpperCase()}
              </Avatar>
              <span className="text-slate-700">{user?.username}</span>
              <span className="text-slate-400 text-xs">({user?.role})</span>
            </div>
          </Dropdown>
        </div>
      </Header>
      <AntLayout>
        <Sider theme="light" width={220} breakpoint="lg" collapsedWidth={0}>
          <Menu mode="inline" selectedKeys={[loc.pathname]} items={items} className="!border-r-0 mt-2" />
        </Sider>
        <Content className="p-6">
          <div className="fade-in">
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
