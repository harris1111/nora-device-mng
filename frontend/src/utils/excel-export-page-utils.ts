import type { ExcelExportColumnOption } from '../api/device-api';

export function downloadExcel(blob: Blob, prefix: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  link.href = url;
  link.download = `${prefix}-${timestamp}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getDefaultColumnKeys(columns: ExcelExportColumnOption[]): string[] {
  const defaults = columns.filter((column) => column.default).map((column) => column.key);
  return defaults.length > 0 ? defaults : columns.slice(0, 1).map((column) => column.key);
}

export function mapByName<T extends { id: string; name: string }>(items: T[]): Map<string, string> {
  return new Map(items.map((item) => [item.name, item.id]));
}
