import React, { useMemo } from 'react';

/**
 * Component to compare reference data with actual data
 * Shows matching items in green, extra items in red, missing items in yellow
 */
export default function ReferenceComparison({ referenceData, actualData }) {
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

  // Categorize items
  const comparison = useMemo(() => {
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

  return (
    <div className="border rounded-lg p-4 bg-blue-50 border-blue-200 w-full">
      <h3 className="font-bold mb-3 text-blue-900 break-words">Сравнение с эталонными данными</h3>
      
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

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-blue-300 flex flex-wrap gap-4 text-xs break-words">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="w-4 h-4 bg-green-100 border border-green-300 rounded flex-shrink-0"></span>
          <span className="break-words">Совпадают</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded flex-shrink-0"></span>
          <span className="break-words">Отсутствуют в фактических</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="w-4 h-4 bg-red-100 border border-red-300 rounded flex-shrink-0"></span>
          <span className="break-words">Лишние в фактических</span>
        </div>
      </div>
    </div>
  );
}
