/**
 * EnvironmentPanel - 环境数据面板
 * 显示天气、海情、潮汐数据
 * 支持数据源选择和刷新
 */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import type { LngLat } from '../../../core/types/common';
import { Card, Space, Typography, Tag, Tooltip, Button, Empty, Spin, Segmented, Descriptions, Progress } from 'antd';
import {
  CloudOutlined,
  DashboardOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  CompassOutlined,
} from '@ant-design/icons';
import { useEnvironmentStore } from '../../../store/environmentStore';
import type { WeatherData, SeaStateData, TideData, TideTrend } from '../types/environment';

const { Text, Title } = Typography;

// ============ Constants ============

const WIND_DIRECTION_LABELS: string[] = [
  '北', '北北东', '东北', '东北东', '东', '东南东', '东南', '南南东',
  '南', '南南西', '西南', '西南西', '西', '西北西', '西北', '北北西',
];

function windDirectionToLabel(deg: number): string {
  const idx = Math.round(deg / 22.5) % 16;
  return WIND_DIRECTION_LABELS[idx];
}

const SEA_STATE_LABELS: Record<number, { label: string; color: string; description: string }> = {
  0: { label: '无浪', color: '#52c41a', description: '海面如镜' },
  1: { label: '微浪', color: '#52c41a', description: '波纹如鱼鳞' },
  2: { label: '小浪', color: '#73d13d', description: '短小波浪' },
  3: { label: '轻浪', color: '#95de64', description: '大波浪开始形成' },
  4: { label: '中浪', color: '#ffc53d', description: '较大波浪' },
  5: { label: '大浪', color: '#ffa940', description: '大波浪，白沫飞溅' },
  6: { label: '巨浪', color: '#ff7a45', description: '巨浪，白沫成片' },
  7: { label: '狂浪', color: '#ff4d4f', description: '狂浪，白沫翻滚' },
  8: { label: '狂涛', color: '#cf1322', description: '狂涛，海面翻滚' },
  9: { label: '怒涛', color: '#a8071a', description: '怒涛，空中满是水沫' },
};

const TIDE_TREND_LABELS: Record<TideTrend, { label: string; icon: string; color: string }> = {
  rising: { label: '涨潮', icon: '↑', color: '#1890ff' },
  falling: { label: '落潮', icon: '↓', color: '#faad14' },
  high: { label: '高潮', icon: '◉', color: '#52c41a' },
  low: { label: '低潮', icon: '◎', color: '#ff4d4f' },
  slack: { label: '平潮', icon: '—', color: '#8b949e' },
};

const WEATHER_CODE_ICONS: Record<string, { icon: string; label: string }> = {
  'CLR': { icon: '☀️', label: '晴' },
  'FEW': { icon: '🌤️', label: '少云' },
  'SCT': { icon: '⛅', label: '多云' },
  'BKN': { icon: '☁️', label: '阴' },
  'OVC': { icon: '☁️', label: '阴天' },
  'RA': { icon: '🌧️', label: '雨' },
  'SN': { icon: '❄️', label: '雪' },
  'FG': { icon: '🌫️', label: '雾' },
  'BR': { icon: '🌫️', label: '轻雾' },
  'TS': { icon: '⛈️', label: '雷暴' },
  'HZ': { icon: '🌫️', label: '霾' },
};

// ============ Sub-components ============

/** 风向罗盘 */
const WindCompass: React.FC<{ direction: number; speed: number; gust?: number; unit: string }> = ({
  direction, speed, gust, unit,
}) => (
  <div style={{ textAlign: 'center', padding: 8 }}>
    <div style={{
      width: 80, height: 80, borderRadius: '50%', border: '2px solid #30363d',
      position: 'relative', margin: '0 auto 8px',
    }}>
      {/* 方位标记 */}
      {['N', 'E', 'S', 'W'].map((d, i) => (
        <span key={d} style={{
          position: 'absolute', fontSize: 9, color: '#8b949e',
          top: d === 'N' ? 2 : d === 'S' ? undefined : '50%',
          bottom: d === 'S' ? 2 : undefined,
          left: d === 'W' ? 2 : d === 'E' ? undefined : '50%',
          right: d === 'E' ? 2 : undefined,
          transform: d === 'N' || d === 'S' ? 'translateX(-50%)' : 'translateY(-50%)',
        }}>{d}</span>
      ))}
      {/* 风向箭头 */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 2, height: 30, background: '#1890ff',
        transformOrigin: 'bottom center',
        transform: `translate(-50%, -100%) rotate(${direction}deg)`,
      }}>
        <div style={{
          position: 'absolute', top: -4, left: -4,
          width: 0, height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderBottom: '8px solid #1890ff',
        }} />
      </div>
    </div>
    <div>
      <Text style={{ color: '#e6edf3', fontSize: 16, fontWeight: 600 }}>
        {speed.toFixed(1)}
      </Text>
      <Text type="secondary" style={{ fontSize: 11 }}> {unit}</Text>
    </div>
    {gust !== undefined && (
      <Text type="secondary" style={{ fontSize: 10 }}>
        阵风 {gust.toFixed(1)} {unit}
      </Text>
    )}
    <div>
      <Text type="secondary" style={{ fontSize: 10 }}>
        {windDirectionToLabel(direction)} ({direction.toFixed(0)}°)
      </Text>
    </div>
  </div>
);

/** 天气卡片 */
const WeatherCard: React.FC<{ data: WeatherData }> = ({ data }) => {
  const codeInfo = data.weatherCode ? WEATHER_CODE_ICONS[data.weatherCode] : null;

  return (
    <Card
      size="small"
      title={
        <Space>
          <CloudOutlined style={{ color: '#4fc3f7' }} />
          <Text style={{ color: '#e6edf3', fontSize: 13 }}>天气</Text>
          {codeInfo && <Tag style={{ fontSize: 11 }}>{codeInfo.icon} {codeInfo.label}</Tag>}
        </Space>
      }
      style={{ background: '#111820', borderColor: '#30363d' }}
      styles={{ header: { background: '#161b22', borderColor: '#30363d', minHeight: 36, padding: '4px 12px' }, body: { padding: 8 } }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        <WindCompass
          direction={data.wind.direction}
          speed={data.wind.speed}
          gust={data.wind.gust}
          unit={data.wind.unit}
        />
        <div style={{ flex: 1 }}>
          <Descriptions
            column={1}
            size="small"
            labelStyle={{ color: '#8b949e', fontSize: 11, padding: '2px 0', width: 60 }}
            contentStyle={{ color: '#e6edf3', fontSize: 11, padding: '2px 0' }}
          >
            <Descriptions.Item label="气温">
              <Text style={{ color: '#e6edf3', fontSize: 14, fontWeight: 600 }}>
                {data.temperature.air.toFixed(1)}°C
              </Text>
              {data.temperature.feelsLike !== undefined && (
                <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>
                  体感 {data.temperature.feelsLike.toFixed(1)}°C
                </Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="气压">
              {data.pressure.seaLevel.toFixed(1)} hPa
            </Descriptions.Item>
            <Descriptions.Item label="能见度">
              {data.visibility >= 10000 ? '>10km' : `${(data.visibility / 1000).toFixed(1)}km`}
            </Descriptions.Item>
            <Descriptions.Item label="湿度">
              {data.humidity}%
            </Descriptions.Item>
            {data.temperature.dewPoint !== undefined && (
              <Descriptions.Item label="露点">
                {data.temperature.dewPoint.toFixed(1)}°C
              </Descriptions.Item>
            )}
          </Descriptions>
        </div>
      </div>
      {data.precipitation.type !== 'none' && (
        <Tag color="blue" style={{ marginTop: 4, fontSize: 10 }}>
          {data.precipitation.type} {data.precipitation.rateMmH ? `${data.precipitation.rateMmH.toFixed(1)}mm/h` : ''}
        </Tag>
      )}
      {data.stationName && (
        <Text type="secondary" style={{ fontSize: 9, display: 'block', marginTop: 4 }}>
          {data.stationName} ({data.stationId})
        </Text>
      )}
    </Card>
  );
};

/** 海情卡片 */
const SeaStateCard: React.FC<{ data: SeaStateData }> = ({ data }) => {
  const stateInfo = SEA_STATE_LABELS[data.seaState] ?? { label: `等级${data.seaState}`, color: '#8b949e', description: '' };

  return (
    <Card
      size="small"
      title={
        <Space>
          <EnvironmentOutlined style={{ color: '#26a69a' }} />
          <Text style={{ color: '#e6edf3', fontSize: 13 }}>海情</Text>
          <Tag color={stateInfo.color} style={{ fontSize: 10 }}>
            {stateInfo.label}
          </Tag>
        </Space>
      }
      style={{ background: '#111820', borderColor: '#30363d' }}
      styles={{ header: { background: '#161b22', borderColor: '#30363d', minHeight: 36, padding: '4px 12px' }, body: { padding: 8 } }}
    >
      <Descriptions
        column={2}
        size="small"
        labelStyle={{ color: '#8b949e', fontSize: 11, padding: '2px 4px' }}
        contentStyle={{ color: '#e6edf3', fontSize: 11, padding: '2px 4px' }}
      >
        <Descriptions.Item label="有效浪高">
          <Text style={{ color: '#e6edf3', fontSize: 14, fontWeight: 600 }}>
            {data.wave.significantHeight.toFixed(1)}m
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="浪向">
          {windDirectionToLabel(data.wave.direction)} ({data.wave.direction.toFixed(0)}°)
        </Descriptions.Item>
        <Descriptions.Item label="周期">
          {data.wave.period.toFixed(1)}s
        </Descriptions.Item>
        <Descriptions.Item label="海温">
          {data.seaSurfaceTemperature.toFixed(1)}°C
        </Descriptions.Item>
        {data.swell.height > 0 && (
          <>
            <Descriptions.Item label="涌浪高">
              {data.swell.height.toFixed(1)}m
            </Descriptions.Item>
            <Descriptions.Item label="涌浪向">
              {windDirectionToLabel(data.swell.direction)}
            </Descriptions.Item>
          </>
        )}
        <Descriptions.Item label="海流">
          {data.current.speed.toFixed(1)} {data.current.unit}
        </Descriptions.Item>
        <Descriptions.Item label="流向">
          {windDirectionToLabel(data.current.direction)}
        </Descriptions.Item>
      </Descriptions>
      {data.iceCondition && data.iceCondition !== 'none' && (
        <Tag color="cyan" style={{ marginTop: 4, fontSize: 10 }}>
          冰况: {data.iceCondition}
        </Tag>
      )}
    </Card>
  );
};

/** 潮汐卡片 */
const TideCard: React.FC<{ data: TideData }> = ({ data }) => {
  const trendInfo = TIDE_TREND_LABELS[data.trend];

  // 计算下一高低潮
  const nextEvent = data.predictions
    .filter((p) => p.time > Date.now() / 1000)
    .sort((a, b) => a.time - b.time)[0];

  return (
    <Card
      size="small"
      title={
        <Space>
          <DashboardOutlined style={{ color: '#1890ff' }} />
          <Text style={{ color: '#e6edf3', fontSize: 13 }}>潮汐</Text>
          <Tag color={trendInfo.color} style={{ fontSize: 10 }}>
            {trendInfo.icon} {trendInfo.label}
          </Tag>
        </Space>
      }
      style={{ background: '#111820', borderColor: '#30363d' }}
      styles={{ header: { background: '#161b22', borderColor: '#30363d', minHeight: 36, padding: '4px 12px' }, body: { padding: 8 } }}
    >
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <Text style={{ color: '#e6edf3', fontSize: 24, fontWeight: 600 }}>
          {data.level.toFixed(2)}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}> m</Text>
      </div>

      <Descriptions
        column={1}
        size="small"
        labelStyle={{ color: '#8b949e', fontSize: 11, padding: '2px 4px', width: 70 }}
        contentStyle={{ color: '#e6edf3', fontSize: 11, padding: '2px 4px' }}
      >
        <Descriptions.Item label="基准面">
          {data.datum}
        </Descriptions.Item>
        <Descriptions.Item label="站点">
          {data.stationName}
        </Descriptions.Item>
        {data.current && (
          <Descriptions.Item label="潮流">
            {data.current.type === 'flood' ? '涨潮流' : data.current.type === 'ebb' ? '落潮流' : '平潮流'}
            {' '}{data.current.speed.toFixed(1)} kn
          </Descriptions.Item>
        )}
      </Descriptions>

      {nextEvent && (
        <div style={{ marginTop: 4, padding: '4px 8px', background: '#161b22', borderRadius: 4 }}>
          <Text type="secondary" style={{ fontSize: 10 }}>
            下一{nextEvent.type === 'high' ? '高潮' : '低潮'}:
          </Text>
          <Text style={{ color: '#e6edf3', fontSize: 11, marginLeft: 4 }}>
            {new Date(nextEvent.time * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            {' '}{nextEvent.level.toFixed(2)}m
          </Text>
        </div>
      )}

      {/* 24h 预测简图 */}
      {data.predictions.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 9 }}>24h预测</Text>
          <div style={{ display: 'flex', gap: 2, marginTop: 2, alignItems: 'flex-end', height: 30 }}>
            {data.predictions.slice(0, 8).map((p, i) => {
              const maxLevel = Math.max(...data.predictions.map((pp) => Math.abs(pp.level)));
              const heightPct = maxLevel > 0 ? (Math.abs(p.level) / maxLevel) * 100 : 50;
              return (
                <Tooltip key={i} title={`${new Date(p.time * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} ${p.level.toFixed(2)}m`}>
                  <div style={{
                    flex: 1,
                    height: `${Math.max(heightPct, 10)}%`,
                    background: p.type === 'high' ? '#1890ff' : '#faad14',
                    borderRadius: 2,
                    minHeight: 4,
                  }} />
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};

// ============ Main Component ============

type PanelTab = 'weather' | 'sea' | 'tide';

interface EnvironmentPanelProps {
  /** 当前地图中心点 */
  center?: LngLat;
  /** 自动加载模拟数据 */
  autoLoadMock?: boolean;
}

export const EnvironmentPanel: React.FC<EnvironmentPanelProps> = ({
  center,
  autoLoadMock = true,
}) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('weather');
  const [loading, setLoading] = useState(false);

  const getAllWeather = useEnvironmentStore((s) => s.getAllWeather);
  const getAllSeaState = useEnvironmentStore((s) => s.getAllSeaState);
  const getAllTides = useEnvironmentStore((s) => s.getAllTides);
  const getWeatherAt = useEnvironmentStore((s) => s.getWeatherAt);
  const getSeaStateAt = useEnvironmentStore((s) => s.getSeaStateAt);
  const getTideAt = useEnvironmentStore((s) => s.getTideAt);
  const setWeather = useEnvironmentStore((s) => s.setWeather);
  const setSeaState = useEnvironmentStore((s) => s.setSeaState);
  const setTides = useEnvironmentStore((s) => s.setTides);
  const weatherCount = useEnvironmentStore((s) => s.weather.size);
  const seaStateCount = useEnvironmentStore((s) => s.seaState.size);
  const tideCount = useEnvironmentStore((s) => s.tides.size);

  // 加载模拟数据 (开发用)
  useEffect(() => {
    if (!autoLoadMock) return;
    if (weatherCount > 0) return; // 已有数据

    const now = Date.now() / 1000;

    // 模拟天气数据
    setWeather([
      {
        stationId: 'ZBAA',
        stationName: '北京首都',
        position: { lng: 116.59, lat: 40.08 },
        timestamp: now,
        wind: { speed: 5.2, direction: 315, gust: 8.1, unit: 'm/s' },
        temperature: { air: 18.5, dewPoint: 12.3, feelsLike: 17.0, unit: 'C' },
        pressure: { seaLevel: 1013.2, unit: 'hPa' },
        visibility: 8000,
        precipitation: { type: 'none' },
        cloudCover: { total: 0.4, layers: [{ altitude: 2000, type: 'cumulus', coverage: 0.4 }] },
        humidity: 65,
        weatherCode: 'FEW',
        source: 'mock',
      },
      {
        stationId: 'ZSSS',
        stationName: '上海虹桥',
        position: { lng: 121.34, lat: 31.17 },
        timestamp: now,
        wind: { speed: 3.8, direction: 135, unit: 'm/s' },
        temperature: { air: 22.1, dewPoint: 18.5, feelsLike: 23.0, unit: 'C' },
        pressure: { seaLevel: 1010.5, unit: 'hPa' },
        visibility: 6000,
        precipitation: { type: 'rain', rateMmH: 2.5 },
        cloudCover: { total: 0.8, layers: [{ altitude: 1500, type: 'nimbostratus', coverage: 0.8 }] },
        humidity: 82,
        weatherCode: 'RA',
        source: 'mock',
      },
      {
        stationId: 'ZGGG',
        stationName: '广州白云',
        position: { lng: 113.27, lat: 23.13 },
        timestamp: now,
        wind: { speed: 4.1, direction: 200, unit: 'm/s' },
        temperature: { air: 28.3, dewPoint: 24.1, unit: 'C' },
        pressure: { seaLevel: 1008.2, unit: 'hPa' },
        visibility: 10000,
        precipitation: { type: 'none' },
        cloudCover: { total: 0.3, layers: [{ altitude: 3000, type: 'cumulus', coverage: 0.3 }] },
        humidity: 78,
        weatherCode: 'SCT',
        source: 'mock',
      },
    ]);

    // 模拟海情数据
    setSeaState([
      {
        position: { lng: 122.0, lat: 30.0 },
        timestamp: now,
        wave: { significantHeight: 1.2, maxHeight: 2.0, direction: 180, period: 6.5, unit: 'm' },
        swell: { height: 0.8, direction: 190, period: 8.0 },
        current: { speed: 1.5, direction: 90, unit: 'knots' },
        seaSurfaceTemperature: 20.5,
        seaState: 3,
        source: 'mock',
      },
      {
        position: { lng: 118.0, lat: 24.0 },
        timestamp: now,
        wave: { significantHeight: 2.5, maxHeight: 4.0, direction: 220, period: 8.0, unit: 'm' },
        swell: { height: 1.8, direction: 230, period: 10.0 },
        current: { speed: 2.0, direction: 180, unit: 'knots' },
        seaSurfaceTemperature: 26.8,
        seaState: 5,
        source: 'mock',
      },
    ]);

    // 模拟潮汐数据
    setTides([
      {
        stationId: 'SHPG',
        stationName: '上海吴淞',
        position: { lng: 121.50, lat: 31.38 },
        timestamp: now,
        level: 2.35,
        trend: 'rising',
        predictions: [
          { time: now + 3600 * 2, level: 3.8, type: 'high' },
          { time: now + 3600 * 8, level: 0.5, type: 'low' },
          { time: now + 3600 * 14, level: 4.1, type: 'high' },
          { time: now + 3600 * 20, level: 0.3, type: 'low' },
        ],
        datum: 'MSL',
        source: 'mock',
      },
      {
        stationId: 'HKG',
        stationName: '香港维多利亚',
        position: { lng: 114.17, lat: 22.28 },
        timestamp: now,
        level: 1.12,
        trend: 'falling',
        predictions: [
          { time: now + 3600 * 1, level: 0.4, type: 'low' },
          { time: now + 3600 * 6, level: 2.3, type: 'high' },
          { time: now + 3600 * 12, level: 0.2, type: 'low' },
          { time: now + 3600 * 18, level: 2.5, type: 'high' },
        ],
        datum: 'MLLW',
        source: 'mock',
      },
    ]);
  }, [autoLoadMock, weatherCount, setWeather, setSeaState, setTides]);

  // 按当前视口/中心点过滤数据
  const weatherData = useMemo(() => {
    if (center) {
      const nearest = getWeatherAt(center);
      return nearest ? [nearest] : [];
    }
    return getAllWeather();
  }, [center, getWeatherAt, getAllWeather, weatherCount]);

  const seaData = useMemo(() => {
    if (center) {
      const nearest = getSeaStateAt(center);
      return nearest ? [nearest] : [];
    }
    return getAllSeaState();
  }, [center, getSeaStateAt, getAllSeaState, seaStateCount]);

  const tideData = useMemo(() => {
    if (center) {
      const nearest = getTideAt(center);
      return nearest ? [nearest] : [];
    }
    return getAllTides();
  }, [center, getTideAt, getAllTides, tideCount]);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    // 实际使用时会调用适配器刷新
    setTimeout(() => setLoading(false), 500);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '6px 12px', borderBottom: '1px solid #30363d',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Space size={8}>
          <Text strong style={{ color: '#e0e0e0', fontSize: 13 }}>环境数据</Text>
          <Segmented
            size="small"
            value={activeTab}
            onChange={(v) => setActiveTab(v as PanelTab)}
            options={[
              { label: '天气', value: 'weather', icon: <CloudOutlined /> },
              { label: '海情', value: 'sea', icon: <EnvironmentOutlined /> },
              { label: '潮汐', value: 'tide', icon: <DashboardOutlined /> },
            ]}
          />
        </Space>
        <Tooltip title="刷新数据">
          <Button
            type="text" size="small" icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
            style={{ color: '#8b949e' }}
          />
        </Tooltip>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        <Spin spinning={loading}>
          {activeTab === 'weather' && (
            weatherData.length === 0 ? (
              <Empty description="暂无天气数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {weatherData.map((w) => (
                  <WeatherCard key={w.stationId} data={w} />
                ))}
              </Space>
            )
          )}

          {activeTab === 'sea' && (
            seaData.length === 0 ? (
              <Empty description="暂无海情数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {seaData.map((s, i) => (
                  <SeaStateCard key={`sea-${i}`} data={s} />
                ))}
              </Space>
            )
          )}

          {activeTab === 'tide' && (
            tideData.length === 0 ? (
              <Empty description="暂无潮汐数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {tideData.map((t) => (
                  <TideCard key={t.stationId} data={t} />
                ))}
              </Space>
            )
          )}
        </Spin>
      </div>

      {/* Footer stats */}
      <div style={{
        padding: '4px 12px', borderTop: '1px solid #30363d',
        display: 'flex', gap: 12, fontSize: 10, color: '#484f58',
      }}>
        <span>天气: {weatherCount}</span>
        <span>海情: {seaStateCount}</span>
        <span>潮汐: {tideCount}</span>
      </div>
    </div>
  );
};

export default EnvironmentPanel;
