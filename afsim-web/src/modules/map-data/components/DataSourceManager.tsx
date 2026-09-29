import React, { useState } from 'react';
import {
  Table,
  Upload,
  Button,
  Tag,
  Space,
  Modal,
  Typography,
  Progress,
  Tooltip,
  Popconfirm,
  Input,
  Select,
  message,
  Descriptions,
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  FileImageOutlined,
  EnvironmentOutlined,
  ApartmentOutlined,
  CloudServerOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMapDataStore } from '../store/mapDataStore';
import type { MapDataSource, DataSourceType } from '../types';

const { Text } = Typography;

const TYPE_ICONS: Record<DataSourceType, React.ReactNode> = {
  imagery: <FileImageOutlined />,
  terrain: <EnvironmentOutlined />,
  vector: <ApartmentOutlined />,
  geojson: <ApartmentOutlined />,
  wms: <CloudServerOutlined />,
};

const TYPE_LABELS: Record<DataSourceType, string> = {
  imagery: '影像',
  terrain: '地形',
  vector: '矢量',
  geojson: 'GeoJSON',
  wms: 'WMS',
};

const TYPE_COLORS: Record<DataSourceType, string> = {
  imagery: 'blue',
  terrain: 'green',
  vector: 'gold',
  geojson: 'orange',
  wms: 'purple',
};

const STATUS_CONFIG: Record<
  string,
  { color: string; icon: React.ReactNode; label: string }
> = {
  ready: { color: 'success', icon: <CheckCircleOutlined />, label: '就绪' },
  processing: { color: 'processing', icon: <SyncOutlined spin />, label: '处理中' },
  uploading: { color: 'processing', icon: <LoadingOutlined />, label: '上传中' },
  error: { color: 'error', icon: <ExclamationCircleOutlined />, label: '错误' },
};

const DataSourceManager: React.FC = () => {
  const {
    dataSources,
    removeDataSource,
    uploading,
    uploadProgress,
    setUploading,
    setUploadProgress,
  } = useMapDataStore();

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewSource, setPreviewSource] = useState<MapDataSource | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<DataSourceType | 'all'>('all');

  const filteredSources = dataSources.filter((s) => {
    const matchName = s.name.toLowerCase().includes(searchText.toLowerCase());
    const matchType = filterType === 'all' || s.type === filterType;
    return matchName && matchType;
  });

  const handleUpload = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['tif', 'tiff', 'dt1', 'dt2', 'shp', 'geojson', 'json', 'kml', 'kmz'];
    if (!ext || !validExts.includes(ext)) {
      message.error(`不支持的文件格式: .${ext}`);
      return false;
    }

    setUploading(true);
    setUploadProgress(0);

    // 模拟上传
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        clearInterval(interval);
        setUploadProgress(100);
        setUploading(false);
        message.success(`文件 ${file.name} 上传成功`);
      } else {
        setUploadProgress(Math.round(progress));
      }
    }, 200);

    return false; // 阻止 antd 自动上传
  };

  const handlePreview = (record: MapDataSource) => {
    setPreviewSource(record);
    setPreviewVisible(true);
  };

  const handleDelete = (id: string) => {
    removeDataSource(id);
    message.success('数据源已删除');
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const columns: ColumnsType<MapDataSource> = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 70,
      render: (type: DataSourceType) => (
        <Tag color={TYPE_COLORS[type]} icon={TYPE_ICONS[type]}>
          {TYPE_LABELS[type]}
        </Tag>
      ),
      filters: Object.entries(TYPE_LABELS).map(([value, text]) => ({ text, value })),
      onFilter: (value, record) => record.type === value,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string, record) => (
        <Tooltip title={record.url || name}>
          <Text style={{ color: '#d9d9d9' }}>{name}</Text>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string, record) => {
        const config = STATUS_CONFIG[status];
        return (
          <Tooltip title={record.errorMessage}>
            <Tag color={config.color} icon={config.icon}>
              {config.label}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '分辨率',
      key: 'resolution',
      width: 80,
      render: (_, record) => {
        const res = record.metadata.resolution;
        return res ? `${res}m` : '-';
      },
    },
    {
      title: '大小',
      key: 'fileSize',
      width: 80,
      render: (_, record) => formatFileSize(record.metadata.fileSize),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="预览">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record)}
              disabled={record.status !== 'ready'}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此数据源？"
            description="删除后不可恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 12 }}>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Text strong style={{ color: '#fff' }}>
          数据源管理
        </Text>
        <Upload
          beforeUpload={handleUpload}
          showUploadList={false}
          accept=".tif,.tiff,.dt1,.dt2,.shp,.geojson,.json,.kml,.kmz"
        >
          <Button type="primary" icon={<UploadOutlined />} size="small">
            上传数据
          </Button>
        </Upload>
      </Space>

      {uploading && (
        <Progress
          percent={Math.round(uploadProgress)}
          status="active"
          size="small"
          style={{ marginBottom: 8 }}
          strokeColor="#1677ff"
        />
      )}

      <Space style={{ marginBottom: 8, width: '100%' }}>
        <Input
          placeholder="搜索数据源..."
          size="small"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 160 }}
          allowClear
        />
        <Select
          size="small"
          value={filterType}
          onChange={setFilterType}
          style={{ width: 90 }}
          options={[
            { value: 'all', label: '全部' },
            ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
      </Space>

      <Table<MapDataSource>
        columns={columns}
        dataSource={filteredSources}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ y: 300 }}
        style={{ backgroundColor: '#141414' }}
        rowClassName={(record) =>
          record.status === 'error' ? 'datasource-row-error' : ''
        }
      />

      {/* 预览弹窗 */}
      <Modal
        title={previewSource?.name || '数据预览'}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={600}
      >
        {previewSource && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="类型">
              <Tag color={TYPE_COLORS[previewSource.type]}>
                {TYPE_LABELS[previewSource.type]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="格式">{previewSource.format || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={STATUS_CONFIG[previewSource.status]?.color}>
                {STATUS_CONFIG[previewSource.status]?.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="分辨率">
              {previewSource.metadata.resolution
                ? `${previewSource.metadata.resolution}m`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="空间参考" span={2}>
              {previewSource.metadata.srs || '-'}
            </Descriptions.Item>
            {previewSource.bounds && (
              <Descriptions.Item label="范围" span={2}>
                [{previewSource.bounds.south.toFixed(2)}, {previewSource.bounds.west.toFixed(2)}] ~
                [{previewSource.bounds.north.toFixed(2)}, {previewSource.bounds.east.toFixed(2)}]
              </Descriptions.Item>
            )}
            {previewSource.url && (
              <Descriptions.Item label="URL" span={2}>
                <Text copyable style={{ fontSize: 12, color: '#d9d9d9', wordBreak: 'break-all' }}>
                  {previewSource.url}
                </Text>
              </Descriptions.Item>
            )}
            {previewSource.errorMessage && (
              <Descriptions.Item label="错误信息" span={2}>
                <Text type="danger">{previewSource.errorMessage}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      <style>{`
        .datasource-row-error td {
          background: rgba(255, 77, 79, 0.06) !important;
        }
      `}</style>
    </div>
  );
};

export default DataSourceManager;
