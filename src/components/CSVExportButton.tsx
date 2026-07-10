'use client';

import { Button } from '@/components/ui/button';
import { Download } from '@/components/icons';
import { exportToCSV } from '@/lib/csv-export';

interface CSVExportButtonProps<T extends Record<string, unknown>> {
  data: T[];
  filename: string;
  columns?: { key: keyof T; label: string }[];
  label?: string;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
}

export function CSVExportButton<T extends Record<string, unknown>>({
  data,
  filename,
  columns,
  label = 'Export CSV',
  size = 'sm',
  variant = 'outline',
}: CSVExportButtonProps<T>) {
  return (
    <Button
      variant={variant}
      size={size}
      className="gap-1"
      onClick={() => exportToCSV(data, filename, columns)}
      disabled={data.length === 0}
    >
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
}
