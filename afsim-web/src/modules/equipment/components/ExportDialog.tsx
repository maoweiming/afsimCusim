// ============================================================
// Equipment Export Dialog
// Tree-based equipment/component selector + format choice
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  Tree,
  Select,
  Button,
  Space,
  Typography,
  Tag,
  message,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  DownloadOutlined,
  ExportOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons';
import type { AfsimEquipment } from '../afsim/types';
import type { ExportSelection } from '../io/jsonExporter';
import { downloadAfsimExport } from '../io/jsonExporter';
import { writeAfsimConf } from '../io/confWriter';

const { Text } = Typography;

type ExportFormat = 'conf' | 'json';

interface ExportDialogProps {
  open: boolean;
  equipmentList: AfsimEquipment[];
  onClose: () => void;
}

interface ComponentCheckState {
  [equipmentName: string]: {
    sensors: boolean;
    weapons: boolean;
    comms: boolean;
    mover: boolean;
    processors: boolean;
    fuel: boolean;
  };
}

export function ExportDialog({ open, equipmentList, onClose }: ExportDialogProps) {
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [format, setFormat] = useState<ExportFormat>('conf');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [componentChecks, setComponentChecks] = useState<ComponentCheckState>({});

  const handleOpen = useCallback(() => {
    const allNames = equipmentList.map((eq) => eq.name);
    setSelectedNames(allNames);

    const checks: ComponentCheckState = {};
    for (const eq of equipmentList) {
      checks[eq.name] = {
        sensors: true,
        weapons: true,
        comms: true,
        mover: true,
        processors: true,
        fuel: true,
      };
    }
    setComponentChecks(checks);
    setExpandedKeys([]);
  }, [equipmentList]);

  const treeData = useMemo<DataNode[]>(() => {
    return equipmentList.map((eq) => {
      const platform = eq.platform;
      const hasSensors = Object.keys(platform.sensors).length > 0;
      const hasWeapons = Object.keys(platform.weapons).length > 0;
      const hasComms = Object.keys(platform.comms).length > 0;
      const hasMovers = Object.keys(platform.movers).length > 0;
      const hasProcessors = Object.keys(platform.processors).length > 0;
      const hasFuels = Object.keys(platform.fuels).length > 0;

      const children: DataNode[] = [];

      if (hasSensors) {
        children.push({
          key: `${eq.name}-sensors`,
          title: `Sensors (${Object.keys(platform.sensors).length})`,
          isLeaf: true,
        });
      }
      if (hasWeapons) {
        children.push({
          key: `${eq.name}-weapons`,
          title: `Weapons (${Object.keys(platform.weapons).length})`,
          isLeaf: true,
        });
      }
      if (hasComms) {
        children.push({
          key: `${eq.name}-comms`,
          title: `Communications (${Object.keys(platform.comms).length})`,
          isLeaf: true,
        });
      }
      if (hasMovers) {
        children.push({
          key: `${eq.name}-mover`,
          title: `Mover (${Object.keys(platform.movers).length})`,
          isLeaf: true,
        });
      }
      if (hasProcessors) {
        children.push({
          key: `${eq.name}-processors`,
          title: `Processors (${Object.keys(platform.processors).length})`,
          isLeaf: true,
        });
      }
      if (hasFuels) {
        children.push({
          key: `${eq.name}-fuel`,
          title: `Fuel (${Object.keys(platform.fuels).length})`,
          isLeaf: true,
        });
      }

      return {
        key: eq.name,
        title: (
          <Text style={{ color: '#e6edf3' }}>{eq.name}</Text>
        ),
        children: children.length > 0 ? children : undefined,
      };
    });
  }, [equipmentList]);

  const handleCheck = useCallback(
    (checkedKeys: any) => {
      const keys = (checkedKeys as string[]) || [];
      const eqNames = new Set(keys.filter((k: string) => !k.includes('-')));
      const compKeys = keys.filter((k: string) => k.includes('-'));

      setSelectedNames([...eqNames]);

      const newChecks = { ...componentChecks };
      for (const eq of equipmentList) {
        if (!newChecks[eq.name]) {
          newChecks[eq.name] = { sensors: true, weapons: true, comms: true, mover: true, processors: true, fuel: true };
        }
        const eqCompKeys = compKeys.filter((k: string) => k.startsWith(`${eq.name}-`));
        newChecks[eq.name] = {
          sensors: eqCompKeys.includes(`${eq.name}-sensors`) || eqCompKeys.length === 0,
          weapons: eqCompKeys.includes(`${eq.name}-weapons`) || eqCompKeys.length === 0,
          comms: eqCompKeys.includes(`${eq.name}-comms`) || eqCompKeys.length === 0,
          mover: eqCompKeys.includes(`${eq.name}-mover`) || eqCompKeys.length === 0,
          processors: eqCompKeys.includes(`${eq.name}-processors`) || eqCompKeys.length === 0,
          fuel: eqCompKeys.includes(`${eq.name}-fuel`) || eqCompKeys.length === 0,
        };
      }
      setComponentChecks(newChecks);
    },
    [equipmentList, componentChecks],
  );

  const checkedKeys = useMemo(() => {
    const keys: string[] = [];
    for (const eq of equipmentList) {
      if (selectedNames.includes(eq.name)) {
        keys.push(eq.name);
        const checks = componentChecks[eq.name];
        if (checks) {
          if (checks.sensors) keys.push(`${eq.name}-sensors`);
          if (checks.weapons) keys.push(`${eq.name}-weapons`);
          if (checks.comms) keys.push(`${eq.name}-comms`);
          if (checks.mover) keys.push(`${eq.name}-mover`);
          if (checks.processors) keys.push(`${eq.name}-processors`);
          if (checks.fuel) keys.push(`${eq.name}-fuel`);
        }
      }
    }
    return keys;
  }, [equipmentList, selectedNames, componentChecks]);

  const handleSelectAll = useCallback(() => {
    const allNames = equipmentList.map((eq) => eq.name);
    setSelectedNames(allNames);
    const checks: ComponentCheckState = {};
    for (const eq of equipmentList) {
      checks[eq.name] = { sensors: true, weapons: true, comms: true, mover: true, processors: true, fuel: true };
    }
    setComponentChecks(checks);
  }, [equipmentList]);

  const handleExport = useCallback(() => {
    if (selectedNames.length === 0) {
      message.warning('Please select at least one equipment to export');
      return;
    }

    const selectedEquipment = equipmentList.filter((eq) => selectedNames.includes(eq.name));

    if (format === 'conf') {
      const confText = writeAfsimConf(selectedEquipment, { includeComments: true });
      const blob = new Blob([confText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `afsim_equipment_${new Date().toISOString().slice(0, 10)}.conf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const selection: ExportSelection = {
        equipmentNames: selectedNames,
        includeComponents: {
          sensors: selectedNames.some((name) => componentChecks[name]?.sensors !== false),
          weapons: selectedNames.some((name) => componentChecks[name]?.weapons !== false),
          comms: selectedNames.some((name) => componentChecks[name]?.comms !== false),
          mover: selectedNames.some((name) => componentChecks[name]?.mover !== false),
          processors: selectedNames.some((name) => componentChecks[name]?.processors !== false),
          fuel: selectedNames.some((name) => componentChecks[name]?.fuel !== false),
        },
      };
      downloadAfsimExport(equipmentList, selection);
    }

    message.success(`Exported ${selectedNames.length} equipment as .${format}`);
    onClose();
  }, [selectedNames, equipmentList, format, componentChecks, onClose]);

  return (
    <Modal
      title={
        <Space>
          <ExportOutlined />
          <span>Export Equipment</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      afterOpenChange={(visible) => { if (visible) handleOpen(); }}
      width={640}
      destroyOnClose
      styles={{
        body: { padding: '16px 24px' },
        header: { background: '#161b22', borderBottom: '1px solid #30363d' },
      }}
      footer={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSelectAll} icon={<CheckSquareOutlined />}>
            Select All
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={selectedNames.length === 0}
          >
            Export ({selectedNames.length}) as .{format}
          </Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Text style={{ color: '#e6edf3', marginRight: 8 }}>Export Format:</Text>
        <Select
          value={format}
          onChange={setFormat}
          style={{ width: 160 }}
          options={[
            { value: 'conf', label: '.conf (AFSIM)' },
            { value: 'json', label: '.json (JSON)' },
          ]}
        />
      </div>

      <div
        style={{
          maxHeight: 400,
          overflow: 'auto',
          border: '1px solid #30363d',
          borderRadius: 6,
          padding: '8px 0',
          background: '#161b22',
        }}
      >
        {equipmentList.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Text type="secondary">No equipment available for export</Text>
          </div>
        ) : (
          <Tree
            checkable
            checkedKeys={checkedKeys}
            expandedKeys={expandedKeys}
            onCheck={handleCheck}
            onExpand={(keys) => setExpandedKeys(keys as string[])}
            treeData={treeData}
            defaultExpandAll={false}
            style={{ background: 'transparent', color: '#e6edf3' }}
          />
        )}
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Tag color="blue">{selectedNames.length} equipment selected</Tag>
        {format === 'conf' && (
          <Tag color="green">Will generate AFSIM .conf text</Tag>
        )}
        {format === 'json' && (
          <Tag color="green">Will generate AFSIM JSON bundle</Tag>
        )}
      </div>
    </Modal>
  );
}
