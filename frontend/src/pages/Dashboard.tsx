import { useState, useEffect } from 'react';
import { getDashboardStats, type DashboardStats } from '../api/client';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => setError('Failed to load dashboard stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-charcoal-400 text-lg">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Cars',
      value: stats?.total_cars ?? 0,
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
      ),
      color: 'text-rpm-gold-light',
    },
    {
      label: 'Active Leads',
      value: stats?.active_leads ?? 0,
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
        </svg>
      ),
      color: 'text-green-400',
    },
    {
      label: 'Pending Appointments',
      value: stats?.pending_appointments ?? 0,
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
        </svg>
      ),
      color: 'text-amber-400',
    },
    {
      label: 'Conversations Today',
      value: stats?.conversations_today ?? 0,
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
        </svg>
      ),
      color: 'text-blue-400',
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-charcoal-700 border border-charcoal-500 rounded-xl p-5 hover:border-charcoal-400 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`${card.color}`}>{card.icon}</span>
            </div>
            <p className="text-3xl font-bold text-white">{card.value}</p>
            <p className="text-charcoal-300 text-sm mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <div className="bg-charcoal-700 border border-charcoal-500 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Conversations</h2>
          {stats?.recent_conversations && stats.recent_conversations.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_conversations.map((conv) => (
                <div key={conv.id} className="flex items-center justify-between py-2 border-b border-charcoal-600 last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{conv.phone_number}</p>
                    <p className="text-charcoal-300 text-xs truncate max-w-[250px]">{conv.last_message}</p>
                  </div>
                  <span className="text-charcoal-400 text-xs whitespace-nowrap ml-3">
                    {conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString() : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-charcoal-400 text-sm">No recent conversations</p>
          )}
        </div>

        {/* Recent Leads */}
        <div className="bg-charcoal-700 border border-charcoal-500 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Newest Leads</h2>
          {stats?.recent_leads && stats.recent_leads.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_leads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between py-2 border-b border-charcoal-600 last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{lead.name}</p>
                    <p className="text-charcoal-300 text-xs">{lead.phone}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    lead.score >= 7 ? 'bg-green-700 text-green-200' :
                    lead.score >= 4 ? 'bg-amber-700 text-amber-200' :
                    'bg-red-700 text-red-200'
                  }`}>
                    Score: {lead.score}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-charcoal-400 text-sm">No leads yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
