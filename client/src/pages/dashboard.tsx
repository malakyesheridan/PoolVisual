import React from 'react';
import { ProjectDashboard } from '../components/dashboard/ProjectDashboard';

export default function Dashboard() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <ProjectDashboard />
      </div>
    </div>
  );
}
