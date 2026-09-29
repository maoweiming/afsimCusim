/**
 * 协同面板
 * 在线用户列表、光标位置、对象锁定状态、评论、聊天
 */

import React, { useState, useEffect } from 'react';
import {
  Avatar,
  Badge,
  Tag,
  Tooltip,
  Space,
  Divider,
  Button,
  Empty,
  Popover,
} from 'antd';
import {
  TeamOutlined,
  EnvironmentOutlined,
  LockOutlined,
  UnlockOutlined,
  EditOutlined,
  EyeOutlined,
  CrownOutlined,
  MessageOutlined,
  UserOutlined,
  WifiOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import type { Scenario, Collaborator } from '../types';
import { useCollabStore } from '../store/scenarioStore';

// ============ 角色配置 ============

const ROLE_CONFIG: Record<
  Collaborator['role'],
  { label: string; color: string; icon: React.ReactNode }
> = {
  owner: { label: '所有者', color: '#d97706', icon: <CrownOutlined /> },
  editor: { label: '编辑者', color: '#0078d7', icon: <EditOutlined /> },
  viewer: { label: '查看者', color: '#5a6a7a', icon: <EyeOutlined /> },
};

// ============ Mock 锁定数据 ============

const MOCK_LOCKS: Array<{
  objectId: string;
  objectName: string;
  objectType: string;
  userId: string;
  userName: string;
}> = [
  {
    objectId: 'plat-f16-01',
    objectName: '红箭中队 F-16V #1',
    objectType: '平台',
    userId: 'user-002',
    userName: '李参谋',
  },
  {
    objectId: 'route-f16-patrol',
    objectName: '西部巡逻航线',
    objectType: '路线',
    userId: 'user-001',
    userName: '张指挥官',
  },
];

interface CollabPanelProps {
  scenario: Scenario;
}

export const CollabPanel: React.FC<CollabPanelProps> = ({ scenario }) => {
  const collaborators = scenario.collaborators;
  const onlineUsers = collaborators.filter((c) => c.online);
  const offlineUsers = collaborators.filter((c) => !c.online);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* 在线用户 */}
      <div style={{ padding: '12px 16px' }}>
        <div style={sectionTitleStyle}>
          <WifiOutlined style={{ color: '#28b43c', marginRight: 6 }} />
          在线用户 ({onlineUsers.length})
        </div>

        {onlineUsers.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#5a6a7a', padding: 12 }}>
            暂无在线用户
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {onlineUsers.map((user) => (
              <UserCard key={user.userId} user={user} online />
            ))}
          </div>
        )}
      </div>

      <Divider style={{ margin: 0, borderColor: '#2a3a4a' }} />

      {/* 离线用户 */}
      <div style={{ padding: '12px 16px' }}>
        <div style={sectionTitleStyle}>
          <DisconnectOutlined style={{ color: '#5a6a7a', marginRight: 6 }} />
          离线用户 ({offlineUsers.length})
        </div>

        {offlineUsers.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#5a6a7a', padding: 12 }}>
            所有用户都在线
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {offlineUsers.map((user) => (
              <UserCard key={user.userId} user={user} online={false} />
            ))}
          </div>
        )}
      </div>

      <Divider style={{ margin: 0, borderColor: '#2a3a4a' }} />

      {/* 对象锁定状态 */}
      <div style={{ padding: '12px 16px', flex: 1, overflow: 'auto' }}>
        <div style={sectionTitleStyle}>
          <LockOutlined style={{ color: '#d97706', marginRight: 6 }} />
          对象锁定 ({MOCK_LOCKS.length})
        </div>

        {MOCK_LOCKS.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#5a6a7a', padding: 12 }}>
            无锁定对象
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {MOCK_LOCKS.map((lock) => (
              <div
                key={lock.objectId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: '#0d1117',
                  borderRadius: 4,
                  border: '1px solid #1e2a3a',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#e0e0e0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <LockOutlined style={{ marginRight: 4, color: '#d97706' }} />
                    {lock.objectName}
                  </div>
                  <div style={{ fontSize: 10, color: '#5a6a7a', marginTop: 2 }}>
                    <Tag style={{ fontSize: 9, margin: 0, lineHeight: '14px' }}>
                      {lock.objectType}
                    </Tag>
                    <span style={{ marginLeft: 6 }}>
                      锁定者: {lock.userName}
                    </span>
                  </div>
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={<UnlockOutlined />}
                  style={{ color: '#5a6a7a' }}
                  title="请求解锁"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Divider style={{ margin: 0, borderColor: '#2a3a4a' }} />

      {/* 协同统计 */}
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-around',
          fontSize: 11,
          color: '#5a6a7a',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#0078d7',
            }}
          >
            {collaborators.length}
          </div>
          <div>总人数</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#28b43c',
            }}
          >
            {onlineUsers.length}
          </div>
          <div>在线</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#d97706',
            }}
          >
            {MOCK_LOCKS.length}
          </div>
          <div>锁定</div>
        </div>
      </div>
    </div>
  );
};

// ============ 用户卡片子组件 ============

interface UserCardProps {
  user: Collaborator;
  online: boolean;
}

const UserCard: React.FC<UserCardProps> = ({ user, online }) => {
  const roleConfig = ROLE_CONFIG[user.role];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: online ? '#0d1117' : 'transparent',
        borderRadius: 4,
        opacity: online ? 1 : 0.5,
      }}
    >
      <Badge dot color={online ? '#28b43c' : '#5a6a7a'} offset={[-2, 2]}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: user.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
          }}
        >
          {user.userName.charAt(0)}
        </div>
      </Badge>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: online ? '#e0e0e0' : '#5a6a7a',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user.userName}
          </span>
          <Tag
            style={{
              fontSize: 9,
              lineHeight: '14px',
              padding: '0 4px',
              margin: 0,
              background: `${roleConfig.color}15`,
              color: roleConfig.color,
              borderColor: `${roleConfig.color}30`,
            }}
          >
            {roleConfig.icon} {roleConfig.label}
          </Tag>
        </div>

        {/* 光标位置 */}
        {online && user.cursor && (
          <div
            style={{
              fontSize: 10,
              color: '#5a6a7a',
              marginTop: 2,
              fontFamily: 'monospace',
            }}
          >
            <EnvironmentOutlined style={{ marginRight: 3, fontSize: 9 }} />
            {user.cursor.lat.toFixed(3)}°N, {user.cursor.lng.toFixed(3)}°E
          </div>
        )}
      </div>
    </div>
  );
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: '#8899aa',
  marginBottom: 8,
  display: 'flex',
  alignItems: 'center',
};

export default CollabPanel;
