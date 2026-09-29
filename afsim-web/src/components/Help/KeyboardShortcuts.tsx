/**
 * KeyboardShortcuts - 键盘快捷键弹窗
 * 显示所有可用的键盘快捷键
 */
import { Modal, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useHelpStore } from '../../store/helpStore';

export interface ShortcutItem {
  key: string;
  action: string;
}

/** 快捷键数据，供 HelpDrawer 等其他组件复用 */
export const shortcutsData: ShortcutItem[] = [
  { key: '?', action: '显示/隐藏快捷键' },
  { key: '空格', action: '暂停/继续仿真' },
  { key: '→', action: '单步前进' },
  { key: 'L', action: '切换左侧面板' },
  { key: 'R', action: '切换右侧面板' },
  { key: 'H', action: '打开帮助抽屉' },
  { key: 'F', action: '飞到选中平台' },
  { key: 'Esc', action: '关闭弹窗' },
];

/** 快捷键表格列定义，供 HelpDrawer 复用 */
export const shortcutsColumns: ColumnsType<ShortcutItem> = [
  {
    title: '快捷键',
    dataIndex: 'key',
    key: 'key',
    width: 120,
    render: (k: string) => (
      <Tag
        style={{
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          background: 'var(--bg-tertiary)',
          color: '#e6edf3',
          border: '1px solid #30363d',
          borderRadius: 4,
          padding: '2px 10px',
          fontSize: 13,
        }}
      >
        {k}
      </Tag>
    ),
  },
  {
    title: '功能',
    dataIndex: 'action',
    key: 'action',
  },
];

export const KeyboardShortcuts: React.FC = () => {
  const showKeyboardShortcuts = useHelpStore((s) => s.showKeyboardShortcuts);
  const toggleKeyboardShortcuts = useHelpStore((s) => s.toggleKeyboardShortcuts);

  return (
    <Modal
      title="键盘快捷键"
      open={showKeyboardShortcuts}
      onCancel={toggleKeyboardShortcuts}
      footer={null}
      width={480}
      styles={{
        header: { background: 'var(--bg-secondary)', color: '#e6edf3' },
        body: { background: 'var(--bg-primary)', padding: '16px 0' },
      }}
    >
      <Table<ShortcutItem>
        columns={shortcutsColumns}
        dataSource={shortcutsData}
        pagination={false}
        size="small"
        rowKey="key"
        style={{ background: 'var(--bg-primary)' }}
      />
    </Modal>
  );
};

export default KeyboardShortcuts;
