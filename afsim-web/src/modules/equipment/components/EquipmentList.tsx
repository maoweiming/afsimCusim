// ============================================================
// Equipment Module - Equipment List Component
// AFSIM-native: directly displays AfsimEquipment[]
// ============================================================

import { useEffect, useMemo, useCallback, useState } from 'react';
import {
  Table,
  Input,
  Button,
  Tag,
  Space,
  Tooltip,
  Popconfirm,
  Empty,
  message,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  LockOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useEquipmentStore } from '../store/equipmentStore';
import type { AfsimEquipment } from '../afsim/types';
import { DOMAIN_LABELS } from '../afsim/enums';
import { ImportDialog } from './ImportDialog';
import type { CategoryFilter } from './CategoryTree';

// ============ Current user (mock) ============

const CURRENT_USER = '当前用户';

// ============ Component ============

interface EquipmentListProps {
  onEdit?: () => void;
  filter?: CategoryFilter | null;
}

export function EquipmentList({ onEdit, filter }: EquipmentListProps) {
  const [importOpen, setImportOpen] = useState(false);
  const equipmentList = useEquipmentStore((s) => s.equipmentList);
  const total = useEquipmentStore((s) => s.total);
  const page = useEquipmentStore((s) => s.page);
  const pageSize = useEquipmentStore((s) => s.pageSize);
  const loading = useEquipmentStore((s) => s.loading);
  const queryParams = useEquipmentStore((s) => s.queryParams);
  const selectedEquipment = useEquipmentStore((s) => s.selectedEquipment);
  const lockedEquipmentMap = useEquipmentStore((s) => s.lockedEquipmentMap);
  const editorVisible = useEquipmentStore((s) => s.editorVisible);
  const editingEquipment = useEquipmentStore((s) => s.editingEquipment);

  const fetchList = useEquipmentStore((s) => s.fetchList);
  const setKeyword = useEquipmentStore((s) => s.setKeyword);
  const setPage = useEquipmentStore((s) => s.setPage);
  const setPageSize = useEquipmentStore((s) => s.setPageSize);
  const selectEquipment = useEquipmentStore((s) => s.selectEquipment);
  const fetchDetail = useEquipmentStore((s) => s.fetchDetail);
  const openEditor = useEquipmentStore((s) => s.openEditor);
  const closeEditor = useEquipmentStore((s) => s.closeEditor);
  const deleteEquipment = useEquipmentStore((s) => s.deleteEquipment);
  const importEquipment = useEquipmentStore((s) => s.importEquipment);
  const lockEquipment = useEquipmentStore((s) => s.lockEquipment);
  const unlockEquipment = useEquipmentStore((s) => s.unlockEquipment);
  const getLockStatuses = useEquipmentStore((s) => s.getLockStatuses);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ---- Client-side filtering ----
  const filteredList = useMemo(() => {
    if (!filter) return equipmentList;
    return equipmentList.filter((eq) => {
      switch (filter.dimension) {
        case 'spatialDomain':
          return eq.platform.spatialDomain === filter.value;
        case 'side':
          return eq.platform.side === filter.value;
        case 'platformType':
          return eq.platform.categories?.includes(filter.value) ?? false;
        default:
          return true;
      }
    });
  }, [equipmentList, filter]);

  // ---- Fetch lock statuses when list loads ----
  useEffect(() => {
    if (equipmentList.length > 0) {
      const names = equipmentList.map((eq) => eq.name);
      getLockStatuses(names);
    }
  }, [equipmentList, getLockStatuses]);

  // ---- Auto-unlock when editor closes ----
  useEffect(() => {
    if (!editorVisible && editingEquipment?.name) {
      const lockInfo = lockedEquipmentMap[editingEquipment.name];
      if (lockInfo && lockInfo.lockedBy === CURRENT_USER) {
        unlockEquipment(editingEquipment.name);
      }
    }
  }, [editorVisible, editingEquipment, lockedEquipmentMap, unlockEquipment]);

  const handleRowClick = (record: AfsimEquipment) => {
    fetchDetail(record.name);
  };

  // ---- Edit with lock ----
  const handleEdit = useCallback(
    async (record: AfsimEquipment, e?: React.MouseEvent) => {
      e?.stopPropagation();

      const lockInfo = lockedEquipmentMap[record.name];

      if (lockInfo && lockInfo.lockedBy !== CURRENT_USER) {
        message.warning(`装备 "${record.name}" 已被 ${lockInfo.lockedBy} 锁定，无法编辑`);
        return;
      }

      if (!lockInfo || lockInfo.lockedBy !== CURRENT_USER) {
        await lockEquipment(record.name);
      }

      await fetchDetail(record.name);
      const current = useEquipmentStore.getState().selectedEquipment;
      if (current) {
        openEditor(current);
      }
      onEdit?.();
    },
    [lockedEquipmentMap, lockEquipment, openEditor, onEdit],
  );

  const handleDelete = async (name: string) => {
    try {
      await deleteEquipment(name);
      message.success('装备已删除');
    } catch {
      message.error('删除失败');
    }
  };

  // ---- Lock helpers ----
  const isLockedByOther = useCallback(
    (name: string): boolean => {
      const lockInfo = lockedEquipmentMap[name];
      return !!lockInfo && lockInfo.lockedBy !== CURRENT_USER;
    },
    [lockedEquipmentMap],
  );

  const getLockOwner = useCallback(
    (name: string): string | null => {
      const lockInfo = lockedEquipmentMap[name];
      return lockInfo ? lockInfo.lockedBy : null;
    },
    [lockedEquipmentMap],
  );

  // ---- Table columns ----
  const columns = useMemo<ColumnsType<AfsimEquipment>>(
    () => [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        width: 220,
        ellipsis: true,
        sorter: true,
        render: (name: string, record: AfsimEquipment) => {
          const lockOwner = getLockOwner(record.name);
          const lockedByOther = isLockedByOther(record.name);

          return (
            <Space size={4}>
              <strong>{name}</strong>
              {lockOwner && (
                <Tooltip
                  title={
                    lockedByOther
                      ? `已被 ${lockOwner} 锁定编辑中`
                      : `您已锁定此装备`
                  }
                >
                  <LockOutlined
                    style={{
                      color: lockedByOther ? '#f85149' : '#52c41a',
                      fontSize: 12,
                      cursor: 'default',
                    }}
                  />
                </Tooltip>
              )}
            </Space>
          );
        },
      },
      {
        title: '父类型',
        dataIndex: 'parentType',
        key: 'parentType',
        width: 160,
        ellipsis: true,
        render: (pt: string | undefined) => pt ? (
          <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{pt}</Tag>
        ) : <span style={{ color: '#30363d' }}>—</span>,
      },
      {
        title: '空间域',
        key: 'spatialDomain',
        width: 90,
        render: (_: unknown, record: AfsimEquipment) => {
          const domain = record.platform.spatialDomain;
          if (!domain) return <span style={{ color: '#30363d' }}>—</span>;
          const label = DOMAIN_LABELS[domain as keyof typeof DOMAIN_LABELS] ?? domain;
          return <Tag color="blue">{label}</Tag>;
        },
      },
      {
        title: '阵营',
        key: 'side',
        width: 70,
        render: (_: unknown, record: AfsimEquipment) => {
          const side = record.platform.side;
          if (!side) return <span style={{ color: '#30363d' }}>—</span>;
          return (
            <Tag color={side === 'blue' ? 'blue' : side === 'red' ? 'red' : 'default'}>
              {side}
            </Tag>
          );
        },
      },
      {
        title: '子系统',
        key: 'components',
        width: 180,
        render: (_: unknown, record: AfsimEquipment) => {
          const parts: string[] = [];
          const s = Object.keys(record.platform.sensors || {}).length;
          const w = Object.keys(record.platform.weapons || {}).length;
          const m = Object.keys(record.platform.movers || {}).length;
          if (s) parts.push(`${s}传感器`);
          if (w) parts.push(`${w}武器`);
          if (m) parts.push(`${m}动力`);
          return parts.length > 0 ? (
            <Space size={2} wrap>
              {parts.map((p) => <Tag key={p} style={{ fontSize: 11 }}>{p}</Tag>)}
            </Space>
          ) : <span style={{ color: '#30363d' }}>—</span>;
        },
      },
      {
        title: '锁定',
        key: 'lock',
        width: 70,
        align: 'center',
        render: (_: unknown, record: AfsimEquipment) => {
          const lockOwner = getLockOwner(record.name);
          if (!lockOwner) return <span style={{ color: '#30363d' }}>—</span>;

          const lockedByOther = isLockedByOther(record.name);
          return (
            <Tooltip
              title={lockedByOther ? `已被 ${lockOwner} 锁定` : `您已锁定`}
            >
              <Tag
                color={lockedByOther ? 'red' : 'green'}
                icon={<LockOutlined />}
                style={{ fontSize: 11 }}
              >
                {lockedByOther ? lockOwner : '我'}
              </Tag>
            </Tooltip>
          );
        },
      },
      {
        title: '操作',
        key: 'action',
        width: 120,
        align: 'center',
        render: (_: unknown, record: AfsimEquipment) => {
          const lockedByOther = isLockedByOther(record.name);
          const lockOwner = getLockOwner(record.name);

          return (
            <Space size="small">
              {lockedByOther ? (
                <Tooltip title={`已被 ${lockOwner} 锁定，无法编辑`}>
                  <Button
                    type="text"
                    size="small"
                    disabled
                    icon={<EditOutlined />}
                  />
                </Tooltip>
              ) : (
                <Tooltip title="编辑">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => handleEdit(record, e)}
                  />
                </Tooltip>
              )}
              <Popconfirm
                title="确认删除"
                description={`确定删除 "${record.name}"？`}
                onConfirm={(e) => {
                  e?.stopPropagation();
                  handleDelete(record.name);
                }}
                onCancel={(e) => e?.stopPropagation()}
              >
                <Tooltip title="删除">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Tooltip>
              </Popconfirm>
            </Space>
          );
        },
      },
    ],
    [openEditor, isLockedByOther, getLockOwner, handleEdit],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {/* ---- Toolbar ---- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <Input
          placeholder="搜索装备名称..."
          prefix={<SearchOutlined />}
          allowClear
          value={queryParams.keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ width: 260 }}
        />
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchList()}>
            刷新
          </Button>
          <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
            导入
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { openEditor(); onEdit?.(); }}>
            新建装备
          </Button>
        </Space>
      </div>

      {/* ---- Table ---- */}
      <Table<AfsimEquipment>
        columns={columns}
        dataSource={filteredList}
        rowKey="name"
        loading={loading}
        size="small"
        scroll={{ x: 900 }}
        locale={{
          emptyText: (
            <Empty
              description={filter ? '当前筛选条件下无装备数据' : '暂无装备数据，点击上方「新建装备」添加'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
        pagination={{
          current: page,
          pageSize,
          total: filter ? filteredList.length : total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => `共 ${t} 条${filter ? ' (已筛选)' : ''}`,
          onChange: (p, ps) => {
            setPage(p);
            if (ps !== pageSize) setPageSize(ps);
          },
        }}
        rowClassName={(record) =>
          record.name === selectedEquipment?.name ? 'ant-table-row-selected' : ''
        }
        onRow={(record) => ({
          onClick: () => handleRowClick(record),
          style: { cursor: 'pointer' },
        })}
      />

      {/* Import Dialog */}
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={async (items) => {
          await importEquipment(items);
        }}
      />
    </div>
  );
}
