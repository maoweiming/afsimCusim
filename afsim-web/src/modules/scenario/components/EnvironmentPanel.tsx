/**
 * EnvironmentPanel - 想定环境/气象参数配置面板
 * 配置内容存储于 Scenario.environment，随想定一并保存/导出
 */
import React from 'react';
import { Select, InputNumber, Empty } from 'antd';
import { CloudOutlined } from '@ant-design/icons';
import { useScenarioEditorStore } from '../store/scenarioStore';
import type { EnvironmentConfig } from '../types';

const propLabelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: 'var(--text-muted)',
  marginBottom: 4,
};

const DEFAULT_ENVIRONMENT: EnvironmentConfig = {
  temperature: 15,
  windSpeedKnots: 10,
  windDirection: 270,
  visibilityMeters: 20000,
  precipitation: 'none',
  cloudCeilingMeters: 3000,
};

const PRECIPITATION_OPTIONS = [
  { value: 'none', label: '无降水' },
  { value: 'rain', label: '雨' },
  { value: 'snow', label: '雪' },
  { value: 'fog', label: '雾' },
];

export const EnvironmentPanel: React.FC = () => {
  const { currentScenario, updateScenarioField } = useScenarioEditorStore();

  if (!currentScenario) return null;

  const env = currentScenario.environment ?? DEFAULT_ENVIRONMENT;

  const handleChange = (field: keyof EnvironmentConfig, value: unknown) => {
    updateScenarioField('environment', { ...env, [field]: value });
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
        <CloudOutlined style={{ marginRight: 6 }} />
        环境/气象配置
      </div>

      {!currentScenario.environment && (
        <Empty
          description="尚未配置环境参数，以下为默认值"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ marginBottom: 12 }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={propLabelStyle}>气温 (°C)</div>
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={env.temperature}
              onChange={(v) => handleChange('temperature', v ?? 0)}
              min={-60}
              max={60}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={propLabelStyle}>云高 (m)</div>
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={env.cloudCeilingMeters}
              onChange={(v) => handleChange('cloudCeilingMeters', v ?? 0)}
              min={0}
              step={100}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={propLabelStyle}>风速 (kn)</div>
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={env.windSpeedKnots}
              onChange={(v) => handleChange('windSpeedKnots', v ?? 0)}
              min={0}
              max={200}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={propLabelStyle}>风向 (°)</div>
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={env.windDirection}
              onChange={(v) => handleChange('windDirection', v ?? 0)}
              min={0}
              max={359}
            />
          </div>
        </div>

        <div>
          <div style={propLabelStyle}>能见度 (m)</div>
          <InputNumber
            size="small"
            style={{ width: '100%' }}
            value={env.visibilityMeters}
            onChange={(v) => handleChange('visibilityMeters', v ?? 0)}
            min={0}
            step={500}
          />
        </div>

        <div>
          <div style={propLabelStyle}>降水</div>
          <Select
            size="small"
            style={{ width: '100%' }}
            value={env.precipitation}
            onChange={(v) => handleChange('precipitation', v)}
            options={PRECIPITATION_OPTIONS}
          />
        </div>
      </div>
    </div>
  );
};
