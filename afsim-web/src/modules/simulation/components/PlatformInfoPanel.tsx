import { useMemo } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Progress,
  Typography,
  Space,
  Badge,
  Tabs,
  Table,
  Empty,
  Tooltip,
} from 'antd';
import {
  InfoCircleOutlined,
  RocketOutlined,
  DashboardOutlined,
  RadarChartOutlined,
  WarningOutlined,
  AimOutlined,
  EyeOutlined,
  EnvironmentOutlined,
  CompassOutlined,
  CloudOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FireOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  ToolOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import { usePlatformStore } from '../../../store/platformStore';
import type { PlatformInfo, SensorInfo } from '../../../store/platformStore';
import { useAiStore } from '../../../store/aiStore';
import type { PlatformAiState } from '../../../store/aiStore';

const { Text } = Typography;

// ============ Theme constants ============

const BG = '#0d1117';
const CARD_BG = '#111820';
const BORDER = '#30363d';
const TEXT = '#e6edf3';
const TEXT_SEC = '#8b949e';
const CARD_BODY: React.CSSProperties = { padding: '8px 12px' };

// ============ Helper functions ============

function sideColor(side: string): string {
  const s = side.toLowerCase();
  if (s === 'blue' || s === 'friendly') return '#1890ff';
  if (s === 'red' || s === 'hostile') return '#ff4d4f';
  return '#8899aa';
}

function sideLabel(side: string): string {
  const s = side.toLowerCase();
  if (s === 'blue' || s === 'friendly') return '蓝方';
  if (s === 'red' || s === 'hostile') return '红方';
  if (s === 'neutral') return '中立';
  return side || '未知';
}

function calcSpeed(velN?: number, velE?: number, velD?: number): number | null {
  if (velN === undefined && velE === undefined && velD === undefined) return null;
  const vn = velN ?? 0;
  const ve = velE ?? 0;
  const vd = velD ?? 0;
  return Math.sqrt(vn * vn + ve * ve + vd * vd) * 3.6;
}

function sensorTypeIcon(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes('radar')) return <RadarChartOutlined style={{ color: '#1890ff' }} />;
  if (lower.includes('ir') || lower.includes('infrared'))
    return <EyeOutlined style={{ color: '#faad14' }} />;
  if (lower.includes('sonar')) return <AimOutlined style={{ color: '#13c2c2' }} />;
  return <RadarChartOutlined style={{ color: '#1890ff' }} />;
}

function missionTypeLabel(t: string): string {
  const map: Record<string, string> = {
    patrol: '巡逻', strike: '打击', escort: '护航', recon: '侦察',
    cargo: '运输', cap: '空中巡逻', cas: '近距支援',
  };
  return map[t] ?? t;
}

function missionStatusLabel(s: string): string {
  const map: Record<string, string> = {
    en_route: '途中', on_station: '到位', engaging: '交战中',
    rtb: '返航', completed: '完成', aborted: '中止',
  };
  return map[s] ?? s;
}

function engagementStateLabel(s: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    safe: { label: '安全', color: '#52c41a' },
    caution: { label: '警戒', color: '#faad14' },
    weapons_free: { label: '自由开火', color: '#fa8c16' },
    engaged: { label: '交战中', color: '#ff4d4f' },
  };
  return map[s] ?? { label: s, color: TEXT_SEC };
}

function readinessLabel(s: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    full: { label: '满状态', color: '#52c41a' },
    degraded: { label: '降级', color: '#faad14' },
    limited: { label: '受限', color: '#fa8c16' },
    incapable: { label: '丧失能力', color: '#ff4d4f' },
  };
  return map[s] ?? { label: s, color: TEXT_SEC };
}

function maintenanceLabel(s: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    operational: { label: '正常', color: '#52c41a' },
    minor_fault: { label: '轻微故障', color: '#faad14' },
    major_fault: { label: '严重故障', color: '#fa8c16' },
    non_mission_capable: { label: '不可用', color: '#ff4d4f' },
  };
  return map[s] ?? { label: s, color: TEXT_SEC };
}

function NoData() {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<Text style={{ color: TEXT_SEC }}>暂无数据</Text>}
      />
    </div>
  );
}

function sectionLabel(icon: React.ReactNode, text: string, source?: DataSource) {
  return (
    <Space size={6}>
      {icon}
      <Text style={{ color: TEXT }}>{text}</Text>
      {source && <SourceDot source={source} />}
    </Space>
  );
}

// ============ Data Source Indicator ============

type DataSource = 'engine' | 'scenario' | 'client';

const SOURCE_CONFIG: Record<DataSource, { color: string; label: string }> = {
  engine: { color: '#1890ff', label: '引擎实时数据 (WebSocket)' },
  scenario: { color: '#8b949e', label: '想定静态配置' },
  client: { color: '#faad14', label: '前端显示计算' },
};

/** 数据来源指示器 — 小圆点 + tooltip */
function SourceDot({ source }: { source: DataSource }) {
  const cfg = SOURCE_CONFIG[source];
  return (
    <Tooltip title={cfg.label} placement="right">
      <span
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: cfg.color,
          marginLeft: 4,
          verticalAlign: 'middle',
          opacity: 0.7,
        }}
      />
    </Tooltip>
  );
}

// ============ Tab Content Components ============

/** 概览 Tab */
function OverviewTab({ platform }: { platform: PlatformInfo }) {
  const speed = useMemo(
    () => calcSpeed(platform.velN, platform.velE, platform.velD),
    [platform.velN, platform.velE, platform.velD],
  );

  const damagePct = useMemo(() => {
    const raw = platform.damageFactor ?? 0;
    return raw <= 1 ? Math.round(raw * 100) : Math.round(Math.min(raw, 100));
  }, [platform.damageFactor]);

  const sensorEntries = useMemo(
    () => Object.entries(platform.sensors).map(([name, info]) => ({ ...info, name })),
    [platform.sensors],
  );

  const fuelEntries = useMemo(() => Object.entries(platform.fuel), [platform.fuel]);

  const statusTag = useMemo(() => {
    if (platform.broken) {
      return (
        <Tag icon={<CloseCircleOutlined />} color="error">
          损毁
        </Tag>
      );
    }
    if (platform.initialized === false) {
      return (
        <Tag icon={<WarningOutlined />} color="warning">
          未初始化
        </Tag>
      );
    }
    return (
      <Tag icon={<CheckCircleOutlined />} color="success">
        运行中
      </Tag>
    );
  }, [platform.broken, platform.initialized]);

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {/* Basic info */}
      <Card
        size="small"
        title={sectionLabel(<InfoCircleOutlined style={{ color: '#1890ff' }} />, '基本信息')}
        bordered={false}
        style={{ background: CARD_BG }}
        bodyStyle={CARD_BODY}
      >
        <Descriptions
          size="small"
          column={2}
          labelStyle={{ color: TEXT_SEC, width: 80 }}
          contentStyle={{ color: TEXT }}
        >
          <Descriptions.Item label={<Space size={2}>名称<SourceDot source="scenario" /></Space>}>
            <Text strong style={{ color: TEXT }}>
              {platform.name || `平台-${platform.index}`}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label={<Space size={2}>阵营<SourceDot source="scenario" /></Space>}>
            <Tag color={sideColor(platform.side)}>{sideLabel(platform.side)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={<Space size={2}>类型<SourceDot source="scenario" /></Space>}>
            <Tag style={{ background: '#1f2937', border: '1px solid #374151', color: '#9ca3af' }}>
              {platform.typeId || '未知'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={<Space size={2}>状态<SourceDot source="engine" /></Space>}>{statusTag}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Movement */}
      <Card
        size="small"
        title={sectionLabel(<CompassOutlined style={{ color: '#1890ff' }} />, '运动参数')}
        bordered={false}
        style={{ background: CARD_BG }}
        bodyStyle={CARD_BODY}
      >
        <Descriptions
          size="small"
          column={2}
          labelStyle={{ color: TEXT_SEC, width: 80 }}
          contentStyle={{ color: TEXT }}
        >
          <Descriptions.Item label={<Space size={4}><DashboardOutlined style={{ fontSize: 12 }} /><span>速度</span><SourceDot source="client" /></Space>}>
            {speed !== null ? `${speed.toFixed(1)} km/h` : '--'}
          </Descriptions.Item>
          <Descriptions.Item label={<Space size={4}><CloudOutlined style={{ fontSize: 12 }} /><span>高度</span><SourceDot source="engine" /></Space>}>
            {platform.alt != null ? `${platform.alt.toFixed(1)} m` : '--'}
          </Descriptions.Item>
          <Descriptions.Item label={<Space size={4}><CompassOutlined style={{ fontSize: 12 }} /><span>航向</span><SourceDot source="engine" /></Space>}>
            {platform.heading != null ? `${platform.heading.toFixed(1)}°` : '--'}
          </Descriptions.Item>
          <Descriptions.Item label={<Space size={4}><EnvironmentOutlined style={{ fontSize: 12 }} /><span>位置</span><SourceDot source="engine" /></Space>}>
            <Text style={{ fontSize: 12, color: TEXT }}>
              {platform.lat.toFixed(4)}, {platform.lon.toFixed(4)}
            </Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Sensors */}
      <Card
        size="small"
        title={sectionLabel(
          <RadarChartOutlined style={{ color: '#1890ff' }} />,
          `传感器 (${sensorEntries.length})`,
          'engine',
        )}
        bordered={false}
        style={{ background: CARD_BG }}
        bodyStyle={{ padding: '4px 12px' }}
      >
        {sensorEntries.length === 0 ? (
          <Text style={{ color: TEXT_SEC, fontSize: 12 }}>无传感器数据</Text>
        ) : (
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            {sensorEntries.map((sensor) => (
              <div
                key={sensor.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  borderBottom: '1px solid #1f2937',
                }}
              >
                <Space size={8}>
                  {sensorTypeIcon(sensor.type)}
                  <Text strong style={{ color: TEXT, fontSize: 13 }}>{sensor.name}</Text>
                  <Tag style={{ background: '#1f2937', border: '1px solid #374151', color: '#9ca3af', fontSize: 11 }}>
                    {sensor.type || '未知'}
                  </Tag>
                </Space>
                <Badge
                  status={sensor.isOn ? 'success' : 'default'}
                  text={
                    <Text style={{ fontSize: 12, color: sensor.isOn ? '#52c41a' : '#6b7280' }}>
                      {sensor.isOn ? '开机' : '关机'}
                    </Text>
                  }
                />
              </div>
            ))}
          </Space>
        )}
      </Card>

      {/* Damage */}
      <Card
        size="small"
        title={sectionLabel(
          <WarningOutlined style={{ color: damagePct > 50 ? '#ff4d4f' : '#faad14' }} />,
          '损伤状态',
          'engine',
        )}
        bordered={false}
        style={{ background: CARD_BG }}
        bodyStyle={CARD_BODY}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: TEXT }}>损伤等级</Text>
            <Text style={{ color: damagePct >= 80 ? '#ff4d4f' : damagePct >= 40 ? '#faad14' : '#52c41a' }}>
              {damagePct}%
            </Text>
          </div>
          <Progress
            percent={damagePct}
            showInfo={false}
            strokeColor={damagePct >= 80 ? '#ff4d4f' : damagePct >= 40 ? '#faad14' : '#52c41a'}
            trailColor="#1f2937"
          />
          {platform.broken && (
            <div style={{ marginTop: 6 }}>
              <Tag icon={<CloseCircleOutlined />} color="error">平台已损毁</Tag>
            </div>
          )}
        </div>
      </Card>

      {/* Fuel */}
      {fuelEntries.length > 0 && (
        <Card
          size="small"
          title={sectionLabel(<FireOutlined style={{ color: '#faad14' }} />, `燃料 (${fuelEntries.length})`, 'engine')}
          bordered={false}
          style={{ background: CARD_BG }}
          bodyStyle={CARD_BODY}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {fuelEntries.map(([name, quantity]) => {
              const pct = quantity <= 1 ? quantity * 100 : Math.min(quantity, 100);
              return (
                <div key={name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text style={{ fontSize: 12, color: TEXT }}>{name}</Text>
                    <Text style={{ fontSize: 12, color: TEXT_SEC }}>{pct.toFixed(1)}%</Text>
                  </div>
                  <Progress
                    percent={Math.round(pct)}
                    size="small"
                    showInfo={false}
                    strokeColor={pct > 50 ? '#52c41a' : pct > 20 ? '#faad14' : '#ff4d4f'}
                    trailColor="#1f2937"
                  />
                </div>
              );
            })}
          </Space>
        </Card>
      )}
    </Space>
  );
}

/** 任务 Tab */
function MissionTab({ platform }: { platform: PlatformInfo }) {
  const mission = platform.mission;

  if (!mission) return <NoData />;

  const progressPct = Math.round((mission.progress ?? 0) * 100);

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card
        size="small"
        title={sectionLabel(<AimOutlined style={{ color: '#1890ff' }} />, '任务状态', 'engine')}
        bordered={false}
        style={{ background: CARD_BG }}
        bodyStyle={CARD_BODY}
      >
        <Descriptions
          size="small"
          column={2}
          labelStyle={{ color: TEXT_SEC, width: 100 }}
          contentStyle={{ color: TEXT }}
        >
          <Descriptions.Item label="任务类型">
            <Tag style={{ background: '#1f2937', border: '1px solid #374151', color: '#9ca3af' }}>
              {missionTypeLabel(mission.type)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="任务状态">
            <Tag color={
              mission.status === 'engaging' ? 'error' :
              mission.status === 'on_station' ? 'processing' :
              mission.status === 'rtb' ? 'warning' :
              mission.status === 'completed' ? 'success' :
              mission.status === 'aborted' ? 'default' : 'blue'
            }>
              {missionStatusLabel(mission.status)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="剩余航路点">
            <Text style={{ color: TEXT }}>{mission.waypointsRemaining}</Text>
          </Descriptions.Item>
          {mission.eta != null && (
            <Descriptions.Item label="预计到达">
              <Text style={{ color: TEXT }}>
                {mission.eta >= 3600
                  ? `${Math.floor(mission.eta / 3600)}h ${Math.floor((mission.eta % 3600) / 60)}m`
                  : mission.eta >= 60
                    ? `${Math.floor(mission.eta / 60)}m ${Math.round(mission.eta % 60)}s`
                    : `${Math.round(mission.eta)}s`}
              </Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card
        size="small"
        title={sectionLabel(<DashboardOutlined style={{ color: '#1890ff' }} />, '任务进度', 'engine')}
        bordered={false}
        style={{ background: CARD_BG }}
        bodyStyle={CARD_BODY}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ color: TEXT }}>完成度</Text>
          <Text style={{ color: '#1890ff' }}>{progressPct}%</Text>
        </div>
        <Progress
          percent={progressPct}
          showInfo={false}
          strokeColor="#1890ff"
          trailColor="#1f2937"
        />
      </Card>
    </Space>
  );
}

/** 作战 Tab */
function CombatTab({ platform }: { platform: PlatformInfo }) {
  const combat = platform.combat;

  if (!combat) return <NoData />;

  const es = engagementStateLabel(combat.engagementState);
  const ammoEntries = Object.entries(combat.ammoRemaining ?? {});

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card
        size="small"
        title={sectionLabel(<ThunderboltOutlined style={{ color: '#faad14' }} />, '作战状态', 'engine')}
        bordered={false}
        style={{ background: CARD_BG }}
        bodyStyle={CARD_BODY}
      >
        <Descriptions
          size="small"
          column={2}
          labelStyle={{ color: TEXT_SEC, width: 100 }}
          contentStyle={{ color: TEXT }}
        >
          <Descriptions.Item label="武器就绪">
            <Text style={{ color: TEXT }}>{combat.weaponsReady}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="武器消耗">
            <Text style={{ color: TEXT }}>{combat.weaponsExpended}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="交战状态" span={2}>
            <Tag color={es.color}>{es.label}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {ammoEntries.length > 0 && (
        <Card
          size="small"
          title={sectionLabel(<FireOutlined style={{ color: '#ff4d4f' }} />, '弹药状态', 'engine')}
          bordered={false}
          style={{ background: CARD_BG }}
          bodyStyle={{ padding: '4px 0' }}
        >
          <Table
            dataSource={ammoEntries.map(([name, count], i) => ({ key: i, name, count }))}
            columns={[
              { title: '弹药类型', dataIndex: 'name', key: 'name', render: (v: string) => <Text style={{ color: TEXT }}>{v}</Text> },
              { title: '剩余数量', dataIndex: 'count', key: 'count', align: 'right' as const, render: (v: number) => <Text style={{ color: v > 0 ? '#52c41a' : '#ff4d4f' }}>{v}</Text> },
            ]}
            size="small"
            pagination={false}
            style={{ background: 'transparent' }}
          />
        </Card>
      )}
    </Space>
  );
}

/** 通信 Tab */
function CommunicationsTab({ platform }: { platform: PlatformInfo }) {
  const comms = platform.communications;

  if (!comms) return <NoData />;

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card
        size="small"
        title={sectionLabel(<ApiOutlined style={{ color: '#1890ff' }} />, '数据链', 'engine')}
        bordered={false}
        style={{ background: CARD_BG }}
        bodyStyle={CARD_BODY}
      >
        <Descriptions
          size="small"
          column={2}
          labelStyle={{ color: TEXT_SEC, width: 100 }}
          contentStyle={{ color: TEXT }}
        >
          <Descriptions.Item label="连接状态">
            <Badge
              status={comms.datalink.connected ? 'success' : 'error'}
              text={
                <Text style={{ color: comms.datalink.connected ? '#52c41a' : '#ff4d4f' }}>
                  {comms.datalink.connected ? '已连接' : '断开'}
                </Text>
              }
            />
          </Descriptions.Item>
          <Descriptions.Item label="网络ID">
            <Text style={{ color: TEXT, fontFamily: 'monospace', fontSize: 12 }}>
              {comms.datalink.networkId}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="节点数" span={2}>
            <Text style={{ color: TEXT }}>{comms.datalink.nodes.length}</Text>
            {comms.datalink.nodes.length > 0 && (
              <Text style={{ color: TEXT_SEC, fontSize: 11, marginLeft: 8 }}>
                [{comms.datalink.nodes.map((n) => `#${n}`).join(', ')}]
              </Text>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        size="small"
        title={sectionLabel(<NodeIndexOutlined style={{ color: '#13c2c2' }} />, `无线电 (${comms.radio.length})`, 'engine')}
        bordered={false}
        style={{ background: CARD_BG }}
        bodyStyle={{ padding: '4px 0' }}
      >
        {comms.radio.length === 0 ? (
          <Text style={{ color: TEXT_SEC, fontSize: 12, padding: '8px 12px', display: 'block' }}>无无线电频道</Text>
        ) : (
          <Table
            dataSource={comms.radio.map((r, i) => ({ key: i, ...r }))}
            columns={[
              { title: '频道', dataIndex: 'channel', key: 'channel', render: (v: string) => <Text style={{ color: TEXT }}>{v}</Text> },
              { title: '频率', dataIndex: 'frequency', key: 'frequency', render: (v: number) => <Text style={{ color: TEXT, fontFamily: 'monospace', fontSize: 12 }}>{(v / 1000000).toFixed(3)} MHz</Text> },
              { title: '状态', dataIndex: 'active', key: 'active', render: (v: boolean) => <Badge status={v ? 'success' : 'default'} text={<Text style={{ color: v ? '#52c41a' : TEXT_SEC, fontSize: 12 }}>{v ? '活跃' : '静默'}</Text>} /> },
              { title: '加密', dataIndex: 'encrypted', key: 'encrypted', render: (v: boolean) => v ? <Tag color="green" style={{ fontSize: 11 }}>加密</Tag> : <Tag style={{ fontSize: 11 }}>明文</Tag> },
            ]}
            size="small"
            pagination={false}
            style={{ background: 'transparent' }}
          />
        )}
      </Card>
    </Space>
  );
}

/** AI Tab */
function AiTab({ platformIndex }: { platformIndex: number }) {
  const platformAi = useAiStore((s) => s.platformAi);
  const ai = platformAi.get(platformIndex) as PlatformAiState | undefined;

  if (!ai) return <NoData />;

  const oodaLabels: Record<string, string> = {
    observe: '观察', orient: '判断', decide: '决策', act: '行动',
  };

  const riskColors: Record<string, string> = {
    low: '#52c41a', medium: '#faad14', high: '#fa8c16', critical: '#ff4d4f',
  };

  const decisionLabels: Record<string, string> = {
    hold: '待命', engage: '交战', evade: '规避', rtb: '返航',
  };

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card
        size="small"
        title={sectionLabel(<EyeOutlined style={{ color: '#722ed1' }} />, 'OODA 状态', 'engine')}
        bordered={false}
        style={{ background: CARD_BG }}
        bodyStyle={CARD_BODY}
      >
        <Descriptions
          size="small"
          column={2}
          labelStyle={{ color: TEXT_SEC, width: 100 }}
          contentStyle={{ color: TEXT }}
        >
          <Descriptions.Item label="OODA 阶段">
            <Tag color="purple">{oodaLabels[ai.oodaPhase] ?? ai.oodaPhase}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="决策时间">
            <Text style={{ color: TEXT_SEC, fontSize: 12 }}>
              {new Date(ai.lastDecisionTime * 1000).toLocaleTimeString()}
            </Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        size="small"
        title={sectionLabel(<WarningOutlined style={{ color: riskColors[ai.riskLevel] ?? TEXT_SEC }} />, '威胁评估', 'engine')}
        bordered={false}
        style={{ background: CARD_BG }}
        bodyStyle={CARD_BODY}
      >
        <Descriptions
          size="small"
          column={2}
          labelStyle={{ color: TEXT_SEC, width: 100 }}
          contentStyle={{ color: TEXT }}
        >
          <Descriptions.Item label="威胁分数">
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ color: TEXT }}>{(ai.threatScore * 100).toFixed(0)}%</Text>
              </div>
              <Progress
                percent={Math.round(ai.threatScore * 100)}
                showInfo={false}
                strokeColor={riskColors[ai.riskLevel] ?? '#1890ff'}
                trailColor="#1f2937"
                size="small"
              />
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="风险等级">
            <Tag color={riskColors[ai.riskLevel] ?? 'default'}>
              {(ai.riskLevel ?? 'low').toUpperCase()}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="交战决策">
            <Tag style={{ background: '#1f2937', border: '1px solid #374151', color: '#9ca3af' }}>
              {decisionLabels[ai.engagementDecision] ?? ai.engagementDecision}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="行为模式">
            <Text style={{ color: TEXT }}>{ai.aiBehaviorMode}</Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );
}

/** 运维 Tab */
function OperationalTab({ platform }: { platform: PlatformInfo }) {
  const ops = platform.operational;

  if (!ops) return <NoData />;

  const rd = readinessLabel(ops.readiness);
  const ms = maintenanceLabel(ops.maintenanceState);

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card
        size="small"
        title={sectionLabel(<ToolOutlined style={{ color: '#1890ff' }} />, '运维状态', 'engine')}
        bordered={false}
        style={{ background: CARD_BG }}
        bodyStyle={CARD_BODY}
      >
        <Descriptions
          size="small"
          column={2}
          labelStyle={{ color: TEXT_SEC, width: 100 }}
          contentStyle={{ color: TEXT }}
        >
          <Descriptions.Item label="战备状态">
            <Tag color={rd.color}>{rd.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="维护状态">
            <Tag color={ms.color}>{ms.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="出动架次">
            <Text style={{ color: TEXT }}>{ops.sortieCount}</Text>
          </Descriptions.Item>
          {ops.flightHours != null && (
            <Descriptions.Item label="飞行小时">
              <Text style={{ color: TEXT }}>{ops.flightHours.toFixed(1)} h</Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>
    </Space>
  );
}

// ============ Main Component ============

export default function PlatformInfoPanel() {
  const platforms = usePlatformStore((s) => s.platforms);
  const selectedPlatformIndex = usePlatformStore((s) => s.selectedPlatformIndex);

  const selectedPlatform = useMemo(
    () => (selectedPlatformIndex !== null ? platforms[selectedPlatformIndex] : null),
    [platforms, selectedPlatformIndex],
  );

  if (!selectedPlatform) {
    return (
      <div
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          background: BG,
        }}
      >
        <Card
          size="small"
          bordered={false}
          style={{ background: CARD_BG, textAlign: 'center', padding: 40, width: '100%' }}
        >
          <Space direction="vertical" size={8}>
            <InfoCircleOutlined style={{ fontSize: 48, color: '#2a3a4a' }} />
            <Text style={{ color: TEXT_SEC }}>请选择一个平台以查看详情</Text>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: '100%',
        overflow: 'auto',
        background: BG,
      }}
    >
      {/* Header */}
      <Card
        size="small"
        bordered={false}
        style={{ background: CARD_BG }}
        bodyStyle={{ padding: '8px 12px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space size={8}>
            <RocketOutlined style={{ color: sideColor(selectedPlatform.side), fontSize: 16 }} />
            <Text strong style={{ color: TEXT, fontSize: 15 }}>
              {selectedPlatform.name || `平台-${selectedPlatform.index}`}
            </Text>
            <Tag color={sideColor(selectedPlatform.side)}>{sideLabel(selectedPlatform.side)}</Tag>
          </Space>
        </div>
      </Card>

      {/* Tabs */}
      <Card
        size="small"
        bordered={false}
        style={{ background: CARD_BG, flex: 1, overflow: 'hidden' }}
        bodyStyle={{ padding: '0 12px 12px 12px' }}
      >
        <Tabs
          defaultActiveKey="overview"
          size="small"
          style={{ color: TEXT }}
          items={[
            {
              key: 'overview',
              label: <Space size={4}><InfoCircleOutlined style={{ fontSize: 13 }} /><span>概览</span></Space>,
              children: <OverviewTab platform={selectedPlatform} />,
            },
            {
              key: 'mission',
              label: <Space size={4}><AimOutlined style={{ fontSize: 13 }} /><span>任务</span></Space>,
              children: <MissionTab platform={selectedPlatform} />,
            },
            {
              key: 'combat',
              label: <Space size={4}><ThunderboltOutlined style={{ fontSize: 13 }} /><span>作战</span></Space>,
              children: <CombatTab platform={selectedPlatform} />,
            },
            {
              key: 'comms',
              label: <Space size={4}><ApiOutlined style={{ fontSize: 13 }} /><span>通信</span></Space>,
              children: <CommunicationsTab platform={selectedPlatform} />,
            },
            {
              key: 'ai',
              label: <Space size={4}><EyeOutlined style={{ fontSize: 13 }} /><span>AI</span></Space>,
              children: <AiTab platformIndex={selectedPlatform.index} />,
            },
            {
              key: 'ops',
              label: <Space size={4}><ToolOutlined style={{ fontSize: 13 }} /><span>运维</span></Space>,
              children: <OperationalTab platform={selectedPlatform} />,
            },
          ]}
        />
      </Card>
    </div>
  );
}
