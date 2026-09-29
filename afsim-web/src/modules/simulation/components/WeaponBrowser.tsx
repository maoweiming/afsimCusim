import { useMemo, useState } from 'react';
import {
  Card,
  Tree,
  Table,
  Modal,
  Select,
  InputNumber,
  Button,
  Space,
  Typography,
  Tag,
  Descriptions,
  message,
  Empty,
  List,
  Tooltip,
  Badge,
  Divider,
  Popconfirm,
  Alert,
} from 'antd';
import {
  RocketOutlined,
  ThunderboltOutlined,
  FireOutlined,
  AimOutlined,
  SendOutlined,
  HistoryOutlined,
  TeamOutlined,
  NodeIndexOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import { usePlatformStore } from '../../../store/platformStore';
import { useTrackStore } from '../../../store/trackStore';
import { useWeaponStore } from '../../../store/weaponStore';
import { useSimStore } from '../../../store/simStore';
import { fireWeapon } from '../../../api/controlApi';
import type { PlatformInfo } from '../../../store/platformStore';
import type { WeaponEngagement } from '../../../api/types';

const { Text, Title } = Typography;

// ============ Mock 武器数据 ============

interface WeaponInfo {
  id: string;
  name: string;
  platformIndex: number;
  platformName: string;
  side: string;
  type: 'missile' | 'bomb' | 'torpedo' | 'gun' | 'rocket';
  quantity: number;
  maxRange: number; // km
  guidance: string;
  speed: number; // Mach
  status: 'ready' | 'loading' | 'empty' | 'damaged';
}

const mockWeapons: WeaponInfo[] = [
  // 蓝方平台武器
  {
    id: 'w-001',
    name: 'AIM-120 AMRAAM',
    platformIndex: 1,
    platformName: 'F-22 Alpha',
    side: 'blue',
    type: 'missile',
    quantity: 6,
    maxRange: 180,
    guidance: '主动雷达',
    speed: 4,
    status: 'ready',
  },
  {
    id: 'w-002',
    name: 'AIM-9X Sidewinder',
    platformIndex: 1,
    platformName: 'F-22 Alpha',
    side: 'blue',
    type: 'missile',
    quantity: 2,
    maxRange: 35,
    guidance: '红外成像',
    speed: 2.5,
    status: 'ready',
  },
  {
    id: 'w-003',
    name: 'AGM-158 JASSM',
    platformIndex: 2,
    platformName: 'B-2 Spirit',
    side: 'blue',
    type: 'missile',
    quantity: 8,
    maxRange: 370,
    guidance: 'GPS/INS + 红外',
    speed: 0.8,
    status: 'ready',
  },
  {
    id: 'w-004',
    name: 'GBU-57 MOP',
    platformIndex: 2,
    platformName: 'B-2 Spirit',
    side: 'blue',
    type: 'bomb',
    quantity: 2,
    maxRange: 0,
    guidance: 'GPS/INS',
    speed: 0,
    status: 'ready',
  },
  {
    id: 'w-005',
    name: 'SM-6',
    platformIndex: 3,
    platformName: 'USS Arleigh Burke',
    side: 'blue',
    type: 'missile',
    quantity: 32,
    maxRange: 370,
    guidance: '主动/半主动雷达',
    speed: 3.5,
    status: 'ready',
  },
  {
    id: 'w-006',
    name: 'Tomahawk',
    platformIndex: 3,
    platformName: 'USS Arleigh Burke',
    side: 'blue',
    type: 'missile',
    quantity: 16,
    maxRange: 1600,
    guidance: 'GPS/INS + 地形匹配',
    speed: 0.7,
    status: 'ready',
  },
  // 红方平台武器
  {
    id: 'w-007',
    name: 'PL-15',
    platformIndex: 10,
    platformName: 'Su-35 Red-1',
    side: 'red',
    type: 'missile',
    quantity: 4,
    maxRange: 200,
    guidance: '主动雷达 + 数据链',
    speed: 4,
    status: 'ready',
  },
  {
    id: 'w-008',
    name: 'PL-10',
    platformIndex: 10,
    platformName: 'Su-35 Red-1',
    side: 'red',
    type: 'missile',
    quantity: 2,
    maxRange: 20,
    guidance: '红外成像',
    speed: 3,
    status: 'ready',
  },
  {
    id: 'w-009',
    name: 'YJ-12',
    platformIndex: 11,
    platformName: 'H-6K Bomber',
    side: 'red',
    type: 'missile',
    quantity: 6,
    maxRange: 400,
    guidance: '惯导 + 主动雷达',
    speed: 3,
    status: 'loading',
  },
  {
    id: 'w-010',
    name: 'HQ-9',
    platformIndex: 12,
    platformName: 'SAM Site Alpha',
    side: 'red',
    type: 'missile',
    quantity: 8,
    maxRange: 200,
    guidance: 'TVM + 指令',
    speed: 4.2,
    status: 'ready',
  },
];

// ============ 辅助函数 ============

function weaponTypeLabel(type: WeaponInfo['type']): string {
  const map: Record<WeaponInfo['type'], string> = {
    missile: '导弹',
    bomb: '炸弹',
    torpedo: '鱼雷',
    gun: '火炮',
    rocket: '火箭弹',
  };
  return map[type];
}

function weaponTypeColor(type: WeaponInfo['type']): string {
  const map: Record<WeaponInfo['type'], string> = {
    missile: '#ff4d4f',
    bomb: '#faad14',
    torpedo: '#13c2c2',
    gun: '#722ed1',
    rocket: '#fa8c16',
  };
  return map[type];
}

function weaponStatusTag(status: WeaponInfo['status']) {
  const map: Record<WeaponInfo['status'], { color: string; label: string; icon: React.ReactNode }> = {
    ready: { color: 'success', label: '就绪', icon: <CheckCircleOutlined /> },
    loading: { color: 'processing', label: '装填中', icon: <ThunderboltOutlined /> },
    empty: { color: 'default', label: '耗尽', icon: <CloseCircleOutlined /> },
    damaged: { color: 'error', label: '损坏', icon: <WarningOutlined /> },
  };
  const { color, label, icon } = map[status];
  return <Tag icon={icon} color={color}>{label}</Tag>;
}

// ============ 主组件 ============

export default function WeaponBrowser() {
  const platforms = usePlatformStore((s) => s.platforms);
  const tracks = useTrackStore((s) => s.tracks);
  const activeWeapons = useWeaponStore((s) => s.weapons);

  const [selectedWeapon, setSelectedWeapon] = useState<WeaponInfo | null>(null);
  const [fireModalVisible, setFireModalVisible] = useState(false);
  const [fireTargetIndex, setFireTargetIndex] = useState<number | null>(null);
  const [fireQuantity, setFireQuantity] = useState(1);

  // 构建武器树
  const weaponTree = useMemo(() => {
    const grouped: Record<string, WeaponInfo[]> = {};
    mockWeapons.forEach((w) => {
      const key = `${w.side === 'blue' ? '蓝方' : '红方'} - ${w.platformName}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(w);
    });

    const tree: DataNode[] = [];
    // 蓝方
    const blueNodes = Object.entries(grouped)
      .filter(([k]) => k.startsWith('蓝方'))
      .map(([key, weapons]) => ({
        title: (
          <Space>
            <TeamOutlined style={{ color: '#1890ff' }} />
            <Text>{key.replace('蓝方 - ', '')}</Text>
            <Tag color="blue" style={{ marginLeft: 4 }}>{weapons.length}</Tag>
          </Space>
        ),
        key: key,
        children: weapons.map((w) => ({
          title: (
            <Space>
              <RocketOutlined style={{ color: weaponTypeColor(w.type) }} />
              <Text>{w.name}</Text>
              {weaponStatusTag(w.status)}
            </Space>
          ),
          key: w.id,
          isLeaf: true,
        })),
      }));

    if (blueNodes.length > 0) {
      tree.push({
        title: (
          <Space>
            <Tag color="blue">蓝方</Tag>
            <Text type="secondary">{blueNodes.length} 个平台</Text>
          </Space>
        ),
        key: 'blue-root',
        children: blueNodes,
      });
    }

    // 红方
    const redNodes = Object.entries(grouped)
      .filter(([k]) => k.startsWith('红方'))
      .map(([key, weapons]) => ({
        title: (
          <Space>
            <TeamOutlined style={{ color: '#ff4d4f' }} />
            <Text>{key.replace('红方 - ', '')}</Text>
            <Tag color="red" style={{ marginLeft: 4 }}>{weapons.length}</Tag>
          </Space>
        ),
        key: key,
        children: weapons.map((w) => ({
          title: (
            <Space>
              <RocketOutlined style={{ color: weaponTypeColor(w.type) }} />
              <Text>{w.name}</Text>
              {weaponStatusTag(w.status)}
            </Space>
          ),
          key: w.id,
          isLeaf: true,
        })),
      }));

    if (redNodes.length > 0) {
      tree.push({
        title: (
          <Space>
            <Tag color="red">红方</Tag>
            <Text type="secondary">{redNodes.length} 个平台</Text>
          </Space>
        ),
        key: 'red-root',
        children: redNodes,
      });
    }

    return tree;
  }, []);

  // 可选目标航迹
  const trackOptions = useMemo(() => {
    return Array.from(tracks.values()).map((t) => ({
      value: t.target_index,
      label: `航迹 #${t.target_index} (${t.lat.toFixed(4)}, ${t.lon.toFixed(4)}) - 质量 ${(t.quality * 100).toFixed(0)}%`,
    }));
  }, [tracks]);

  // 发射历史（来自 weaponStore）
  const fireHistory = useMemo(() => {
    return Array.from(activeWeapons.values()).map((w) => ({
      ...w,
      status: w.hit === true ? '命中' : w.hit === false ? '未命中' : '飞行中',
    }));
  }, [activeWeapons]);

  const handleTreeSelect = (selectedKeys: React.Key[]) => {
    const key = selectedKeys[0] as string;
    const weapon = mockWeapons.find((w) => w.id === key);
    setSelectedWeapon(weapon ?? null);
  };

  const handleFire = () => {
    if (!selectedWeapon) {
      message.warning('请先选择武器');
      return;
    }
    if (selectedWeapon.status !== 'ready') {
      message.error('武器未就绪，无法发射');
      return;
    }
    setFireModalVisible(true);
  };

  const simulationId = useSimStore((s) => s.simulationId);

  const confirmFire = async () => {
    if (fireTargetIndex === null) {
      message.warning('请选择目标航迹');
      return;
    }
    if (!selectedWeapon) return;

    if (!simulationId) {
      message.warning('无活跃仿真，无法发送发射指令');
      return;
    }

    try {
      await fireWeapon(simulationId, {
        firing_platform_index: selectedWeapon.platformIndex,
        weapon_name: selectedWeapon.name,
        target_platform_index: fireTargetIndex,
      });
      message.success(`${selectedWeapon.name} x${fireQuantity} 已发射，目标航迹 #${fireTargetIndex}`);
      setFireModalVisible(false);
      setFireTargetIndex(null);
      setFireQuantity(1);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      message.error(`发射指令失败: ${errMsg}`);
    }
  };

  // 发射历史列
  const historyColumns: ColumnsType<WeaponEngagement & { status: string }> = [
    {
      title: '武器',
      dataIndex: 'weapon_name',
      key: 'weapon_name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '发射平台',
      dataIndex: 'firing_platform_index',
      key: 'firing_platform_index',
      width: 80,
      render: (idx: number) => <Text>#{idx}</Text>,
    },
    {
      title: '目标',
      dataIndex: 'target_platform_index',
      key: 'target_platform_index',
      width: 80,
      render: (idx: number) => <Text>#{idx}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag
          color={
            status === '命中' ? 'success' : status === '飞行中' ? 'processing' : 'error'
          }
        >
          {status}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {/* 左侧：武器树 */}
        <Card
          size="small"
          title={
            <Space>
              <RocketOutlined />
              <span>武器库</span>
              <Tag>{mockWeapons.length} 种</Tag>
            </Space>
          }
          bordered={false}
          style={{ background: 'var(--bg-secondary)', width: 280, overflow: 'auto' }}
        >
          <Tree
            treeData={weaponTree}
            onSelect={handleTreeSelect}
            defaultExpandAll
            showLine
            style={{ background: 'transparent', color: 'var(--text-primary)' }}
          />
        </Card>

        {/* 右侧：详情 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
          {selectedWeapon ? (
            <>
              {/* 武器信息 */}
              <Card
                size="small"
                title={
                  <Space>
                    <RocketOutlined style={{ color: weaponTypeColor(selectedWeapon.type) }} />
                    <span>{selectedWeapon.name}</span>
                    {weaponStatusTag(selectedWeapon.status)}
                  </Space>
                }
                bordered={false}
                style={{ background: 'var(--bg-secondary)' }}
                extra={
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleFire}
                    disabled={selectedWeapon.status !== 'ready'}
                  >
                    发射
                  </Button>
                }
              >
                <Descriptions column={2} size="small" labelStyle={{ color: 'var(--text-secondary)' }}>
                  <Descriptions.Item label="武器类型">
                    <Tag color={weaponTypeColor(selectedWeapon.type)}>
                      {weaponTypeLabel(selectedWeapon.type)}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="数量">
                    <Badge count={selectedWeapon.quantity} showZero color="#1890ff" />
                  </Descriptions.Item>
                  <Descriptions.Item label="最大射程">
                    <Text>{selectedWeapon.maxRange > 0 ? `${selectedWeapon.maxRange} km` : 'N/A'}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="速度">
                    <Text>{selectedWeapon.speed > 0 ? `${selectedWeapon.speed} Mach` : 'N/A'}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="制导方式" span={2}>
                    <Text>{selectedWeapon.guidance}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="搭载平台">
                    <Text>{selectedWeapon.platformName}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="阵营">
                    <Tag color={selectedWeapon.side === 'blue' ? '#1890ff' : '#ff4d4f'}>
                      {selectedWeapon.side === 'blue' ? '蓝方' : '红方'}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {/* 发射历史 */}
              <Card
                size="small"
                title={
                  <Space>
                    <HistoryOutlined />
                    <span>发射历史</span>
                    <Tag>{fireHistory.length} 条</Tag>
                  </Space>
                }
                bordered={false}
                style={{ background: 'var(--bg-secondary)', flex: 1, overflow: 'auto' }}
                bodyStyle={{ padding: 0 }}
              >
                {fireHistory.length > 0 ? (
                  <Table
                    size="small"
                    columns={historyColumns}
                    dataSource={fireHistory}
                    rowKey="weapon_platform_index"
                    pagination={{ pageSize: 10, size: 'small' }}
                  />
                ) : (
                  <Empty description="暂无发射记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </>
          ) : (
            <Card
              size="small"
              bordered={false}
              style={{
                background: 'var(--bg-secondary)',
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Empty
                description="请从左侧武器树选择一个武器"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </Card>
          )}
        </div>
      </div>

      {/* 发射对话框 */}
      <Modal
        title={
          <Space>
            <SendOutlined style={{ color: '#ff4d4f' }} />
            <span>发射武器</span>
          </Space>
        }
        open={fireModalVisible}
        onOk={confirmFire}
        onCancel={() => {
          setFireModalVisible(false);
          setFireTargetIndex(null);
          setFireQuantity(1);
        }}
        okText="发射"
        cancelText="取消"
        okButtonProps={{ danger: true, icon: <SendOutlined /> }}
      >
        {selectedWeapon && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions column={1} size="small" labelStyle={{ color: 'var(--text-secondary)' }}>
              <Descriptions.Item label="武器">{selectedWeapon.name}</Descriptions.Item>
              <Descriptions.Item label="可用数量">{selectedWeapon.quantity}</Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: '8px 0' }} />

            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                选择目标航迹：
              </Text>
              <Select
                style={{ width: '100%' }}
                placeholder="选择目标航迹"
                value={fireTargetIndex}
                onChange={setFireTargetIndex}
                options={trackOptions}
                showSearch
                optionFilterProp="label"
                notFoundContent="暂无可用航迹"
              />
            </div>

            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                发射数量：
              </Text>
              <InputNumber
                value={fireQuantity}
                onChange={(v) => setFireQuantity(v ?? 1)}
                min={1}
                max={selectedWeapon.quantity}
                style={{ width: 120 }}
              />
            </div>

            {fireTargetIndex !== null && (
              <Alert
                message={`即将发射 ${selectedWeapon.name} x${fireQuantity}，目标航迹 #${fireTargetIndex}`}
                type="warning"
                showIcon
              />
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
}
