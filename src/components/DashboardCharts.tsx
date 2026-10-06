/**
 * AssetMT - Premium Dashboard Charts
 * Bespoke lightweight SVG charts using 100% real database metrics.
 * Zero external heavy dependencies, fully responsive and accessible.
 */

import React, { useState } from 'react';

// ============================================================================
// 1. ASSET STATUS DONUT CHART
// ============================================================================
interface StatusSlice {
  label: string;
  count: number;
  color: string;
}

export const AssetStatusDonutChart: React.FC<{
  statusBreakdown: Record<string, number>;
  totalAssets: number;
}> = ({ statusBreakdown, totalAssets }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const statusColors: Record<string, string> = {
    Available: '#27C499', // Mint / Success
    Assigned: '#315CFF', // Cobalt
    'Under Repair': '#F59E0B', // Restrained Amber
    Retired: '#94A3B8', // Neutral Slate
    Disposed: '#64748B', // Darker Slate
  };

  const slices: StatusSlice[] = [
    { label: 'Available', count: statusBreakdown?.['Available'] || 0, color: statusColors['Available'] },
    { label: 'Assigned', count: statusBreakdown?.['Assigned'] || 0, color: statusColors['Assigned'] },
    { label: 'Under Repair', count: statusBreakdown?.['Under Repair'] || 0, color: statusColors['Under Repair'] },
    { label: 'Retired', count: statusBreakdown?.['Retired'] || 0, color: statusColors['Retired'] },
    { label: 'Disposed', count: statusBreakdown?.['Disposed'] || 0, color: statusColors['Disposed'] },
  ].filter((s) => s.count > 0);

  if (totalAssets === 0 || slices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-neutral-200 flex items-center justify-center text-neutral-400 mb-3 font-mono text-xs">
          0%
        </div>
        <p className="text-xs font-semibold text-neutral-800">No Asset Data Yet</p>
        <p className="text-[11px] text-neutral-500 mt-0.5 max-w-xs">
          Add your first asset to visualize operational status distribution.
        </p>
      </div>
    );
  }

  // Calculate SVG arc paths
  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 justify-between">
      {/* SVG Donut */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
          />
          {slices.map((slice, i) => {
            const percent = slice.count / totalAssets;
            const strokeDasharray = `${circumference * percent} ${circumference * (1 - percent)}`;
            const strokeDashoffset = -circumference * cumulativePercent;
            cumulativePercent += percent;

            const isHovered = hoveredIndex === i;

            return (
              <circle
                key={slice.label}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        {/* Center Total Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-2xl font-bold font-mono text-neutral-900 tabular-nums">
            {hoveredIndex !== null ? slices[hoveredIndex]?.count : totalAssets.toLocaleString()}
          </span>
          <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">
            {hoveredIndex !== null ? slices[hoveredIndex]?.label : 'Total Assets'}
          </span>
        </div>
      </div>

      {/* Legend & Breakdown */}
      <div className="flex-1 w-full space-y-2">
        {slices.map((slice, i) => {
          const percent = ((slice.count / totalAssets) * 100).toFixed(1);
          const isHovered = hoveredIndex === i;

          return (
            <div
              key={slice.label}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors cursor-pointer ${
                isHovered ? 'bg-neutral-50 font-semibold' : 'hover:bg-neutral-50/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="text-neutral-700 font-medium">{slice.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-neutral-900 font-bold tabular-nums">
                  {slice.count.toLocaleString()}
                </span>
                <span className="font-mono text-neutral-400 text-[11px] w-12 text-right tabular-nums">
                  {percent}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 2. ASSETS BY CATEGORY (HORIZONTAL BAR CHART)
// ============================================================================
export const CategoryHorizontalBarChart: React.FC<{
  categories: { categoryName: string; count: number; value: number }[];
  formatCurrency: (val: number) => string;
}> = ({ categories, formatCurrency }) => {
  if (!categories || categories.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-xs font-semibold text-neutral-800">No Category Data</p>
        <p className="text-[11px] text-neutral-500 mt-0.5">
          Assets assigned to categories will populate this chart.
        </p>
      </div>
    );
  }

  const sorted = [...categories].sort((a, b) => b.count - a.count).slice(0, 6);
  const maxCount = Math.max(...sorted.map((c) => c.count), 1);

  return (
    <div className="space-y-3.5">
      {sorted.map((cat, idx) => {
        const percentage = Math.round((cat.count / maxCount) * 100);
        return (
          <div key={idx} className="group">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-neutral-800 truncate max-w-[180px]">
                {cat.categoryName}
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-neutral-500 text-[11px] tabular-nums">
                  {formatCurrency(cat.value)}
                </span>
                <span className="font-mono font-bold text-neutral-900 tabular-nums w-8 text-right">
                  {cat.count}
                </span>
              </div>
            </div>

            {/* Progress Bar Track */}
            <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#FF6A1A] to-[#FF8A4C] rounded-full transition-all duration-500"
                style={{ width: `${Math.max(percentage, 4)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// 3. ASSETS BY SITE / LOCATION (VERTICAL BAR CHART)
// ============================================================================
export const SiteDistributionBarChart: React.FC<{
  siteData: { siteName: string; count: number }[];
}> = ({ siteData }) => {
  if (!siteData || siteData.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-xs font-semibold text-neutral-800">No Site Data Available</p>
        <p className="text-[11px] text-neutral-500 mt-0.5">
          Configure physical sites in Organization Management to view geographic telemetry.
        </p>
      </div>
    );
  }

  const maxVal = Math.max(...siteData.map((s) => s.count), 1);

  return (
    <div className="flex items-end justify-between gap-3 h-44 pt-4 px-2">
      {siteData.map((item, idx) => {
        const heightPct = Math.max(Math.round((item.count / maxVal) * 100), 8);
        return (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
            <span className="text-[11px] font-mono font-bold text-neutral-900 opacity-80 group-hover:opacity-100 transition-opacity">
              {item.count}
            </span>
            <div className="w-full max-w-[40px] bg-neutral-100 rounded-t-md h-full flex items-end overflow-hidden p-0.5">
              <div
                className="w-full bg-[#315CFF] hover:bg-[#2348db] rounded-t-sm transition-all duration-300"
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="text-[10px] font-medium text-neutral-600 truncate max-w-[65px] text-center title" title={item.siteName}>
              {item.siteName}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// 4. MAINTENANCE ACTIVITY BREAKDOWN
// ============================================================================
export const MaintenanceActivityChart: React.FC<{
  maintenanceMetrics?: {
    openCount: number;
    scheduledCount: number;
    inProgressCount: number;
    overdueCount: number;
    completedCount?: number;
    totalCost: number;
  };
  hasHistory: boolean;
}> = ({ maintenanceMetrics, hasHistory }) => {
  if (!hasHistory || !maintenanceMetrics) {
    return (
      <div className="py-12 text-center">
        <p className="text-xs font-semibold text-neutral-800">No Maintenance History Available Yet</p>
        <p className="text-[11px] text-neutral-500 mt-0.5">
          Scheduled and completed work orders will plot here over time.
        </p>
      </div>
    );
  }

  const stages = [
    { label: 'Scheduled', count: maintenanceMetrics.scheduledCount, color: '#315CFF' },
    { label: 'Open', count: maintenanceMetrics.openCount, color: '#0284C7' },
    { label: 'In Progress', count: maintenanceMetrics.inProgressCount, color: '#F59E0B' },
    { label: 'Overdue', count: maintenanceMetrics.overdueCount, color: '#EF4444' },
    { label: 'Completed', count: maintenanceMetrics.completedCount || 0, color: '#27C499' },
  ];

  const total = stages.reduce((acc, s) => acc + s.count, 0);

  if (total === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-xs font-semibold text-neutral-800">No Active Service Activity</p>
        <p className="text-[11px] text-neutral-500 mt-0.5">
          All equipment is operational with no active work orders.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Segmented Stacked Bar */}
      <div className="h-4 w-full bg-neutral-100 rounded-full overflow-hidden flex">
        {stages.map((stage) => {
          if (stage.count === 0) return null;
          const widthPct = (stage.count / total) * 100;
          return (
            <div
              key={stage.label}
              style={{ width: `${widthPct}%`, backgroundColor: stage.color }}
              title={`${stage.label}: ${stage.count}`}
              className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
            />
          );
        })}
      </div>

      {/* Grid of Stages */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
        {stages.map((stage) => (
          <div key={stage.label} className="p-2.5 rounded-lg border border-neutral-100 bg-neutral-50/50">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
              <span className="text-[11px] font-medium text-neutral-600 truncate">{stage.label}</span>
            </div>
            <div className="text-lg font-bold font-mono text-neutral-900 tabular-nums">
              {stage.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 5. ASSET VALUE & FINANCIAL OVERVIEW
// ============================================================================
export const AssetFinancialOverview: React.FC<{
  totalAssetValue: number;
  maintenanceSpend: number;
  formatCurrency: (val: number) => string;
}> = ({ totalAssetValue, maintenanceSpend, formatCurrency }) => {
  const maxValue = Math.max(totalAssetValue, maintenanceSpend, 1);
  const purchasePct = Math.round((totalAssetValue / maxValue) * 100);
  const maintPct = Math.round((maintenanceSpend / maxValue) * 100);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-medium text-neutral-700">Total Purchase Value</span>
          <span className="font-mono font-bold text-neutral-900 tabular-nums">
            {formatCurrency(totalAssetValue)}
          </span>
        </div>
        <div className="h-2.5 w-full bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#27C499] rounded-full transition-all duration-500"
            style={{ width: `${purchasePct}%` }}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-medium text-neutral-700">Cumulative Maintenance Spend</span>
          <span className="font-mono font-bold text-neutral-900 tabular-nums">
            {formatCurrency(maintenanceSpend)}
          </span>
        </div>
        <div className="h-2.5 w-full bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#FF6A1A] rounded-full transition-all duration-500"
            style={{ width: `${maintPct}%` }}
          />
        </div>
      </div>

      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
        <span>Capital Preservation Ratio</span>
        <span className="font-mono font-semibold text-neutral-800">
          {totalAssetValue > 0
            ? `${(((totalAssetValue - maintenanceSpend) / totalAssetValue) * 100).toFixed(1)}% Net`
            : '100%'}
        </span>
      </div>
    </div>
  );
};
