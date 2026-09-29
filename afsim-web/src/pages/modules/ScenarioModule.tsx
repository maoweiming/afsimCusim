/**
 * ScenarioModule - 想定编辑模块路由
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import ScenarioListPage from '../ScenarioListPage';
import ScenarioEditorPage from '../ScenarioEditorPage';

export default function ScenarioModule() {
  return (
    <Routes>
      <Route index element={<ScenarioListPage />} />
      <Route path=":id" element={<ScenarioEditorPage />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}
