/**
 * EquipmentEditForm — AFSIM-native inline editor
 * Directly edits AfsimEquipment fields, no adapter layer
 */
import { useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  Divider,
  Tag,
  Card,
  Typography,
  Spin,
  Collapse,
  InputNumber,
} from 'antd';
import {
  SaveOutlined,
  CloseOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  FileTextOutlined,
  SettingOutlined,
  RadarChartOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { useEquipmentStore } from '../store/equipmentStore';
import { BehaviorTreeEditor } from './BehaviorTreeEditor';
import { createEmptyEquipment } from '../afsim/types';
import type { AfsimEquipment } from '../afsim/types';

const { Text } = Typography;

// ============ Helpers ============

function labelForKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// ============ Component Map Editor ============

/** Editable list of named WSF components (sensors, weapons, etc.) */
function ComponentMapEditor({
  mapName,
  title,
  form,
}: {
  mapName: string;
  title: string;
  form: ReturnType<typeof Form.useForm>[0];
}) {
  const items = Form.useWatch(mapName, form) as Record<string, Record<string, unknown>> | undefined;
  const entries = items ? Object.entries(items) : [];

  const handleAdd = useCallback(() => {
    const current = form.getFieldValue(mapName) || {};
    const newName = `${mapName}_${Date.now().toString(36)}`;
    form.setFieldsValue({
      [mapName]: {
        ...current,
        [newName]: { type: `WSF_${mapName.toUpperCase().slice(0, -1)}`, on: true },
      },
    });
  }, [form, mapName]);

  const handleRemove = useCallback((name: string) => {
    const current = { ...(form.getFieldValue(mapName) || {}) };
    delete current[name];
    form.setFieldsValue({ [mapName]: current });
  }, [form, mapName]);

  const handleFieldChange = useCallback((componentName: string, field: string, value: unknown) => {
    const current = { ...(form.getFieldValue(mapName) || {}) };
    const component = { ...(current[componentName] || {}) };
    component[field] = value;
    current[componentName] = component;
    form.setFieldsValue({ [mapName]: current });
  }, [form, mapName]);

  return (
    <>
      <Divider titlePlacement="left">
        <Space>
          {title}
          <Tag>{entries.length} 项</Tag>
        </Space>
      </Divider>
      {entries.map(([name, config]) => (
        <Card
          key={name}
          size="small"
          style={{ marginBottom: 8, background: '#0d1117', border: '1px solid #21262d' }}
          title={
            <Space>
              <Text strong style={{ color: '#e6edf3' }}>{name}</Text>
              {config.type ? <Tag color="blue" style={{ fontSize: 11 }}>{String(config.type)}</Tag> : null}
            </Space>
          }
          extra={
            <Button
              type="text"
              danger
              size="small"
              icon={<MinusCircleOutlined />}
              onClick={() => handleRemove(name)}
            />
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 16px' }}>
            <Form.Item label="类型">
              <Input
                value={config.type as string}
                onChange={(e) => handleFieldChange(name, 'type', e.target.value)}
                size="small"
              />
            </Form.Item>
            <Form.Item label="启用">
              <Select
                value={config.on !== false ? 'true' : 'false'}
                options={[
                  { value: 'true', label: 'ON' },
                  { value: 'false', label: 'OFF' },
                ]}
                onChange={(v) => handleFieldChange(name, 'on', v === 'true')}
                size="small"
              />
            </Form.Item>
          </div>
          <Collapse
            ghost
            size="small"
            items={[{
              key: 'props',
              label: <Text type="secondary" style={{ fontSize: 12 }}>属性详情</Text>,
              children: (
                <pre style={{
                  fontSize: 11,
                  background: '#161b22',
                  padding: 8,
                  borderRadius: 4,
                  maxHeight: 200,
                  overflow: 'auto',
                  color: '#8b949e',
                  margin: 0,
                }}>
                  {JSON.stringify(config, null, 2)}
                </pre>
              ),
            }]}
          />
        </Card>
      ))}
      <Button type="dashed" onClick={handleAdd} block icon={<PlusOutlined />}>
        添加{title}
      </Button>
    </>
  );
}

// ============ Main Component ============

interface EquipmentEditFormProps {
  onCancel: () => void;
  onSaved: () => void;
}

export function EquipmentEditForm({ onCancel, onSaved }: EquipmentEditFormProps) {
  const editingEquipment = useEquipmentStore((s) => s.editingEquipment);
  const draftEquipment = useEquipmentStore((s) => s.draftEquipment);
  const saving = useEquipmentStore((s) => s.saving);
  const saveEquipment = useEquipmentStore((s) => s.saveEquipment);

  const [form] = Form.useForm();
  const isEditing = !!editingEquipment?.name;

  const formReady = draftEquipment !== null;

  const [activeTab, setActiveTab] = useState('basic');
  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
  }, []);

  // Build initial values from draft
  const initialValues = useMemo(() => {
    if (!draftEquipment) return {};
    return {
      name: draftEquipment.name || '',
      parentType: draftEquipment.parentType || '',
      // Platform scalar fields
      side: draftEquipment.platform.side || 'blue',
      icon: draftEquipment.platform.icon || '',
      marking: draftEquipment.platform.marking || '',
      spatialDomain: draftEquipment.platform.spatialDomain || 'air',
      destructible: draftEquipment.platform.destructible ?? true,
      altitude: draftEquipment.platform.altitude || '',
      heading: draftEquipment.platform.heading || '',
      emptyMass: draftEquipment.platform.emptyMass || '',
      fuelMass: draftEquipment.platform.fuelMass || '',
      length: draftEquipment.platform.length || '',
      width: draftEquipment.platform.width || '',
      height: draftEquipment.platform.height || '',
      radarSignature: draftEquipment.platform.radarSignature || '',
      // Component maps
      sensors: draftEquipment.platform.sensors || {},
      weapons: draftEquipment.platform.weapons || {},
      comms: draftEquipment.platform.comms || {},
      processors: draftEquipment.platform.processors || {},
      movers: draftEquipment.platform.movers || {},
      fuels: draftEquipment.platform.fuels || {},
    };
  }, [draftEquipment]);

  const handleSave = useCallback(async () => {
    try {
      await form.validateFields();
    } catch {
      message.warning('请检查表单填写');
      return;
    }

    const formValues = form.getFieldsValue(true);
    const base = editingEquipment ?? createEmptyEquipment();

    const equipment: AfsimEquipment = {
      ...base,
      name: formValues.name || base.name,
      parentType: formValues.parentType || base.parentType,
      platform: {
        ...base.platform,
        side: formValues.side || base.platform.side,
        icon: formValues.icon || base.platform.icon,
        marking: formValues.marking || base.platform.marking,
        spatialDomain: formValues.spatialDomain || base.platform.spatialDomain,
        destructible: formValues.destructible ?? base.platform.destructible,
        altitude: formValues.altitude || base.platform.altitude,
        heading: formValues.heading || base.platform.heading,
        emptyMass: formValues.emptyMass || base.platform.emptyMass,
        fuelMass: formValues.fuelMass || base.platform.fuelMass,
        length: formValues.length || base.platform.length,
        width: formValues.width || base.platform.width,
        height: formValues.height || base.platform.height,
        radarSignature: formValues.radarSignature || base.platform.radarSignature,
        sensors: formValues.sensors || base.platform.sensors,
        weapons: formValues.weapons || base.platform.weapons,
        comms: formValues.comms || base.platform.comms,
        processors: formValues.processors || base.platform.processors,
        movers: formValues.movers || base.platform.movers,
        fuels: formValues.fuels || base.platform.fuels,
      },
    };

    await saveEquipment(equipment);
    message.success(isEditing ? '装备已更新' : '装备已创建');
    onSaved();
  }, [form, editingEquipment, isEditing, saveEquipment, onSaved]);

  const handleCancel = useCallback(() => {
    form.resetFields();
    onCancel();
  }, [form, onCancel]);

  const tabItems = [
    {
      key: 'basic',
      label: <span><FileTextOutlined /> 基本信息</span>,
      children: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 16px' }}>
          <Form.Item name="name" label="装备名称" rules={[{ required: true, message: '请输入装备名称' }]}>
            <Input placeholder="装备名称" />
          </Form.Item>
          <Form.Item name="parentType" label="父类型">
            <Input placeholder="继承的平台类型名" />
          </Form.Item>
          <Form.Item name="side" label="阵营">
            <Select options={[
              { value: 'blue', label: '蓝方' },
              { value: 'red', label: '红方' },
              { value: 'neutral', label: '中立' },
            ]} />
          </Form.Item>
          <Form.Item name="spatialDomain" label="空间域">
            <Select options={[
              { value: 'air', label: '空中' },
              { value: 'land', label: '陆地' },
              { value: 'surface', label: '水面' },
              { value: 'subsurface', label: '水下' },
              { value: 'space', label: '太空' },
            ]} />
          </Form.Item>
          <Form.Item name="icon" label="图标">
            <Input placeholder="图标标识" />
          </Form.Item>
        </div>
      ),
    },
    {
      key: 'platform',
      label: <span><SettingOutlined /> 平台参数</span>,
      children: (
        <>
          <Divider titlePlacement="left">物理属性</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 16px' }}>
            <Form.Item name="altitude" label="高度">
              <Input placeholder="0 m" />
            </Form.Item>
            <Form.Item name="heading" label="航向">
              <Input placeholder="0 deg" />
            </Form.Item>
            <Form.Item name="marking" label="标识">
              <Input placeholder="标识" />
            </Form.Item>
            <Form.Item name="emptyMass" label="空重">
              <Input placeholder="10000 kg" />
            </Form.Item>
            <Form.Item name="fuelMass" label="燃料质量">
              <Input placeholder="5000 kg" />
            </Form.Item>
            <Form.Item name="radarSignature" label="雷达特征">
              <Input placeholder="雷达反射截面积" />
            </Form.Item>
            <Form.Item name="length" label="长度">
              <Input placeholder="15 m" />
            </Form.Item>
            <Form.Item name="width" label="宽度">
              <Input placeholder="10 m" />
            </Form.Item>
            <Form.Item name="height" label="高度">
              <Input placeholder="5 m" />
            </Form.Item>
          </div>
        </>
      ),
    },
    {
      key: 'components',
      label: <span><RadarChartOutlined /> 子系统</span>,
      children: (
        <>
          <ComponentMapEditor mapName="sensors" title="传感器" form={form} />
          <ComponentMapEditor mapName="weapons" title="武器" form={form} />
          <ComponentMapEditor mapName="comms" title="通信" form={form} />
          <ComponentMapEditor mapName="processors" title="处理器" form={form} />
          <ComponentMapEditor mapName="movers" title="动力系统" form={form} />
          <ComponentMapEditor mapName="fuels" title="燃料系统" form={form} />
        </>
      ),
    },
    {
      key: 'behavior',
      label: <span><ApartmentOutlined /> 行为模型</span>,
      children: <BehaviorTreeEditor form={form} />,
    },
  ];

  return (
    <div className="equip-edit-form">
      <div className="equip-edit-toolbar">
        <Text strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>
          {isEditing ? `编辑 - ${editingEquipment?.name}` : '新建装备'}
        </Text>
        <Space>
          <Button icon={<CloseOutlined />} onClick={handleCancel}>取消</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>保存</Button>
        </Space>
      </div>
      {formReady ? (
        <Form
          key={editingEquipment?.name ?? 'new'}
          form={form}
          layout="vertical"
          size="small"
          initialValues={initialValues}
        >
          <div className="ant-tabs ant-tabs-small">
            <div className="ant-tabs-nav">
              <div className="ant-tabs-nav-wrap">
                <div className="ant-tabs-nav-list">
                  {tabItems.map((tab) => (
                    <div
                      key={tab.key}
                      className={`ant-tabs-tab ${activeTab === tab.key ? 'ant-tabs-tab-active' : ''}`}
                      onClick={() => handleTabChange(tab.key)}
                    >
                      <div className="ant-tabs-tab-btn">{tab.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {tabItems.map((tab) => (
              <div
                key={tab.key}
                role="tabpanel"
                className="ant-tabs-tabpane"
                style={{ display: activeTab === tab.key ? 'block' : 'none' }}
              >
                <div className="ant-tabs-tabpane-active" style={{ padding: '12px 0' }}>
                  {tab.children}
                </div>
              </div>
            ))}
          </div>
        </Form>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <Spin tip="加载编辑数据..." />
        </div>
      )}
    </div>
  );
}
