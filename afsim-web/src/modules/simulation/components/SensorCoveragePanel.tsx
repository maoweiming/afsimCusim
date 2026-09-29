import { useMemo } from 'react'
import {
  Card,
  Switch,
  Slider,
  Space,
  Typography,
  Table,
  Button,
  Badge,
  Tooltip,
  Divider,
} from 'antd'
import {
  RadarChartOutlined,
  HeatMapOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import { useCoverageStore, SensorDetectionStat } from '../../../store/coverageStore'
import { usePlatformStore } from '../../../store/platformStore'

const { Text } = Typography

// ─── heatmap legend bar ────────────────────────────────────────────────────

function HeatmapLegend() {
  return (
    <div>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
        检测密度图例
      </Text>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            flex: 1,
            height: 12,
            borderRadius: 4,
            background: 'linear-gradient(to right, #00ff88, #ffdd00, #ff3300)',
            opacity: 0.85,
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>低</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>中</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>高</Text>
      </div>
    </div>
  )
}

// ─── main panel ────────────────────────────────────────────────────────────

export default function SensorCoveragePanel() {
  const showCoverageCircles = useCoverageStore((s) => s.showCoverageCircles)
  const showHeatmap = useCoverageStore((s) => s.showHeatmap)
  const heatmapOpacity = useCoverageStore((s) => s.heatmapOpacity)
  const sensorStats = useCoverageStore((s) => s.sensorStats)
  const detectionGrid = useCoverageStore((s) => s.detectionGrid)
  const setShowCoverageCircles = useCoverageStore((s) => s.setShowCoverageCircles)
  const setShowHeatmap = useCoverageStore((s) => s.setShowHeatmap)
  const setHeatmapOpacity = useCoverageStore((s) => s.setHeatmapOpacity)
  const clearAll = useCoverageStore((s) => s.clearAll)

  const platforms = usePlatformStore((s) => s.platforms)

  const totalDetections = useMemo(
    () => Object.values(sensorStats).reduce((s, v) => s + v.count, 0),
    [sensorStats],
  )

  const activeSensors = useMemo(() => {
    const result: (SensorDetectionStat & { side: string; isOn: boolean })[] = []
    for (const plat of Object.values(platforms)) {
      for (const [sName, sensor] of Object.entries(plat.sensors)) {
        const key = `${plat.index}_${sName}`
        const stat = sensorStats[key]
        result.push({
          platformIndex: plat.index,
          platformName: plat.name,
          sensorName: sName,
          sensorType: sensor.type || stat?.sensorType || '',
          count: stat?.count ?? 0,
          side: plat.side,
          isOn: sensor.isOn,
        })
      }
    }
    return result.sort((a, b) => b.count - a.count)
  }, [platforms, sensorStats])

  const cellCount = Object.keys(detectionGrid).length

  const columns = [
    {
      title: '平台',
      dataIndex: 'platformName',
      key: 'platform',
      ellipsis: true,
      render: (name: string, row: { side: string }) => (
        <Text style={{ color: row.side === 'blue' ? '#70f3ff' : '#ff6666', fontSize: 12 }}>
          {name}
        </Text>
      ),
    },
    {
      title: '传感器',
      dataIndex: 'sensorName',
      key: 'sensor',
      ellipsis: true,
      render: (name: string, row: { isOn: boolean }) => (
        <Space size={4}>
          <Badge status={row.isOn ? 'success' : 'default'} />
          <Text style={{ fontSize: 12 }}>{name}</Text>
        </Space>
      ),
    },
    {
      title: '探测次数',
      dataIndex: 'count',
      key: 'count',
      width: 80,
      render: (count: number) => (
        <Badge
          count={count}
          showZero
          color={count > 10 ? '#ff4d4f' : count > 4 ? '#faad14' : '#52c41a'}
          overflowCount={999}
        />
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── display toggles ── */}
      <Card
        size="small"
        title={
          <Space>
            <RadarChartOutlined />
            <span>传感器覆盖分析</span>
          </Space>
        }
        bordered={false}
        style={{ background: '#111820' }}
        extra={
          <Tooltip title="清除检测热力图数据">
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={clearAll}
              disabled={totalDetections === 0}
            />
          </Tooltip>
        }
      >
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          {/* coverage circles */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <RadarChartOutlined style={{ color: '#4499ff' }} />
              <Text>传感器探测圆</Text>
            </Space>
            <Switch
              checked={showCoverageCircles}
              onChange={setShowCoverageCircles}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </div>

          {/* heatmap */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <HeatMapOutlined style={{ color: '#ff8800' }} />
              <Text>检测热力图</Text>
            </Space>
            <Switch
              checked={showHeatmap}
              onChange={setShowHeatmap}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </div>

          {/* opacity */}
          {showHeatmap && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  热力图透明度
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {Math.round(heatmapOpacity * 100)}%
                </Text>
              </div>
              <Slider
                min={0.1}
                max={1.0}
                step={0.05}
                value={heatmapOpacity}
                onChange={setHeatmapOpacity}
              />
              <HeatmapLegend />
            </div>
          )}

          <Divider style={{ margin: '4px 0' }} />

          {/* stats summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>累计探测事件</Text>
            <Badge count={totalDetections} showZero color="#1890ff" overflowCount={99999} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>覆盖网格单元</Text>
            <Badge count={cellCount} showZero color="#52c41a" overflowCount={9999} />
          </div>
        </Space>
      </Card>

      {/* ── per-sensor table ── */}
      {activeSensors.length > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <InfoCircleOutlined />
              <span>传感器探测统计</span>
            </Space>
          }
          bordered={false}
          style={{ background: '#111820' }}
        >
          <Table<(typeof activeSensors)[0]>
            dataSource={activeSensors}
            columns={columns}
            rowKey={(r) => `${r.platformIndex}_${r.sensorName}`}
            size="small"
            pagination={false}
            scroll={{ y: 240 }}
            style={{ fontSize: 12 }}
          />
        </Card>
      )}
    </div>
  )
}
