/**
 * ScenarioValidator - 场景验证工具
 * 对应 AFSIM wsf_scenario_analyzer 插件
 * 检查想定的完整性、一致性和合理性
 *
 * 验证规则采用配置驱动模式，可通过 VALIDATION_RULES 增删规则
 */
import React, { useMemo, useCallback } from 'react';
import { List, Tag, Space, Typography, Button, Badge, Tooltip, Empty } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  AimOutlined,
  BranchesOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { Scenario } from '../types';

const { Text } = Typography;

// ============ Types ============

type Severity = 'error' | 'warning' | 'info';

interface ValidationIssue {
  id: string;
  severity: Severity;
  category: string;
  message: string;
  entityId?: string;
  entityName?: string;
}

/** 配置化验证规则 */
export interface ValidationRule {
  id: string;
  name: string;
  severity: Severity;
  category: string;
  enabled: boolean;
  check: (scenario: Scenario, addIssue: (
    severity: Severity, category: string, message: string, entityId?: string, entityName?: string,
  ) => void) => void;
}

// ============ Validation Rules (配置驱动) ============

export const VALIDATION_RULES: ValidationRule[] = [
  {
    id: 'duplicate_names',
    name: '平台名称重复检查',
    severity: 'error',
    category: '平台',
    enabled: true,
    check: (scenario, addIssue) => {
      const nameCount = new Map<string, number>();
      scenario.platforms.forEach((p) => nameCount.set(p.name, (nameCount.get(p.name) ?? 0) + 1));
      nameCount.forEach((count, name) => {
        if (count > 1) addIssue('error', '平台', `平台名称 "${name}" 重复 (${count}个)`);
      });
    },
  },
  {
    id: 'missing_equipment',
    name: '装备关联检查',
    severity: 'warning',
    category: '装备',
    enabled: true,
    check: (scenario, addIssue) => {
      scenario.platforms.forEach((p) => {
        const eqId = p.equipmentRef?.equipmentId || p.equipmentId;
        if (!eqId || eqId.trim() === '') {
          addIssue('warning', '装备', `平台 "${p.name}" 未关联装备数据`, p.id, p.name);
        }
      });
    },
  },
  {
    id: 'equipment_version_lock',
    name: '装备版本锁定检查',
    severity: 'info',
    category: '装备',
    enabled: true,
    check: (scenario, addIssue) => {
      scenario.platforms.forEach((p) => {
        if (p.equipmentRef && (p.equipmentRef.version == null || p.equipmentRef.version <= 0)) {
          addIssue('info', '装备', `平台 "${p.name}" 装备引用未锁定版本，将使用最新版本`, p.id, p.name);
        }
      });
    },
  },
  {
    id: 'speed_validation',
    name: '速度合理性检查',
    severity: 'error',
    category: '运动',
    enabled: true,
    check: (scenario, addIssue) => {
      scenario.platforms.forEach((p) => {
        if (p.initialSpeed < 0) addIssue('error', '运动', `平台 "${p.name}" 初始速度为负值 (${p.initialSpeed})`, p.id, p.name);
        if (p.initialSpeed > 3000) addIssue('warning', '运动', `平台 "${p.name}" 初始速度异常高 (${p.initialSpeed} kn)`, p.id, p.name);
      });
    },
  },
  {
    id: 'altitude_validation',
    name: '高度合理性检查',
    severity: 'error',
    category: '运动',
    enabled: true,
    check: (scenario, addIssue) => {
      scenario.platforms.forEach((p) => {
        if (p.initialAltitude < -500) addIssue('error', '运动', `平台 "${p.name}" 初始高度异常 (${p.initialAltitude} m)`, p.id, p.name);
        if (p.initialAltitude > 100000) addIssue('warning', '运动', `平台 "${p.name}" 初始高度超出常规范围 (${p.initialAltitude} m)`, p.id, p.name);
      });
    },
  },
  {
    id: 'heading_validation',
    name: '航向范围检查',
    severity: 'info',
    category: '运动',
    enabled: true,
    check: (scenario, addIssue) => {
      scenario.platforms.forEach((p) => {
        if (p.initialHeading < 0 || p.initialHeading >= 360)
          addIssue('info', '运动', `平台 "${p.name}" 航向不在 0-359 范围 (${p.initialHeading}°)`, p.id, p.name);
      });
    },
  },
  {
    id: 'route_reference',
    name: '航线引用检查',
    severity: 'error',
    category: '航线',
    enabled: true,
    check: (scenario, addIssue) => {
      const routeIds = new Set(scenario.routes.map((r) => r.id));
      scenario.platforms.forEach((p) => {
        if (p.routeId && !routeIds.has(p.routeId))
          addIssue('error', '航线', `平台 "${p.name}" 引用了不存在的航线 "${p.routeId}"`, p.id, p.name);
      });
    },
  },
  {
    id: 'route_waypoints',
    name: '航路点检查',
    severity: 'warning',
    category: '航线',
    enabled: true,
    check: (scenario, addIssue) => {
      scenario.routes.forEach((r) => {
        if (r.waypoints.length < 2) addIssue('warning', '航线', `航线 "${r.name}" 航路点不足 (${r.waypoints.length}个)`, r.id, r.name);
        r.waypoints.forEach((wp, i) => {
          if (wp.altitude < -500) addIssue('warning', '航线', `航线 "${r.name}" 航路点 ${i + 1} 高度异常 (${wp.altitude} m)`, r.id, r.name);
          if (wp.speed < 0) addIssue('error', '航线', `航线 "${r.name}" 航路点 ${i + 1} 速度为负 (${wp.speed})`, r.id, r.name);
        });
      });
    },
  },
  {
    id: 'zone_validation',
    name: '区域几何检查',
    severity: 'error',
    category: '区域',
    enabled: true,
    check: (scenario, addIssue) => {
      scenario.zones.forEach((z) => {
        if (z.geometry.type === 'circle') {
          if (z.geometry.radius <= 0) addIssue('error', '区域', `区域 "${z.name}" 半径无效 (${z.geometry.radius} m)`, z.id, z.name);
          if (z.geometry.radius > 1000000) addIssue('warning', '区域', `区域 "${z.name}" 半径过大 (${(z.geometry.radius / 1000).toFixed(0)} km)`, z.id, z.name);
        }
        if (z.geometry.type === 'polygon' && z.geometry.vertices.length < 3)
          addIssue('error', '区域', `区域 "${z.name}" 顶点不足 (${z.geometry.vertices.length}个)`, z.id, z.name);
      });
    },
  },
  {
    id: 'side_balance',
    name: '对抗态势检查',
    severity: 'warning',
    category: '态势',
    enabled: true,
    check: (scenario, addIssue) => {
      const sideCount = { blue: 0, red: 0, neutral: 0, green: 0 };
      scenario.platforms.forEach((p) => { sideCount[p.side] = (sideCount[p.side] ?? 0) + 1; });
      if (scenario.platforms.length > 0) {
        if (sideCount.blue === 0 && sideCount.red > 0) addIssue('warning', '态势', '想定中无蓝方平台，但有红方平台');
        if (sideCount.red === 0 && sideCount.blue > 0) addIssue('info', '态势', '想定中无红方平台（单方演练）');
      }
    },
  },
  {
    id: 'empty_scenario',
    name: '空想定检查',
    severity: 'warning',
    category: '完整性',
    enabled: true,
    check: (scenario, addIssue) => {
      if (scenario.platforms.length === 0) addIssue('warning', '完整性', '想定中无平台，无法执行仿真');
      if (scenario.routes.length === 0 && scenario.platforms.length > 0) addIssue('info', '完整性', '想定中无航线定义');
    },
  },
  {
    id: 'position_bounds',
    name: '坐标越界检查',
    severity: 'error',
    category: '位置',
    enabled: true,
    check: (scenario, addIssue) => {
      scenario.platforms.forEach((p) => {
        if (p.initialPosition.lat < -90 || p.initialPosition.lat > 90)
          addIssue('error', '位置', `平台 "${p.name}" 纬度越界 (${p.initialPosition.lat}°)`, p.id, p.name);
        if (p.initialPosition.lng < -180 || p.initialPosition.lng > 180)
          addIssue('error', '位置', `平台 "${p.name}" 经度越界 (${p.initialPosition.lng}°)`, p.id, p.name);
      });
    },
  },
  {
    id: 'subsystem_check',
    name: '子系统配置检查',
    severity: 'info',
    category: '子系统',
    enabled: true,
    check: (scenario, addIssue) => {
      scenario.platforms.forEach((p) => {
        if (!p.sensors || p.sensors.length === 0) addIssue('info', '子系统', `平台 "${p.name}" 未配置传感器`, p.id, p.name);
        if (!p.weapons || p.weapons.length === 0) addIssue('info', '子系统', `平台 "${p.name}" 未配置武器`, p.id, p.name);
      });
    },
  },
];

/** 运行所有启用的验证规则 */
function validateScenario(scenario: Scenario, rules: ValidationRule[] = VALIDATION_RULES): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let issueId = 0;

  const addIssue = (
    severity: Severity, category: string, message: string, entityId?: string, entityName?: string,
  ) => {
    issues.push({ id: `v-${issueId++}`, severity, category, message, entityId, entityName });
  };

  for (const rule of rules) {
    if (!rule.enabled) continue;
    rule.check(scenario, addIssue);
  }

  return issues;
}

// ============ Component ============

interface ScenarioValidatorProps {
  scenario: Scenario;
  onLocateEntity?: (entityId: string) => void;
}

const SEVERITY_CONFIG: Record<Severity, { icon: React.ReactNode; color: string; label: string }> = {
  error: { icon: <CloseCircleOutlined />, color: '#ef5350', label: '错误' },
  warning: { icon: <ExclamationCircleOutlined />, color: '#ffb74d', label: '警告' },
  info: { icon: <InfoCircleOutlined />, color: '#4fc3f7', label: '提示' },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  平台: <AimOutlined />,
  装备: <AimOutlined />,
  运动: <BranchesOutlined />,
  航线: <BranchesOutlined />,
  区域: <EnvironmentOutlined />,
  态势: <EnvironmentOutlined />,
  完整性: <WarningOutlined />,
  位置: <EnvironmentOutlined />,
  子系统: <AimOutlined />,
};

export const ScenarioValidator: React.FC<ScenarioValidatorProps> = ({
  scenario,
  onLocateEntity,
}) => {
  const issues = useMemo(() => validateScenario(scenario), [scenario]);

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  const handleRevalidate = useCallback(() => {
    // Force re-render by toggling a key (parent should handle)
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #2a3a4a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space size={8}>
          <Text strong style={{ color: '#e0e0e0', fontSize: 13 }}>
            想定验证
          </Text>
          {errorCount === 0 && warningCount === 0 ? (
            <Tag icon={<CheckCircleOutlined />} color="success">
              通过
            </Tag>
          ) : (
            <Tag icon={<WarningOutlined />} color="warning">
              有问题
            </Tag>
          )}
        </Space>
        <Tooltip title="重新检查">
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={handleRevalidate}
            style={{ color: '#8b949e' }}
          />
        </Tooltip>
      </div>

      {/* Summary */}
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          gap: 12,
          borderBottom: '1px solid #2a3a4a',
        }}
      >
        <Badge
          count={errorCount}
          showZero
          color={errorCount > 0 ? '#ef5350' : '#30363d'}
          overflowCount={99}
        >
          <Tag
            style={{
              background: errorCount > 0 ? 'rgba(239,83,80,0.1)' : 'transparent',
              borderColor: errorCount > 0 ? '#ef5350' : '#30363d',
              color: errorCount > 0 ? '#ef5350' : '#484f58',
              fontSize: 11,
              cursor: 'default',
            }}
          >
            <CloseCircleOutlined /> 错误
          </Tag>
        </Badge>
        <Badge
          count={warningCount}
          showZero
          color={warningCount > 0 ? '#ffb74d' : '#30363d'}
          overflowCount={99}
        >
          <Tag
            style={{
              background: warningCount > 0 ? 'rgba(255,183,77,0.1)' : 'transparent',
              borderColor: warningCount > 0 ? '#ffb74d' : '#30363d',
              color: warningCount > 0 ? '#ffb74d' : '#484f58',
              fontSize: 11,
              cursor: 'default',
            }}
          >
            <ExclamationCircleOutlined /> 警告
          </Tag>
        </Badge>
        <Badge
          count={infoCount}
          showZero
          color={infoCount > 0 ? '#4fc3f7' : '#30363d'}
          overflowCount={99}
        >
          <Tag
            style={{
              background: infoCount > 0 ? 'rgba(79,195,247,0.1)' : 'transparent',
              borderColor: infoCount > 0 ? '#4fc3f7' : '#30363d',
              color: infoCount > 0 ? '#4fc3f7' : '#484f58',
              fontSize: 11,
              cursor: 'default',
            }}
          >
            <InfoCircleOutlined /> 提示
          </Tag>
        </Badge>
      </div>

      {/* Issue List */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {issues.length === 0 ? (
          <Empty
            description="想定验证通过，未发现问题"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '40px 0' }}
          >
            <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 8 }} />
          </Empty>
        ) : (
          <List
            size="small"
            dataSource={issues}
            renderItem={(issue) => {
              const config = SEVERITY_CONFIG[issue.severity];
              return (
                <List.Item
                  style={{
                    padding: '6px 12px',
                    borderBottom: '1px solid #1a2233',
                    cursor: issue.entityId ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (issue.entityId && onLocateEntity) {
                      onLocateEntity(issue.entityId);
                    }
                  }}
                >
                  <Space size={8} style={{ width: '100%' }}>
                    <span style={{ color: config.color, fontSize: 14, flexShrink: 0 }}>
                      {config.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: '#e0e0e0', lineHeight: 1.4 }}>
                        {issue.message}
                      </div>
                      <Space size={4} style={{ marginTop: 2 }}>
                        <Tag
                          style={{
                            fontSize: 10,
                            padding: '0 4px',
                            lineHeight: '16px',
                            margin: 0,
                            background: 'rgba(255,255,255,0.04)',
                            borderColor: '#30363d',
                            color: '#8b949e',
                          }}
                        >
                          {CATEGORY_ICONS[issue.category]} {issue.category}
                        </Tag>
                        {issue.entityName && (
                          <Text
                            type="secondary"
                            style={{ fontSize: 10, fontFamily: 'monospace' }}
                          >
                            {issue.entityName}
                          </Text>
                        )}
                      </Space>
                    </div>
                  </Space>
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ScenarioValidator;
