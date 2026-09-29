/**
 * UserManagement - 用户管理面板
 * 用户列表 + 分组管理 + 权限查看
 */
import { useEffect, useState, useMemo } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select, Tabs, Typography,
  Popconfirm, message, Card, Descriptions, Badge, Empty,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined,
  TeamOutlined, UserOutlined, SafetyOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useUserManagementStore, useAuthStore } from '../store/userStore';
import {
  SYSTEM_ROLES, SYSTEM_ROLE_LABELS, SYSTEM_ROLE_COLORS,
  USER_STATUSES, USER_STATUS_LABELS, USER_STATUS_COLORS,
} from '../types';
import type { User, UserGroup, CreateUserForm, UpdateUserForm, SystemRole, UserStatus } from '../types';

const { Text } = Typography;

// ============ 用户列表 ============

function UserList() {
  const users = useUserManagementStore((s) => s.users);
  const groups = useUserManagementStore((s) => s.groups);
  const loading = useUserManagementStore((s) => s.loading);
  const fetchUsers = useUserManagementStore((s) => s.fetchUsers);
  const fetchGroups = useUserManagementStore((s) => s.fetchGroups);
  const createUser = useUserManagementStore((s) => s.createUser);
  const updateUser = useUserManagementStore((s) => s.updateUser);
  const deleteUser = useUserManagementStore((s) => s.deleteUser);
  const resetPassword = useUserManagementStore((s) => s.resetPassword);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdUser, setPwdUser] = useState<User | null>(null);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [pwdForm] = Form.useForm();

  useEffect(() => {
    fetchUsers();
    fetchGroups();
  }, [fetchUsers, fetchGroups]);

  const groupOptions = useMemo(() =>
    groups.map((g) => ({ value: g.id, label: g.name })),
    [groups],
  );

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await createUser(values as CreateUserForm);
      message.success('用户创建成功');
      setCreateOpen(false);
      createForm.resetFields();
    } catch {
      message.warning('请检查表单');
    }
  };

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields();
      if (editUser) {
        await updateUser(editUser.id, values as UpdateUserForm);
        message.success('用户更新成功');
        setEditOpen(false);
        setEditUser(null);
        editForm.resetFields();
      }
    } catch {
      message.warning('请检查表单');
    }
  };

  const handleResetPwd = async () => {
    try {
      const values = await pwdForm.validateFields();
      if (pwdUser) {
        await resetPassword(pwdUser.id, values.password);
        message.success('密码已重置');
        setPwdOpen(false);
        setPwdUser(null);
        pwdForm.resetFields();
      }
    } catch {
      message.warning('请输入新密码');
    }
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    editForm.setFieldsValue({
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      groupId: user.groupId,
      status: user.status,
      phone: user.phone,
      department: user.department,
    });
    setEditOpen(true);
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (v: string, r: User) => (
        <Space size={6}>
          <Badge dot status={r.status === 'active' ? 'success' : r.status === 'locked' ? 'error' : 'default'} />
          <Text strong style={{ fontSize: 13 }}>{v}</Text>
        </Space>
      ),
    },
    {
      title: '姓名',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 100,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      ellipsis: true,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 90,
      filters: SYSTEM_ROLES.map((r) => ({ text: SYSTEM_ROLE_LABELS[r], value: r })),
      onFilter: (value: unknown, record: User) => record.role === value,
      render: (role: SystemRole) => (
        <Tag color={SYSTEM_ROLE_COLORS[role]}>{SYSTEM_ROLE_LABELS[role]}</Tag>
      ),
    },
    {
      title: '用户组',
      key: 'group',
      width: 120,
      render: (_: unknown, r: User) => {
        const group = groups.find((g) => g.id === r.groupId);
        return group ? <Tag>{group.name}</Tag> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 120,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      filters: USER_STATUSES.map((s) => ({ text: USER_STATUS_LABELS[s], value: s })),
      onFilter: (value: unknown, record: User) => record.status === value,
      render: (status: UserStatus) => (
        <Tag color={USER_STATUS_COLORS[status]}>{USER_STATUS_LABELS[status]}</Tag>
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 150,
      render: (v: string | null) => v ? new Date(v).toLocaleString('zh-CN') : '—',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, r: User) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Button type="text" size="small" icon={<KeyOutlined />} onClick={() => { setPwdUser(r); setPwdOpen(true); }} title="重置密码" />
          {r.id !== currentUser?.id && (
            <Popconfirm title={`确认删除用户 ${r.displayName}？`} onConfirm={() => { deleteUser(r.id); message.success('已删除'); }}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
        <Button icon={<ReloadOutlined />} onClick={() => fetchUsers()}>刷新</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建用户</Button>
      </div>

      <Table dataSource={users} columns={columns} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 10 }} />

      {/* 创建用户 */}
      <Modal title="新建用户" open={createOpen} onOk={handleCreate} onCancel={() => { setCreateOpen(false); createForm.resetFields(); }} destroyOnClose>
        <Form form={createForm} layout="vertical" size="small">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input placeholder="登录用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="至少 6 位" />
          </Form.Item>
          <Form.Item name="displayName" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={SYSTEM_ROLES.map((r) => ({ value: r, label: SYSTEM_ROLE_LABELS[r] }))} />
          </Form.Item>
          <Form.Item name="groupId" label="用户组">
            <Select options={groupOptions} allowClear placeholder="选择用户组" />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑用户 */}
      <Modal title={`编辑 - ${editUser?.displayName}`} open={editOpen} onOk={handleEdit} onCancel={() => { setEditOpen(false); setEditUser(null); editForm.resetFields(); }} destroyOnClose>
        <Form form={editForm} layout="vertical" size="small">
          <Form.Item name="displayName" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={SYSTEM_ROLES.map((r) => ({ value: r, label: SYSTEM_ROLE_LABELS[r] }))} />
          </Form.Item>
          <Form.Item name="groupId" label="用户组">
            <Select options={groupOptions} allowClear />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={USER_STATUSES.map((s) => ({ value: s, label: USER_STATUS_LABELS[s] }))} />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置密码 */}
      <Modal title={`重置密码 - ${pwdUser?.displayName}`} open={pwdOpen} onOk={handleResetPwd} onCancel={() => { setPwdOpen(false); setPwdUser(null); pwdForm.resetFields(); }} destroyOnClose>
        <Form form={pwdForm} layout="vertical" size="small">
          <Form.Item name="password" label="新密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="至少 6 位" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ============ 用户组管理 ============

function GroupList() {
  const groups = useUserManagementStore((s) => s.groups);
  const fetchGroups = useUserManagementStore((s) => s.fetchGroups);
  const createGroup = useUserManagementStore((s) => s.createGroup);
  const updateGroup = useUserManagementStore((s) => s.updateGroup);
  const deleteGroup = useUserManagementStore((s) => s.deleteGroup);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<UserGroup | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await createGroup(values);
      message.success('用户组创建成功');
      setCreateOpen(false);
      createForm.resetFields();
    } catch { message.warning('请检查表单'); }
  };

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields();
      if (editGroup) {
        await updateGroup(editGroup.id, values);
        message.success('用户组更新成功');
        setEditOpen(false);
        setEditGroup(null);
        editForm.resetFields();
      }
    } catch { message.warning('请检查表单'); }
  };

  const columns = [
    { title: '组名', dataIndex: 'name', key: 'name', width: 150, render: (v: string) => <Text strong>{v}</Text> },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '默认角色', dataIndex: 'defaultRole', key: 'defaultRole', width: 100, render: (r: SystemRole) => <Tag color={SYSTEM_ROLE_COLORS[r]}>{SYSTEM_ROLE_LABELS[r]}</Tag> },
    { title: '成员数', dataIndex: 'memberCount', key: 'memberCount', width: 80, align: 'center' as const },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: unknown, r: UserGroup) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditGroup(r); editForm.setFieldsValue(r); setEditOpen(true); }} />
          <Popconfirm title={`确认删除 ${r.name}？`} onConfirm={() => { deleteGroup(r.id); message.success('已删除'); }}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建用户组</Button>
      </div>
      <Table dataSource={groups} columns={columns} rowKey="id" size="small" pagination={false} />

      <Modal title="新建用户组" open={createOpen} onOk={handleCreate} onCancel={() => { setCreateOpen(false); createForm.resetFields(); }} destroyOnClose>
        <Form form={createForm} layout="vertical" size="small">
          <Form.Item name="name" label="组名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="defaultRole" label="默认角色" rules={[{ required: true }]}>
            <Select options={SYSTEM_ROLES.map((r) => ({ value: r, label: SYSTEM_ROLE_LABELS[r] }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`编辑 - ${editGroup?.name}`} open={editOpen} onOk={handleEdit} onCancel={() => { setEditOpen(false); setEditGroup(null); editForm.resetFields(); }} destroyOnClose>
        <Form form={editForm} layout="vertical" size="small">
          <Form.Item name="name" label="组名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="defaultRole" label="默认角色" rules={[{ required: true }]}>
            <Select options={SYSTEM_ROLES.map((r) => ({ value: r, label: SYSTEM_ROLE_LABELS[r] }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ============ 权限查看 ============

function PermissionView() {
  const permissions = useUserManagementStore((s) => s.permissions);
  const fetchPermissions = useUserManagementStore((s) => s.fetchPermissions);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  const MODULE_LABELS: Record<string, string> = {
    equipment: '装备数据管理',
    simulation: '仿真运行',
    scenario: '想定编辑',
    analysis: '数据分析',
    'admin-setting': '系统管理',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
      {permissions.map((p) => (
        <Card key={p.role} size="small" title={<Space><Tag color={SYSTEM_ROLE_COLORS[p.role]}>{p.label}</Tag></Space>}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="描述">{p.description}</Descriptions.Item>
            <Descriptions.Item label="可访问模块">
              <Space size={4} wrap>
                {p.modules.map((m) => <Tag key={m}>{MODULE_LABELS[m] || m}</Tag>)}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="创建">{p.canCreate ? '✓' : '—'}</Descriptions.Item>
            <Descriptions.Item label="编辑">{p.canEdit ? '✓' : '—'}</Descriptions.Item>
            <Descriptions.Item label="删除">{p.canDelete ? '✓' : '—'}</Descriptions.Item>
            <Descriptions.Item label="用户管理">{p.canManageUsers ? '✓' : '—'}</Descriptions.Item>
            <Descriptions.Item label="系统配置">{p.canManageSystem ? '✓' : '—'}</Descriptions.Item>
          </Descriptions>
        </Card>
      ))}
    </div>
  );
}

// ============ 主组件 ============

export function UserManagement() {
  const tabItems = [
    { key: 'users', label: <span><UserOutlined /> 用户管理</span>, children: <UserList /> },
    { key: 'groups', label: <span><TeamOutlined /> 分组管理</span>, children: <GroupList /> },
    { key: 'permissions', label: <span><SafetyOutlined /> 权限配置</span>, children: <PermissionView /> },
  ];

  return <Tabs items={tabItems} size="small" />;
}
