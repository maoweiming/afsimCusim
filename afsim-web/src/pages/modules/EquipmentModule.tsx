/**
 * EquipmentModule - 装备数据管理模块
 * 三段式：分类树 | 装备列表 | 详情/编辑
 */
import { useState, Suspense, lazy } from 'react';
import { Spin } from 'antd';
import type { CategoryFilter } from '../../modules/equipment/components/CategoryTree';

const CategoryTree = lazy(() => import('../../modules/equipment/components/CategoryTree').then(m => ({ default: m.CategoryTree })));
const EquipmentList = lazy(() => import('../../modules/equipment').then(m => ({ default: m.EquipmentList })));
const EquipmentDetail = lazy(() => import('../../modules/equipment').then(m => ({ default: m.EquipmentDetail })));
const EquipmentEditForm = lazy(() => import('../../modules/equipment/components/EquipmentEditForm').then(m => ({ default: m.EquipmentEditForm })));

const Loading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
    <Spin size="large" />
  </div>
);

export default function EquipmentModule() {
  const [editing, setEditing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<CategoryFilter | null>(null);

  return (
    <div className="module-container">
      <div className="module-body module-body--no-padding">
        <Suspense fallback={<Loading />}>
          <div className="equip-layout">
            <div className="equip-category-panel">
              <CategoryTree
                activeFilter={activeFilter}
                onSelect={setActiveFilter}
              />
            </div>
            <div className="equip-list-panel">
              <EquipmentList onEdit={() => setEditing(true)} filter={activeFilter} />
            </div>
            <div className="equip-detail-panel">
              {editing ? (
                <EquipmentEditForm onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
              ) : (
                <EquipmentDetail onEdit={() => setEditing(true)} />
              )}
            </div>
          </div>
        </Suspense>
      </div>
    </div>
  );
}
