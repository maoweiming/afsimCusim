import { useState, useMemo, type CSSProperties } from 'react';
import {
  Drawer,
  List,
  Badge,
  Tag,
  Button,
  Select,
  Space,
  Typography,
  Empty,
  ConfigProvider,
  theme,
} from 'antd';
import {
  ExportOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useErrorStore,
  type AppError,
  type ErrorSource,
  type ErrorSeverity,
} from '../../store/errorStore';

const { Text } = Typography;

interface ErrorDashboardProps {
  open: boolean;
  onClose: () => void;
}

const SEVERITY_COLORS: Record<ErrorSeverity, string> = {
  info: '#4fc3f7',
  warning: '#ffb74d',
  error: '#ef5350',
  critical: '#d32f2f',
};

const SOURCE_OPTIONS: { value: ErrorSource | 'all'; label: string }[] = [
  { value: 'all', label: '全部来源' },
  { value: 'websocket', label: 'WebSocket' },
  { value: 'api', label: 'API' },
  { value: 'render', label: 'Render' },
  { value: 'simulation', label: 'Simulation' },
  { value: 'unknown', label: 'Unknown' },
];

const SEVERITY_OPTIONS: { value: ErrorSeverity | 'all'; label: string }[] = [
  { value: 'all', label: '全部级别' },
  { value: 'info', label: '信息' },
  { value: 'warning', label: '警告' },
  { value: 'error', label: '错误' },
  { value: 'critical', label: '严重' },
];

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  } as CSSProperties,
  filters: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap' as const,
  } as CSSProperties,
  errorItem: {
    cursor: 'pointer',
    marginBottom: 8,
    borderRadius: 6,
    border: '1px solid #30363d',
    padding: '10px 14px',
  } as CSSProperties,
  errorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as CSSProperties,
  detailBlock: {
    marginTop: 10,
    padding: 10,
    borderRadius: 4,
    fontSize: 12,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    maxHeight: 200,
    overflow: 'auto',
  } as CSSProperties,
  itemActions: {
    marginTop: 8,
  } as CSSProperties,
};

function exportErrors(errors: AppError[]) {
  const blob = new Blob([JSON.stringify(errors, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `errors-${dayjs().format('YYYYMMDD-HHmmss')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ErrorDashboard({ open, onClose }: ErrorDashboardProps) {
  const errors = useErrorStore((s) => s.errors);
  const resolveError = useErrorStore((s) => s.resolveError);
  const clearResolved = useErrorStore((s) => s.clearResolved);
  const clearAll = useErrorStore((s) => s.clearAll);

  const [sourceFilter, setSourceFilter] = useState<ErrorSource | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<ErrorSeverity | 'all'>(
    'all',
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredErrors = useMemo(() => {
    return errors.filter((e) => {
      if (sourceFilter !== 'all' && e.source !== sourceFilter) return false;
      if (severityFilter !== 'all' && e.severity !== severityFilter)
        return false;
      return true;
    });
  }, [errors, sourceFilter, severityFilter]);

  const unresolvedCount = errors.filter((e) => !e.resolved).length;
  const resolvedCount = errors.filter((e) => e.resolved).length;

  const handleExport = () => exportErrors(filteredErrors);

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorBgElevated: '#111820',
          colorBorderSecondary: '#30363d',
          colorText: '#e6edf3',
          colorTextSecondary: '#8b949e',
        },
      }}
    >
      <Drawer
        title="错误监控面板"
        placement="right"
        width={520}
        open={open}
        onClose={onClose}
        styles={{ body: { background: '#0d1117', padding: '16px 20px' } }}
      >
        {/* Header with bulk actions */}
        <div style={styles.header}>
          <Space>
            <Text style={{ color: '#e6edf3' }}>
              共 {unresolvedCount} 条未解决
            </Text>
            {resolvedCount > 0 && (
              <Text type="secondary">({resolvedCount} 已解决)</Text>
            )}
          </Space>
          <Space>
            <Button
              size="small"
              icon={<DeleteOutlined />}
              onClick={clearResolved}
              disabled={resolvedCount === 0}
            >
              清除已解决
            </Button>
            <Button
              size="small"
              icon={<ExportOutlined />}
              onClick={handleExport}
              disabled={filteredErrors.length === 0}
            >
              导出 JSON
            </Button>
            <Button
              size="small"
              danger
              onClick={clearAll}
              disabled={errors.length === 0}
            >
              清空全部
            </Button>
          </Space>
        </div>

        {/* Filter bar */}
        <div style={styles.filters}>
          <Select
            size="small"
            value={sourceFilter}
            onChange={setSourceFilter}
            options={SOURCE_OPTIONS}
            style={{ width: 140 }}
          />
          <Select
            size="small"
            value={severityFilter}
            onChange={setSeverityFilter}
            options={SEVERITY_OPTIONS}
            style={{ width: 140 }}
          />
        </div>

        {/* Error list */}
        {filteredErrors.length === 0 ? (
          <Empty
            description={
              <span style={{ color: '#8b949e' }}>
                {errors.length === 0 ? '暂无错误记录' : '无匹配的错误'}
              </span>
            }
            style={{ marginTop: 80 }}
          />
        ) : (
          <List
            dataSource={filteredErrors}
            split={false}
            renderItem={(error) => {
              const isExpanded = expandedId === error.id;
              const hasDetail =
                error.detail || error.stack || error.context;

              return (
                <List.Item
                  style={{
                    ...styles.errorItem,
                    opacity: error.resolved ? 0.5 : 1,
                    background: isExpanded ? '#161b22' : '#0d1117',
                  }}
                  onClick={() => hasDetail && handleToggle(error.id)}
                >
                  <div style={{ width: '100%' }}>
                    {/* Error header row */}
                    <div style={styles.errorHeader}>
                      <Badge
                        color={SEVERITY_COLORS[error.severity]}
                        text={
                          <Text
                            style={{
                              color: SEVERITY_COLORS[error.severity],
                              fontSize: 12,
                              fontWeight: 500,
                              textTransform: 'uppercase',
                            }}
                          >
                            {error.severity}
                          </Text>
                        }
                      />
                      <Tag
                        color="default"
                        style={{
                          margin: 0,
                          fontSize: 11,
                          borderColor: '#30363d',
                          color: '#8b949e',
                        }}
                      >
                        {error.source}
                      </Tag>
                      <Text
                        type="secondary"
                        style={{ fontSize: 12, marginLeft: 'auto' }}
                      >
                        {dayjs(error.timestamp).format('HH:mm:ss.SSS')}
                      </Text>
                    </div>

                    {/* Error message */}
                    <div style={{ marginTop: 6 }}>
                      <Text
                        style={{
                          color: '#e6edf3',
                          fontSize: 13,
                          textDecoration: error.resolved
                            ? 'line-through'
                            : undefined,
                        }}
                      >
                        {error.message}
                      </Text>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && hasDetail && (
                      <div>
                        {error.detail && (
                          <pre style={styles.detailBlock}>
                            {error.detail}
                          </pre>
                        )}
                        {error.stack && (
                          <pre style={styles.detailBlock}>{error.stack}</pre>
                        )}
                        {error.context && (
                          <pre style={styles.detailBlock}>
                            {JSON.stringify(error.context, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={styles.itemActions}>
                      <Button
                        type="link"
                        size="small"
                        icon={<CheckCircleOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          resolveError(error.id);
                        }}
                        disabled={error.resolved}
                        style={{
                          color: error.resolved ? '#30363d' : '#52c41a',
                          padding: 0,
                        }}
                      >
                        {error.resolved ? '已解决' : '解决'}
                      </Button>
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
      </Drawer>
    </ConfigProvider>
  );
}
