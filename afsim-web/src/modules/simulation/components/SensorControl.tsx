import { useMemo, useState } from 'react';
import {
  Card,
  Select,
  InputNumber,
  Button,
  Space,
  Typography,
  Tag,
  Switch,
  Table,
  Alert,
  Tooltip,
  Divider,
  Progress,
  message,
  Descriptions,
} from 'antd';
import {
  RadarChartOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  AimOutlined,
  SwapOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { usePlatformStore } from '../../../store/platformStore';
import type { PlatformInfo, SensorInfo } from '../../../store/platformStore';
import { steerSensor } from '../../../api/controlApi';
import { useSimStore } from '../../../store/simStore';

const { Text, Title } = Typography;

// ============ 辅助函数 ============

function sensorStatusTag(sensor: SensorInfo) {
  if (!sensor.isOn) {
    return <Tag icon={<CloseCircleOutlined />} color="default">关机</Tag>;
  }
  return <Tag icon={<CheckCircleOutlined />} color="success">开机</Tag>;
}

function sensorTypeIcon(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes('radar')) return <RadarChartOutlined style={{ color: '#1890ff' }} />;
  if (lower.includes('ir') || lower.includes('infrared')) return <EyeOutlined style={{ color: '#faad14' }} />;
  if (lower.includes('sonar')) return <AimOutlined style={{ color: '#13c2c2' }} />;
  if (lower.includes('electro') || lower.includes('eo')) return <EyeOutlined style={{ color: '#722ed1' }} />;
  return <RadarChartOutlined style={{ color: '#1890ff' }} />;
}

// ============ Mock 传感器转向数据 ============

interface SteerCommand {
  platformIndex: number;
  sensorName: string;
  azimuth: number; // 方位角 (度)
  elevation: number; // 仰角 (度)
}

// 传感器转向限制
const STEER_LIMITS = {
  azimuth: { min: -180, max: 180 },
  elevation: { min: -90, max: 90 },
};

// ============ 主组件 ============

export default function SensorControl() {
  const platforms = usePlatformStore((s) => s.platforms);
  const updateSensor = usePlatformStore((s) => s.updateSensor);

  const [selectedPlatformIndex, setSelectedPlatformIndex] = useState<number | null>(null);
  const [steerAzimuth, setSteerAzimuth] = useState<number>(0);
  const [steerElevation, setSteerElevation] = useState<number>(0);

  // 可选平台列表（有传感器的）
  const platformOptions = useMemo(() => {
    return Object.values(platforms)
      .filter((p) => Object.keys(p.sensors).length > 0)
      .map((p) => ({
        value: p.index,
        label: `${p.name} (${p.side === 'blue' ? '蓝方' : p.side === 'red' ? '红方' : '中立'})`,
        side: p.side,
      }));
  }, [platforms]);

  const selectedPlatform = useMemo(
    () => (selectedPlatformIndex !== null ? platforms[selectedPlatformIndex] : null),
    [platforms, selectedPlatformIndex]
  );

  // 传感器列表
  const sensorList = useMemo(() => {
    if (!selectedPlatform) return [];
    return Object.entries(selectedPlatform.sensors).map(([name, sensor]) => ({
      ...sensor,
      name,
    }));
  }, [selectedPlatform]);

  // 开关机操作
  const handleToggleSensor = (sensorName: string, currentOn: boolean) => {
    if (selectedPlatformIndex === null) return;
    updateSensor(selectedPlatformIndex, sensorName, { isOn: !currentOn });
    message.success(`${sensorName} 已${currentOn ? '关闭' : '开启'}`);
  };

  const simulationId = useSimStore((s) => s.simulationId);

  // 转向操作
  const handleSteer = async () => {
    if (selectedPlatformIndex === null) {
      message.warning('请先选择平台');
      return;
    }

    // 验证限制
    if (
      steerAzimuth < STEER_LIMITS.azimuth.min ||
      steerAzimuth > STEER_LIMITS.azimuth.max
    ) {
      message.error(`方位角超出范围 [${STEER_LIMITS.azimuth.min}, ${STEER_LIMITS.azimuth.max}]`);
      return;
    }
    if (
      steerElevation < STEER_LIMITS.elevation.min ||
      steerElevation > STEER_LIMITS.elevation.max
    ) {
      message.error(`仰角超出范围 [${STEER_LIMITS.elevation.min}, ${STEER_LIMITS.elevation.max}]`);
      return;
    }

    // Find the first sensor on this platform to steer
    const firstSensorName = sensorList.length > 0 ? sensorList[0].name : null;
    if (!firstSensorName) {
      message.warning('该平台无可用传感器');
      return;
    }

    if (!simulationId) {
      message.warning('无活跃仿真，无法发送控制指令');
      return;
    }

    try {
      await steerSensor(simulationId, {
        platform_index: selectedPlatformIndex,
        sensor_name: firstSensorName,
        azimuth: steerAzimuth,
        elevation: steerElevation,
      });
      message.success(`传感器转向指令已发送：方位 ${steerAzimuth}°，仰角 ${steerElevation}°`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      message.error(`转向指令失败: ${errMsg}`);
    }
  };

  // 传感器表格列
  const sensorColumns: ColumnsType<{ name: string } & SensorInfo> = [
    {
      title: '传感器',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <Space>
          {sensorTypeIcon(record.type)}
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => <Tag>{type || '未知'}</Tag>,
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (_: unknown, record) => sensorStatusTag(record),
    },
    {
      title: '检测数',
      dataIndex: 'detections',
      key: 'detections',
      width: 70,
      render: (detections?: number[]) => (
        <Text>{detections?.length ?? 0}</Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record) => (
        <Button
          size="small"
          type={record.isOn ? 'default' : 'primary'}
          danger={record.isOn}
          icon={record.isOn ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          onClick={() => handleToggleSensor(record.name, record.isOn)}
        >
          {record.isOn ? '关闭' : '开启'}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>
      {/* 平台选择 */}
      <Card size="small" title="平台选择" bordered={false} style={{ background: '#111820' }}>
        <Select
          style={{ width: '100%' }}
          placeholder="选择一个平台查看传感器"
          value={selectedPlatformIndex}
          onChange={setSelectedPlatformIndex}
          allowClear
          showSearch
          optionFilterProp="label"
          options={platformOptions.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))}
        />
        {selectedPlatform && (
          <Descriptions size="small" column={2} style={{ marginTop: 8 }} labelStyle={{ color: '#8899aa' }}>
            <Descriptions.Item label="平台名称">{selectedPlatform.name}</Descriptions.Item>
            <Descriptions.Item label="阵营">
              <Tag color={selectedPlatform.side === 'blue' ? '#1890ff' : selectedPlatform.side === 'red' ? '#ff4d4f' : '#888'}>
                {selectedPlatform.side === 'blue' ? '蓝方' : selectedPlatform.side === 'red' ? '红方' : '中立'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="类型">{selectedPlatform.typeId}</Descriptions.Item>
            <Descriptions.Item label="损伤">
              <Progress
                percent={Math.round(selectedPlatform.damageFactor * 100)}
                size="small"
                status={selectedPlatform.damageFactor >= 1 ? 'exception' : selectedPlatform.damageFactor > 0 ? 'active' : 'normal'}
                style={{ width: 80 }}
              />
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      {/* 传感器列表 */}
      {selectedPlatform && (
        <Card
          size="small"
          title={
            <Space>
              <RadarChartOutlined />
              <span>传感器列表</span>
              <Tag>{sensorList.length} 个</Tag>
            </Space>
          }
          bordered={false}
          style={{ background: '#111820' }}
          bodyStyle={{ padding: 0 }}
        >
          <Table
            size="small"
            columns={sensorColumns}
            dataSource={sensorList}
            rowKey="name"
            pagination={false}
          />
        </Card>
      )}

      {/* 转向控制 */}
      {selectedPlatform && sensorList.length > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <SwapOutlined />
              <span>转向控制</span>
            </Space>
          }
          bordered={false}
          style={{ background: '#111820' }}
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  方位角 (°)
                </Text>
                <InputNumber
                  value={steerAzimuth}
                  onChange={(v) => setSteerAzimuth(v ?? 0)}
                  min={STEER_LIMITS.azimuth.min}
                  max={STEER_LIMITS.azimuth.max}
                  step={1}
                  style={{ width: 120 }}
                  addonAfter="°"
                />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  仰角 (°)
                </Text>
                <InputNumber
                  value={steerElevation}
                  onChange={(v) => setSteerElevation(v ?? 0)}
                  min={STEER_LIMITS.elevation.min}
                  max={STEER_LIMITS.elevation.max}
                  step={1}
                  style={{ width: 120 }}
                  addonAfter="°"
                />
              </div>
              <Button
                type="primary"
                icon={<AimOutlined />}
                onClick={handleSteer}
              >
                转向
              </Button>
            </div>

            <Alert
              message="转向限制"
              description={
                <Space>
                  <Text style={{ fontSize: 12 }}>
                    方位角：[{STEER_LIMITS.azimuth.min}°, {STEER_LIMITS.azimuth.max}°]
                  </Text>
                  <Divider type="vertical" />
                  <Text style={{ fontSize: 12 }}>
                    仰角：[{STEER_LIMITS.elevation.min}°, {STEER_LIMITS.elevation.max}°]
                  </Text>
                </Space>
              }
              type="info"
              showIcon
              style={{ padding: '4px 12px' }}
            />

            {/* 快速转向按钮 */}
            <div>
              <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                快速转向：
              </Text>
              <Space wrap>
                {[
                  { label: '正北', az: 0, el: 0 },
                  { label: '正东', az: 90, el: 0 },
                  { label: '正南', az: 180, el: 0 },
                  { label: '正西', az: -90, el: 0 },
                  { label: '天顶', az: 0, el: 90 },
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    size="small"
                    onClick={() => {
                      setSteerAzimuth(preset.az);
                      setSteerElevation(preset.el);
                    }}
                  >
                    {preset.label} ({preset.az}°/{preset.el}°)
                  </Button>
                ))}
              </Space>
            </div>
          </Space>
        </Card>
      )}

      {/* 无数据提示 */}
      {!selectedPlatform && (
        <Card
          size="small"
          bordered={false}
          style={{ background: '#111820', textAlign: 'center', padding: 40 }}
        >
          <Space direction="vertical" size={8}>
            <RadarChartOutlined style={{ fontSize: 48, color: '#2a3a4a' }} />
            <Text type="secondary">请选择一个平台以控制传感器</Text>
          </Space>
        </Card>
      )}
    </div>
  );
}
