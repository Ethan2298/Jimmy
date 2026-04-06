import { useState, useEffect } from 'react';
import { getLeads, type Lead } from '../api/client';
import LeadScoreBadge from '../components/LeadScoreBadge';

const statusColors: Record<string, string> = {
  new: 'bg-blue-700 text-blue-200',
  contacted: 'bg-purple-700 text-purple-200',
  qualified: 'bg-green-700 text-green-200',
  negotiating: 'bg-amber-700 text-amber-200',
  closed: 'bg-gray-700 text-gray-300',
  lost: 'bg-red-800 text-red-300',
};

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    getLeads()
      .then(setLeads)
      .catch(() => setError('Failed to load leads'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-charcoal-400">Loading leads...</p></div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Leads</h1>
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {leads.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-charcoal-400">No leads yet. They will appear here when customers text in.</p>
        </div>
      ) : (
        <div className="bg-charcoal-700 border border-charcoal-500 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-8 gap-4 px-5 py-3 bg-charcoal-800 text-xs text-charcoal-300 font-semibold uppercase tracking-wider">
            <div>Name</div>
            <div>Phone</div>
            <div>Email</div>
            <div>Interested In</div>
            <div>Budget</div>
            <div>Timeline</div>
            <div className="text-center">Score</div>
            <div className="text-center">Status</div>
          </div>

          {/* Table Rows */}
          {leads.map((lead) => (
            <div key={lead.id}>
              <div
                onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                className="grid grid-cols-1 md:grid-cols-8 gap-2 md:gap-4 px-5 py-3.5 border-t border-charcoal-600 hover:bg-charcoal-600/50 cursor-pointer transition-colors items-center"
              >
                <div className="text-white text-sm font-medium">{lead.name}</div>
                <div className="text-charcoal-300 text-sm">{lead.phone}</div>
                <div className="text-charcoal-300 text-sm truncate">{lead.email || '-'}</div>
                <div className="text-charcoal-300 text-sm truncate">{lead.interested_car || '-'}</div>
                <div className="text-charcoal-300 text-sm">
                  {lead.budget_min || lead.budget_max
                    ? `$${(lead.budget_min || 0).toLocaleString()} - $${(lead.budget_max || 0).toLocaleString()}`
                    : '-'}
                </div>
                <div className="text-charcoal-300 text-sm">{lead.timeline || '-'}</div>
                <div className="flex justify-center">
                  <LeadScoreBadge score={lead.score} />
                </div>
                <div className="flex justify-center">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[lead.status] || 'bg-gray-700 text-gray-300'}`}>
                    {lead.status}
                  </span>
                </div>
              </div>

              {/* Expanded Detail */}
              {expandedId === lead.id && (
                <div className="px-5 py-4 bg-charcoal-800 border-t border-charcoal-600">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-charcoal-400">Full Name:</span>
                      <span className="text-white ml-2">{lead.name}</span>
                    </div>
                    <div>
                      <span className="text-charcoal-400">Phone:</span>
                      <span className="text-white ml-2">{lead.phone}</span>
                    </div>
                    <div>
                      <span className="text-charcoal-400">Email:</span>
                      <span className="text-white ml-2">{lead.email || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-charcoal-400">Budget:</span>
                      <span className="text-white ml-2">
                        {lead.budget_min || lead.budget_max
                          ? `$${(lead.budget_min || 0).toLocaleString()} - $${(lead.budget_max || 0).toLocaleString()}`
                          : 'Not specified'}
                      </span>
                    </div>
                    <div>
                      <span className="text-charcoal-400">Timeline:</span>
                      <span className="text-white ml-2">{lead.timeline || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-charcoal-400">Created:</span>
                      <span className="text-white ml-2">{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                  {lead.notes && (
                    <div className="mt-3 text-sm">
                      <span className="text-charcoal-400">Notes:</span>
                      <p className="text-charcoal-300 mt-1">{lead.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
