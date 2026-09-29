import { useState, useMemo, useCallback } from 'react';
import { usePlatformStore } from '../../store/platformStore';

type SortField = 'name' | 'side' | 'typeId' | 'alt' | 'damageFactor';
type SortDir = 'asc' | 'desc';

export function PlatformTable() {
  const platforms = usePlatformStore((s) => s.platforms);
  const selectPlatform = usePlatformStore((s) => s.selectPlatform);
  const selectedPlatformIndex = usePlatformStore((s) => s.selectedPlatformIndex);

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterSide, setFilterSide] = useState<string>('all');
  const [search, setSearch] = useState('');

  const sortedPlatforms = useMemo(() => {
    let list = Object.values(platforms);

    if (filterSide !== 'all') {
      list = list.filter((p) => p.side.toLowerCase() === filterSide);
    }

    if (search) {
      const lower = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          p.typeId.toLowerCase().includes(lower),
      );
    }

    list.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const numA = Number(aVal);
      const numB = Number(bVal);
      return sortDir === 'asc' ? numA - numB : numB - numA;
    });

    return list;
  }, [platforms, sortField, sortDir, filterSide, search]);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('asc');
      }
    },
    [sortField],
  );

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  const platformCount = Object.keys(platforms).length;

  return (
    <div className="platform-table">
      <div className="panel-header">
        <h3 className="panel-title">Platforms ({platformCount})</h3>
      </div>

      <div className="table-filters">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-input"
        />
        <select
          value={filterSide}
          onChange={(e) => setFilterSide(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Sides</option>
          <option value="blue">Blue</option>
          <option value="red">Red</option>
          <option value="neutral">Neutral</option>
        </select>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('name')}>Name{sortIndicator('name')}</th>
              <th onClick={() => toggleSort('side')}>Side{sortIndicator('side')}</th>
              <th onClick={() => toggleSort('typeId')}>Type{sortIndicator('typeId')}</th>
              <th onClick={() => toggleSort('alt')}>Alt{sortIndicator('alt')}</th>
              <th onClick={() => toggleSort('damageFactor')}>Dmg{sortIndicator('damageFactor')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlatforms.map((p) => (
              <tr
                key={p.index}
                className={`table-row ${p.index === selectedPlatformIndex ? 'selected' : ''}`}
                onClick={() => selectPlatform(p.index)}
              >
                <td className="cell-name">{p.name}</td>
                <td>
                  <span className="side-badge" style={{ color: getSideCssColor(p.side) }}>
                    {p.side.toUpperCase()}
                  </span>
                </td>
                <td className="cell-type">{p.typeId}</td>
                <td className="cell-num">{p.alt.toFixed(0)}m</td>
                <td className="cell-num">
                  <span className={`damage-bar damage-${damageLevel(p.damageFactor)}`}>
                    {(p.damageFactor * 100).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
            {sortedPlatforms.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
                  No platforms
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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

function damageLevel(factor: number): 'none' | 'light' | 'medium' | 'heavy' | 'destroyed' {
  if (factor === 0) return 'none';
  if (factor < 0.25) return 'light';
  if (factor < 0.5) return 'medium';
  if (factor < 1.0) return 'heavy';
  return 'destroyed';
}
