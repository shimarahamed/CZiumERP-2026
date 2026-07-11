'use client';

import Header from '@/components/Header';
import { Breadcrumb } from '@/components/Breadcrumb';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';

export default function DashboardPreviewPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard Preview" />
      <Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Dashboard Preview' }]} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <AnalyticsDashboard />
      </main>
    </div>
  );
}
