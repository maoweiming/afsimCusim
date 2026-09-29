import React, { useState, useEffect, useMemo } from 'react';
import {
  Form,
  InputNumber,
  Select,
  Typography,
  Space,
  Divider,
  Card,
  Slider,
  Button,
  Empty,
  Tooltip,
} from 'antd';
import {
  BgColorsOutlined,
  BorderOuterOutlined,
  AimOutlined,
  FontSizeOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useMapDataStore } from '../store/mapDataStore';
import type { LayerStyle, VectorLayer, MapDataSource } from '../types';

const { Text } = Typography;

// 预设颜色
const PRESET_COLORS = [
  '#ff4d4f', '#ff7a45', '#ffa940', '#ffc53d',
  '#ffec3d', '#bae637', '#73d13d', '#52c41a',
  '#36cfc9', '#13c2c2', '#1677ff', '#2f54eb',
  '#597ef7', '#9254de', '#b37feb', '#eb2f96',
  '#f759ab', '#ff85c0', '#d9d9d9', '#8c8c8c',
  '#595959', '#262626', '#000000', '#ffffff',
];

interface ColorFieldProps {
  label: string;
  value?: string;
  onChange: (val: string) => void;
}

const ColorField: React.FC<ColorFieldProps> = ({ label, value, onChange }) => {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <Form.Item label={label} style={{ marginBottom: 8 }}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <div
            onClick={() => setShowPicker(!showPicker)}
            style={{
              width: 28,
              height: 28,
              backgroundColor: value || 'transparent',
              border: '2px solid #444',
              borderRadius: 4,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            style={{
              flex: 1,
              backgroundColor: '#1f1f1f',
              border: '1px solid #303030',
              borderRadius: 4,
              color: '#d9d9d9',
              padding: '2px 8px',
              fontSize: 12,
              height: 28,
            }}
          />
        </div>
        {showPicker && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 2,
              padding: 4,
              backgroundColor: '#1f1f1f',
              borderRadius: 4,
              border: '1px solid #303030',
            }}
          >
            {PRESET_COLORS.map((c) => (
              <div
                key={c}
                onClick={() => {
                  onChange(c);
                  setShowPicker(false);
                }}
                style={{
                  width: 20,
                  height: 20,
                  backgroundColor: c,
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: value === c ? '2px solid #1677ff' : '1px solid #444',
                }}
              />
            ))}
          </div>
        )}
      </Space>
    </Form.Item>
  );
};

const LayerStyleEditor: React.FC = () => {
  const { dataSources, updateLayerStyle } = useMapDataStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localStyle, setLocalStyle] = useState<LayerStyle>({});

  const vectorSources = useMemo(
    () => dataSources.filter((d) => d.type === 'vector' || d.type === 'geojson'),
    [dataSources]
  );

  const selectedSource = useMemo(
    () => vectorSources.find((d) => d.id === selectedId) as (VectorLayer & MapDataSource) | undefined,
    [vectorSources, selectedId]
  );

  useEffect(() => {
    if (selectedSource) {
      setLocalStyle(selectedSource.style || {});
    }
  }, [selectedId, selectedSource]);

  const updateStyle = (key: keyof LayerStyle, value: any) => {
    const newStyle = { ...localStyle, [key]: value };
    setLocalStyle(newStyle);
    if (selectedId) {
      updateLayerStyle(selectedId, { [key]: value });
    }
  };

  const handleReset = () => {
    if (!selectedSource) return;
    const defaultStyle: LayerStyle = {
      fillColor: '#1677ff',
      fillOpacity: 0.3,
      strokeColor: '#1677ff',
      strokeWidth: 2,
      pointRadius: 6,
      labelField: undefined,
    };
    setLocalStyle(defaultStyle);
    if (selectedId) {
      updateLayerStyle(selectedId, defaultStyle);
    }
  };

  // 根据几何类型决定显示哪些控件
  const geomType = selectedSource?.geometryType;
  const showFill = geomType === 'polygon' || geomType === 'mixed';
  const showStroke = geomType === 'line' || geomType === 'polygon' || geomType === 'mixed';
  const showPoint = geomType === 'point' || geomType === 'mixed';

  return (
    <div style={{ padding: 12 }}>
      <Text strong style={{ color: '#fff', display: 'block', marginBottom: 12 }}>
        图层样式
      </Text>

      <Select
        placeholder="选择图层..."
        value={selectedId}
        onChange={setSelectedId}
        style={{ width: '100%', marginBottom: 12 }}
        size="small"
        options={vectorSources.map((s) => ({
          value: s.id,
          label: (
            <Space>
              <div
                style={{
                  width: 10,
                  height: 10,
                  backgroundColor: (s as VectorLayer).style?.fillColor || '#1677ff',
                  borderRadius: '50%',
                }}
              />
              {s.name}
            </Space>
          ),
        }))}
        showSearch
        filterOption={(input, option) =>
          (option?.label as any)?.props?.children?.[1]
            ?.toLowerCase()
            ?.includes(input.toLowerCase()) ?? false
        }
      />

      {selectedSource ? (
        <Card
          size="small"
          style={{ backgroundColor: '#1f1f1f', borderColor: '#303030' }}
          styles={{ body: { padding: 12 } }}
        >
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: '#aaa', fontSize: 12 }}>
              {selectedSource.name} ({selectedSource.geometryType})
            </Text>
            <Tooltip title="重置为默认">
              <Button
                type="text"
                size="small"
                icon={<UndoOutlined />}
                onClick={handleReset}
              />
            </Tooltip>
          </Space>

          {/* 填充 */}
          {showFill && (
            <>
              <Space size={4} style={{ marginBottom: 4 }}>
                <BgColorsOutlined style={{ color: '#888' }} />
                <Text style={{ color: '#888', fontSize: 12 }}>填充</Text>
              </Space>
              <ColorField
                label="颜色"
                value={localStyle.fillColor}
                onChange={(v) => updateStyle('fillColor', v)}
              />
              <Form.Item label="透明度" style={{ marginBottom: 8 }}>
                <Slider
                  min={0}
                  max={100}
                  value={Math.round((localStyle.fillOpacity ?? 0.3) * 100)}
                  onChange={(v) => updateStyle('fillOpacity', v / 100)}
                  tooltip={{ formatter: (v) => `${v}%` }}
                />
              </Form.Item>
              <Divider style={{ margin: '8px 0', borderColor: '#303030' }} />
            </>
          )}

          {/* 描边 */}
          {showStroke && (
            <>
              <Space size={4} style={{ marginBottom: 4 }}>
                <BorderOuterOutlined style={{ color: '#888' }} />
                <Text style={{ color: '#888', fontSize: 12 }}>描边</Text>
              </Space>
              <ColorField
                label="颜色"
                value={localStyle.strokeColor}
                onChange={(v) => updateStyle('strokeColor', v)}
              />
              <Form.Item label="宽度" style={{ marginBottom: 8 }}>
                <Slider
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={localStyle.strokeWidth ?? 2}
                  onChange={(v) => updateStyle('strokeWidth', v)}
                />
              </Form.Item>
              <Divider style={{ margin: '8px 0', borderColor: '#303030' }} />
            </>
          )}

          {/* 点样式 */}
          {showPoint && (
            <>
              <Space size={4} style={{ marginBottom: 4 }}>
                <AimOutlined style={{ color: '#888' }} />
                <Text style={{ color: '#888', fontSize: 12 }}>点样式</Text>
              </Space>
              <ColorField
                label="颜色"
                value={localStyle.fillColor}
                onChange={(v) => updateStyle('fillColor', v)}
              />
              <Form.Item label="半径" style={{ marginBottom: 8 }}>
                <Slider
                  min={2}
                  max={20}
                  value={localStyle.pointRadius ?? 6}
                  onChange={(v) => updateStyle('pointRadius', v)}
                />
              </Form.Item>
              <Divider style={{ margin: '8px 0', borderColor: '#303030' }} />
            </>
          )}

          {/* 标签 */}
          {selectedSource.fields && selectedSource.fields.length > 0 && (
            <>
              <Space size={4} style={{ marginBottom: 4 }}>
                <FontSizeOutlined style={{ color: '#888' }} />
                <Text style={{ color: '#888', fontSize: 12 }}>标签</Text>
              </Space>
              <Form.Item label="标签字段" style={{ marginBottom: 8 }}>
                <Select
                  value={localStyle.labelField}
                  onChange={(v) => updateStyle('labelField', v)}
                  allowClear
                  placeholder="不显示标签"
                  size="small"
                  options={selectedSource.fields.map((f) => ({
                    value: f,
                    label: f,
                  }))}
                />
              </Form.Item>
            </>
          )}

          {/* 实时预览 */}
          <Divider style={{ margin: '8px 0', borderColor: '#303030' }} />
          <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 6 }}>
            预览
          </Text>
          <StylePreview style={localStyle} geometryType={geomType || 'point'} />
        </Card>
      ) : (
        <Empty
          description="请选择一个矢量图层"
          style={{ color: '#888' }}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </div>
  );
};

// 样式预览组件
const StylePreview: React.FC<{ style: LayerStyle; geometryType: string }> = ({
  style,
  geometryType,
}) => {
  return (
    <div
      style={{
        height: 80,
        backgroundColor: '#141414',
        borderRadius: 4,
        border: '1px solid #303030',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 8,
      }}
    >
      {/* 点 */}
      {(geometryType === 'point' || geometryType === 'mixed') && (
        <svg width="30" height="30">
          <circle
            cx="15"
            cy="15"
            r={style.pointRadius ?? 6}
            fill={style.fillColor || '#1677ff'}
            stroke={style.strokeColor || '#fff'}
            strokeWidth={style.strokeWidth ?? 1}
          />
        </svg>
      )}
      {/* 线 */}
      {(geometryType === 'line' || geometryType === 'mixed') && (
        <svg width="50" height="30">
          <line
            x1="0"
            y1="15"
            x2="50"
            y2="15"
            stroke={style.strokeColor || '#1677ff'}
            strokeWidth={style.strokeWidth ?? 2}
          />
        </svg>
      )}
      {/* 面 */}
      {geometryType === 'polygon' && (
        <svg width="50" height="30">
          <rect
            x="2"
            y="2"
            width="46"
            height="26"
            fill={style.fillColor || '#1677ff'}
            fillOpacity={style.fillOpacity ?? 0.3}
            stroke={style.strokeColor || '#1677ff'}
            strokeWidth={style.strokeWidth ?? 2}
            rx="3"
          />
        </svg>
      )}
      {style.labelField && (
        <Text style={{ color: style.labelColor || '#d9d9d9', fontSize: 12 }}>
          {style.labelField}
        </Text>
      )}
    </div>
  );
};

export default LayerStyleEditor;
