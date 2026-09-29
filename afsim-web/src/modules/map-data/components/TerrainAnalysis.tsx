import React, { useState, useMemo } from 'react';
import {
  Card,
  InputNumber,
  Typography,
  Space,
  Button,
  Tabs,
  Spin,
  Tag,
  Statistic,
  Divider,
  Alert,
  Row,
  Col,
  Empty,
} from 'antd';
import {
  EyeOutlined,
  LineChartOutlined,
  AimOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useMapDataStore } from '../store/mapDataStore';
import type { LOSRequest, TerrainProfileRequest, CoverageAnalysisRequest } from '../types';

const { Text } = Typography;

const TerrainAnalysis: React.FC = () => {
  const {
    computeLOS,
    getTerrainProfile,
    computeCoverage,
    clearAnalysisResults,
    losResult,
    terrainProfile,
    coverageResult,
    analyzing,
  } = useMapDataStore();

  // LOS 状态
  const [losFrom, setLosFrom] = useState({ lng: 121.5, lat: 25.0, alt: 100 });
  const [losTo, setLosTo] = useState({ lng: 121.8, lat: 25.2, alt: 500 });

  // 地形剖面状态
  const [profilePoints, setProfilePoints] = useState([
    { lng: 120.0, lat: 23.5 },
    { lng: 121.0, lat: 24.0 },
    { lng: 121.5, lat: 25.0 },
  ]);

  // 覆盖范围状态
  const [coverageCenter, setCoverageCenter] = useState({ lng: 121.5, lat: 25.0 });
  const [coverageRadius, setCoverageRadius] = useState(50000);
  const [coverageAlt, setCoverageAlt] = useState(1000);

  const handleLOS = () => {
    const request: LOSRequest = { from: losFrom, to: losTo };
    computeLOS(request);
  };

  const handleProfile = () => {
    const request: TerrainProfileRequest = { points: profilePoints, sampleCount: 100 };
    getTerrainProfile(request);
  };

  const handleCoverage = () => {
    const request: CoverageAnalysisRequest = {
      center: coverageCenter,
      radius: coverageRadius,
      altitude: coverageAlt,
    };
    computeCoverage(request);
  };

  return (
    <div style={{ padding: 12 }}>
      <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
        <Text strong style={{ color: '#fff' }}>
          地形分析
        </Text>
        <Button
          type="text"
          size="small"
          onClick={clearAnalysisResults}
          disabled={analyzing}
        >
          清除结果
        </Button>
      </Space>

      <Tabs
        size="small"
        items={[
          {
            key: 'los',
            label: (
              <span>
                <EyeOutlined /> 视线分析
              </span>
            ),
            children: (
              <LOSSection
                losFrom={losFrom}
                setLosFrom={setLosFrom}
                losTo={losTo}
                setLosTo={setLosTo}
                onAnalyze={handleLOS}
                result={losResult}
                analyzing={analyzing}
              />
            ),
          },
          {
            key: 'profile',
            label: (
              <span>
                <LineChartOutlined /> 地形剖面
              </span>
            ),
            children: (
              <ProfileSection
                points={profilePoints}
                setPoints={setProfilePoints}
                onAnalyze={handleProfile}
                profile={terrainProfile}
                analyzing={analyzing}
              />
            ),
          },
          {
            key: 'coverage',
            label: (
              <span>
                <AimOutlined /> 覆盖分析
              </span>
            ),
            children: (
              <CoverageSection
                center={coverageCenter}
                setCenter={setCoverageCenter}
                radius={coverageRadius}
                setRadius={setCoverageRadius}
                altitude={coverageAlt}
                setAltitude={setCoverageAlt}
                onAnalyze={handleCoverage}
                result={coverageResult}
                analyzing={analyzing}
              />
            ),
          },
        ]}
      />
    </div>
  );
};

// ============ 视线分析 ============

interface LOSSectionProps {
  losFrom: { lng: number; lat: number; alt: number };
  setLosFrom: (v: { lng: number; lat: number; alt: number }) => void;
  losTo: { lng: number; lat: number; alt: number };
  setLosTo: (v: { lng: number; lat: number; alt: number }) => void;
  onAnalyze: () => void;
  result: any;
  analyzing: boolean;
}

const LOSSection: React.FC<LOSSectionProps> = ({
  losFrom,
  setLosFrom,
  losTo,
  setLosTo,
  onAnalyze,
  result,
  analyzing,
}) => (
  <div>
    <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 8 }}>
      起点坐标
    </Text>
    <Space size={4} style={{ marginBottom: 8 }}>
      <CoordInput
        label="经度"
        value={losFrom.lng}
        onChange={(v) => setLosFrom({ ...losFrom, lng: v })}
        min={-180}
        max={180}
        step={0.01}
      />
      <CoordInput
        label="纬度"
        value={losFrom.lat}
        onChange={(v) => setLosFrom({ ...losFrom, lat: v })}
        min={-90}
        max={90}
        step={0.01}
      />
      <CoordInput
        label="高度(m)"
        value={losFrom.alt}
        onChange={(v) => setLosFrom({ ...losFrom, alt: v })}
        min={0}
        max={50000}
        step={10}
      />
    </Space>

    <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 8 }}>
      终点坐标
    </Text>
    <Space size={4} style={{ marginBottom: 12 }}>
      <CoordInput
        label="经度"
        value={losTo.lng}
        onChange={(v) => setLosTo({ ...losTo, lng: v })}
        min={-180}
        max={180}
        step={0.01}
      />
      <CoordInput
        label="纬度"
        value={losTo.lat}
        onChange={(v) => setLosTo({ ...losTo, lat: v })}
        min={-90}
        max={90}
        step={0.01}
      />
      <CoordInput
        label="高度(m)"
        value={losTo.alt}
        onChange={(v) => setLosTo({ ...losTo, alt: v })}
        min={0}
        max={50000}
        step={10}
      />
    </Space>

    <Button
      type="primary"
      icon={<ThunderboltOutlined />}
      onClick={onAnalyze}
      loading={analyzing}
      block
      size="small"
    >
      计算视线
    </Button>

    {result && (
      <div style={{ marginTop: 12 }}>
        <Alert
          type={result.hasLOS ? 'success' : 'warning'}
          showIcon
          icon={result.hasLOS ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          message={result.hasLOS ? '视线通畅' : '视线受阻'}
          description={
            result.obstructionPoint
              ? `遮挡点: (${result.obstructionPoint.lng.toFixed(3)}, ${result.obstructionPoint.lat.toFixed(3)}) 距离: ${result.obstructionDistance?.toFixed(0)}m`
              : '两点之间无遮挡'
          }
          style={{ marginBottom: 8 }}
        />
        {result.profile && <TerrainProfileChart profile={result.profile} />}
      </div>
    )}
  </div>
);

// ============ 地形剖面 ============

interface ProfileSectionProps {
  points: Array<{ lng: number; lat: number }>;
  setPoints: (v: Array<{ lng: number; lat: number }>) => void;
  onAnalyze: () => void;
  profile: any[] | null;
  analyzing: boolean;
}

const ProfileSection: React.FC<ProfileSectionProps> = ({
  points,
  setPoints,
  onAnalyze,
  profile,
  analyzing,
}) => (
  <div>
    <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 8 }}>
      路径点（至少2个）
    </Text>
    {points.map((p, i) => (
      <Space key={i} size={4} style={{ marginBottom: 4 }}>
        <Text style={{ color: '#666', fontSize: 11, width: 32 }}>P{i + 1}</Text>
        <CoordInput
          label="经度"
          value={p.lng}
          onChange={(v) => {
            const newPoints = [...points];
            newPoints[i] = { ...newPoints[i], lng: v };
            setPoints(newPoints);
          }}
          min={-180}
          max={180}
          step={0.1}
        />
        <CoordInput
          label="纬度"
          value={p.lat}
          onChange={(v) => {
            const newPoints = [...points];
            newPoints[i] = { ...newPoints[i], lat: v };
            setPoints(newPoints);
          }}
          min={-90}
          max={90}
          step={0.1}
        />
        {points.length > 2 && (
          <Button
            type="text"
            size="small"
            danger
            onClick={() => setPoints(points.filter((_, idx) => idx !== i))}
          >
            -
          </Button>
        )}
      </Space>
    ))}
    <Space style={{ marginBottom: 12 }}>
      <Button
        size="small"
        onClick={() => setPoints([...points, { lng: 122.0, lat: 25.5 }])}
      >
        + 添加点
      </Button>
    </Space>

    <Button
      type="primary"
      icon={<LineChartOutlined />}
      onClick={onAnalyze}
      loading={analyzing}
      block
      size="small"
    >
      生成剖面
    </Button>

    {profile && profile.length > 0 && (
      <div style={{ marginTop: 12 }}>
        <Statistic
          title="最高点"
          value={Math.max(...profile.map((p) => p.altitude)).toFixed(0)}
          suffix="m"
          valueStyle={{ fontSize: 14, color: '#52c41a' }}
        />
        <Statistic
          title="最低点"
          value={Math.min(...profile.map((p) => p.altitude)).toFixed(0)}
          suffix="m"
          valueStyle={{ fontSize: 14, color: '#ff4d4f' }}
        />
        <TerrainProfileChart
          profile={profile.map((p) => ({
            distance: p.distance,
            terrainHeight: p.altitude,
            losHeight: 0,
          }))}
        />
      </div>
    )}
  </div>
);

// ============ 覆盖分析 ============

interface CoverageSectionProps {
  center: { lng: number; lat: number };
  setCenter: (v: { lng: number; lat: number }) => void;
  radius: number;
  setRadius: (v: number) => void;
  altitude: number;
  setAltitude: (v: number) => void;
  onAnalyze: () => void;
  result: any;
  analyzing: boolean;
}

const CoverageSection: React.FC<CoverageSectionProps> = ({
  center,
  setCenter,
  radius,
  setRadius,
  altitude,
  setAltitude,
  onAnalyze,
  result,
  analyzing,
}) => (
  <div>
    <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 8 }}>
      中心点
    </Text>
    <Space size={4} style={{ marginBottom: 8 }}>
      <CoordInput
        label="经度"
        value={center.lng}
        onChange={(v) => setCenter({ ...center, lng: v })}
        min={-180}
        max={180}
        step={0.01}
      />
      <CoordInput
        label="纬度"
        value={center.lat}
        onChange={(v) => setCenter({ ...center, lat: v })}
        min={-90}
        max={90}
        step={0.01}
      />
    </Space>

    <Row gutter={8} style={{ marginBottom: 12 }}>
      <Col span={12}>
        <Text style={{ color: '#888', fontSize: 12 }}>半径 (m)</Text>
        <InputNumber
          value={radius}
          onChange={(v) => setRadius(v || 50000)}
          min={1000}
          max={500000}
          step={1000}
          size="small"
          style={{ width: '100%' }}
        />
      </Col>
      <Col span={12}>
        <Text style={{ color: '#888', fontSize: 12 }}>高度 (m)</Text>
        <InputNumber
          value={altitude}
          onChange={(v) => setAltitude(v || 1000)}
          min={0}
          max={50000}
          step={100}
          size="small"
          style={{ width: '100%' }}
        />
      </Col>
    </Row>

    <Button
      type="primary"
      icon={<AimOutlined />}
      onClick={onAnalyze}
      loading={analyzing}
      block
      size="small"
    >
      分析覆盖范围
    </Button>

    {result && (
      <div style={{ marginTop: 12 }}>
        <Card
          size="small"
          style={{ backgroundColor: '#1f1f1f', borderColor: '#303030' }}
        >
          <Statistic
            title="覆盖率"
            value={result.coveragePercent.toFixed(1)}
            suffix="%"
            valueStyle={{
              color: result.coveragePercent > 80 ? '#52c41a' : '#faad14',
              fontSize: 24,
            }}
            prefix={<AimOutlined />}
          />
        </Card>
      </div>
    )}
  </div>
);

// ============ 通用输入组件 ============

const CoordInput: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}> = ({ label, value, onChange, min, max, step }) => (
  <div>
    <Text style={{ color: '#666', fontSize: 10, display: 'block' }}>{label}</Text>
    <InputNumber
      value={value}
      onChange={(v) => onChange(v ?? 0)}
      min={min}
      max={max}
      step={step}
      size="small"
      style={{ width: 80 }}
      controls={false}
    />
  </div>
);

// ============ 地形剖面 SVG 图表 ============

const TerrainProfileChart: React.FC<{
  profile: Array<{ distance: number; terrainHeight: number; losHeight: number }>;
}> = ({ profile }) => {
  const { points, maxY, maxY2, scaleX, scaleY } = useMemo(() => {
    if (!profile.length)
      return { points: '', maxY: 0, maxY2: 0, scaleX: 1, scaleY: 1 };

    const maxDist = Math.max(...profile.map((p) => p.distance));
    const maxH = Math.max(
      ...profile.map((p) => Math.max(p.terrainHeight, p.losHeight))
    );
    const minH = Math.min(
      ...profile.map((p) => Math.min(p.terrainHeight, p.losHeight))
    );
    const rangeH = maxH - minH || 1;

    const w = 240;
    const h = 80;
    const sx = w / (maxDist || 1);
    const sy = h / rangeH;

    const terrainPoints = profile
      .map((p) => `${p.distance * sx},${h - (p.terrainHeight - minH) * sy}`)
      .join(' ');

    return { points: terrainPoints, maxY: maxH, maxY2: minH, scaleX: sx, scaleY: sy };
  }, [profile]);

  if (!profile.length) return null;

  const w = 240;
  const h = 80;

  // LOS 线
  const losPoints =
    profile[0].losHeight !== 0
      ? profile
          .map(
            (p) =>
              `${p.distance * scaleX},${h - (p.losHeight - maxY2) * scaleY}`
          )
          .join(' ')
      : '';

  return (
    <div style={{ marginTop: 8 }}>
      <svg
        width="100%"
        viewBox={`0 0 ${w + 10} ${h + 20}`}
        style={{ backgroundColor: '#141414', borderRadius: 4 }}
      >
        {/* 网格 */}
        {[0, 0.25, 0.5, 0.75, 1].map((r) => (
          <line
            key={`h-${r}`}
            x1={0}
            y1={h * r}
            x2={w}
            y2={h * r}
            stroke="#262626"
            strokeWidth={0.5}
          />
        ))}

        {/* 地形线 */}
        <polyline
          points={points}
          fill="none"
          stroke="#52c41a"
          strokeWidth={1.5}
        />

        {/* 地形填充 */}
        <polygon
          points={`0,${h} ${points} ${w},${h}`}
          fill="#52c41a"
          fillOpacity={0.15}
        />

        {/* LOS 线 */}
        {losPoints && (
          <polyline
            points={losPoints}
            fill="none"
            stroke="#ff4d4f"
            strokeWidth={1.5}
            strokeDasharray="4,2"
          />
        )}

        {/* 刻度 */}
        <text x={2} y={h + 12} fill="#666" fontSize={8}>
          {maxY2.toFixed(0)}m
        </text>
        <text x={w - 20} y={h + 12} fill="#666" fontSize={8}>
          {maxY.toFixed(0)}m
        </text>
      </svg>
      <div style={{ display: 'flex', gap: 12, marginTop: 4, justifyContent: 'center' }}>
        <Space size={4}>
          <div
            style={{
              width: 16,
              height: 2,
              backgroundColor: '#52c41a',
              borderRadius: 1,
            }}
          />
          <Text style={{ color: '#888', fontSize: 10 }}>地形</Text>
        </Space>
        {losPoints && (
          <Space size={4}>
            <div
              style={{
                width: 16,
                height: 2,
                backgroundColor: '#ff4d4f',
                borderRadius: 1,
                borderTop: '1px dashed #ff4d4f',
              }}
            />
            <Text style={{ color: '#888', fontSize: 10 }}>视线</Text>
          </Space>
        )}
      </div>
    </div>
  );
};

export default TerrainAnalysis;
