import React, { useMemo } from 'react';

/**
 * Component to compare reference data with actual data
 * Shows matching items in green, extra items in red, missing items in yellow
 */
export default function ReferenceComparison({ referenceData, actualData }) {
  const normalizeLines = (data) => {
    if (!data) return [];
    return String(data)
      .replace(/\r/g, '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  };

  const isKvByContract = (data) => {
    const lines = normalizeLines(data);
    if (lines.length === 0) return false;
    if (lines.some((l) => l.includes(','))) return false;
    return lines.every((l) => /^[A-Z0-9_]+\s*=\s*.+$/.test(l));
  };

  const parseKv = (data) => {
    const lines = normalizeLines(data);
    const map = new Map();
    const order = [];

    for (const line of lines) {
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!key) continue;
      if (!map.has(key)) order.push(key);
      map.set(key, value);
    }

    return { map, order };
  };

  // Parse data into arrays (split by comma, space, or newline)
  // Handles formats like: "user1,user2", "user1 user2", "user1\nuser2", etc.
  const parseData = (data) => {
    if (!data) return [];
    
    // First try splitting by comma (most common)
    if (data.includes(',')) {
      return data
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    }
    
    // Then try splitting by newline
    if (data.includes('\n')) {
      return data
        .split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    }
    
    // Finally, split by whitespace
    return data
      .split(/\s+/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  };

  const referenceItems = useMemo(() => parseData(referenceData), [referenceData]);
  const actualItems = useMemo(() => parseData(actualData), [actualData]);

  const isKv = useMemo(() => isKvByContract(referenceData), [referenceData]);

  const kvComparison = useMemo(() => {
    if (!isKv) return null;

    const ref = parseKv(referenceData);
    const act = parseKv(actualData);

    const rows = ref.order.map((key) => {
      const expected = ref.map.get(key) ?? '';
      const actual = act.map.has(key) ? (act.map.get(key) ?? '') : null;

      let status = 'matching';
      if (actual === null) status = 'missing';
      else if (actual !== expected) status = 'different';

      return { key, expected, actual, status };
    });

    const extra = [];
    for (const [key, value] of act.map.entries()) {
      if (!ref.map.has(key)) extra.push({ key, value });
    }

    return { rows, extra };
  }, [isKv, referenceData, actualData]);

  // Categorize items
  const comparison = useMemo(() => {
    if (isKv) return { matching: [], extra: [], missing: [] };

    const matching = [];
    const extra = []; // In actual but not in reference
    const missing = []; // In reference but not in actual

    // Create sets for faster lookup
    const referenceSet = new Set(referenceItems);
    const actualSet = new Set(actualItems);

    // Find matching items
    referenceItems.forEach(item => {
      if (actualSet.has(item)) {
        matching.push(item);
      } else {
        missing.push(item);
      }
    });

    // Find extra items
    actualItems.forEach(item => {
      if (!referenceSet.has(item)) {
        extra.push(item);
      }
    });

    return { matching, extra, missing };
  }, [referenceItems, actualItems]);

  if (!referenceData || !actualData) {
    return null;
  }

  const renderItem = (item, type) => {
    const baseClasses = "px-2 py-1 rounded text-sm font-mono break-words inline-block max-w-full";
    let colorClasses = "";
    
    switch (type) {
      case 'matching':
        colorClasses = "bg-green-100 text-green-800 border border-green-300";
        break;
      case 'extra':
        colorClasses = "bg-red-100 text-red-800 border border-red-300";
        break;
      case 'missing':
        colorClasses = "bg-yellow-100 text-yellow-800 border border-yellow-300";
        break;
      default:
        colorClasses = "bg-gray-100 text-gray-800 border border-gray-300";
    }

    return (
      <span key={item} className={`${baseClasses} ${colorClasses}`}>
        {item}
      </span>
    );
  };

  const renderKvRow = (row) => {
    const baseClasses = "px-2 py-1 rounded text-sm font-mono break-words inline-block max-w-full";
    const keyClasses = "text-xs font-semibold text-gray-600";

    const getColor = (status, side) => {
      if (status === 'matching') return "bg-green-100 text-green-800 border border-green-300";
      if (status === 'different') return "bg-yellow-100 text-yellow-800 border border-yellow-300";
      if (status === 'missing') return "bg-red-100 text-red-800 border border-red-300";
      return "bg-gray-100 text-gray-800 border border-gray-300";
    };

    const leftText = `${row.key}: ${row.expected}`;
    const rightText = row.actual === null ? `${row.key}: (отсутствует)` : `${row.key}: ${row.actual}`;

    return (
      <React.Fragment key={row.key}>
        <div className="min-w-0 w-full">
          <div className={keyClasses}>{row.key}</div>
          <span className={`${baseClasses} ${getColor(row.status, 'reference')}`}>{leftText}</span>
        </div>
        <div className="min-w-0 w-full">
          <div className={keyClasses}>{row.key}</div>
          <span className={`${baseClasses} ${getColor(row.status, 'actual')}`}>{rightText}</span>
        </div>
      </React.Fragment>
    );
  };

  return (
    <div className="border rounded-lg p-4 bg-blue-50 border-blue-200 w-full">
      <h3 className="font-bold mb-3 text-blue-900 break-words">Сравнение с эталонными данными</h3>
      
      {isKv && kvComparison ? (
        <div className="w-full">
          <div className="grid grid-cols-2 gap-4 w-full mb-2">
            <div className="font-semibold text-sm text-gray-700 break-words">Эталонные данные:</div>
            <div className="font-semibold text-sm text-gray-700 break-words">Текущие данные:</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
            <div className="min-w-0 w-full p-3 bg-white rounded border border-gray-200">
              <div className="grid grid-cols-1 gap-2">
                {kvComparison.rows.map((r) => (
                  <div key={r.key} className="min-w-0">
                    <div className="text-xs font-semibold text-gray-600">{r.key}</div>
                    <span
                      className={`px-2 py-1 rounded text-sm font-mono break-words inline-block max-w-full ${
                        r.status === 'matching'
                          ? 'bg-green-100 text-green-800 border border-green-300'
                          : r.status === 'missing'
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                      }`}
                    >
                      {`${r.key}: ${r.expected}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0 w-full p-3 bg-white rounded border border-gray-200">
              <div className="grid grid-cols-1 gap-2">
                {kvComparison.rows.map((r) => (
                  <div key={r.key} className="min-w-0">
                    <div className="text-xs font-semibold text-gray-600">{r.key}</div>
                    <span
                      className={`px-2 py-1 rounded text-sm font-mono break-words inline-block max-w-full ${
                        r.status === 'matching'
                          ? 'bg-green-100 text-green-800 border border-green-300'
                          : r.status === 'missing'
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                      }`}
                    >
                      {r.actual === null ? `${r.key}: (отсутствует)` : `${r.key}: ${r.actual}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {kvComparison.extra.length > 0 && (
            <div className="mt-3 text-xs text-red-700 break-words">
              ⚠ Лишние в текущих:{' '}
              <span className="break-words">
                {kvComparison.extra.map((e) => `${e.key}=${e.value}`).join(', ')}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
          {/* Reference Data Column */}
          <div className="min-w-0 w-full">
            <div className="font-semibold mb-2 text-sm text-gray-700 break-words">Эталонные данные:</div>
            <div className="flex flex-wrap gap-2 min-h-[60px] p-3 bg-white rounded border border-gray-200 break-words">
              {referenceItems.length === 0 ? (
                <span className="text-gray-400 italic">Нет данных</span>
              ) : (
                referenceItems.map(item => {
                  const type = comparison.matching.includes(item) ? 'matching' : 'missing';
                  return renderItem(item, type);
                })
              )}
            </div>
            {comparison.missing.length > 0 && (
              <div className="mt-2 text-xs text-yellow-700 break-words">
                ⚠ Отсутствуют: <span className="break-words">{comparison.missing.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Actual Data Column */}
          <div className="min-w-0 w-full">
            <div className="font-semibold mb-2 text-sm text-gray-700 break-words">Фактические данные:</div>
            <div className="flex flex-wrap gap-2 min-h-[60px] p-3 bg-white rounded border border-gray-200 break-words">
              {actualItems.length === 0 ? (
                <span className="text-gray-400 italic">Нет данных</span>
              ) : (
                actualItems.map(item => {
                  const type = comparison.matching.includes(item) ? 'matching' : 'extra';
                  return renderItem(item, type);
                })
              )}
            </div>
            {comparison.extra.length > 0 && (
              <div className="mt-2 text-xs text-red-700 break-words">
                ⚠ Лишние: <span className="break-words">{comparison.extra.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-blue-300 flex flex-wrap gap-4 text-xs break-words">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="w-4 h-4 bg-green-100 border border-green-300 rounded flex-shrink-0"></span>
          <span className="break-words">Совпадают</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded flex-shrink-0"></span>
          <span className="break-words">{isKv ? 'Отличаются значения' : 'Отсутствуют в фактических'}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="w-4 h-4 bg-red-100 border border-red-300 rounded flex-shrink-0"></span>
          <span className="break-words">{isKv ? 'Отсутствуют в текущих' : 'Лишние в фактических'}</span>
        </div>
      </div>
    </div>
  );
}
