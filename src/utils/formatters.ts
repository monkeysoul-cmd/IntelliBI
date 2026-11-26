import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function formatCurrency(value: number, compact = false): string {
  if (!Number.isFinite(value)) return '$0.00';
  if (compact && Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (compact && Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  }).format(value);
}

export function formatNumber(value: number, compact = false): string {
  if (!Number.isFinite(value)) return '0';
  if (compact && Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (compact && Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0.0%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function formatColumnHeader(col: string): string {
  return col
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatCellValue(col: string, val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return '—';
    const lower = String(col ?? '').toLowerCase();
    if (/(revenue|amount|sales|price|cost|profit|aov|spend|value|gross)/i.test(lower)) {
      return formatCurrency(val);
    }
    if (/(pct|percent|rate|share|growth|margin_pct)/i.test(lower)) {
      return `${val.toFixed(1)}%`;
    }
    return formatNumber(val);
  }
  return String(val);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function buildCsvString(
  columns: string[],
  rows: Record<string, unknown>[]
): string {
  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map(escapeCell).join(',');
  const body = rows.map((row) => columns.map((c) => escapeCell(row[c])).join(','));
  return [header, ...body].join('\n');
}

export function downloadCsvFile(
  filename: string,
  columns: string[],
  rows: Record<string, unknown>[]
): void {
  const csv = buildCsvString(columns, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportReportToPdf(params: {
  title: string;
  question: string;
  summary: string;
  insights: string[];
  generatedSql: string | null;
  columns: string[];
  rows: Record<string, unknown>[];
  createdAt?: string;
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const marginX = 44;
  let cursorY = 50;

  // Brand header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(37, 99, 235);
  doc.text('INTELLIBI  ·  EXECUTIVE ANALYTICS REPORT', marginX, cursorY);
  cursorY += 22;

  // Title
  const safeTitle = params.title || 'Analytics Report';
  const safeQuestion = params.question || '';
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(safeTitle, 505);
  doc.text(titleLines, marginX, cursorY);
  cursorY += titleLines.length * 22 + 4;

  // Timestamp & Question
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated ${params.createdAt ? formatDateTime(params.createdAt) : formatDateTime(new Date().toISOString())}`,
    marginX,
    cursorY
  );
  cursorY += 18;

  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, cursorY, 551, cursorY);
  cursorY += 18;

  // Question
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Analytical Question', marginX, cursorY);
  cursorY += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const qLines = doc.splitTextToSize(safeQuestion, 505);
  doc.text(qLines, marginX, cursorY);
  cursorY += qLines.length * 14 + 12;

  // Executive Summary
  if (params.summary) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Executive Summary', marginX, cursorY);
    cursorY += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const sumLines = doc.splitTextToSize(params.summary, 505);
    doc.text(sumLines, marginX, cursorY);
    cursorY += sumLines.length * 14 + 12;
  }

  // Key Insights
  const safeInsights = params.insights || [];
  if (safeInsights.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Key Business Insights', marginX, cursorY);
    cursorY += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    for (const insight of safeInsights.slice(0, 6)) {
      const lines = doc.splitTextToSize(`• ${insight}`, 498);
      doc.text(lines, marginX + 6, cursorY);
      cursorY += lines.length * 13 + 4;
    }
    cursorY += 8;
  }

  // SQL Block
  if (params.generatedSql) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Validated PostgreSQL Query', marginX, cursorY);
    cursorY += 12;
    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    const sqlLines = doc.splitTextToSize(params.generatedSql, 495);
    doc.text(sqlLines, marginX + 6, cursorY + 4);
    cursorY += sqlLines.length * 11 + 16;
  }

  // Result Data Table
  const safeColumns = params.columns || [];
  const safeRows = params.rows || [];
  if (safeColumns.length > 0 && safeRows.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [safeColumns.map(formatColumnHeader)],
      body: safeRows.slice(0, 40).map((row) =>
        safeColumns.map((c) => formatCellValue(c, row[c]))
      ),
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8.5, cellPadding: 5, textColor: [30, 41, 59] },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }

  const slug =
    safeTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'intellibi-report';
  doc.save(`${slug}.pdf`);
}
