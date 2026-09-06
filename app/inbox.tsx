'use client';
import { useState } from 'react';
import { MessageSquare, RefreshCw } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { request, displayDate } from '@/lib/client';
import type { Connections } from './integrations';
export default function Inbox({
  accounts,
  setup,
}: {
  accounts: Connections['accounts'];
  setup: () => void;
}) {
  const eligible = accounts.filter((a) =>
    ['Facebook', 'Instagram', 'Google Business Profile'].includes(a.platform),
  );
  const [selected, setSelected] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reply, setReply] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  async function sync(next = false) {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const r = await request(
        '/api/inbox?account=' +
          encodeURIComponent(selected) +
          (next && cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
      );
      setItems(next ? [...items, ...r.items] : r.items);
      setCursor(r.cursor);
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
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
      {eligible.length ? (
        <>
          <div className="calendar-toolbar" style={{ padding: '0 0 22px' }}>
            <Select
              value={selected}
              onValueChange={(v) => {
                setSelected(v || '');
                setItems([]);
                setLoaded(false);
                setCursor(null);
              }}
            >
              <SelectTrigger
                aria-label="Inbox account"
                className="w-80 h-10 bg-white"
              >
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {eligible.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} · {a.platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              disabled={!selected || busy}
              className="secondary-button"
              onClick={() => sync()}
            >
              <RefreshCw />
              {busy ? 'Loading…' : 'Refresh inbox'}
            </button>
          </div>
          <p className="small muted" style={{ marginBottom: 20 }}>
            Google Business Profile reviews and Meta conversations. Message
            access and reply windows depend on platform permissions.
          </p>
          {items.map((item, i) => (
            <article
              className="settings-box"
              style={{ maxWidth: 'none' }}
              key={item.id + '-' + i}
            >
              <div className="page-heading" style={{ marginBottom: 14 }}>
                <h3>{item.author}</h3>
                <span className="small muted">
                  {item.date ? displayDate(item.date) : ''}
                </span>
              </div>
              {item.rating && (
                <span className="status">{item.rating} stars</span>
              )}
              <p style={{ whiteSpace: 'pre-wrap' }}>{item.text}</p>
              {item.reply && (
                <div className="notice" style={{ marginTop: 15 }}>
                  Your reply: {item.reply}
                </div>
              )}
              <button
                className="secondary-button"
                style={{ marginTop: 18 }}
                onClick={() => {
                  setReply(item);
                  setMessage(item.reply || '');
                }}
              >
                {item.reply ? 'Edit reply' : 'Reply'}
              </button>
            </article>
          ))}
          {!items.length && (
            <div className="empty-panel">
              <MessageSquare />
              <h2>
                {loaded
                  ? 'You’re all caught up.'
                  : 'Your conversations, together.'}
              </h2>
              <p>
                {loaded
                  ? 'No reviews or conversations were returned for this account.'
                  : 'Choose a connected account and refresh to load reviews or recent messages.'}
              </p>
            </div>
          )}
          {cursor && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => sync(true)}
            >
              Load more
            </button>
          )}
        </>
      ) : (
        <div className="empty-panel">
          <MessageSquare />
          <h2>Make room for the conversation.</h2>
          <p>
            Connect Google Business Profile to manage reviews, or Meta to review
            and respond to messages.
          </p>
          <button className="primary-button" onClick={setup}>
            Set up an integration
          </button>
        </div>
      )}
      <Dialog
        open={!!reply}
        onOpenChange={(o) => {
          if (!o && !busy) setReply(null);
        }}
      >
        <DialogContent className="sm:max-w-lg p-6">
          <DialogTitle className="text-xl font-bold">
            Reply to {reply?.author}
          </DialogTitle>
          <DialogDescription>
            This sends your response to the selected social account’s
            conversation or review.
          </DialogDescription>
          {error && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
          <label className="field">
            Your reply
            <textarea
              value={message}
              maxLength={2000}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <button
            disabled={busy || !message.trim()}
            className="primary-button"
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await request('/api/inbox', 'POST', {
                  account: selected,
                  id: reply.id,
                  recipient: reply.recipient,
                  message,
                });
                setReply(null);
                setNotice(
                  'Reply sent. Refresh the inbox to see the latest conversation.',
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Sending…' : 'Send reply'}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
