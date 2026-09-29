// ============================================================
// Equipment Import Dialog
// File upload (.conf / .json) + preview + confirm
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  Upload,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  Steps,
  message,
  Alert,
  List,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, RcFile } from 'antd/es/upload';
import {
  UploadOutlined,
  ImportOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { AfsimEquipment } from '../afsim/types';
import type { AfsimParseError } from '../io/confParser';
import { parseAfsimConf } from '../io/confParser';
import { importAfsimJson, isAfsimFormat } from '../io/jsonImporter';

const { Text, Title, Paragraph } = Typography;

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (equipment: AfsimEquipment[]) => Promise<void> | void;
}

type ImportStep = 0 | 1 | 2;

export function ImportDialog({ open, onClose, onImport }: ImportDialogProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [parsedEquipment, setParsedEquipment] = useState<AfsimEquipment[]>([]);
  const [parseErrors, setParseErrors] = useState<Array<{ line?: number; name: string; field: string; message: string }>>([]);
  const [step, setStep] = useState<ImportStep>(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<'conf' | 'json' | null>(null);

  // Reset on close
  const handleClose = useCallback(() => {
    setFileList([]);
    setParsedEquipment([]);
    setParseErrors([]);
    setStep(0);
    setParseError(null);
    setDetectedFormat(null);
    onClose();
  }, [onClose]);

  // Parse uploaded file
  const handleFileRead = useCallback((file: RcFile) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;

      // Detect format
      const isConf = file.name.endsWith('.conf') || file.name.endsWith('.cfg') || file.name.endsWith('.txt');
      const isJson = file.name.endsWith('.json') || file.type === 'application/json';

      if (isConf) {
        setDetectedFormat('conf');
        const result = parseAfsimConf(text);
        setParsedEquipment(result.equipment);
        setParseErrors(
          result.errors.map((err) => ({
            line: err.line,
            name: 'Parse error',
            field: 'conf',
            message: err.message,
          })),
        );
        setParseError(null);
        setStep(1);
      } else if (isJson || isAfsimFormat(text)) {
        setDetectedFormat('json');
        const result = importAfsimJson(text);
        setParsedEquipment(result.valid);
        setParseErrors(result.errors);
        if (result.valid.length === 0 && result.errors.length > 0) {
          setParseError(result.errors[0].message);
        } else {
          setParseError(null);
        }
        setStep(1);
      } else {
        // Try JSON first, then conf
        try {
          setDetectedFormat('json');
          const result = importAfsimJson(text);
          if (result.valid.length > 0 || result.errors.length > 0) {
            setParsedEquipment(result.valid);
            setParseErrors(result.errors);
            setParseError(null);
            setStep(1);
            return;
          }
        } catch {
          // Fall through to conf
        }

        setDetectedFormat('conf');
        const result = parseAfsimConf(text);
        setParsedEquipment(result.equipment);
        setParseErrors(
          result.errors.map((err) => ({
            line: err.line,
            name: 'Parse error',
            field: 'conf',
            message: err.message,
          })),
        );
        setParseError(null);
        setStep(1);
      }
    };
    reader.readAsText(file);
    return false; // prevent auto upload
  }, []);

  // Confirm import
  const handleConfirmImport = useCallback(async () => {
    if (parsedEquipment.length === 0) {
      message.warning('No valid equipment data to import');
      return;
    }
    setImporting(true);
    try {
      await onImport(parsedEquipment);
      message.success(`Successfully imported ${parsedEquipment.length} equipment`);
      setStep(2);
    } catch (err) {
      message.error(`Import failed: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  }, [parsedEquipment, onImport]);

  // Preview table columns
  const previewColumns = useMemo<ColumnsType<AfsimEquipment>>(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        width: 200,
        ellipsis: true,
      },
      {
        title: 'Domain',
        key: 'domain',
        width: 80,
        render: (_: unknown, record: AfsimEquipment) => (
          <Tag>{record.platform.spatialDomain}</Tag>
        ),
      },
      {
        title: 'Components',
        key: 'components',
        width: 200,
        render: (_: unknown, record: AfsimEquipment) => {
          const parts: string[] = [];
          const s = Object.keys(record.platform.sensors).length;
          const w = Object.keys(record.platform.weapons).length;
          const c = Object.keys(record.platform.comms).length;
          const m = Object.keys(record.platform.movers).length;
          const p = Object.keys(record.platform.processors).length;
          if (s) parts.push(`${s} sensor${s > 1 ? 's' : ''}`);
          if (w) parts.push(`${w} weapon${w > 1 ? 's' : ''}`);
          if (c) parts.push(`${c} comm${c > 1 ? 's' : ''}`);
          if (m) parts.push(`${m} mover${m > 1 ? 's' : ''}`);
          if (p) parts.push(`${p} processor${p > 1 ? 's' : ''}`);
          return (
            <Space size={2} wrap>
              {parts.map((pt) => (
                <Tag key={pt} style={{ fontSize: 11 }}>{pt}</Tag>
              ))}
            </Space>
          );
        },
      },
    ],
    [],
  );

  return (
    <Modal
      title={
        <Space>
          <ImportOutlined />
          <span>Import Equipment</span>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      width={760}
      footer={null}
      destroyOnClose
      styles={{
        body: { padding: '16px 0' },
        header: { background: '#161b22', borderBottom: '1px solid #30363d' },
      }}
    >
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 24, padding: '0 24px' }}
        items={[
          { title: 'Upload File', icon: <FileTextOutlined /> },
          { title: 'Preview & Confirm', icon: <ExclamationCircleOutlined /> },
          { title: 'Import Complete', icon: <CheckCircleOutlined /> },
        ]}
      />

      {/* Step 0: File Upload */}
      {step === 0 && (
        <div style={{ padding: '0 24px' }}>
          <div
            style={{
              border: '2px dashed #30363d',
              borderRadius: 8,
              padding: '40px 24px',
              textAlign: 'center',
              background: '#161b22',
              marginBottom: 16,
            }}
          >
            <Upload
              accept=".conf,.cfg,.txt,.json"
              maxCount={1}
              fileList={fileList}
              beforeUpload={(file) => {
                const isValidType =
                  file.name.endsWith('.conf') ||
                  file.name.endsWith('.cfg') ||
                  file.name.endsWith('.txt') ||
                  file.name.endsWith('.json') ||
                  file.type === 'application/json' ||
                  file.type === 'text/plain';

                if (!isValidType) {
                  message.error('Only .conf, .cfg, .txt, and .json files are supported');
                  return Upload.LIST_IGNORE;
                }

                setFileList([file]);
                handleFileRead(file);
                return false;
              }}
              onRemove={() => {
                setFileList([]);
                setParsedEquipment([]);
                setParseErrors([]);
                setParseError(null);
              }}
              showUploadList={{ showRemoveIcon: true }}
            >
              <Button icon={<UploadOutlined />} size="large" type="primary">
                Select .conf, .txt, or .json File
              </Button>
            </Upload>
            <Paragraph
              type="secondary"
              style={{ marginTop: 16, marginBottom: 0, fontSize: 13 }}
            >
              Supports AFSIM .conf/.txt format and AFSIM JSON format
            </Paragraph>
          </div>

          {parseError && (
            <Alert
              type="error"
              message="Parse Error"
              description={parseError}
              showIcon
              style={{ background: '#2d1b1b', border: '1px solid #5c2626' }}
            />
          )}
        </div>
      )}

      {/* Step 1: Preview */}
      {step === 1 && (
        <div style={{ padding: '0 24px' }}>
          {/* Summary */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              marginBottom: 16,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {detectedFormat && (
              <Tag color="blue" style={{ fontSize: 13, padding: '4px 12px' }}>
                Format: .{detectedFormat}
              </Tag>
            )}
            <Tag color="green" style={{ fontSize: 13, padding: '4px 12px' }}>
              Valid: {parsedEquipment.length} items
            </Tag>
            {parseErrors.length > 0 && (
              <Tag color="red" style={{ fontSize: 13, padding: '4px 12px' }}>
                Errors: {parseErrors.length}
              </Tag>
            )}
          </div>

          {/* Valid items preview */}
          {parsedEquipment.length > 0 && (
            <Table<AfsimEquipment>
              columns={previewColumns}
              dataSource={parsedEquipment}
              rowKey={(eq) => eq.name}
              size="small"
              pagination={false}
              scroll={{ y: 260 }}
              style={{ marginBottom: 16 }}
            />
          )}

          {/* Parse errors */}
          {parseErrors.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ color: '#e6edf3', marginBottom: 8, display: 'block' }}>
                Errors:
              </Text>
              <List
                size="small"
                dataSource={parseErrors.slice(0, 10)}
                style={{
                  maxHeight: 120,
                  overflow: 'auto',
                  border: '1px solid #30363d',
                  borderRadius: 4,
                  background: '#161b22',
                }}
                renderItem={(err) => (
                  <List.Item style={{ padding: '4px 12px', borderBottom: '1px solid #1c2128' }}>
                    <Space size="small">
                      {err.line != null && <Tag color="red">Line {err.line}</Tag>}
                      <Text type="danger" style={{ fontSize: 12 }}>
                        {err.message}
                      </Text>
                    </Space>
                  </List.Item>
                )}
              />
              {parseErrors.length > 10 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ...and {parseErrors.length - 10} more errors
                </Text>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <Button onClick={() => { setStep(0); setParsedEquipment([]); setParseErrors([]); }}>
              Re-select File
            </Button>
            <Space>
              <Button onClick={handleClose}>Cancel</Button>
              <Button
                type="primary"
                onClick={handleConfirmImport}
                loading={importing}
                disabled={parsedEquipment.length === 0}
              >
                Confirm Import ({parsedEquipment.length} items)
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* Step 2: Done */}
      {step === 2 && (
        <div style={{ padding: '0 24px', textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
          <Title level={4} style={{ color: '#e6edf3' }}>
            Import Complete
          </Title>
          <Paragraph type="secondary">
            Successfully imported {parsedEquipment.length} equipment definitions
          </Paragraph>
          <Button type="primary" onClick={handleClose}>
            Done
          </Button>
        </div>
      )}
    </Modal>
  );
}

