'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface HeatmapRow {
  name: string;
  slug: string;
  yearCounts: Record<number, number>;
  total: number;
  color?: string;
}

interface Props {
  rows: HeatmapRow[];
  years: number[];
  linkPrefix: string; // e.g. '/dj/' or '/stages' (not used for stages)
  accentColor?: string;
}

export function Heatmap({ rows, years, linkPrefix, accentColor = 'rgba(139, 92, 246' }: Props) {
  const heatmapRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const gridEl = heatmapRef.current;
    if (!gridEl) return;

    import('d3').then((d3) => {
      gridEl.innerHTML = '';

      if (rows.length === 0) {
        gridEl.innerHTML = '<div class="empty-state"><div class="empty-state-text">No data.</div></div>';
        return;
      }

      if (!tooltipRef.current) {
        const tip = document.createElement('div');
        tip.className = 'heatmap-tooltip';
        tip.style.display = 'none';
        document.body.appendChild(tip);
        tooltipRef.current = tip;
      }
      const tooltip = tooltipRef.current;

      const cellSize = 20;
      const cellGap = 1;
      const step = cellSize + cellGap;
      const labelWidth = 160;
      const headerHeight = 40;

      const width = labelWidth + years.length * step + 20;
      const height = headerHeight + rows.length * step + 10;

      const svg = d3.select(gridEl)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('display', 'block');

      // Year labels
      const yearGroup = svg.append('g')
        .attr('transform', `translate(${labelWidth}, 0)`);

      yearGroup.selectAll('text')
        .data(years)
        .enter()
        .append('text')
        .attr('x', (_d: number, i: number) => i * step + cellSize / 2)
        .attr('y', headerHeight - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', '#94a3b8')
        .attr('font-size', years.length > 20 ? '8px' : '10px')
        .attr('font-family', "'Inter', system-ui, sans-serif")
        .text((d: number) => {
          if (years.length > 20) return d % 2 === 0 ? String(d).slice(2) : '';
          return String(d).slice(2);
        });

      // Rows
      const rowGroup = svg.append('g')
        .attr('transform', `translate(0, ${headerHeight})`);

      rows.forEach((row, rowIdx) => {
        const y = rowIdx * step;
        const rowColor = row.color || accentColor;

        const label = rowGroup.append('text')
          .attr('x', labelWidth - 8)
          .attr('y', y + cellSize / 2 + 4)
          .attr('text-anchor', 'end')
          .attr('fill', '#e2e8f0')
          .attr('font-size', '11px')
          .attr('font-family', "'Inter', system-ui, sans-serif")
          .attr('cursor', linkPrefix ? 'pointer' : 'default')
          .text(row.name.length > 20 ? row.name.substring(0, 18) + '...' : row.name);

        if (linkPrefix) {
          label.on('click', () => router.push(`${linkPrefix}${row.slug}`));
          label.on('mouseover', function (this: SVGTextElement) { d3.select(this).attr('fill', '#8b5cf6'); });
          label.on('mouseout', function (this: SVGTextElement) { d3.select(this).attr('fill', '#e2e8f0'); });
        }

        years.forEach((year, colIdx) => {
          const count = row.yearCounts[year] || 0;
          const x = labelWidth + colIdx * step;

          let fill: string;
          if (count === 0) {
            fill = 'rgba(30, 30, 46, 0.2)';
          } else if (count === 1) {
            fill = `${rowColor}, 0.35)`;
          } else {
            fill = `${rowColor}, 0.8)`;
          }

          const rect = rowGroup.append('rect')
            .attr('x', x)
            .attr('y', y)
            .attr('width', cellSize)
            .attr('height', cellSize)
            .attr('rx', 2)
            .attr('fill', fill)
            .attr('cursor', count > 0 && linkPrefix ? 'pointer' : 'default');

          rect.on('mousemove', function (event: MouseEvent) {
            if (!tooltip) return;
            tooltip.style.display = 'block';
            tooltip.textContent = `${row.name} \u2014 ${year}: ${count} set${count !== 1 ? 's' : ''}`;
            tooltip.style.left = (event.clientX + 12) + 'px';
            tooltip.style.top = (event.clientY - 8) + 'px';
          });

          rect.on('mouseout', function () {
            if (!tooltip) return;
            tooltip.style.display = 'none';
          });

          if (count > 0 && linkPrefix) {
            rect.on('click', () => router.push(`${linkPrefix}${row.slug}`));
          }
        });
      });
    });

    return () => {
      if (tooltipRef.current && tooltipRef.current.parentNode) {
        tooltipRef.current.parentNode.removeChild(tooltipRef.current);
        tooltipRef.current = null;
      }
    };
  }, [rows, years, linkPrefix, accentColor, router]);

  return <div ref={heatmapRef} style={{ overflowX: 'auto', padding: '0 20px 20px' }} />;
}
