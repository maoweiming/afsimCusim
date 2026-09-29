/**
 * Map Engine Selector Component
 * Dropdown to switch between 2D/3D map engines
 */
import { Select, Space, Tag, Typography } from 'antd';
import {
  GlobalOutlined,
  HeatMapOutlined,
  BlockOutlined,
} from '@ant-design/icons';
import { useMapEngine } from './MapEngineContext';
import { EngineFactory } from './EngineFactory';
import type { MapEngineType } from './MapEngine';

const { Text } = Typography;

const engineIcons: Record<string, React.ReactNode> = {
  cesium: <GlobalOutlined />,
  leaflet: <HeatMapOutlined />,
  mapboxgl: <BlockOutlined />,
  openlayers: <HeatMapOutlined />,
};

const engineLabels: Record<string, string> = {
  cesium: 'CesiumJS 3D',
  leaflet: 'Leaflet 2D',
  mapboxgl: 'MapboxGL',
  openlayers: 'OpenLayers',
};

interface MapEngineSelectorProps {
  style?: React.CSSProperties;
  size?: 'small' | 'middle' | 'large';
}

export function MapEngineSelector({ style, size = 'small' }: MapEngineSelectorProps) {
  const { engineType, switchEngine } = useMapEngine();
  const engines = EngineFactory.getAvailableEngines();

  return (
    <Select
      value={engineType}
      onChange={(value) => switchEngine(value as MapEngineType)}
      size={size}
      style={{ width: 180, ...style }}
      options={engines.map((e) => ({
        value: e.id,
        label: (
          <Space size={6}>
            {engineIcons[e.id]}
            <span>{e.name}</span>
            <Tag color={e.dimension === '3d' ? 'blue' : 'green'} style={{ fontSize: 10 }}>
              {e.dimension.toUpperCase()}
            </Tag>
          </Space>
        ),
      }))}
    />
  );
}
