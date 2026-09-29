/**
 * 区域编辑器
 * 绘制圆形/多边形区域，设置区域类型和样式
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Input,
  InputNumber,
  Button,
  Space,
  Tag,
  Divider,
  Select,
  Empty,
} from 'antd';
import {
  EnvironmentOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { useScenarioEditorStore } from '../store/scenarioStore';
import type { ZoneDefinition, ZoneGeometry } from '../types';
import type { MapEngine, LngLatAlt } from '../../../core/map-engine/MapEngine';

// ============ 区域类型配置 ============

const ZONE_TYPES: Array<{
  value: ZoneDefinition['type'];
  label: string;
  color: string;
  description: string;
}> = [
  {
    value: 'exclusion',
    label: '排除区',
    color: '#d72828',
    description: '禁止进入的区域',
  },
  {
    value: 'inclusion',
    label: '包含区',
    color: '#0078d7',
    description: '关注的重点区域',
  },
  {
    value: 'threat',
    label: '威胁区',
    color: '#d97706',
    description: '存在威胁的区域',
  },
  {
    value: 'safe',
    label: '安全区',
    color: '#28b43c',
    description: '安全/保护区域',
  },
];

interface ZoneEditorProps {
  geometryType?: 'circle' | 'polygon';
  mapEngine?: MapEngine | null;
}

export const ZoneEditor: React.FC<ZoneEditorProps> = ({
  geometryType = 'circle',
  mapEngine,
}) => {
  const {
    currentScenario,
    addZone,
    updateZone,
    removeZone,
    selectedZoneId,
    selectZone,
  } = useScenarioEditorStore();

  const [editMode, setEditMode] = useState<'list' | 'create' | 'edit'>('list');
  const [zoneName, setZoneName] = useState('');
  const [zoneType, setZoneType] = useState<ZoneDefinition['type']>('exclusion');
  const [geometry, setGeometry] = useState<ZoneGeometry>(
    geometryType === 'circle'
      ? { type: 'circle', center: { lng: 120.5, lat: 25.0 }, radius: 50000 }
      : { type: 'polygon', vertices: [] }
  );
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const zones = currentScenario?.zones || [];

  // 开始创建
  const startCreate = useCallback(() => {
    setEditMode('create');
    setZoneName(`区域 ${zones.length + 1}`);
    setZoneType(geometryType === 'circle' ? 'threat' : 'exclusion');
    setGeometry(
      geometryType === 'circle'
        ? { type: 'circle', center: { lng: 120.5, lat: 25.0 }, radius: 50000 }
        : { type: 'polygon', vertices: [] }
    );
    setEditingZoneId(null);
  }, [zones.length, geometryType]);

  // 在地图上绘制区域
  const handleMapDraw = useCallback(() => {
    if (!mapEngine) return;
    setIsDrawing(true);
    mapEngine.startDraw(geometryType === 'circle' ? 'circle' : 'polygon');
  }, [mapEngine, geometryType]);

  // 监听绘图完成事件
  useEffect(() => {
    if (!mapEngine || editMode === 'list') return;

    const cleanup = mapEngine.onDraw((event) => {
      if (event.type === 'circle' && event.positions.length >= 1 && event.properties?.radius) {
        const pos = event.positions[0];
        setGeometry({
          type: 'circle',
          center: { lng: pos.lng, lat: pos.lat },
          radius: event.properties.radius,
        });
        setIsDrawing(false);
      } else if (event.type === 'polygon' && event.positions.length >= 3) {
        setGeometry({
          type: 'polygon',
          vertices: event.positions.map((pos: LngLatAlt) => ({
            lng: pos.lng,
            lat: pos.lat,
          })),
        });
        setIsDrawing(false);
      }
    });

    return cleanup;
  }, [mapEngine, editMode]);

  // 开始编辑
  const startEdit = useCallback(
    (zone: ZoneDefinition) => {
      setEditMode('edit');
      setZoneName(zone.name);
      setZoneType(zone.type);
      setGeometry({ ...zone.geometry });
      setEditingZoneId(zone.id);
      selectZone(zone.id);
    },
    [selectZone]
  );

  // 取消
  const cancelEdit = useCallback(() => {
    setEditMode('list');
    setEditingZoneId(null);
  }, []);

  // 保存
  const handleSave = useCallback(() => {
    if (editingZoneId) {
      updateZone(editingZoneId, {
        name: zoneName,
        type: zoneType,
        geometry,
        fillColor: getZoneColor(zoneType, 'fill'),
        strokeColor: getZoneColor(zoneType, 'stroke'),
      });
    } else {
      const zone: ZoneDefinition = {
        id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: zoneName,
        type: zoneType,
        geometry,
        fillColor: getZoneColor(zoneType, 'fill'),
        strokeColor: getZoneColor(zoneType, 'stroke'),
      };
      addZone(zone);

      // 在地图上绘制区域
      if (mapEngine) {
        if (geometry.type === 'circle') {
          mapEngine.addEntity({
            id: zone.id,
            type: 'point',
            position: { ...geometry.center, alt: 0 },
            style: {
              fillColor: getZoneColor(zoneType, 'fill'),
              fillOpacity: 0.2,
              outlineColor: getZoneColor(zoneType, 'stroke'),
              outlineWidth: 2,
            },
            properties: { radius: geometry.radius },
          });
        } else if (geometry.type === 'polygon' && geometry.vertices.length >= 3) {
          mapEngine.addEntity({
            id: zone.id,
            type: 'polygon',
            positions: geometry.vertices.map((v) => ({ ...v, alt: 0 })),
            style: {
              fillColor: getZoneColor(zoneType, 'fill'),
              fillOpacity: 0.2,
              outlineColor: getZoneColor(zoneType, 'stroke'),
              outlineWidth: 2,
            },
          });
        }
      }
    }

    setEditMode('list');
    setEditingZoneId(null);
  }, [editingZoneId, zoneName, zoneType, geometry, updateZone, addZone, mapEngine]);

  // 删除
  const handleDelete = useCallback(
    (id: string) => {
      removeZone(id);
      if (editingZoneId === id) cancelEdit();
    },
    [removeZone, editingZoneId, cancelEdit]
  );

  // 添加多边形顶点
  const addVertex = useCallback(() => {
    if (geometry.type !== 'polygon') return;
    const last = geometry.vertices[geometry.vertices.length - 1];
    setGeometry({
      ...geometry,
      vertices: [
        ...geometry.vertices,
        {
          lng: (last?.lng ?? 120) + 0.2,
          lat: (last?.lat ?? 25) - 0.1,
        },
      ],
    });
  }, [geometry]);

  // 删除多边形顶点
  const removeVertex = useCallback(
    (index: number) => {
      if (geometry.type !== 'polygon') return;
      setGeometry({
        ...geometry,
        vertices: geometry.vertices.filter((_, i) => i !== index),
      });
    },
    [geometry]
  );

  // 更新多边形顶点
  const updateVertex = useCallback(
    (index: number, updates: { lng?: number; lat?: number }) => {
      if (geometry.type !== 'polygon') return;
      setGeometry({
        ...geometry,
        vertices: geometry.vertices.map((v, i) =>
          i === index ? { ...v, ...updates } : v
        ),
      });
    },
    [geometry]
  );

  // ============ 列表视图 ============

  if (editMode === 'list') {
    return (
      <Card
        size="small"
        title={
          <Space>
            <EnvironmentOutlined />
            <span style={{ fontSize: 13 }}>
              区域编辑 ({geometryType === 'circle' ? '圆形' : '多边形'})
            </span>
          </Space>
        }
        style={{
          width: 300,
          background: '#111820',
          border: '1px solid #2a3a4a',
        }}
        styles={{
          header: { background: '#1a2233', padding: '8px 12px' },
          body: { padding: '12px' },
        }}
        extra={
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={startCreate}
          >
            新建
          </Button>
        }
      >
        {zones.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无区域"
            style={{ margin: '16px 0' }}
          >
            <Button size="small" type="primary" onClick={startCreate}>
              创建第一个区域
            </Button>
          </Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {zones.map((zone) => {
              const typeConfig = ZONE_TYPES.find((t) => t.value === zone.type);
              return (
                <div
                  key={zone.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    background:
                      selectedZoneId === zone.id ? '#1e2a3a' : '#0d1117',
                    borderRadius: 4,
                    border:
                      selectedZoneId === zone.id
                        ? `1px solid ${typeConfig?.color || '#0078d7'}`
                        : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => selectZone(zone.id)}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        background: typeConfig?.color || '#8899aa',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#e0e0e0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {zone.name}
                      </div>
                      <div style={{ fontSize: 10, color: '#5a6a7a' }}>
                        <Tag
                          color={typeConfig?.color}
                          style={{
                            fontSize: 9,
                            lineHeight: '14px',
                            padding: '0 4px',
                            margin: 0,
                          }}
                        >
                          {typeConfig?.label}
                        </Tag>
                        <span style={{ marginLeft: 6 }}>
                          {zone.geometry.type === 'circle'
                            ? `R=${(zone.geometry.radius / 1000).toFixed(0)}km`
                            : `${zone.geometry.vertices.length}点`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Space size={2}>
                    <Button
                      type="text"
                      size="small"
                      icon={<EnvironmentOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(zone);
                      }}
                      style={{ color: '#5a6a7a' }}
                    />
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(zone.id);
                      }}
                    />
                  </Space>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    );
  }

  // ============ 编辑视图 ============

  const currentTypeConfig = ZONE_TYPES.find((t) => t.value === zoneType);

  return (
    <Card
      size="small"
      title={
        <Space>
          <EnvironmentOutlined />
          <span style={{ fontSize: 13 }}>
            {editMode === 'create' ? '新建区域' : '编辑区域'}
          </span>
        </Space>
      }
      style={{
        width: 320,
        background: '#111820',
        border: '1px solid #2a3a4a',
        maxHeight: 500,
        overflow: 'auto',
      }}
      styles={{
        header: { background: '#1a2233', padding: '8px 12px' },
        body: { padding: '12px' },
      }}
    >
      {/* 区域名称 */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>区域名称</div>
        <Input
          size="small"
          value={zoneName}
          onChange={(e) => setZoneName(e.target.value)}
          placeholder="输入区域名称"
        />
      </div>

      {/* 区域类型 */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>区域类型</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ZONE_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setZoneType(type.value)}
              style={{
                flex: '1 1 calc(50% - 3px)',
                padding: '6px 8px',
                background:
                  zoneType === type.value ? `${type.color}15` : '#0d1117',
                border: `1px solid ${zoneType === type.value ? type.color : '#2a3a4a'}`,
                borderRadius: 4,
                color: zoneType === type.value ? type.color : '#5a6a7a',
                fontSize: 11,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <div style={{ fontWeight: 600 }}>{type.label}</div>
              <div style={{ fontSize: 9, opacity: 0.7 }}>{type.description}</div>
            </button>
          ))}
        </div>
      </div>

      <Divider style={{ margin: '8px 0', borderColor: '#2a3a4a' }} />

      {/* 在地图上绘制 */}
      {mapEngine && (
        <div style={{ marginBottom: 10 }}>
          <Button
            size="small"
            block
            icon={<EditOutlined />}
            onClick={handleMapDraw}
            loading={isDrawing}
            style={{
              background: '#0d1117',
              border: '1px dashed #2a3a4a',
              color: '#28b43c',
            }}
          >
            {isDrawing
              ? geometryType === 'circle'
                ? '在地图上点击设置圆心，再点击设置半径'
                : '在地图上点击添加顶点，双击完成'
              : '在地图上绘制'}
          </Button>
        </div>
      )}

      {/* 几何参数 */}
      {geometry.type === 'circle' ? (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={labelStyle}>圆心经度</div>
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={geometry.center.lng}
              onChange={(v) =>
                v !== null &&
                setGeometry({ ...geometry, center: { ...geometry.center, lng: v } })
              }
              step={0.01}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={labelStyle}>圆心纬度</div>
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={geometry.center.lat}
              onChange={(v) =>
                v !== null &&
                setGeometry({ ...geometry, center: { ...geometry.center, lat: v } })
              }
              step={0.01}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={labelStyle}>
              半径: {(geometry.radius / 1000).toFixed(1)} km
            </div>
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={geometry.radius}
              onChange={(v) =>
                v !== null && setGeometry({ ...geometry, radius: v })
              }
              step={1000}
              min={1000}
              max={500000}
            />
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <div style={labelStyle}>
              顶点 ({geometry.vertices.length})
            </div>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={addVertex}
              style={{ color: '#0078d7' }}
            >
              添加顶点
            </Button>
          </div>
          {geometry.vertices.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: '#5a6a7a',
                padding: 16,
                fontSize: 12,
              }}
            >
              点击「添加顶点」或在地图上点击来添加
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {geometry.vertices.map((v, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 8px',
                    background: '#0d1117',
                    borderRadius: 4,
                  }}
                >
                  <Tag style={{ margin: 0, fontSize: 10, lineHeight: '18px' }}>
                    V{idx + 1}
                  </Tag>
                  <InputNumber
                    size="small"
                    style={{ flex: 1 }}
                    value={v.lng}
                    onChange={(val) =>
                      val !== null && updateVertex(idx, { lng: val })
                    }
                    step={0.01}
                  />
                  <InputNumber
                    size="small"
                    style={{ flex: 1 }}
                    value={v.lat}
                    onChange={(val) =>
                      val !== null && updateVertex(idx, { lat: val })
                    }
                    step={0.01}
                  />
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<MinusCircleOutlined />}
                    onClick={() => removeVertex(idx)}
                    style={{ padding: 0 }}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 预览颜色 */}
      {currentTypeConfig && (
        <div
          style={{
            marginTop: 10,
            padding: '6px 10px',
            background: `${currentTypeConfig.color}10`,
            border: `1px solid ${currentTypeConfig.color}40`,
            borderRadius: 4,
            fontSize: 11,
            color: currentTypeConfig.color,
          }}
        >
          预览颜色: {currentTypeConfig.label}
        </div>
      )}

      {/* 操作按钮 */}
      <Divider style={{ margin: '8px 0', borderColor: '#2a3a4a' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="small" onClick={cancelEdit} style={{ flex: 1 }}>
          取消
        </Button>
        <Button
          type="primary"
          size="small"
          onClick={handleSave}
          disabled={
            geometry.type === 'polygon' && geometry.vertices.length < 3
          }
          style={{ flex: 1 }}
        >
          保存区域
        </Button>
      </div>
    </Card>
  );
};

function getZoneColor(
  type: ZoneDefinition['type'],
  part: 'fill' | 'stroke'
): string {
  const colors: Record<ZoneDefinition['type'], { fill: string; stroke: string }> = {
    exclusion: { fill: '#d7282820', stroke: '#d72828' },
    inclusion: { fill: '#0078d720', stroke: '#0078d7' },
    threat: { fill: '#d9770620', stroke: '#d97706' },
    safe: { fill: '#28b43c20', stroke: '#28b43c' },
  };
  return colors[type][part];
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: '#5a6a7a',
  marginBottom: 4,
};

export default ZoneEditor;
