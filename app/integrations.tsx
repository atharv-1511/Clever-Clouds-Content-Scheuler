'use client';
import { useState } from 'react';
import { providers } from '@/lib/catalog';
import { request } from '@/lib/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Link2, KeyRound, ArrowUpRight, Plus, Trash2, Copy, Check } from 'lucide-react';

export type Connections = {
  configured: { id: string; label: string; provider: string; client_id?: string; clientIdHint: string; updated: string }[];
  accounts: {
    id: string;
    integration_id: string;
    provider: string;
    name: string;
    platform: string;
    external_id: string;
  }[];
  origin: string;
};

const platformGuides: Record<string, { steps: string[]; tips?: string }> = {
  meta: {
    steps: [
      'Go to <a href="https://developers.facebook.com/apps/" target="_blank">Meta for Developers</a> → Create App → choose "Business".',
      'Add products: <strong>Facebook Login</strong> and <strong>Instagram Graph API</strong>.',
      'Under Facebook Login → Settings, add the Redirect URI shown below.',
      'Under App Settings → Basic, copy your <strong>App ID</strong> (Client ID) and <strong>App Secret</strong>.',
      'Set the app to <strong>Live mode</strong> (or add your Facebook account as a Test User while in Development).',
    ],
    tips: 'Connects Facebook Pages AND linked Instagram Business accounts in one step.',
  },
  youtube: {
    steps: [
      'Go to <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a> → Create a new project for this client.',
      'Enable the <strong>YouTube Data API v3</strong> under APIs & Services → Library.',
      'Go to APIs & Services → Credentials → Create → <strong>OAuth 2.0 Client ID</strong> → Web application.',
      'Add the Redirect URI shown below to "Authorized redirect URIs".',
      'Copy the <strong>Client ID</strong> and <strong>Client Secret</strong>.',
      'Under OAuth Consent Screen, add the client\'s Google account as a <strong>Test user</strong>.',
    ],
    tips: 'Each client needs their own Google Cloud project (Option A).',
  },
  gbp: {
    steps: [
      'Go to <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a> → Create a project for this client.',
      'Enable <strong>My Business Account Management API</strong> and <strong>My Business Business Information API</strong>.',
      'Create OAuth 2.0 Client ID → Web application, add the Redirect URI.',
      'Copy <strong>Client ID</strong> and <strong>Client Secret</strong>.',
      'Add the client\'s Google account as a Test user in OAuth Consent Screen.',
    ],
  },
  linkedin: {
    steps: [
      'Go to <a href="https://www.linkedin.com/developers/apps" target="_blank">LinkedIn Developers</a> → Create App for this client.',
      'Under Auth tab, add the Redirect URI shown below.',
      'Under Products, request access to <strong>Share on LinkedIn</strong> and <strong>Sign In with LinkedIn using OpenID Connect</strong>.',
      'Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> from the Auth tab.',
    ],
    tips: 'LinkedIn connects personal profiles. Organization publishing requires additional approval.',
  },
  x: {
    steps: [
      'Go to <a href="https://developer.x.com/en/portal/projects-and-apps" target="_blank">X Developer Portal</a> → Create a new App for this client.',
      'Under User authentication settings, enable <strong>OAuth 2.0</strong> → Web App.',
      'Set App permissions to <strong>Read and Write</strong>.',
      'Add the Callback URI shown below.',
      'Copy <strong>Client ID</strong> and <strong>Client Secret</strong> (OAuth 2.0 section).',
    ],
  },
};

type EditState = { integrationId?: string; provider: string } | null;

export default function Integrations({
  data,
  refresh,
  clientId,
}: {
  data: Connections;
  refresh: () => Promise<void>;
  clientId?: string;
}) {
  const [editing, setEditing] = useState<EditState>(null);
  const [removing, setRemoving] = useState<string | null>(null); // integrationId
  const [removingAccount, setRemovingAccount] = useState<string | null>(null); // account id
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentProvider = editing ? providers.find((p) => p.id === editing.provider) : null;
  const currentIntegration = editing?.integrationId
    ? data.configured.find((c) => c.id === editing.integrationId)
    : null;

  function copyRedirect() {
    const url = `${data.origin}/api/oauth/${editing?.provider}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      {error && <div role="alert" className="notice error">{error}</div>}
      {notice && <div role="status" className="notice">{notice}</div>}

      <div className="cards">
        {providers.map((p) => {
          // Filter integrations by provider and clientId (if provided)
          const integrations = data.configured.filter((c) => 
            (c.provider === p.id || c.id === p.id) &&
            (!clientId || c.client_id === clientId)
          );
          // Accounts belong to integrations, so filter accounts based on those valid integrations
          const accounts = data.accounts.filter((a) => a.provider === p.id && integrations.some(i => i.id === a.integration_id || i.id === a.provider));
          return (
            <section className="account-card" key={p.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="platform-symbol">{p.symbol}</div>
                <span className="status" style={{ height: 'fit-content' }}>
                  {accounts.length
                    ? `${accounts.length} account${accounts.length > 1 ? 's' : ''}`
                    : integrations.length
                      ? `${integrations.length} integration${integrations.length > 1 ? 's' : ''}`
                      : 'Not configured'}
                </span>
              </div>
              <h3>{p.name}</h3>
              <p style={{ marginBottom: 8 }}>{p.help}</p>

              {/* List integrations and their accounts */}
              {integrations.map((intg) => {
                const intgAccounts = data.accounts.filter(
                  (a) => a.integration_id === intg.id || (a.provider === intg.id),
                );
                return (
                  <div
                    key={intg.id}
                    style={{
                      border: '1px solid #e1e7ef',
                      borderRadius: 8,
                      padding: '10px 12px',
                      marginBottom: 8,
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <strong style={{ color: '#253853' }}>
                        {intg.label || `${p.name} integration`}
                      </strong>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          className="text-button"
                          style={{ fontSize: 12 }}
                          onClick={() => { setError(''); setEditing({ integrationId: intg.id, provider: p.id }); }}
                        >
                          Edit
                        </button>
                        <button
                          className="text-button"
                          style={{ fontSize: 12, color: '#9e3445' }}
                          onClick={() => setRemoving(intg.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div style={{ color: '#8a95a8', fontSize: 12, marginTop: 2 }}>
                      App ID: {intg.clientIdHint}
                    </div>
                    {intgAccounts.map((a) => (
                      <div
                        key={a.id}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, color: '#1648be' }}
                      >
                        <span>✓ {a.name} · {a.platform}</span>
                        <button
                          className="icon-button"
                          style={{ width: 24, height: 24 }}
                          aria-label={`Disconnect ${a.name}`}
                          onClick={() => setRemovingAccount(a.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {/* Connect button for this specific integration */}
                    <button
                      disabled={busy}
                      className="text-button"
                      style={{ marginTop: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={async () => {
                        setBusy(true);
                        setError('');
                        try {
                          const r = await request('/api/connect/' + p.id, 'POST', {
                            integrationId: intg.id,
                          });
                          window.location.assign(r.url);
                        } catch (e) {
                          setError((e as Error).message);
                          setBusy(false);
                        }
                      }}
                    >
                      <Link2 size={12} /> Connect account
                    </button>
                  </div>
                );
              })}

              {/* Add new integration button */}
              <button
                className="secondary-button"
                style={{ width: '100%', marginTop: 4, justifyContent: 'center' }}
                onClick={() => { setError(''); setEditing({ provider: p.id }); }}
              >
                <Plus size={14} /> Add {p.name} integration
              </button>
            </section>
          );
        })}
      </div>

      <section className="settings-box" style={{ marginTop: 24, maxWidth: 'none' }}>
        <h3>How Option A (per-client credentials) works</h3>
        <ol className="setup-list">
          <li>Each client gets their own developer app on the platform (e.g. their own Google Cloud project or Meta App).</li>
          <li>Click <strong>Add [Platform] integration</strong>, enter a label (e.g. "Client A"), then paste the credentials from the developer console.</li>
          <li>Click <strong>Connect account</strong> under that integration to run the OAuth flow using that client's specific app.</li>
          <li>Each integration is fully isolated — rotating one client's credentials won't affect others.</li>
        </ol>
      </section>

      {/* Add / Edit Integration Dialog */}
      <Dialog
        open={!!currentProvider}
        onOpenChange={(o) => { if (!o && !busy) setEditing(null); }}
      >
        <DialogContent className="sm:max-w-xl p-6 max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {currentIntegration ? 'Edit' : 'Add'} {currentProvider?.name} integration
            </DialogTitle>
            <DialogDescription>
              {currentIntegration
                ? 'Update credentials for this integration. Changing them will disconnect existing accounts.'
                : `Set up a new ${currentProvider?.name} app. Each client should have their own.`}
            </DialogDescription>
          </DialogHeader>

          {currentProvider && (
            <form
              className="form-grid"
              key={editing?.integrationId || editing?.provider}
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                const b = Object.fromEntries(new FormData(e.currentTarget));
                try {
                  const r = await request('/api/integrations', 'POST', {
                    ...b,
                    provider: currentProvider.id,
                    targetClientId: clientId,
                    ...(editing?.integrationId ? { integrationId: editing.integrationId } : {}),
                  });
                  await refresh();
                  setEditing(null);
                  setNotice(
                    r.reconnect
                      ? 'Credentials updated. Reconnect accounts for this integration.'
                      : 'Integration saved. Click "Connect account" to link social accounts.',
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {error && <div className="notice error" role="alert">{error}</div>}

              {/* Step-by-step guide */}
              {platformGuides[currentProvider.id] && (
                <div className="platform-guide">
                  <strong style={{ display: 'block', marginBottom: 6 }}>
                    📋 Setup steps for {currentProvider.name}
                  </strong>
                  <ol>
                    {platformGuides[currentProvider.id].steps.map((s, i) => (
                      <li key={i} dangerouslySetInnerHTML={{ __html: s }} />
                    ))}
                  </ol>
                  {platformGuides[currentProvider.id].tips && (
                    <p style={{ marginTop: 8, fontStyle: 'italic', opacity: 0.8 }}>
                      💡 {platformGuides[currentProvider.id].tips}
                    </p>
                  )}
                </div>
              )}

              <label className="field">
                Integration label (e.g. "Client A" or "Brand X YouTube")
                <input
                  name="label"
                  autoComplete="off"
                  placeholder={currentIntegration?.label || `${currentProvider.name} – Client name`}
                  defaultValue={currentIntegration?.label || ''}
                  maxLength={100}
                />
              </label>

              <label className="field">
                {currentProvider.id === 'meta' ? 'App ID' : 'Client ID'}
                <input
                  name="clientId"
                  autoComplete="off"
                  required={!currentIntegration}
                  placeholder={
                    currentIntegration
                      ? `Saved: ${currentIntegration.clientIdHint} — leave blank to keep`
                      : 'Paste from developer portal'
                  }
                  maxLength={512}
                />
              </label>

              <label className="field">
                {currentProvider.id === 'meta' ? 'App Secret' : 'Client Secret'}
                <input
                  name="clientSecret"
                  type="password"
                  autoComplete="new-password"
                  required={!currentIntegration}
                  placeholder={currentIntegration ? 'Saved — leave blank to keep' : 'Paste from developer portal'}
                  maxLength={4096}
                />
              </label>

              <label className="field">
                Authorized redirect / callback URL
                <div className="copy-field-wrap">
                  <input
                    readOnly
                    value={`${data.origin}/api/oauth/${currentProvider.id}`}
                    onFocus={(e) => e.target.select()}
                  />
                  <button type="button" className="copy-btn" onClick={copyRedirect}>
                    {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                  </button>
                </div>
              </label>

              <div>
                <strong className="small">Required permissions / scopes</strong>
                <p
                  className="small muted"
                  style={{ overflowWrap: 'anywhere', lineHeight: 1.7, marginTop: 7 }}
                >
                  {currentProvider.scopes}
                </p>
              </div>

              {currentIntegration && (
                <div className="notice">
                  Changing credentials disconnects existing accounts for this integration.
                  Reconnect them after saving.
                </div>
              )}

              <div className="form-actions">
                <a
                  className="secondary-button"
                  href={currentProvider.docs}
                  target="_blank"
                  rel="noreferrer"
                >
                  Developer portal <ArrowUpRight size={14} />
                </a>
                <button className="primary-button" disabled={busy}>
                  {busy ? 'Saving…' : 'Save securely'}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove Integration Dialog */}
      <AlertDialog
        open={!!removing}
        onOpenChange={(o) => { if (!o && !busy) setRemoving(null); }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Remove this integration?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes its credentials and all connected accounts under it.
            Your saved posts remain. Revoke app access in the platform's settings if needed.
          </AlertDialogDescription>
          {error && <p role="alert" className="small error">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await request('/api/integrations', 'DELETE', { integrationId: removing });
                  await refresh();
                  setRemoving(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Account Dialog */}
      <AlertDialog
        open={!!removingAccount}
        onOpenChange={(o) => { if (!o && !busy) setRemovingAccount(null); }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Disconnect this account?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the account connection locally. Your posts remain.
            You can reconnect at any time.
          </AlertDialogDescription>
          {error && <p role="alert" className="small error">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await request('/api/accounts', 'DELETE', { id: removingAccount });
                  await refresh();
                  setRemovingAccount(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
