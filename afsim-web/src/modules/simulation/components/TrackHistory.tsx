import { useMemo } from 'react';
import {
  Card,
  Slider,
  Select,
  Switch,
  Space,
  Typography,
  Tag,
  Divider,
  Tooltip,
  Descriptions,
  Alert,
  Collapse,
  List,
  Badge,
} from 'antd';
import {
  LineChartOutlined,
  ClockCircleOutlined,
  BgColorsOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  AimOutlined,
  ThunderboltOutlined,
  FireOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import { useTrackSettingsStore } from '../../../store/trackSettingsStore';
import { useTrackStore } from '../../../store/trackStore';
import SensorCoveragePanel from './SensorCoveragePanel';

const { Text, Title, Paragraph } = Typography;

// ============ 类型定义 ============

type ColorMode = 'side' | 'status';

interface TrackColorLegend {
  label: string;
  color: string;
  description: string;
}

// ============ 着色图例 ============

const sideColorLegend: TrackColorLegend[] = [
  { label: '蓝方', color: '#4488ff', description: '己方平台轨迹' },
  { label: '红方', color: '#ff4444', description: '敌方平台轨迹' },
  { label: '中立', color: '#aaaaaa', description: '中立方平台轨迹' },
];

const statusColorLegend: TrackColorLegend[] = [
  { label: '默认', color: '#52c41a', description: '正常状态（绿色）' },
  { label: '检测中', color: '#faad14', description: '传感器检测中（黄色）' },
  { label: '跟踪中', color: '#fa8c16', description: '持续跟踪状态（橙色）' },
  { label: '攻击中', color: '#ff4d4f', description: '武器交战状态（红色）' },
];

// ============ 主组件 ============

export default function TrackHistory() {
  // Pull settings from shared store (drives PlatformLayer rendering)
  const showTrackLines = useTrackSettingsStore((s) => s.showTrackLines);
  const trackLength = useTrackSettingsStore((s) => s.trackLength);
  const colorMode = useTrackSettingsStore((s) => s.colorMode);
  const showLabels = useTrackSettingsStore((s) => s.showLabels);
  const showVelocityVectors = useTrackSettingsStore((s) => s.showVelocityVectors);
  const showRoutes = useTrackSettingsStore((s) => s.showRoutes);
  const setShowTrackLines = useTrackSettingsStore((s) => s.setShowTrackLines);
  const setTrackLength = useTrackSettingsStore((s) => s.setTrackLength);
  const setColorMode = useTrackSettingsStore((s) => s.setColorMode);
  const setShowLabels = useTrackSettingsStore((s) => s.setShowLabels);
  const setShowVelocityVectors = useTrackSettingsStore((s) => s.setShowVelocityVectors);
  const setShowRoutes = useTrackSettingsStore((s) => s.setShowRoutes);

  // Real track stats from trackStore
  const tracks = useTrackStore((s) => s.tracks);
  const trackStats = useMemo(() => {
    const all = Array.from(tracks.values());
    const total = all.length;
    let blueCount = 0;
    let redCount = 0;
    let totalQuality = 0;
    for (const t of all) {
      // Heuristic: tracks don't store side directly, so count by originator convention
      // For now count all tracks and compute average quality
      totalQuality += t.quality;
    }
    const avgQuality = total > 0 ? totalQuality / total : 0;
    return { total, blueCount, redCount, avgQuality };
  }, [tracks]);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>
      {/* 轨迹显示控制 */}
      <Card
        size="small"
        title={
          <Space>
            <LineChartOutlined />
            <span>轨迹显示</span>
          </Space>
        }
        bordered={false}
        style={{ background: '#111820' }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {/* 轨迹线开关 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              {showTrackLines ? (
                <EyeOutlined style={{ color: '#52c41a' }} />
              ) : (
                <EyeInvisibleOutlined style={{ color: '#888' }} />
              )}
              <Text>轨迹线显示</Text>
            </Space>
            <Switch
              checked={showTrackLines}
              onChange={setShowTrackLines}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </div>

          {/* 轨迹长度滑块 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Space>
                <ClockCircleOutlined style={{ color: '#8899aa' }} />
                <Text type="secondary">轨迹长度</Text>
              </Space>
              <Tag color="blue">{trackLength} 秒</Tag>
            </div>
            <Slider
              min={5}
              max={120}
              step={5}
              value={trackLength}
              onChange={setTrackLength}
              marks={{
                5: '5s',
                30: '30s',
                60: '60s',
                120: '120s',
              }}
              disabled={!showTrackLines}
            />
          </div>

          {/* 标签显示 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <InfoCircleOutlined style={{ color: '#8899aa' }} />
              <Text>显示标签</Text>
            </Space>
            <Switch
              checked={showLabels}
              onChange={setShowLabels}
              disabled={!showTrackLines}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </div>

          {/* 速度矢量 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <AimOutlined style={{ color: '#8899aa' }} />
              <Text>速度矢量</Text>
            </Space>
            <Switch
              checked={showVelocityVectors}
              onChange={setShowVelocityVectors}
              disabled={!showTrackLines}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </div>

          {/* 预设航线显示 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <NodeIndexOutlined style={{ color: '#8899aa' }} />
              <Text>预设航线</Text>
            </Space>
            <Switch
              checked={showRoutes}
              onChange={setShowRoutes}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </div>
        </Space>
      </Card>

      {/* 着色模式 */}
      <Card
        size="small"
        title={
          <Space>
            <BgColorsOutlined />
            <span>着色模式</span>
          </Space>
        }
        bordered={false}
        style={{ background: '#111820' }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Select
            style={{ width: '100%' }}
            value={colorMode}
            onChange={setColorMode}
            options={[
              {
                value: 'side',
                label: (
                  <Space>
                    <BgColorsOutlined />
                    按阵营着色
                  </Space>
                ),
              },
              {
                value: 'status',
                label: (
                  <Space>
                    <BgColorsOutlined />
                    按状态着色
                  </Space>
                ),
              },
            ]}
          />

          {/* 着色图例 */}
          <div>
            <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
              图例说明：
            </Text>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {(colorMode === 'side' ? sideColorLegend : statusColorLegend).map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 8px',
                    background: '#0d1117',
                    borderRadius: 4,
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 4,
                      background: item.color,
                      borderRadius: 2,
                    }}
                  />
                  <Text style={{ fontSize: 12, flex: 1 }}>{item.label}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {item.description}
                  </Text>
                </div>
              ))}
            </Space>
          </div>

          {/* 状态着色详细说明 */}
          {colorMode === 'status' && (
            <Alert
              message="状态着色说明"
              description={
                <div style={{ fontSize: 12 }}>
                  <p style={{ margin: '4px 0' }}>
                    <span style={{ color: '#52c41a' }}>&#9632;</span> <strong>默认（绿色）</strong>：平台正常运行，无特殊状态
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <span style={{ color: '#faad14' }}>&#9632;</span> <strong>检测中（黄色）</strong>：被传感器探测到，但尚未形成稳定跟踪
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <span style={{ color: '#fa8c16' }}>&#9632;</span> <strong>跟踪中（橙色）</strong>：被持续跟踪，数据质量稳定
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <span style={{ color: '#ff4d4f' }}>&#9632;</span> <strong>攻击中（红色）</strong>：已被武器锁定或正在交战
                  </p>
                </div>
              }
              type="info"
              showIcon
              style={{ padding: '4px 12px' }}
            />
          )}
        </Space>
      </Card>

      {/* 当前航迹统计 */}
      <Card
        size="small"
        title={
          <Space>
            <AimOutlined />
            <span>当前航迹统计</span>
          </Space>
        }
        bordered={false}
        style={{ background: '#111820' }}
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">活跃航迹</Text>
            <Badge count={trackStats.total} showZero color="#1890ff" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">蓝方航迹</Text>
            <Badge count={trackStats.blueCount} showZero color="#4488ff" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">红方航迹</Text>
            <Badge count={trackStats.redCount} showZero color="#ff4444" />
          </div>
          <Divider style={{ margin: '4px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">平均质量</Text>
            <Tag color="green">{Math.round(trackStats.avgQuality * 100)}%</Tag>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">更新频率</Text>
            <Tag color="blue">2 Hz</Tag>
          </div>
        </Space>
      </Card>

      {/* 传感器覆盖分析 */}
      <SensorCoveragePanel />

      {/* 显示设置提示 */}
      <Card size="small" bordered={false} style={{ background: '#111820' }}>
        <Space align="start">
          <InfoCircleOutlined style={{ color: '#1890ff', marginTop: 2 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            轨迹显示设置将实时应用到 3D 地球视图。较长的轨迹长度可能影响渲染性能。
          </Text>
        </Space>
      </Card>
    </div>
  );
}
