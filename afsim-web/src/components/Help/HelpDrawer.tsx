/**
 * HelpDrawer - 帮助抽屉
 * 包含快速开始、键盘快捷键、AFSIM 概念、故障排除四个标签页
 */
import { Drawer, Tabs, Collapse, List, Typography, Table, Tag } from 'antd';
import {
  RocketOutlined,
  KeyOutlined,
  BookOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useHelpStore } from '../../store/helpStore';
import { shortcutsData, shortcutsColumns } from './KeyboardShortcuts';
import type { ShortcutItem } from './KeyboardShortcuts';

const { Text, Paragraph } = Typography;

/* ── 快速开始步骤 ── */
const quickStartSteps = [
  '从左侧面板选择一个想定',
  '点击"启动仿真"按钮',
  '在3D地球上观察平台运动',
  '在右侧面板查看平台详情和传感器状态',
  '使用事件日志跟踪仿真事件',
];

/* ── AFSIM 概念 ── */
const glossaryItems = [
  {
    key: 'ooda',
    label: 'OODA 循环',
    children: (
      <Paragraph style={{ color: '#8b949e', margin: 0 }}>
        观察→判断→决策→行动的决策循环
      </Paragraph>
    ),
  },
  {
    key: 'wez',
    label: 'WEZ',
    children: (
      <Paragraph style={{ color: '#8b949e', margin: 0 }}>
        武器交战区 (Weapon Engagement Zone)
      </Paragraph>
    ),
  },
  {
    key: 'pk',
    label: 'Pk',
    children: (
      <Paragraph style={{ color: '#8b949e', margin: 0 }}>
        杀伤概率 (Probability of Kill)
      </Paragraph>
    ),
  },
  {
    key: 'killchain',
    label: 'Kill Chain',
    children: (
      <Paragraph style={{ color: '#8b949e', margin: 0 }}>
        探测→跟踪→识别→决策→交战→评估
      </Paragraph>
    ),
  },
  {
    key: 'iads',
    label: 'IADS',
    children: (
      <Paragraph style={{ color: '#8b949e', margin: 0 }}>
        综合防空系统 (Integrated Air Defense System)
      </Paragraph>
    ),
  },
  {
    key: 'c2',
    label: 'C2',
    children: (
      <Paragraph style={{ color: '#8b949e', margin: 0 }}>
        指挥与控制 (Command and Control)
      </Paragraph>
    ),
  },
  {
    key: 'ew',
    label: 'EW',
    children: (
      <Paragraph style={{ color: '#8b949e', margin: 0 }}>
        电子战 (Electronic Warfare)
      </Paragraph>
    ),
  },
  {
    key: 'esm',
    label: 'ESM',
    children: (
      <Paragraph style={{ color: '#8b949e', margin: 0 }}>
        电子支援措施
      </Paragraph>
    ),
  },
  {
    key: 'drfm',
    label: 'DRFM',
    children: (
      <Paragraph style={{ color: '#8b949e', margin: 0 }}>
        数字射频存储器
      </Paragraph>
    ),
  },
];

/* ── 故障排除 ── */
const troubleshootingItems = [
  {
    key: 'connection',
    label: '连接问题',
    children: (
      <Paragraph style={{ color: '#8b949e', margin: 0 }}>
        检查仿真网关是否运行，确认端口8080可访问
      </Paragraph>
    ),
  },
  {
    key: 'nodata',
    label: '无数据',
    children: (
      <Paragraph style={{ color: '#8b949e', margin: 0 }}>
        确认仿真已启动，检查WebSocket连接状态
      </Paragraph>
    ),
  },
  {
    key: 'perf',
    label: '性能',
    children: (
      <Paragraph style={{ color: '#8b949e', margin: 0 }}>
        减少平台数量，降低时钟速率
      </Paragraph>
    ),
  },
];

/* ── 快捷键表格（Drawer 内使用 antd Table） ── */
const shortcutsTable = (
  <Table<ShortcutItem>
    columns={shortcutsColumns}
    dataSource={shortcutsData}
    pagination={false}
    size="small"
    rowKey="key"
  />
);

/* ── Tab 项 ── */
const tabItems = [
  {
    key: 'quickstart',
    label: (
      <span>
        <RocketOutlined /> 快速开始
      </span>
    ),
    children: (
      <List
        dataSource={quickStartSteps}
        renderItem={(item, index) => (
          <List.Item
            style={{
              borderBottom: '1px solid #30363d',
              padding: '10px 0',
            }}
          >
            <Text style={{ color: '#e6edf3' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 24,
                  height: 24,
                  lineHeight: '24px',
                  textAlign: 'center',
                  borderRadius: '50%',
                  background: '#0078d7',
                  color: '#fff',
                  fontSize: 12,
                  marginRight: 12,
                  fontWeight: 600,
                }}
              >
                {index + 1}
              </span>
              {item}
            </Text>
          </List.Item>
        )}
      />
    ),
  },
  {
    key: 'shortcuts',
    label: (
      <span>
        <KeyOutlined /> 键盘快捷键
      </span>
    ),
    children: shortcutsTable,
  },
  {
    key: 'glossary',
    label: (
      <span>
        <BookOutlined /> AFSIM 概念
      </span>
    ),
    children: (
      <Collapse
        items={glossaryItems}
        accordion
        style={{ background: 'var(--bg-primary)', border: '1px solid #30363d' }}
      />
    ),
  },
  {
    key: 'troubleshoot',
    label: (
      <span>
        <ToolOutlined /> 故障排除
      </span>
    ),
    children: (
      <Collapse
        items={troubleshootingItems}
        accordion
        style={{ background: 'var(--bg-primary)', border: '1px solid #30363d' }}
      />
    ),
  },
];

export const HelpDrawer: React.FC = () => {
  const helpDrawerOpen = useHelpStore((s) => s.helpDrawerOpen);
  const toggleHelpDrawer = useHelpStore((s) => s.toggleHelpDrawer);

  return (
    <Drawer
      title="帮助"
      placement="right"
      width={480}
      open={helpDrawerOpen}
      onClose={toggleHelpDrawer}
      styles={{
        header: { background: 'var(--bg-secondary)', color: '#e6edf3', borderBottom: '1px solid #30363d' },
        body: { background: 'var(--bg-primary)', padding: '12px 16px' },
      }}
    >
      <Tabs
        defaultActiveKey="quickstart"
        items={tabItems}
        tabBarStyle={{ color: '#8b949e', marginBottom: 12 }}
      />
    </Drawer>
  );
};

export default HelpDrawer;
