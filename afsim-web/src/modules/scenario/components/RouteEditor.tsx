/**
 * 路线编辑器
 * 添加航路点、拖拽调整、设置高度和速度
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Card,
  Input,
  InputNumber,
  Button,
  Space,
  Tag,
  Divider,
  Empty,
} from 'antd';
import {
  BranchesOutlined,
  PlusOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EyeOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useScenarioEditorStore } from '../store/scenarioStore';
import type { RouteDefinition, RouteWaypoint } from '../types';
import type { MapEngine } from '../../../core/map-engine/MapEngine';

const ROUTE_COLORS = [
  '#0078d7',
  '#28b43c',
  '#c8c83c',
  '#d72828',
  '#d97706',
  '#9333ea',
  '#ec4899',
  '#06b6d4',
];

interface RouteEditorProps {
  mapEngine?: MapEngine | null;
}

export const RouteEditor: React.FC<RouteEditorProps> = ({ mapEngine }) => {
  const {
    currentScenario,
    addRoute,
    updateRoute,
    removeRoute,
    selectedRouteId,
    selectRoute,
  } = useScenarioEditorStore();

  const [editMode, setEditMode] = useState<'list' | 'create' | 'edit'>('list');
  const [routeName, setRouteName] = useState('');
  const [routeColor, setRouteColor] = useState(ROUTE_COLORS[0]);
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([]);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  // 「绘制」与「添加」互斥：选定一种录入方式后，禁用另一种，避免两路数据混用
  const [inputMode, setInputMode] = useState<'draw' | 'manual' | null>(null);

  const routes = currentScenario?.routes || [];

  // 开始创建新路线
  const startCreate = useCallback(() => {
    setEditMode('create');
    setRouteName(`路线 ${routes.length + 1}`);
    setRouteColor(ROUTE_COLORS[routes.length % ROUTE_COLORS.length]);
    setWaypoints([]);
    setEditingRouteId(null);
    setIsDrawing(false);
    setInputMode(null);
  }, [routes.length]);

  // 开始编辑已有路线
  const startEdit = useCallback(
    (route: RouteDefinition) => {
      setEditMode('edit');
      setRouteName(route.name);
      setRouteColor(route.color || ROUTE_COLORS[0]);
      setWaypoints([...route.waypoints]);
      setEditingRouteId(route.id);
      setIsDrawing(false);
      setInputMode(null);
      selectRoute(route.id);
    },
    [selectRoute]
  );

  // 取消编辑
  const cancelEdit = useCallback(() => {
    setEditMode('list');
    setWaypoints([]);
    setEditingRouteId(null);
    setIsDrawing(false);
    setInputMode(null);
  }, []);

  // 手动添加航路点：进入「添加」模式（与「绘制」互斥），在地图视野中心生成一个占位点供手动填写经纬度/高度/速度
  const addWaypoint = useCallback(() => {
    if (inputMode === 'draw') return;
    setInputMode('manual');

    const lastWp = waypoints[waypoints.length - 1];
    const center = mapEngine?.getCenter();
    const newWp: RouteWaypoint = {
      position: {
        lng: center?.lng ?? lastWp?.position.lng ?? 120,
        lat: center?.lat ?? lastWp?.position.lat ?? 25,
      },
      altitude: lastWp?.altitude ?? 8000,
      speed: lastWp?.speed ?? 450,
    };
    setWaypoints((prev) => [...prev, newWp]);
  }, [waypoints, mapEngine, inputMode]);

  // 删除航路点
  const removeWaypoint = useCallback((index: number) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 更新航路点
  const updateWaypoint = useCallback(
    (index: number, updates: Partial<RouteWaypoint>) => {
      setWaypoints((prev) =>
        prev.map((wp, i) => (i === index ? { ...wp, ...updates } : wp))
      );
    },
    []
  );

  // 移动航路点
  const moveWaypoint = useCallback((index: number, direction: 'up' | 'down') => {
    setWaypoints((prev) => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const arr = [...prev];
      [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
      return arr;
    });
  }, []);

  // 进入「绘制」模式：与「添加」互斥，之后在地图上每点击一次即生成一个航路点
  const handleMapDraw = useCallback(() => {
    if (!mapEngine || inputMode === 'manual') return;
    setInputMode('draw');
    setIsDrawing(true);
  }, [mapEngine, inputMode]);

  // 绘制模式下，监听地图点击：每点一下立即追加一个航路点（经纬度 + 高度/速度沿用上一个点的取值）
  useEffect(() => {
    if (!mapEngine || !isDrawing) return;

    const cleanup = mapEngine.onClick((event) => {
      const { lng, lat } = event.lngLat;
      setWaypoints((prev) => {
        const lastWp = prev[prev.length - 1];
        const newWp: RouteWaypoint = {
          position: { lng, lat },
          altitude: lastWp?.altitude ?? 8000,
          speed: lastWp?.speed ?? 450,
        };
        return [...prev, newWp];
      });
    });

    return cleanup;
  }, [mapEngine, isDrawing]);

  // 绘制过程中实时预览：每个已点击的航路点显示一个图标标记，并用虚线依次连接
  useEffect(() => {
    if (!mapEngine || !isDrawing) return;

    const lineId = '__route-draw-preview-line__';
    const pointIds = waypoints.map((_, idx) => `__route-draw-preview-pt-${idx}__`);

    waypoints.forEach((wp, idx) => {
      mapEngine.removeEntity(pointIds[idx]);
      mapEngine.addEntity({
        id: pointIds[idx],
        type: 'point',
        position: { lng: wp.position.lng, lat: wp.position.lat, alt: wp.altitude },
        label: `WP${idx + 1}`,
        style: {
          pointColor: routeColor,
          pointSize: 8,
          pointOutline: true,
          pointOutlineColor: '#fff',
          pointOutlineWidth: 2,
        },
      });
    });

    mapEngine.removeEntity(lineId);
    if (waypoints.length >= 2) {
      mapEngine.addEntity({
        id: lineId,
        type: 'polyline',
        positions: waypoints.map((wp) => ({
          lng: wp.position.lng,
          lat: wp.position.lat,
          alt: wp.altitude,
        })),
        style: { lineColor: routeColor, lineWidth: 2, lineDash: [6, 3] },
      });
    }

    return () => {
      pointIds.forEach((id) => mapEngine.removeEntity(id));
      mapEngine.removeEntity(lineId);
    };
  }, [mapEngine, isDrawing, waypoints, routeColor]);

  // 保存路线
  const handleSave = useCallback(() => {
    if (waypoints.length < 2) return;

    if (editingRouteId) {
      updateRoute(editingRouteId, {
        name: routeName,
        waypoints,
        color: routeColor,
      });
    } else {
      const route: RouteDefinition = {
        id: `route-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: routeName,
        waypoints,
        color: routeColor,
      };
      addRoute(route);

      // 在地图上绘制路线
      if (mapEngine && waypoints.length >= 2) {
        mapEngine.addEntity({
          id: route.id,
          type: 'polyline',
          positions: waypoints.map((wp) => ({
            lng: wp.position.lng,
            lat: wp.position.lat,
            alt: wp.altitude,
          })),
          style: {
            lineColor: routeColor,
            lineWidth: 2,
            lineDash: [6, 3],
          },
        });
      }
    }

    setEditMode('list');
    setWaypoints([]);
    setEditingRouteId(null);
    setIsDrawing(false);
    setInputMode(null);
  }, [waypoints, editingRouteId, routeName, routeColor, updateRoute, addRoute, mapEngine]);

  // 删除路线（同时移除地图上对应的航线实体，避免残留）
  const handleDelete = useCallback(
    (id: string) => {
      removeRoute(id);
      mapEngine?.removeEntity(id);
      if (editingRouteId === id) {
        cancelEdit();
      }
    },
    [removeRoute, mapEngine, editingRouteId, cancelEdit]
  );

  // ============ 列表视图 ============

  if (editMode === 'list') {
    return (
      <Card
        size="small"
        title={
          <Space>
            <BranchesOutlined />
            <span style={{ fontSize: 13 }}>路线编辑</span>
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
        {routes.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无路线"
            style={{ margin: '16px 0' }}
          >
            <Button size="small" type="primary" onClick={startCreate}>
              创建第一条路线
            </Button>
          </Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {routes.map((route) => (
              <div
                key={route.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background:
                    selectedRouteId === route.id ? '#1e2a3a' : '#0d1117',
                  borderRadius: 4,
                  border:
                    selectedRouteId === route.id
                      ? '1px solid #0078d7'
                      : '1px solid transparent',
                  cursor: 'pointer',
                }}
                onClick={() => selectRoute(route.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      background: route.color || '#0078d7',
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
                      {route.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#5a6a7a' }}>
                      {route.waypoints.length} 航路点
                    </div>
                  </div>
                </div>
                <Space size={2}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectRoute(route.id);
                    }}
                    style={{ color: '#5a6a7a' }}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<EnvironmentOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(route);
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
                      handleDelete(route.id);
                    }}
                  />
                </Space>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }

  // ============ 编辑视图 ============

  return (
    <Card
      size="small"
      title={
        <Space>
          <BranchesOutlined />
          <span style={{ fontSize: 13 }}>
            {editMode === 'create' ? '新建路线' : '编辑路线'}
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
      {/* 路线名称 */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>路线名称</div>
        <Input
          size="small"
          value={routeName}
          onChange={(e) => setRouteName(e.target.value)}
          placeholder="输入路线名称"
        />
      </div>

      {/* 路线颜色 */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>颜色</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {ROUTE_COLORS.map((color) => (
            <div
              key={color}
              onClick={() => setRouteColor(color)}
              style={{
                width: 20,
                height: 20,
                borderRadius: 3,
                background: color,
                cursor: 'pointer',
                border:
                  routeColor === color
                    ? '2px solid #fff'
                    : '2px solid transparent',
              }}
            />
          ))}
        </div>
      </div>

      <Divider style={{ margin: '8px 0', borderColor: '#2a3a4a' }} />

      {/* 航路点列表 */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <div style={labelStyle}>航路点 ({waypoints.length})</div>
          <Space size={4}>
            {mapEngine && (
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={handleMapDraw}
                loading={isDrawing}
                disabled={inputMode === 'manual'}
                style={{ color: '#28b43c' }}
              >
                绘制
              </Button>
            )}
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={addWaypoint}
              disabled={inputMode === 'draw'}
              style={{ color: '#0078d7' }}
            >
              添加
            </Button>
          </Space>
        </div>

        {waypoints.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: '#5a6a7a',
              padding: 16,
              fontSize: 12,
            }}
          >
            {isDrawing
              ? '在地图上点击即可生成航路点，满 2 个后点击「保存路线」完成绘制'
              : '点击「添加」手动输入，或点击「绘制」在地图上取点'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {waypoints.map((wp, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 10px',
                  background: '#0d1117',
                  borderRadius: 4,
                  border: '1px solid #1e2a3a',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}
                >
                  <Tag style={{ margin: 0, fontSize: 10, lineHeight: '18px' }}>
                    WP{idx + 1}
                  </Tag>
                  <Space size={2}>
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowUpOutlined />}
                      disabled={idx === 0}
                      onClick={() => moveWaypoint(idx, 'up')}
                      style={{ color: '#5a6a7a', padding: '0 2px' }}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowDownOutlined />}
                      disabled={idx === waypoints.length - 1}
                      onClick={() => moveWaypoint(idx, 'down')}
                      style={{ color: '#5a6a7a', padding: '0 2px' }}
                    />
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeWaypoint(idx)}
                      style={{ padding: '0 2px' }}
                    />
                  </Space>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...labelStyle, marginBottom: 2 }}>经度</div>
                    <InputNumber
                      size="small"
                      style={{ width: '100%' }}
                      value={wp.position.lng}
                      onChange={(v) =>
                        v !== null &&
                        updateWaypoint(idx, {
                          position: { ...wp.position, lng: v },
                        })
                      }
                      step={0.01}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...labelStyle, marginBottom: 2 }}>纬度</div>
                    <InputNumber
                      size="small"
                      style={{ width: '100%' }}
                      value={wp.position.lat}
                      onChange={(v) =>
                        v !== null &&
                        updateWaypoint(idx, {
                          position: { ...wp.position, lat: v },
                        })
                      }
                      step={0.01}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...labelStyle, marginBottom: 2 }}>高度 (m)</div>
                    <InputNumber
                      size="small"
                      style={{ width: '100%' }}
                      value={wp.altitude}
                      onChange={(v) =>
                        v !== null && updateWaypoint(idx, { altitude: v })
                      }
                      step={100}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...labelStyle, marginBottom: 2 }}>速度 (kn)</div>
                    <InputNumber
                      size="small"
                      style={{ width: '100%' }}
                      value={wp.speed}
                      onChange={(v) =>
                        v !== null && updateWaypoint(idx, { speed: v })
                      }
                      step={10}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
          disabled={waypoints.length < 2}
          style={{ flex: 1 }}
        >
          保存路线
        </Button>
      </div>
    </Card>
  );
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: '#5a6a7a',
  marginBottom: 4,
};

export default RouteEditor;
