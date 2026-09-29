// ============================================================
// Equipment Module - Import/Export Component
// AFSIM-native: uses AfsimEquipment
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  Upload,
  Button,
  Table,
  List,
  Tag,
  Space,
  Typography,
  Steps,
  message,
  Divider,
  Alert,
} from 'antd';
import type { UploadFile, RcFile } from 'antd/es/upload';
import type { ColumnsType } from 'antd/es/table';
import {
  UploadOutlined,
  DownloadOutlined,
  FileTextOutlined as FileJsonOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ImportOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { useEquipmentStore } from '../store/equipmentStore';
import type { AfsimEquipment } from '../afsim/types';
import { importAfsimJson } from '../io/jsonImporter';

const { Text, Title, Paragraph } = Typography;

// ============ Component ============

interface EquipmentImportExportProps {
  open: boolean;
  mode: 'import' | 'export';
  selectedNames?: string[];
  onClose: () => void;
}

export function EquipmentImportExport({
  open,
  mode,
  selectedNames = [],
  onClose,
}: EquipmentImportExportProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [parsedItems, setParsedItems] = useState<AfsimEquipment[]>([]);
  const [validationErrors, setValidationErrors] = useState<Array<{ index: number; name: string; field: string; message: string }>>([]);
  const [importStep, setImportStep] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);

  const importEquipment = useEquipmentStore((s) => s.importEquipment);
  const exportEquipment = useEquipmentStore((s) => s.exportEquipment);
  const exporting = useEquipmentStore((s) => s.exporting);
  const importing = useEquipmentStore((s) => s.importing);
  const equipmentList = useEquipmentStore((s) => s.equipmentList);

  const handleClose = useCallback(() => {
    setFileList([]);
    setParsedItems([]);
    setValidationErrors([]);
    setImportStep(0);
    setParseError(null);
    onClose();
  }, [onClose]);

  const handleFileRead = useCallback((file: RcFile) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const result = importAfsimJson(text);
        setParsedItems(result.valid);
        setValidationErrors(result.errors);
        if (result.valid.length === 0 && result.errors.length > 0) {
          setParseError(result.errors[0].message);
        } else {
          setParseError(null);
        }
        setImportStep(1);
      } catch {
        setParseError('JSON 解析失败，请检查文件格式');
        setParsedItems([]);
        setValidationErrors([]);
      }
    };
    reader.readAsText(file);
    return false;
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (parsedItems.length === 0) {
      message.warning('没有可导入的有效装备数据');
      return;
    }
    try {
      await importEquipment(parsedItems);
      message.success(`成功导入 ${parsedItems.length} 条装备数据`);
      setImportStep(2);
    } catch {
      message.error('导入失败，请稍后重试');
    }
  }, [parsedItems, importEquipment]);

  const handleExport = useCallback(async () => {
    if (selectedNames.length === 0) {
      message.warning('请先选择要导出的装备');
      return;
    }
    try {
      await exportEquipment(selectedNames);
      message.success(`已导出 ${selectedNames.length} 条装备数据`);
      handleClose();
    } catch {
      message.error('导出失败，请稍后重试');
    }
  }, [selectedNames, exportEquipment, handleClose]);

  const previewColumns = useMemo<ColumnsType<AfsimEquipment>>(
    () => [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        width: 200,
        ellipsis: true,
      },
      {
        title: '空间域',
        key: 'domain',
        width: 90,
        render: (_: unknown, record: AfsimEquipment) => (
          <Tag color="blue">{record.platform.spatialDomain || '—'}</Tag>
        ),
      },
      {
        title: '子系统',
        key: 'components',
        width: 200,
        render: (_: unknown, record: AfsimEquipment) => {
          const parts: string[] = [];
          const s = Object.keys(record.platform.sensors || {}).length;
          const w = Object.keys(record.platform.weapons || {}).length;
          if (s) parts.push(`${s}传感器`);
          if (w) parts.push(`${w}武器`);
          return parts.length > 0 ? (
            <Space size={2} wrap>
              {parts.map((pt) => <Tag key={pt} style={{ fontSize: 11 }}>{pt}</Tag>)}
            </Space>
          ) : <span style={{ color: '#30363d' }}>—</span>;
        },
      },
    ],
    [],
  );

  const selectedEquipment = useMemo(
    () => equipmentList.filter((eq) => selectedNames.includes(eq.name)),
    [equipmentList, selectedNames],
  );

  const renderImportModal = () => (
    <Modal
      title={<Space><ImportOutlined /><span>批量导入装备</span></Space>}
      open={open && mode === 'import'}
      onCancel={handleClose}
      width={720}
      footer={null}
      destroyOnClose
      styles={{ body: { padding: '16px 0' }, header: { background: '#161b22', borderBottom: '1px solid #30363d' } }}
    >
      <Steps current={importStep} size="small" style={{ marginBottom: 24, padding: '0 24px' }} items={[
        { title: '上传文件', icon: <FileJsonOutlined /> },
        { title: '预览确认', icon: <ExclamationCircleOutlined /> },
        { title: '导入完成', icon: <CheckCircleOutlined /> },
      ]} />

      {importStep === 0 && (
        <div style={{ padding: '0 24px' }}>
          <div style={{ border: '2px dashed #30363d', borderRadius: 8, padding: '40px 24px', textAlign: 'center', background: '#161b22', marginBottom: 16 }}>
            <Upload accept=".json,.conf,.cfg,.txt" maxCount={1} fileList={fileList}
              beforeUpload={(file) => { setFileList([file]); handleFileRead(file); return false; }}
              onRemove={() => { setFileList([]); setParsedItems([]); setValidationErrors([]); setParseError(null); }}
              showUploadList={{ showRemoveIcon: true }}
            >
              <Button icon={<UploadOutlined />} size="large" type="primary">选择文件</Button>
            </Upload>
            <Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, fontSize: 13 }}>
              支持 AFSIM .conf/.txt 和 JSON 格式
            </Paragraph>
          </div>
          {parseError && <Alert type="error" message="解析错误" description={parseError} showIcon style={{ background: '#2d1b1b', border: '1px solid #5c2626' }} />}
        </div>
      )}

      {importStep === 1 && (
        <div style={{ padding: '0 24px' }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>有效: {parsedItems.length} 条</Tag>
            {validationErrors.length > 0 && <Tag color="red" style={{ fontSize: 14, padding: '4px 12px' }}>错误: {validationErrors.length}</Tag>}
          </div>
          {parsedItems.length > 0 && (
            <Table<AfsimEquipment> columns={previewColumns} dataSource={parsedItems} rowKey={(eq) => eq.name} size="small" pagination={false} scroll={{ y: 240 }} style={{ marginBottom: 16 }} />
          )}
          {validationErrors.length > 0 && (
            <List size="small" dataSource={validationErrors.slice(0, 10)} style={{ marginBottom: 16 }}
              renderItem={(err) => (
                <List.Item style={{ padding: '4px 0', borderBottom: '1px solid #1c2128' }}>
                  <Space size="small">
                    <Tag color="red">{`#${err.index + 1}`}</Tag>
                    <Text type="danger" style={{ fontSize: 12 }}>{err.message}</Text>
                  </Space>
                </List.Item>
              )}
            />
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <Button onClick={() => setImportStep(0)}>重新选择文件</Button>
            <Space>
              <Button onClick={handleClose}>取消</Button>
              <Button type="primary" onClick={handleConfirmImport} loading={importing} disabled={parsedItems.length === 0}>
                确认导入 ({parsedItems.length} 条)
              </Button>
            </Space>
          </div>
        </div>
      )}

      {importStep === 2 && (
        <div style={{ padding: '0 24px', textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
          <Title level={4} style={{ color: '#e6edf3' }}>导入完成</Title>
          <Paragraph type="secondary">成功导入 {parsedItems.length} 条装备数据</Paragraph>
          <Button type="primary" onClick={handleClose}>完成</Button>
        </div>
      )}
    </Modal>
  );

  const renderExportModal = () => (
    <Modal
      title={<Space><ExportOutlined /><span>导出装备数据</span></Space>}
      open={open && mode === 'export'}
      onCancel={handleClose}
      width={560}
      destroyOnClose
      styles={{ body: { padding: '16px 24px' }, header: { background: '#161b22', borderBottom: '1px solid #30363d' } }}
      footer={
        <Space>
          <Button onClick={handleClose}>取消</Button>
          <Button type="primary" icon={<DownloadOutlined />} loading={exporting} onClick={handleExport} disabled={selectedNames.length === 0}>
            导出 JSON ({selectedNames.length} 条)
          </Button>
        </Space>
      }
    >
      {selectedNames.length === 0 ? (
        <Alert type="warning" message="未选择装备" description="请先在列表中选择要导出的装备。" showIcon style={{ background: '#2d2b1b', border: '1px solid #5c5426' }} />
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <Text style={{ color: '#e6edf3' }}>即将导出 <Text strong style={{ color: '#4da0e8' }}>{selectedNames.length}</Text> 条装备数据</Text>
          </div>
          <List size="small" dataSource={selectedEquipment} style={{ maxHeight: 300, overflow: 'auto', border: '1px solid #30363d', borderRadius: 6, background: '#161b22' }}
            renderItem={(eq) => (
              <List.Item style={{ padding: '8px 16px', borderBottom: '1px solid #1c2128' }}>
                <Space size="middle">
                  <Text style={{ color: '#e6edf3' }}>{eq.name}</Text>
                  {eq.platform.spatialDomain && <Tag color="blue">{eq.platform.spatialDomain}</Tag>}
                </Space>
              </List.Item>
            )}
          />
        </>
      )}
    </Modal>
  );

  return mode === 'import' ? renderImportModal() : renderExportModal();
}
