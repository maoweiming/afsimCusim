import { useState } from 'react';
import {
  Card,
  Upload,
  Select,
  Button,
  Space,
  Typography,
  Steps,
  Table,
  Tag,
  Checkbox,
  Radio,
  Progress,
  message,
  Divider,
  Alert,
  List,
  Modal,
  Input,
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  CodeOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  DeleteOutlined,
  ImportOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, RcFile } from 'antd/es/upload';
import { useDataCenterStore } from '../store/dataCenterStore';
import type { DataItem, ExportFormat, ExportConfig, ImportJob } from '../types';

const { Text, Title, Paragraph } = Typography;
const { Dragger } = Upload;

// ============ 辅助函数 ============

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function typeToLabel(type: DataItem['type']): string {
  const map: Record<DataItem['type'], string> = {
    equipment: '装备',
    scenario: '想定',
    simulation: '仿真',
    replay: '回放',
  };
  return map[type];
}

function formatIcon(format: ExportFormat) {
  const map: Record<ExportFormat, React.ReactNode> = {
    json: <CodeOutlined style={{ color: '#faad14' }} />,
    csv: <FileExcelOutlined style={{ color: '#52c41a' }} />,
    xml: <FileTextOutlined style={{ color: '#1890ff' }} />,
    excel: <FileExcelOutlined style={{ color: '#52c41a' }} />,
  };
  return map[format];
}

function formatLabel(format: ExportFormat): string {
  const map: Record<ExportFormat, string> = {
    json: 'JSON',
    csv: 'CSV',
    xml: 'XML',
    excel: 'Excel (.xlsx)',
  };
  return map[format];
}

// ============ 导出面板 ============

function ExportPanel() {
  const dataItems = useDataCenterStore((s) => s.dataItems);

  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: 'json',
    dataTypes: ['equipment', 'scenario'],
    includeMetadata: true,
    compression: false,
  });
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handleExport = () => {
    if (exportConfig.dataTypes.length === 0) {
      message.warning('请至少选择一种数据类型');
      return;
    }

    setExporting(true);
    setExportProgress(0);

    // Simulate export progress
    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setExporting(false);
          message.success('导出完成');
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const selectedCount = dataItems.filter((item) =>
    exportConfig.dataTypes.includes(item.type)
  ).length;

  const selectedSize = dataItems
    .filter((item) => exportConfig.dataTypes.includes(item.type))
    .reduce((sum, item) => sum + (item.size ?? 0), 0);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* 格式选择 */}
      <Card size="small" title="导出格式" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
        <Radio.Group
          value={exportConfig.format}
          onChange={(e) => setExportConfig({ ...exportConfig, format: e.target.value })}
          style={{ width: '100%' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(['json', 'csv', 'xml', 'excel'] as ExportFormat[]).map((format) => (
              <Card
                key={format}
                hoverable
                size="small"
                style={{
                  background: exportConfig.format === format ? '#1e2a3a' : 'var(--bg-primary)',
                  borderColor: exportConfig.format === format ? '#0078d7' : 'var(--border-color)',
                }}
              >
                <Radio value={format}>
                  <Space>
                    {formatIcon(format)}
                    <div>
                      <Text strong>{formatLabel(format)}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {format === 'json' && '通用格式，适合程序处理'}
                        {format === 'csv' && '表格格式，适合Excel打开'}
                        {format === 'xml' && '结构化格式，适合系统集成'}
                        {format === 'excel' && '原生Excel格式，支持多Sheet'}
                      </Text>
                    </div>
                  </Space>
                </Radio>
              </Card>
            ))}
          </div>
        </Radio.Group>
      </Card>

      {/* 数据类型选择 */}
      <Card size="small" title="数据类型" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
        <Checkbox.Group
          value={exportConfig.dataTypes}
          onChange={(values) =>
            setExportConfig({ ...exportConfig, dataTypes: values as DataItem['type'][] })
          }
        >
          <Space direction="vertical" size={8}>
            {(['equipment', 'scenario', 'simulation', 'replay'] as DataItem['type'][]).map(
              (type) => {
                const count = dataItems.filter((i) => i.type === type).length;
                return (
                  <Checkbox key={type} value={type}>
                    <Space>
                      <Text>{typeToLabel(type)}</Text>
                      <Tag>{count} 项</Tag>
                    </Space>
                  </Checkbox>
                );
              }
            )}
          </Space>
        </Checkbox.Group>
      </Card>

      {/* 导出选项 */}
      <Card size="small" title="导出选项" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
        <Space direction="vertical" size={8}>
          <Checkbox
            checked={exportConfig.includeMetadata}
            onChange={(e) =>
              setExportConfig({ ...exportConfig, includeMetadata: e.target.checked })
            }
          >
            包含元数据（创建时间、作者、标签等）
          </Checkbox>
          <Checkbox
            checked={exportConfig.compression}
            onChange={(e) =>
              setExportConfig({ ...exportConfig, compression: e.target.checked })
            }
          >
            启用压缩（ZIP 格式）
          </Checkbox>
        </Space>
      </Card>

      {/* 导出摘要 */}
      <Card size="small" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Text type="secondary">已选：</Text>
            <Text strong>{selectedCount} 项</Text>
            <Text type="secondary">/</Text>
            <Text strong>{formatBytes(selectedSize)}</Text>
          </Space>
          <Button
            type="primary"
            icon={<ExportOutlined />}
            onClick={handleExport}
            loading={exporting}
            disabled={exportConfig.dataTypes.length === 0}
          >
            开始导出
          </Button>
        </Space>
        {exporting && (
          <Progress
            percent={exportProgress}
            status="active"
            size="small"
            style={{ marginTop: 8 }}
          />
        )}
      </Card>
    </Space>
  );
}

// ============ 导入面板 ============

function ImportPanel() {
  const dataItems = useDataCenterStore((s) => s.dataItems);

  const [importFormat, setImportFormat] = useState<ExportFormat>('json');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [step, setStep] = useState(0);

  const handleUpload = (file: RcFile) => {
    setFileList([file as UploadFile]);
    return false; // Prevent auto upload
  };

  const handleImport = () => {
    if (fileList.length === 0) {
      message.warning('请先选择文件');
      return;
    }

    setImporting(true);
    setImportProgress(0);
    setStep(1);

    // Simulate import progress
    const interval = setInterval(() => {
      setImportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setImporting(false);
          setStep(2);
          setImportResult({
            success: 15,
            failed: 2,
            errors: [
              '行 23: 缺少必填字段 "name"',
              '行 45: 数据类型 "unknown_type" 不支持',
            ],
          });
          return 100;
        }
        return prev + 5;
      });
    }, 150);
  };

  const handleReset = () => {
    setFileList([]);
    setImporting(false);
    setImportProgress(0);
    setImportResult(null);
    setStep(0);
  };

  const steps = [
    {
      title: '选择文件',
      description: '上传数据文件',
    },
    {
      title: '导入处理',
      description: '解析并验证数据',
    },
    {
      title: '导入完成',
      description: '查看导入结果',
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Steps current={step} size="small" items={steps} />

      {step === 0 && (
        <>
          {/* 格式选择 */}
          <Card size="small" title="导入格式" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
            <Select
              style={{ width: 200 }}
              value={importFormat}
              onChange={setImportFormat}
              options={(['json', 'csv', 'xml', 'excel'] as ExportFormat[]).map((f) => ({
                value: f,
                label: (
                  <Space>
                    {formatIcon(f)}
                    {formatLabel(f)}
                  </Space>
                ),
              }))}
            />
          </Card>

          {/* 文件上传 */}
          <Card size="small" title="上传文件" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
            <Dragger
              fileList={fileList}
              beforeUpload={handleUpload}
              onRemove={() => setFileList([])}
              accept={
                importFormat === 'json'
                  ? '.json'
                  : importFormat === 'csv'
                    ? '.csv'
                    : importFormat === 'xml'
                      ? '.xml'
                      : '.xlsx,.xls'
              }
              maxCount={1}
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: '#0078d7' }} />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持 {formatLabel(importFormat)} 格式文件
              </p>
            </Dragger>
          </Card>

          {/* 导入提示 */}
          <Alert
            message="导入说明"
            description={
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li>导入数据将自动合并到现有数据中</li>
                <li>同名数据将更新版本，不会覆盖</li>
                <li>导入的数据默认为"草稿"状态</li>
                <li>建议先备份现有数据</li>
              </ul>
            }
            type="info"
            showIcon
          />

          <Button
            type="primary"
            icon={<ImportOutlined />}
            onClick={handleImport}
            disabled={fileList.length === 0}
            block
          >
            开始导入
          </Button>
        </>
      )}

      {step === 1 && (
        <Card size="small" bordered={false} style={{ background: 'var(--bg-secondary)', textAlign: 'center' }}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <LoadingOutlined style={{ fontSize: 48, color: '#0078d7' }} />
            <Title level={5} style={{ margin: 0 }}>
              正在导入数据...
            </Title>
            <Progress percent={importProgress} status="active" style={{ maxWidth: 400 }} />
            <Text type="secondary">正在解析 {fileList[0]?.name}</Text>
          </Space>
        </Card>
      )}

      {step === 2 && importResult && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Card size="small" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
            <Space direction="vertical" size={12} style={{ width: '100%', textAlign: 'center' }}>
              <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
              <Title level={5} style={{ margin: 0 }}>
                导入完成
              </Title>
              <Space size={24}>
                <div>
                  <Text type="secondary">成功</Text>
                  <br />
                  <Text strong style={{ fontSize: 24, color: '#52c41a' }}>
                    {importResult.success}
                  </Text>
                </div>
                <div>
                  <Text type="secondary">失败</Text>
                  <br />
                  <Text strong style={{ fontSize: 24, color: '#ff4d4f' }}>
                    {importResult.failed}
                  </Text>
                </div>
              </Space>
            </Space>
          </Card>

          {importResult.errors.length > 0 && (
            <Card size="small" title="错误详情" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
              <List
                size="small"
                dataSource={importResult.errors}
                renderItem={(error) => (
                  <List.Item>
                    <Space>
                      <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                      <Text style={{ fontSize: 12 }}>{error}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          )}

          <Button onClick={handleReset} block>
            继续导入
          </Button>
        </Space>
      )}
    </Space>
  );
}

// ============ 主组件 ============

export default function DataExport() {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>
      {/* 标签切换 */}
      <Card size="small" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
        <Space>
          <Button
            type={activeTab === 'export' ? 'primary' : 'default'}
            icon={<ExportOutlined />}
            onClick={() => setActiveTab('export')}
          >
            数据导出
          </Button>
          <Button
            type={activeTab === 'import' ? 'primary' : 'default'}
            icon={<ImportOutlined />}
            onClick={() => setActiveTab('import')}
          >
            数据导入
          </Button>
        </Space>
      </Card>

      {/* 内容区域 */}
      {activeTab === 'export' ? <ExportPanel /> : <ImportPanel />}
    </div>
  );
}
