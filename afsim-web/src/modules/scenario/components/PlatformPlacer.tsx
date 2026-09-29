/**
 * 平台放置组件
 * 从装备库选择装备，设置初始参数，放置到地图
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Select,
  InputNumber,
  Button,
  Space,
  Tag,
  Divider,
  Form,
  Slider,
  Tooltip,
  Spin,
  Empty,
  message,
} from 'antd';
import {
  AimOutlined,
  DeleteOutlined,
  RocketOutlined,
  SendOutlined,
  EnvironmentOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useScenarioEditorStore } from '../store/scenarioStore';
import type { EquipmentItem, PlatformInstance } from '../types';

const SIDE_OPTIONS = [
  { value: 'blue', label: '蓝方', color: '#0078d7' },
  { value: 'red', label: '红方', color: '#d72828' },
  { value: 'neutral', label: '中立', color: '#8899aa' },
  { value: 'green', label: '绿方', color: '#28b43c' },
];

const CATEGORY_LABELS: Record<string, string> = {
  aircraft: '飞机',
  ship: '舰船',
  submarine: '潜艇',
  vehicle: '车辆',
  missile: '导弹',
  sensor: '传感器',
};

export const PlatformPlacer: React.FC = () => {
  const {
    equipment,
    equipmentLoading,
    currentScenario,
    addPlatform,
    loadEquipment,
    pendingPosition,
    setPendingPosition,
    setActiveTool,
  } = useScenarioEditorStore();

  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [side, setSide] = useState<'blue' | 'red' | 'neutral' | 'green'>('blue');
  const [name, setName] = useState('');
  const [altitude, setAltitude] = useState(0);
  const [heading, setHeading] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [position, setPosition] = useState({ lng: 120.0, lat: 25.0 });
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (equipment.length === 0) {
      loadEquipment();
    }
  }, [equipment.length, loadEquipment]);

  // 当选择装备时自动填充参数
  useEffect(() => {
    if (selectedEquipment && equipment.length > 0) {
      const eq = equipment.find((e) => e.id === selectedEquipment);
      if (eq) {
        setSpeed(Math.round(eq.maxSpeed * 0.6)); // 默认60%最大速度
        setAltitude(eq.category === 'aircraft' ? 8000 : 0);
        setName(eq.name);
        // 设置默认阵营为装备阵营
        if (eq.side !== side) {
          setSide(eq.side);
        }
      }
    }
  }, [selectedEquipment, equipment]);

  // 当从地图拾取位置时自动填入
  useEffect(() => {
    if (pendingPosition) {
      setPosition(pendingPosition);
      setPendingPosition(null);
    }
  }, [pendingPosition, setPendingPosition]);

  const handlePlace = useCallback(() => {
    if (!selectedEquipment) return;

    const eq = equipment.find((e) => e.id === selectedEquipment);
    if (!eq) return;

    const platformId = `plat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const platform: PlatformInstance = {
      id: platformId,
      equipmentRef: {
        equipmentId: eq.id,
        name: eq.name,
        category: eq.category,
      },
      name: name || eq.name,
      side,
      initialPosition: { ...position },
      initialAltitude: altitude,
      initialHeading: heading,
      initialSpeed: speed,
      routeId: selectedRouteId,
      sensors: eq.sensors,
      weapons: eq.weapons,
    };

    addPlatform(platform);

    // 重置部分参数（保留装备选择和阵营）
    setName('');
    setHeading(0);
  }, [
    selectedEquipment,
    equipment,
    name,
    side,
    position,
    altitude,
    heading,
    speed,
    selectedRouteId,
    addPlatform,
  ]);

  const selectedEquipmentItem = equipment.find(
    (e) => e.id === selectedEquipment
  );

  return (
    <Card
      size="small"
      title={
        <Space>
          <AimOutlined />
          <span style={{ fontSize: 13 }}>放置平台</span>
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
    >
      {/* 装备选择 */}
      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>选择装备</div>
        <Select
          placeholder="从装备库选择..."
          style={{ width: '100%' }}
          value={selectedEquipment}
          onChange={setSelectedEquipment}
          loading={equipmentLoading}
          showSearch
          optionFilterProp="label"
          size="small"
          options={equipment.map((eq) => ({
            value: eq.id,
            label: `${eq.name} (${CATEGORY_LABELS[eq.category] || eq.category})`,
          }))}
          dropdownStyle={{ background: '#111820', border: '1px solid #2a3a4a' }}
        />
      </div>

      {/* 装备信息预览 — 支持拖拽到地图直接放置 */}
      {selectedEquipmentItem && (
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/x-truesim-equipment-id', selectedEquipmentItem.id);
            e.dataTransfer.effectAllowed = 'copy';
          }}
          style={{
            padding: '8px 10px',
            background: '#0d1117',
            borderRadius: 4,
            marginBottom: 12,
            fontSize: 11,
            cursor: 'grab',
            border: '1px dashed #2a3a4a',
          }}
          title="拖拽到地图上以放置该装备"
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <span style={{ fontWeight: 600, color: '#e0e0e0' }}>
              {selectedEquipmentItem.name}
            </span>
            <Tag
              style={{
                fontSize: 10,
                backgroundColor:
                  selectedEquipmentItem.side === 'blue'
                    ? '#0078d720'
                    : selectedEquipmentItem.side === 'red'
                    ? '#d7282820'
                    : '#8899aa20',
                color:
                  selectedEquipmentItem.side === 'blue'
                    ? '#0078d7'
                    : selectedEquipmentItem.side === 'red'
                    ? '#d72828'
                    : '#8899aa',
              }}
            >
              {CATEGORY_LABELS[selectedEquipmentItem.category]}
            </Tag>
          </div>
          <div style={{ color: '#5a6a7a', lineHeight: 1.5 }}>
            {selectedEquipmentItem.description}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#5a6a7a' }}>
              最大速度: {selectedEquipmentItem.maxSpeed} kn
            </span>
            {selectedEquipmentItem.maxAltitude > 0 && (
              <span style={{ color: '#5a6a7a' }}>
                最大高度: {selectedEquipmentItem.maxAltitude.toLocaleString()} m
              </span>
            )}
          </div>
          {selectedEquipmentItem.sensors.length > 0 && (
            <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {selectedEquipmentItem.sensors.map((s) => (
                <Tag key={s} style={{ fontSize: 9, margin: 0, lineHeight: '16px' }}>
                  {s}
                </Tag>
              ))}
            </div>
          )}
          <div style={{ marginTop: 6, color: '#5a6a7a', fontSize: 10 }}>
            <AimOutlined style={{ marginRight: 4 }} />
            可直接拖拽此卡片到地图上放置
          </div>
        </div>
      )}

      <Divider style={{ margin: '8px 0', borderColor: '#2a3a4a' }} />

      {/* 平台参数 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* 名称 */}
        <div>
          <div style={labelStyle}>平台名称</div>
          <input
            className="filter-input"
            style={{ width: '100%' }}
            placeholder="输入平台名称..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* 阵营 */}
        <div>
          <div style={labelStyle}>阵营</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {SIDE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSide(opt.value as typeof side)}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  background: side === opt.value ? `${opt.color}20` : '#0d1117',
                  border: `1px solid ${side === opt.value ? opt.color : '#2a3a4a'}`,
                  borderRadius: 4,
                  color: side === opt.value ? opt.color : '#5a6a7a',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: side === opt.value ? 600 : 400,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 位置 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>经度</div>
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={position.lng}
              onChange={(v) => v !== null && setPosition((p) => ({ ...p, lng: v }))}
              step={0.1}
              min={100}
              max={130}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>纬度</div>
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={position.lat}
              onChange={(v) => v !== null && setPosition((p) => ({ ...p, lat: v }))}
              step={0.1}
              min={10}
              max={40}
            />
          </div>
        </div>
        <Button
          size="small"
          block
          icon={<EyeOutlined />}
          onClick={() => {
            setActiveTool('place_platform');
            message.info('请在地图上点击以拾取位置', 2);
          }}
          style={{
            background: '#0d1117',
            border: '1px dashed #2a3a4a',
            color: '#8899aa',
          }}
        >
          从地图拾取位置
        </Button>

        {/* 高度 */}
        <div>
          <div style={labelStyle}>
            高度: {altitude.toLocaleString()} m
            {altitude > 0 && (
              <span style={{ color: '#5a6a7a', marginLeft: 6 }}>
                (FL{(altitude / 30.48).toFixed(0)})
              </span>
            )}
          </div>
          <Slider
            min={-500}
            max={20000}
            step={100}
            value={altitude}
            onChange={setAltitude}
            styles={{
              track: { background: '#0078d7' },
              handle: { borderColor: '#0078d7' },
            }}
          />
        </div>

        {/* 航向 */}
        <div>
          <div style={labelStyle}>航向: {heading}°</div>
          <Slider
            min={0}
            max={359}
            step={5}
            value={heading}
            onChange={setHeading}
            styles={{
              track: { background: '#28b43c' },
              handle: { borderColor: '#28b43c' },
            }}
          />
        </div>

        {/* 速度 */}
        <div>
          <div style={labelStyle}>速度: {speed} kn</div>
          <Slider
            min={0}
            max={selectedEquipmentItem?.maxSpeed || 2000}
            step={10}
            value={speed}
            onChange={setSpeed}
            styles={{
              track: { background: '#c8c83c' },
              handle: { borderColor: '#c8c83c' },
            }}
          />
        </div>
      </div>

      {/* 关联路线 */}
      {currentScenario && currentScenario.routes.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={labelStyle}>关联路线（可选）</div>
          <Select
            placeholder="无"
            style={{ width: '100%' }}
            value={selectedRouteId}
            onChange={setSelectedRouteId}
            allowClear
            size="small"
            options={currentScenario.routes.map((r) => ({
              value: r.id,
              label: `${r.name} (${r.waypoints.length}点)`,
            }))}
            dropdownStyle={{ background: '#111820', border: '1px solid #2a3a4a' }}
          />
        </div>
      )}

      {/* 放置按钮 */}
      <Button
        type="primary"
        block
        icon={<EnvironmentOutlined />}
        onClick={handlePlace}
        disabled={!selectedEquipment}
        style={{ marginTop: 12 }}
      >
        放置到地图
      </Button>
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

export default PlatformPlacer;
