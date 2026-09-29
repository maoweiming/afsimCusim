/**
 * BehaviorTreeEditor - 高级行为树结构化编辑器
 * 按处理器（processor）展示/编辑其 advanced_behavior_tree 配置：
 * 组合节点（sequence/selector/parallel/...）、装饰器节点（decorator）、叶子节点（behavior_node）
 */
import { useCallback, useMemo } from 'react';
import {
  Card,
  Tag,
  Space,
  Button,
  Select,
  Input,
  Switch,
  Tree,
  Empty,
  Typography,
  Tooltip,
  Divider,
  Form,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ApartmentOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import type {
  AdvancedBehaviorTreeConfig,
  BehaviorTreeNode,
  BehaviorNodeKind,
  BehaviorCompositeKind,
} from '../afsim/types';

const { Text } = Typography;

interface BehaviorTreeEditorProps {
  form: any;
}

const COMPOSITE_OPTIONS: { value: BehaviorCompositeKind; label: string }[] = [
  { value: 'sequence', label: 'sequence（顺序）' },
  { value: 'sequence_with_memory', label: 'sequence_with_memory（顺序·带记忆）' },
  { value: 'selector', label: 'selector（选择）' },
  { value: 'selector_with_memory', label: 'selector_with_memory（选择·带记忆）' },
  { value: 'parallel', label: 'parallel（并行）' },
  { value: 'priority_selector', label: 'priority_selector（优先级选择）' },
  { value: 'weighted_random', label: 'weighted_random（加权随机）' },
];

const ROOT_NODE_TYPE_OPTIONS = COMPOSITE_OPTIONS;

const NEW_NODE_KIND_OPTIONS: { value: BehaviorNodeKind; label: string }[] = [
  { value: 'behavior_node', label: '叶子节点 behavior_node' },
  ...COMPOSITE_OPTIONS,
  { value: 'decorator_inverter', label: '装饰器 inverter（取反）' },
  { value: 'decorator_negator', label: '装饰器 negator（恒失败）' },
  { value: 'decorator_succeeder', label: '装饰器 succeeder（恒成功）' },
  { value: 'decorator_repeater', label: '装饰器 repeater（重复执行）' },
  { value: 'advanced_behavior_tree', label: '子树 advanced_behavior_tree（嵌套）' },
];

const REPEATER_MODE_OPTIONS = [
  { value: 'repeat', label: 'repeat（重复 N 次）' },
  { value: 'for', label: 'for（持续一段时间）' },
  { value: 'until_done', label: 'until_done（直至子节点完成）' },
];

let idCounter = 0;
function genId(): string {
  idCounter += 1;
  return `bn-new-${idCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

function createNode(kind: BehaviorNodeKind): BehaviorTreeNode {
  const node: BehaviorTreeNode = { id: genId(), kind };
  if (kind !== 'behavior_node') node.children = [];
  if (kind === 'decorator_repeater') node.repeaterMode = 'until_done';
  return node;
}

function isComposite(kind: BehaviorNodeKind): boolean {
  return (COMPOSITE_OPTIONS as { value: BehaviorNodeKind }[]).some((o) => o.value === kind);
}

function isDecorator(kind: BehaviorNodeKind): boolean {
  return kind.startsWith('decorator_');
}

function isSubtree(kind: BehaviorNodeKind): boolean {
  return kind === 'advanced_behavior_tree';
}

/** 不可变地按 id 更新节点 */
function updateNode(nodes: BehaviorTreeNode[], id: string, updater: (n: BehaviorTreeNode) => BehaviorTreeNode): BehaviorTreeNode[] {
  return nodes.map((n) => {
    if (n.id === id) return updater(n);
    if (n.children) return { ...n, children: updateNode(n.children, id, updater) };
    return n;
  });
}

/** 不可变地删除指定 id 的节点（递归查找） */
function removeNode(nodes: BehaviorTreeNode[], id: string): BehaviorTreeNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => (n.children ? { ...n, children: removeNode(n.children, id) } : n));
}

/** 不可变地为指定父节点追加子节点；parentId 为 null 时追加到根 */
function addChild(nodes: BehaviorTreeNode[], parentId: string | null, child: BehaviorTreeNode): BehaviorTreeNode[] {
  if (parentId === null) return [...nodes, child];
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...(n.children ?? []), child] };
    if (n.children) return { ...n, children: addChild(n.children, parentId, child) };
    return n;
  });
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: '#5a6a7a',
};

function NodeRow({
  node,
  onChange,
  onAddChild,
  onDelete,
}: {
  node: BehaviorTreeNode;
  onChange: (patch: Partial<BehaviorTreeNode>) => void;
  onAddChild: (kind: BehaviorNodeKind) => void;
  onDelete: () => void;
}) {
  const composite = isComposite(node.kind);
  const decorator = isDecorator(node.kind);
  const subtree = isSubtree(node.kind);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 6px',
        background: '#0d1117',
        border: '1px solid #21262d',
        borderRadius: 4,
        flexWrap: 'wrap',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Tag
        color={node.kind === 'behavior_node' ? 'blue' : composite ? 'purple' : subtree ? 'cyan' : 'gold'}
        style={{ margin: 0, fontFamily: 'monospace', fontSize: 11 }}
      >
        {node.kind === 'behavior_node' ? 'behavior_node' : decorator ? node.kind.replace('decorator_', 'decorator: ') : node.kind}
      </Tag>

      {node.kind === 'behavior_node' && (
        <Input
          size="small"
          placeholder="行为名称（behavior 库中已定义的行为）"
          value={node.name}
          style={{ width: 220 }}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      )}

      {composite && (
        <Input
          size="small"
          placeholder="节点名称（可选）"
          value={node.name}
          style={{ width: 160 }}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      )}

      {subtree && (
        <>
          <Input
            size="small"
            placeholder="子树名称 (name)"
            value={node.name}
            style={{ width: 140 }}
            onChange={(e) => onChange({ name: e.target.value })}
          />
          <Input
            size="small"
            placeholder="描述 (desc)"
            value={node.description}
            style={{ width: 140 }}
            onChange={(e) => onChange({ description: e.target.value })}
          />
          <Select
            size="small"
            allowClear
            placeholder="root_node_type"
            style={{ width: 160 }}
            value={node.rootNodeType}
            options={ROOT_NODE_TYPE_OPTIONS}
            onChange={(v) => onChange({ rootNodeType: v })}
          />
          <Input
            size="small"
            placeholder="success_policy"
            value={node.successPolicy}
            style={{ width: 130 }}
            onChange={(e) => onChange({ successPolicy: e.target.value })}
          />
          <span style={labelStyle}>btt</span>
          <Switch
            size="small"
            checked={node.btt ?? false}
            onChange={(checked) => onChange({ btt: checked })}
          />
        </>
      )}

      {node.kind === 'decorator_repeater' && (
        <>
          <Select
            size="small"
            value={node.repeaterMode ?? 'until_done'}
            options={REPEATER_MODE_OPTIONS}
            style={{ width: 200 }}
            onChange={(v) => onChange({ repeaterMode: v })}
          />
          {node.repeaterMode !== 'until_done' && (
            <Input
              size="small"
              placeholder={node.repeaterMode === 'for' ? '如 5 minutes' : '如 20'}
              value={node.repeaterValue}
              style={{ width: 130 }}
              onChange={(e) => onChange({ repeaterValue: e.target.value })}
            />
          )}
        </>
      )}

      <div style={{ flex: 1 }} />

      {(composite || decorator || subtree) && (
        <Select
          size="small"
          placeholder="添加子节点..."
          value={undefined}
          options={
            decorator && (node.children?.length ?? 0) >= 1
              ? [] // 装饰器节点只能有一个子节点
              : NEW_NODE_KIND_OPTIONS
          }
          style={{ width: 170 }}
          suffixIcon={<PlusCircleOutlined />}
          onChange={(kind: BehaviorNodeKind) => onAddChild(kind)}
        />
      )}

      <Tooltip title="删除该节点（含其子节点）">
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={onDelete} />
      </Tooltip>
    </div>
  );
}

export function BehaviorTreeEditor({ form }: BehaviorTreeEditorProps) {
  const watchedProcessors = Form.useWatch('processors', form) as Record<string, any> | undefined;
  const processors: Record<string, any> = watchedProcessors || form.getFieldValue('processors') || {};

  const entries = useMemo(() => Object.entries(processors), [processors]);

  const commitTree = useCallback(
    (procName: string, tree: AdvancedBehaviorTreeConfig | undefined) => {
      const current = { ...(form.getFieldValue('processors') || {}) };
      const proc = { ...(current[procName] || {}) };
      if (tree) proc.behaviorTree = tree;
      else delete proc.behaviorTree;
      current[procName] = proc;
      form.setFieldsValue({ processors: current });
    },
    [form]
  );

  const buildTreeData = useCallback(
    (procName: string, tree: AdvancedBehaviorTreeConfig): DataNode[] => {
      const updateTree = (updater: (nodes: BehaviorTreeNode[]) => BehaviorTreeNode[]) => {
        commitTree(procName, { ...tree, nodes: updater(tree.nodes) });
      };

      const toDataNode = (node: BehaviorTreeNode): DataNode => ({
        key: node.id,
        title: (
          <NodeRow
            node={node}
            onChange={(patch) => updateTree((nodes) => updateNode(nodes, node.id, (n) => ({ ...n, ...patch })))}
            onAddChild={(kind) => updateTree((nodes) => addChild(nodes, node.id, createNode(kind)))}
            onDelete={() => updateTree((nodes) => removeNode(nodes, node.id))}
          />
        ),
        children: node.children?.map(toDataNode),
      });

      return tree.nodes.map(toDataNode);
    },
    [commitTree]
  );

  if (entries.length === 0) {
    return (
      <div style={{ padding: 12 }}>
        <Empty description="尚未添加处理器" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  return (
    <div>
      <Divider titlePlacement="left">
        <Space>
          <ApartmentOutlined />
          <span>行为模型（高级行为树）</span>
        </Space>
      </Divider>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
        高级行为树挂载在「处理器」上：选择某个处理器，为其添加或编辑 advanced_behavior_tree。
        叶子节点 behavior_node 引用预先定义的行为脚本；组合节点编排执行顺序/策略；装饰器节点修饰单个子节点的返回结果。
      </Text>

      {entries.map(([procName, proc]) => {
        const tree = proc?.behaviorTree as AdvancedBehaviorTreeConfig | undefined;
        const hasRawOnly = !tree && !!proc?.advancedBehaviorTree;

        return (
          <Card
            key={procName}
            size="small"
            style={{ marginBottom: 12, background: '#0d1117', border: '1px solid #21262d' }}
            title={
              <Space>
                <Text strong style={{ color: '#e6edf3' }}>{procName}</Text>
                {proc?.type ? <Tag color="blue" style={{ fontSize: 11 }}>{String(proc.type)}</Tag> : null}
                {tree ? <Tag color="green" style={{ fontSize: 11 }}>已配置行为树</Tag> : null}
                {hasRawOnly ? <Tag color="orange" style={{ fontSize: 11 }}>原始文本格式（未结构化）</Tag> : null}
              </Space>
            }
            extra={
              tree ? (
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => commitTree(procName, undefined)}>
                  移除行为树
                </Button>
              ) : (
                <Button
                  size="small"
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => commitTree(procName, { nodes: [] })}
                >
                  新建行为树
                </Button>
              )
            }
          >
            {hasRawOnly && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                检测到该处理器已包含 advanced_behavior_tree 原始文本，将随装备一同保存（往返不丢失）。
                若点击"新建行为树"，保存时将改为输出下方结构化编辑的内容，原始文本会被结构化版本取代。
              </Text>
            )}

            {tree && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 160px' }}>
                    <div style={labelStyle}>树名称</div>
                    <Input
                      size="small"
                      value={tree.name}
                      onChange={(e) => commitTree(procName, { ...tree, name: e.target.value })}
                    />
                  </div>
                  <div style={{ flex: '1 1 200px' }}>
                    <div style={labelStyle}>根节点类型 (root_node_type)</div>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      allowClear
                      placeholder="默认 parallel"
                      value={tree.rootNodeType}
                      options={ROOT_NODE_TYPE_OPTIONS}
                      onChange={(v) => commitTree(procName, { ...tree, rootNodeType: v })}
                    />
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <div style={labelStyle}>成功策略 (success_policy)</div>
                    <Input
                      size="small"
                      placeholder="如 succeed_on_one"
                      value={tree.successPolicy}
                      onChange={(e) => commitTree(procName, { ...tree, successPolicy: e.target.value })}
                    />
                  </div>
                  <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, paddingTop: 16 }}>
                    <span style={labelStyle}>btt</span>
                    <Switch
                      size="small"
                      checked={tree.btt ?? false}
                      onChange={(checked) => commitTree(procName, { ...tree, btt: checked })}
                    />
                  </div>
                </div>
                <div>
                  <div style={labelStyle}>描述 (desc)</div>
                  <Input
                    size="small"
                    value={tree.description}
                    onChange={(e) => commitTree(procName, { ...tree, description: e.target.value })}
                  />
                </div>

                <Divider style={{ margin: '4px 0', borderColor: '#21262d' }} />

                {tree.nodes.length === 0 ? (
                  <Empty
                    description="树内暂无节点"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    style={{ margin: '8px 0' }}
                  />
                ) : (
                  <Tree
                    treeData={buildTreeData(procName, tree)}
                    selectable={false}
                    blockNode
                    defaultExpandAll
                    style={{ background: 'transparent' }}
                  />
                )}

                <Select
                  size="small"
                  placeholder="向根节点添加节点..."
                  value={undefined}
                  options={NEW_NODE_KIND_OPTIONS}
                  style={{ width: 220 }}
                  suffixIcon={<PlusCircleOutlined />}
                  onChange={(kind: BehaviorNodeKind) =>
                    commitTree(procName, { ...tree, nodes: addChild(tree.nodes, null, createNode(kind)) })
                  }
                />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default BehaviorTreeEditor;
