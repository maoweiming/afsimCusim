import React from 'react';
import { Card, Radio, Typography, Tooltip, Badge } from 'antd';
import { GlobalOutlined, EnvironmentOutlined, BgColorsOutlined, PictureOutlined } from '@ant-design/icons';
import { useMapDataStore } from '../store/mapDataStore';
import type { ImagerySourceType, ImageryPreset } from '../types';

const { Text } = Typography;

const ICON_MAP: Record<ImagerySourceType, React.ReactNode> = {
  osm: <GlobalOutlined />,
  satellite: <PictureOutlined />,
  dark: <BgColorsOutlined />,
  terrain: <EnvironmentOutlined />,
  custom: <GlobalOutlined />,
};

const THUMBNAIL_COLORS: Record<ImagerySourceType, string> = {
  osm: '#4a90d9',
  satellite: '#1a3a2a',
  dark: '#1a1a2e',
  terrain: '#5d7a3a',
  custom: '#666',
};

const ImagerySelector: React.FC = () => {
  const { currentImagery, setImagery, imageryPresets, activeEngine } = useMapDataStore();

  const handleSelect = (type: ImagerySourceType) => {
    setImagery(type);

    // 同步到底图引擎
    if (activeEngine) {
      const sources = activeEngine.getImagerySources();
      const typeMap: Record<ImagerySourceType, string> = {
        osm: 'openstreetmap',
        satellite: 'tile',
        dark: 'tile',
        terrain: 'tile',
        custom: 'custom',
      };
      const match = sources.find(
        (s) => s.type === typeMap[type] || s.id === type
      );
      if (match) {
        activeEngine.setImagerySource(match);
      }
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <Text strong style={{ color: '#fff', display: 'block', marginBottom: 12 }}>
        底图选择
      </Text>
      <Radio.Group
        value={currentImagery}
        onChange={(e) => handleSelect(e.target.value)}
        style={{ width: '100%' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {imageryPresets.map((preset) => (
            <ImageryCard
              key={preset.id}
              preset={preset}
              selected={currentImagery === preset.type}
              onClick={() => handleSelect(preset.type)}
            />
          ))}
        </div>
      </Radio.Group>
    </div>
  );
};

interface ImageryCardProps {
  preset: ImageryPreset;
  selected: boolean;
  onClick: () => void;
}

const ImageryCard: React.FC<ImageryCardProps> = ({ preset, selected, onClick }) => {
  const bgColor = THUMBNAIL_COLORS[preset.type] || '#333';

  return (
    <Tooltip title={preset.attribution} placement="bottom">
      <Card
        hoverable
        size="small"
        onClick={preset.available ? onClick : undefined}
        style={{
          borderColor: selected ? '#1677ff' : '#303030',
          borderWidth: selected ? 2 : 1,
          backgroundColor: '#1f1f1f',
          opacity: preset.available ? 1 : 0.5,
          cursor: preset.available ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
        }}
        styles={{
          body: { padding: 8 },
        }}
      >
        {/* 缩略图占位 */}
        <div
          style={{
            width: '100%',
            height: 60,
            backgroundColor: bgColor,
            borderRadius: 4,
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            color: '#fff',
            position: 'relative',
          }}
        >
          {ICON_MAP[preset.type]}
          {selected && (
            <Badge
              count="✓"
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                backgroundColor: '#1677ff',
              }}
            />
          )}
          {!preset.available && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#999', fontSize: 11 }}>不可用</Text>
            </div>
          )}
        </div>
        <Text
          style={{
            color: selected ? '#1677ff' : '#d9d9d9',
            fontSize: 12,
            display: 'block',
            textAlign: 'center',
            fontWeight: selected ? 600 : 400,
          }}
        >
          {preset.name}
        </Text>
      </Card>
    </Tooltip>
  );
};

export default ImagerySelector;
