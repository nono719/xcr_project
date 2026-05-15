import { Badge, Button, Dropdown, Empty, List, Tag, message } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../apis';

interface Noti {
  notiId: number;
  type: string;
  title: string;
  content: string;
  link?: string | null;
  status: 0 | 1;
  createTime: string;
}

export default function NotificationBell() {
  const [items, setItems] = useState<Noti[]>([]);
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const r = await notificationsApi.me(false);
      setItems(r.data?.items ?? []);
      setUnread(r.data?.unread ?? 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const open = async (n: Noti) => {
    if (n.status === 0) {
      await notificationsApi.read(n.notiId);
      load();
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    await notificationsApi.readAll();
    message.success('已全部标记已读');
    load();
  };

  const dropdownRender = () => (
    <div style={{ width: 360 }} className="glass-panel !bg-white shadow-elevated p-2">
      <div className="flex justify-between items-center px-2 py-1">
        <span className="text-sm font-medium">通知中心</span>
        {unread > 0 && <Button size="small" type="link" onClick={markAll}>全部已读</Button>}
      </div>
      {items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无通知" />
      ) : (
        <List
          size="small"
          dataSource={items.slice(0, 8)}
          renderItem={(n) => (
            <List.Item
              className={`!cursor-pointer hover:bg-slate-50 rounded ${n.status === 0 ? 'bg-blue-50' : ''}`}
              onClick={() => open(n)}
            >
              <div className="w-full">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{n.title}</span>
                  {n.status === 0 && <Tag color="processing">未读</Tag>}
                </div>
                <div className="text-slate-500 text-xs mt-0.5">{n.content}</div>
                <div className="text-slate-400 text-xs mt-0.5">{new Date(n.createTime).toLocaleString()}</div>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Dropdown placement="bottomRight" trigger={['click']} dropdownRender={dropdownRender}>
      <Badge count={unread} size="small" offset={[-2, 6]}>
        <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} />
      </Badge>
    </Dropdown>
  );
}
