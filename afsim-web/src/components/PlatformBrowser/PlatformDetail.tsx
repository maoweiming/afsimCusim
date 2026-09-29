import { usePlatformStore } from '../../store/platformStore';

export function PlatformDetail() {
  const selectedPlatformIndex = usePlatformStore((s) => s.selectedPlatformIndex);
  const platforms = usePlatformStore((s) => s.platforms);
  const selectPlatform = usePlatformStore((s) => s.selectPlatform);

  if (selectedPlatformIndex === null) {
    return (
      <div className="platform-detail empty">
        <p>Select a platform to view details</p>
      </div>
    );
  }

  const platform = platforms[selectedPlatformIndex];
  if (!platform) {
    return (
      <div className="platform-detail empty">
        <p>Platform not found</p>
      </div>
    );
  }

  return (
    <div className="platform-detail">
      <div className="detail-header">
        <h3 className="detail-name">{platform.name}</h3>
        <button className="btn btn-close" onClick={() => selectPlatform(null)}>
          &times;
        </button>
      </div>

      <div className="detail-section">
        <div className="detail-row">
          <span className="detail-label">Side</span>
          <span className="detail-value" style={{ color: getSideCssColor(platform.side) }}>
            {platform.side.toUpperCase()}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Type</span>
          <span className="detail-value">{platform.typeId}</span>
        </div>
      </div>

      <div className="detail-section">
        <h4 className="detail-section-title">Position</h4>
        <div className="detail-row">
          <span className="detail-label">Lat</span>
          <span className="detail-value mono">{platform.lat.toFixed(6)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Lon</span>
          <span className="detail-value mono">{platform.lon.toFixed(6)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Alt</span>
          <span className="detail-value mono">{platform.alt.toFixed(1)} m</span>
        </div>
        {platform.heading !== undefined && (
          <div className="detail-row">
            <span className="detail-label">Hdg</span>
            <span className="detail-value mono">{platform.heading.toFixed(1)}&deg;</span>
          </div>
        )}
        {platform.pitch !== undefined && (
          <div className="detail-row">
            <span className="detail-label">Pitch</span>
            <span className="detail-value mono">{platform.pitch.toFixed(1)}&deg;</span>
          </div>
        )}
        {platform.roll !== undefined && (
          <div className="detail-row">
            <span className="detail-label">Roll</span>
            <span className="detail-value mono">{platform.roll.toFixed(1)}&deg;</span>
          </div>
        )}
      </div>

      {platform.velN !== undefined && (
        <div className="detail-section">
          <h4 className="detail-section-title">Velocity (NED)</h4>
          <div className="detail-row">
            <span className="detail-label">N</span>
            <span className="detail-value mono">{platform.velN.toFixed(1)} m/s</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">E</span>
            <span className="detail-value mono">{platform.velE!.toFixed(1)} m/s</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">D</span>
            <span className="detail-value mono">{platform.velD!.toFixed(1)} m/s</span>
          </div>
        </div>
      )}

      <div className="detail-section">
        <h4 className="detail-section-title">Status</h4>
        <div className="detail-row">
          <span className="detail-label">Damage</span>
          <span
            className={`detail-value damage-text damage-${platform.damageFactor >= 1 ? 'destroyed' : platform.damageFactor > 0 ? 'damaged' : 'healthy'}`}
          >
            {(platform.damageFactor * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {Object.keys(platform.sensors).length > 0 && (
        <div className="detail-section">
          <h4 className="detail-section-title">Sensors</h4>
          {Object.entries(platform.sensors).map(([name, sensor]) => (
            <div key={name} className="detail-row">
              <span className="detail-label">{name}</span>
              <span className="detail-value" style={{ color: sensor.isOn ? '#4caf50' : '#666' }}>
                {sensor.isOn ? 'ON' : 'OFF'} ({sensor.type})
              </span>
            </div>
          ))}
        </div>
      )}

      {Object.keys(platform.fuel).length > 0 && (
        <div className="detail-section">
          <h4 className="detail-section-title">Fuel</h4>
          {Object.entries(platform.fuel).map(([name, qty]) => (
            <div key={name} className="detail-row">
              <span className="detail-label">{name}</span>
              <span className="detail-value mono">{qty.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getSideCssColor(side: string): string {
  switch (side.toLowerCase()) {
    case 'blue': return '#4488ff';
    case 'red': return '#ff4444';
    default: return '#aaaaaa';
  }
}
