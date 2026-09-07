'use client';
import { useState, useEffect } from 'react';
import { request, displayDate } from '@/lib/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Users, Plus, ArrowRight, Trash2, Building, Globe, Phone, MapPin } from 'lucide-react';
import Integrations, { type Connections } from './integrations';

export type ClientData = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  social_urls: string | null;
  created: string;
  updated: string;
};

export default function Clients({
  connections,
  refreshConnections,
}: {
  connections: Connections;
  refreshConnections: () => Promise<void>;
}) {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [editingClient, setEditingClient] = useState<Partial<ClientData> | null>(null);
  const [viewingClient, setViewingClient] = useState<ClientData | null>(null);

  const loadClients = async () => {
    try {
      const res = await request('/api/clients');
      setClients(res);
      setViewingClient((prev) => (prev ? res.find((c: ClientData) => c.id === prev.id) || null : null));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const saveClient = async () => {
    if (!editingClient?.name) return;
    try {
      await request('/api/clients', 'POST', editingClient);
      setEditingClient(null);
      await loadClients();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const deleteClient = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    try {
      await request('/api/clients', 'DELETE', { id });
      if (viewingClient?.id === id) setViewingClient(null);
      await loadClients();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  if (loading) return <div className="p-8">Loading clients...</div>;

  if (viewingClient) {
    // Client Details Page (with Integrations)
    return (
      <div className="client-details fade-in">
        <button 
          className="text-button mb-6 flex items-center gap-2" 
          onClick={() => setViewingClient(null)}
        >
          ← Back to Dashboard
        </button>
        
        <div className="topbar" style={{ padding: 0, border: 'none', height: 'auto', marginBottom: 24, background: 'transparent' }}>
          <div>
            <h1 className="text-3xl font-bold mb-2">{viewingClient.name}</h1>
            <div className="flex gap-4 text-sm muted mt-2 flex-wrap">
              {viewingClient.phone && <span className="flex items-center gap-1"><Phone size={14} /> {viewingClient.phone}</span>}
              {viewingClient.address && <span className="flex items-center gap-1"><MapPin size={14} /> {viewingClient.address}</span>}
              {viewingClient.social_urls && <span className="flex items-center gap-1"><Globe size={14} /> {viewingClient.social_urls}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="secondary-button" onClick={() => setEditingClient(viewingClient)}>Edit Details</button>
            <button className="secondary-button !text-red-500 !border-red-200" onClick={() => deleteClient(viewingClient.id)}><Trash2 size={16} /></button>
          </div>
        </div>

        <div className="settings-box !max-w-none">
          <h2 className="text-xl font-bold mb-4">Social Media Accounts</h2>
          <p className="muted mb-6">Manage the app credentials and connected accounts specifically for {viewingClient.name}.</p>
          
          <Integrations 
            data={connections} 
            refresh={refreshConnections} 
            clientId={viewingClient.id} 
          />
        </div>
      </div>
    );
  }

  // Summary Dashboard
  return (
    <div className="fade-in">
      {error && <div className="notice error">{error}</div>}
      
      <div className="topbar" style={{ padding: 0, border: 'none', height: 'auto', marginBottom: 24, background: 'transparent' }}>
        <div>
          <h1 className="text-2xl font-bold">Client Dashboard</h1>
          <p className="muted mt-1">Manage your onboarded clients and their connected channels.</p>
        </div>
        <button className="primary-button" onClick={() => setEditingClient({ name: '', address: '', phone: '', social_urls: '' })}>
          <Plus size={16} /> Onboard Client
        </button>
      </div>

      {!clients.length ? (
        <div className="empty-panel">
          <Building size={32} />
          <h2>Welcome to your Agency Workspace</h2>
          <p>Onboard your first client to start scheduling and managing their content.</p>
          <button className="primary-button mt-4" onClick={() => setEditingClient({ name: '', address: '', phone: '', social_urls: '' })}>
            Onboard a Client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map(client => {
            const clientIntegrations = connections.configured.filter(c => (c as any).client_id === client.id);
            const clientAccounts = connections.accounts.filter(a => clientIntegrations.some(ci => ci.id === a.integration_id || ci.id === a.provider));
            
            return (
              <div key={client.id} className="account-card cursor-pointer hover:border-[#1043db] transition-colors" onClick={() => setViewingClient(client)}>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg">{client.name}</h3>
                  <ArrowRight size={16} className="text-muted-foreground opacity-50" />
                </div>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-semibold uppercase muted tracking-wider">Connected Accounts</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {clientAccounts.length ? clientAccounts.map(acc => (
                        <span key={acc.id} className="inline-block bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded">
                          {acc.platform}
                        </span>
                      )) : <span className="text-sm muted">None configured</span>}
                    </div>
                  </div>
                  
                  <div className="text-xs muted pt-3 mt-3 border-t border-border">
                    Onboarded {displayDate(client.created)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Onboarding Modal */}
      <Dialog open={!!editingClient} onOpenChange={(o) => { if (!o) setEditingClient(null); }}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editingClient?.id ? 'Edit Client' : 'Onboard New Client'}
            </DialogTitle>
          </DialogHeader>
          <div className="form-grid mt-4">
            <label className="field">
              Client / Brand Name <span className="text-red-500">*</span>
              <input 
                value={editingClient?.name || ''} 
                onChange={e => setEditingClient(prev => prev ? {...prev, name: e.target.value} : null)} 
                placeholder="e.g. Acme Corp"
              />
            </label>
            <label className="field">
              Phone Number
              <input 
                value={editingClient?.phone || ''} 
                onChange={e => setEditingClient(prev => prev ? {...prev, phone: e.target.value} : null)} 
                placeholder="Optional"
              />
            </label>
            <label className="field">
              Address
              <textarea 
                value={editingClient?.address || ''} 
                onChange={e => setEditingClient(prev => prev ? {...prev, address: e.target.value} : null)} 
                placeholder="Optional"
                rows={2}
              />
            </label>
            <label className="field">
              Social URLs
              <textarea 
                value={editingClient?.social_urls || ''} 
                onChange={e => setEditingClient(prev => prev ? {...prev, social_urls: e.target.value} : null)} 
                placeholder="https://instagram.com/...&#10;https://facebook.com/..."
                rows={3}
              />
            </label>
            <button className="primary-button mt-4" disabled={!editingClient?.name} onClick={saveClient}>
              Save Client
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
