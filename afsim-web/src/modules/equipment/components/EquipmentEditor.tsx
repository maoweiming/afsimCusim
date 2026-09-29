// ============================================================
// Equipment Module - Equipment Editor (Drawer)
// AFSIM-native: directly edits AfsimEquipment
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import {
  Drawer,
  Steps,
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
  Collapse,
} from 'antd';
import {
  PlusOutlined,
  MinusCircleOutlined,
  SaveOutlined,
  CloseOutlined,
  FileTextOutlined,
  SettingOutlined,
  RadarChartOutlined,
} from '@ant-design/icons';
import { useEquipmentStore } from '../store/equipmentStore';
import { createEmptyEquipment } from '../afsim/types';
import type { AfsimEquipment } from '../afsim/types';

const { Text } = Typography;

// ============ Component Map Editor (Drawer variant) ============

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
          style={{ marginBottom: 8 }}
          title={
            <Space>
              <Text strong>{name}</Text>
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

export function EquipmentEditor() {
  const editorVisible = useEquipmentStore((s) => s.editorVisible);
  const editingEquipment = useEquipmentStore((s) => s.editingEquipment);
  const draftEquipment = useEquipmentStore((s) => s.draftEquipment);
  const saving = useEquipmentStore((s) => s.saving);

  const closeEditor = useEquipmentStore((s) => s.closeEditor);
  const saveEquipment = useEquipmentStore((s) => s.saveEquipment);

  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();

  const isEditing = !!editingEquipment?.name;

  // Build initial values from draft
  const initialValues = useMemo(() => {
    if (!draftEquipment) return {};
    return {
      name: draftEquipment.name || '',
      parentType: draftEquipment.parentType || '',
      side: draftEquipment.platform.side || 'blue',
      icon: draftEquipment.platform.icon || '',
      spatialDomain: draftEquipment.platform.spatialDomain || 'air',
      altitude: draftEquipment.platform.altitude || '',
      heading: draftEquipment.platform.heading || '',
      emptyMass: draftEquipment.platform.emptyMass || '',
      fuelMass: draftEquipment.platform.fuelMass || '',
      radarSignature: draftEquipment.platform.radarSignature || '',
      sensors: draftEquipment.platform.sensors || {},
      weapons: draftEquipment.platform.weapons || {},
      comms: draftEquipment.platform.comms || {},
      processors: draftEquipment.platform.processors || {},
      movers: draftEquipment.platform.movers || {},
      fuels: draftEquipment.platform.fuels || {},
    };
  }, [draftEquipment]);

  // Sync draft to form
  const handleSave = useCallback(async () => {
    try {
      await form.validateFields();
    } catch {
      message.warning('请检查当前步骤表单填写');
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
        spatialDomain: formValues.spatialDomain || base.platform.spatialDomain,
        altitude: formValues.altitude || base.platform.altitude,
        heading: formValues.heading || base.platform.heading,
        emptyMass: formValues.emptyMass || base.platform.emptyMass,
        fuelMass: formValues.fuelMass || base.platform.fuelMass,
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
  }, [form, editingEquipment, isEditing, saveEquipment]);

  // Steps
  const steps = [
    { title: '基本信息', description: '名称、编码、阵营' },
    { title: '平台参数', description: '物理属性、特征' },
    { title: '子系统', description: '传感器、武器、通信' },
  ];

  const handleNext = async () => {
    try {
      await form.validateFields();
      if (currentStep < steps.length - 1) {
        setCurrentStep((s) => s + 1);
      }
    } catch {
      message.warning('请完善必填信息');
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  return (
    <Drawer
      title={isEditing ? `编辑装备 - ${editingEquipment?.name}` : '新建装备'}
      placement="right"
      width={720}
      open={editorVisible}
      onClose={closeEditor}
      destroyOnClose
      extra={
        <Space>
          <Button icon={<CloseOutlined />} onClick={closeEditor}>
            取消
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            保存
          </Button>
        </Space>
      }
    >
      <Steps
        current={currentStep}
        size="small"
        style={{ marginBottom: 24 }}
        items={steps.map((step, i) => ({
          title: step.title,
          description: step.description,
          style: { cursor: 'pointer' },
          onClick: () => setCurrentStep(i),
        }))}
        onChange={(current) => setCurrentStep(current)}
      />

      <Form
        form={form}
        layout="vertical"
        size="small"
        initialValues={initialValues}
      >
        {/* ---- Step 0: 基本信息 ---- */}
        <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
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
        </div>

        {/* ---- Step 1: 平台参数 ---- */}
        <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
          <Divider titlePlacement="left">物理属性</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 16px' }}>
            <Form.Item name="altitude" label="高度">
              <Input placeholder="0 m" />
            </Form.Item>
            <Form.Item name="heading" label="航向">
              <Input placeholder="0 deg" />
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
          </div>
        </div>

        {/* ---- Step 2: 子系统 ---- */}
        <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
          <ComponentMapEditor mapName="sensors" title="传感器" form={form} />
          <ComponentMapEditor mapName="weapons" title="武器" form={form} />
          <ComponentMapEditor mapName="comms" title="通信" form={form} />
        </div>
      </Form>

      {/* ---- 底部步骤导航 ---- */}
      <Divider />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button disabled={currentStep === 0} onClick={handlePrev}>
          上一步
        </Button>
        {currentStep < steps.length - 1 ? (
          <Button type="primary" onClick={handleNext}>
            下一步
          </Button>
        ) : (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            保存
          </Button>
        )}
      </div>
    </Drawer>
  );
}
