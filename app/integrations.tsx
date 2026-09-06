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
import { Link2, KeyRound, ArrowUpRight } from 'lucide-react';
export type Connections = {
  configured: { id: string; clientIdHint: string; updated: string }[];
  accounts: {
    id: string;
    provider: string;
    name: string;
    platform: string;
    external_id: string;
  }[];
  origin: string;
};
export default function Integrations({
  data,
  refresh,
}: {
  data: Connections;
  refresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const provider = providers.find((p) => p.id === editing);
  const existing = data.configured.find((c) => c.id === editing);
  return (
    <>
      <div className="notice">
        Add app credentials whenever you’re ready. Saving credentials and
        authorizing a social account are separate steps.
      </div>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="notice">
          {notice}
        </div>
      )}
      <div className="cards">
        {providers.map((p) => {
          const ready = data.configured.find((c) => c.id === p.id);
          const accounts = data.accounts.filter((a) => a.provider === p.id);
          return (
            <section className="account-card" key={p.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="platform-symbol">{p.symbol}</div>
                <span className="status" style={{ height: 'fit-content' }}>
                  {accounts.length
                    ? `${accounts.length} connected`
                    : ready
                      ? 'Credentials saved'
                      : 'Not configured'}
                </span>
              </div>
              <h3>{p.name}</h3>
              <p>{p.help}</p>
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="small"
                  style={{ padding: '6px 0', color: '#1648be' }}
                >
                  ✓ {a.name} · {a.platform}
                </div>
              ))}
              <div
                className="toolbar-group"
                style={{ marginTop: 14, flexWrap: 'wrap' }}
              >
                <button
                  className="secondary-button"
                  onClick={() => {
                    setError('');
                    setEditing(p.id);
                  }}
                >
                  <KeyRound />
                  {ready ? 'Edit credentials' : 'Add credentials'}
                </button>
                {ready && (
                  <button
                    disabled={busy}
                    className="text-button"
                    onClick={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        const r = await request('/api/connect/' + p.id, 'POST');
                        window.location.assign(r.url);
                      } catch (e) {
                        setError((e as Error).message);
                        setBusy(false);
                      }
                    }}
                  >
                    <Link2 style={{ display: 'inline', width: 14 }} /> Connect
                  </button>
                )}
              </div>
              {ready && (
                <button
                  className="text-button"
                  style={{ color: '#9e3445', marginTop: 15 }}
                  onClick={() => setRemoving(p.id)}
                >
                  Remove integration
                </button>
              )}
            </section>
          );
        })}
      </div>
      <section
        className="settings-box"
        style={{ marginTop: 24, maxWidth: 'none' }}
      >
        <h3>How connections work</h3>
        <ol className="setup-list">
          <li>Create a web application in the platform’s developer portal.</li>
          <li>
            Add the callback URL shown under its credentials. Enable the
            required APIs and permissions.
          </li>
          <li>
            Save your client ID and secret here, then choose Connect to approve
            account access.
          </li>
        </ol>
        <p>
          App review, verification, and API access are controlled by each
          platform. LinkedIn connects personal profiles; organization publishing
          needs a separate approved integration. Discovery retrieves up to 100
          Meta pages, 50 YouTube channels, and 20 Google business accounts with
          100 locations each.
        </p>
      </section>
      <Dialog
        open={!!provider}
        onOpenChange={(o) => {
          if (!o && !busy) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-xl p-6 max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {provider?.name} credentials
            </DialogTitle>
            <DialogDescription>
              Stored encrypted. Saved secrets are never displayed again.
            </DialogDescription>
          </DialogHeader>
          {provider && (
            <form
              className="form-grid"
              key={provider.id}
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                const b = Object.fromEntries(new FormData(e.currentTarget));
                try {
                  const r = await request('/api/integrations', 'POST', {
                    ...b,
                    provider: provider.id,
                  });
                  await refresh();
                  setEditing(null);
                  setNotice(
                    r.reconnect
                      ? 'Credentials updated. Reconnect your accounts to use the new app.'
                      : 'Credentials saved. You can now connect your account.',
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {error && (
                <div className="notice error" role="alert">
                  {error}
                </div>
              )}
              <label className="field">
                Client ID / App ID
                <input
                  name="clientId"
                  autoComplete="off"
                  required={!existing}
                  placeholder={
                    existing
                      ? `Saved: ${existing.clientIdHint} — leave blank to keep`
                      : ''
                  }
                  maxLength={512}
                />
              </label>
              <label className="field">
                Client secret / App secret
                <input
                  name="clientSecret"
                  type="password"
                  autoComplete="new-password"
                  required={!existing}
                  placeholder={existing ? 'Saved — leave blank to keep' : ''}
                  maxLength={4096}
                />
              </label>
              <label className="field">
                Authorized redirect / callback URL
                <input
                  readOnly
                  value={`${data.origin}/api/oauth/${provider.id}`}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <div>
                <strong className="small">Required permissions</strong>
                <p
                  className="small muted"
                  style={{
                    overflowWrap: 'anywhere',
                    lineHeight: 1.7,
                    marginTop: 7,
                  }}
                >
                  {provider.scopes}
                </p>
              </div>
              {existing && (
                <div className="notice">
                  Changing credentials disconnects existing accounts for this
                  integration. Reconnect them after saving.
                </div>
              )}
              <div className="form-actions">
                <a
                  className="secondary-button"
                  href={provider.docs}
                  target="_blank"
                  rel="noreferrer"
                >
                  Developer portal
                  <ArrowUpRight size={14} />
                </a>
                <button className="primary-button" disabled={busy}>
                  {busy ? 'Saving…' : 'Save securely'}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!removing}
        onOpenChange={(o) => {
          if (!o && !busy) setRemoving(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Remove this integration?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes its credentials and local account connections. Your
            saved posts remain. Revoke app access in the platform’s settings if
            needed.
          </AlertDialogDescription>
          {error && (
            <p role="alert" className="small error">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await request('/api/integrations', 'DELETE', {
                    provider: removing,
                  });
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
    </>
  );
}
