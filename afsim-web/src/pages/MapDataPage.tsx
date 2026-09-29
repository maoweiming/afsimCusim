import { Suspense, lazy } from 'react';
import { Spin } from 'antd';

const MapLayerPanel = lazy(() => import('../modules/map-data').then(m => ({ default: m.MapLayerPanel })));
const DataSourceManager = lazy(() => import('../modules/map-data').then(m => ({ default: m.DataSourceManager })));
const TerrainAnalysis = lazy(() => import('../modules/map-data').then(m => ({ default: m.TerrainAnalysis })));
const ImagerySelector = lazy(() => import('../modules/map-data').then(m => ({ default: m.ImagerySelector })));

const Loading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
    <Spin size="large" />
  </div>
);

export default function MapDataPage() {
  return (
    <main className="module-page">
      <Suspense fallback={<Loading />}>
        <div className="module-sidebar">
          <ImagerySelector />
          <MapLayerPanel />
        </div>
        <div className="module-content">
          <div className="map-data-panels">
            <DataSourceManager />
            <TerrainAnalysis />
          </div>
        </div>
      </Suspense>
    </main>
  );
}
