import { useEffect, useState, useCallback } from 'react';
import * as api from '../../api/client';
import { useSimStore } from '../../store/simStore';
import { usePlatformStore } from '../../store/platformStore';
import { connectWebSocket } from '../../api/websocket';
import type { ScenarioInfo } from '../../api/types';
import {
  fetchScenarioList,
  fetchScenario,
} from '../../modules/scenario/api/scenarioApi';
import type { Scenario } from '../../modules/scenario/types';
import {
  exportScenarioForSimulation,
  wrapAsGatewayScenario,
} from '../../modules/scenario/utils/scenarioExporter';

export function ScenarioList() {
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  // 网关离线时降级：展示编辑器里的想定
  const [gatewayOffline, setGatewayOffline] = useState(false);
  const [editorScenarios, setEditorScenarios] = useState<Scenario[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);

  const phase = useSimStore((s) => s.phase);
  const canStart = phase === 'idle' || phase === 'complete';

  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGatewayOffline(false);
    try {
      const list = await api.listScenarios();
      setScenarios(list);
    } catch (err) {
      // 网关不可达 → 降级到编辑器侧想定列表
      setGatewayOffline(true);
      setError(null);
      try {
        const editorList = await fetchScenarioList();
        setEditorScenarios(editorList);
      } catch {
        setEditorScenarios([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScenarios();
    const onRefresh = () => fetchScenarios();
    window.addEventListener('truesim:scenarios-updated', onRefresh);
    return () => window.removeEventListener('truesim:scenarios-updated', onRefresh);
  }, [fetchScenarios]);

  // 启动网关上已有的想定（直接 startSimulation，不再用 fetchScenario 混用 ID）
  const handleStart = useCallback(
    async (scenarioId: string) => {
      if (!canStart) return;
      setStarting(scenarioId);
      try {
        const status = await api.startSimulation(scenarioId, 'realtime');
        usePlatformStore.getState().clearAll();
        useSimStore.getState().startSimulation(scenarioId, status.sim_id);
        useSimStore.getState().setSimTime(status.sim_time);
        useSimStore.getState().setClockRate(status.clock_rate);
        connectWebSocket(status.sim_id);
        useSimStore.getState().setConnected(true);
      } catch (err) {
        console.error('Failed to start simulation:', err);
        setError(err instanceof Error ? err.message : 'Failed to start');
      } finally {
        setStarting(null);
      }
    },
    [canStart],
  );

  // 从编辑器想定导出 → 上传网关 → 启动（网关离线 fallback 下的"导出并启动"）
  const handleUploadAndStart = useCallback(
    async (editorScenarioId: string) => {
      if (!canStart) return;
      setUploading(editorScenarioId);
      try {
        const scenario = await fetchScenario(editorScenarioId);
        const afsimBody = exportScenarioForSimulation(scenario, new Map());
        // 使用想定 id（ASCII，唯一）而非中文 name 生成 CASE 名/文件名，
        // 避免与同名的网关生产想定文件冲突，也避免 CASE 占位符全为下划线。
        const wrapped = wrapAsGatewayScenario(scenario.id, afsimBody, { endTime: '30 mins' });
        const filename = `${scenario.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.scenario`;
        const file = new File([wrapped], filename, { type: 'text/plain' });

        const scenarioInfo = await api.uploadScenario(file);
        const status = await api.startSimulation(scenarioInfo.id, 'realtime');
        usePlatformStore.getState().clearAll();
        useSimStore.getState().startSimulation(scenarioInfo.id, status.sim_id);
        useSimStore.getState().setSimTime(status.sim_time);
        useSimStore.getState().setClockRate(status.clock_rate);
        connectWebSocket(status.sim_id);
        useSimStore.getState().setConnected(true);

        // 刷新网关想定列表
        window.dispatchEvent(new Event('truesim:scenarios-updated'));
      } catch (err) {
        console.error('Failed to upload and start:', err);
        setError(err instanceof Error ? err.message : '上传或启动失败');
      } finally {
        setUploading(null);
      }
    },
    [canStart],
  );

  return (
    <div className="scenario-list">
      <div className="panel-header">
        <h3 className="panel-title">想定列表</h3>
        <button className="btn btn-sm" onClick={fetchScenarios} title="刷新">
          &#8635;
        </button>
      </div>

      {loading && <div className="panel-msg">加载中...</div>}
      {error && <div className="panel-msg error">{error}</div>}

      {/* 网关在线：显示网关磁盘上的想定 */}
      {!loading && !gatewayOffline && !error && (
        <>
          {scenarios.length === 0 && (
            <div className="panel-msg">
              暂无想定 — 请在想定编辑器中点击「运行仿真」上传后刷新
            </div>
          )}
          <ul className="scenario-items">
            {scenarios.map((scenario) => (
              <li key={scenario.id} className="scenario-item">
                <div className="scenario-info">
                  <span className="scenario-name">{scenario.name || scenario.filename}</span>
                  <span className="scenario-meta">
                    {formatFileSize(scenario.size_bytes)} &middot;{' '}
                    {new Date(scenario.created_at).toLocaleDateString()}
                  </span>
                </div>
                <button
                  className="btn btn-start"
                  disabled={!canStart || starting !== null}
                  onClick={() => handleStart(scenario.id)}
                >
                  {starting === scenario.id ? '启动中...' : '启动'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* 网关离线：降级展示编辑器想定，提供"导出并启动"按钮 */}
      {!loading && gatewayOffline && (
        <>
          <div className="panel-msg" style={{ color: '#d97706', marginBottom: 8 }}>
            ⚠ 仿真网关未运行（localhost:8080）
            <br />
            下方显示编辑器中的想定，点击「导出并启动」将自动上传并运行
          </div>
          {editorScenarios.length === 0 ? (
            <div className="panel-msg">编辑器中暂无想定</div>
          ) : (
            <ul className="scenario-items">
              {editorScenarios.map((s) => (
                <li key={s.id} className="scenario-item">
                  <div className="scenario-info">
                    <span className="scenario-name">{s.name}</span>
                    <span className="scenario-meta">
                      {s.platforms.length} 平台 &middot; v{s.version}
                      &nbsp;
                      <StatusBadge status={s.status} />
                    </span>
                  </div>
                  <button
                    className="btn btn-start"
                    disabled={!canStart || uploading !== null || s.status === 'archived'}
                    onClick={() => handleUploadAndStart(s.id)}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {uploading === s.id ? '上传中...' : '导出并启动'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: '草稿',
    in_review: '审核中',
    approved: '已批准',
    archived: '已归档',
  };
  const colors: Record<string, string> = {
    draft: '#8b949e',
    in_review: '#1890ff',
    approved: '#52c41a',
    archived: '#d97706',
  };
  return (
    <span style={{ color: colors[status] ?? '#8b949e', fontSize: 10 }}>
      {map[status] ?? status}
    </span>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
