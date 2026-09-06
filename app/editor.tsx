'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { platforms, type Post } from '@/lib/catalog';
import { istInput, request } from '@/lib/client';
export default function Editor({
  post,
  day,
  close,
  saved,
}: {
  post?: Post;
  day?: string;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(post?.title || '');
  const [content, setContent] = useState(post?.content || '');
  const [selected, setSelected] = useState<string[]>(
    post?.platforms || ['Instagram'],
  );
  const [variants, setVariants] = useState<Record<string, string>>(
    post?.variants || {},
  );
  const [tab, setTab] = useState('All');
  const [when, setWhen] = useState(
    post?.scheduled_at
      ? istInput(new Date(post.scheduled_at))
      : day
        ? day + 'T10:00'
        : '',
  );
  const [media, setMedia] = useState<string | null>(post?.media_id || null);
  const [uploadName, setUploadName] = useState(
    post?.media_id ? 'Attachment saved' : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(status: string) {
    setBusy(true);
    setError('');
    try {
      await request('/api/posts', 'POST', {
        id: post?.id,
        version: post?.version,
        title,
        content,
        platforms: selected,
        variants,
        scheduled_at: when ? new Date(when + ':00+05:30').toISOString() : null,
        status,
        media_id: media,
      });
      await saved();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const current = tab === 'All' ? content : variants[tab] || '';
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !busy) close();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {post ? 'Edit post' : 'Create a post'}
          </DialogTitle>
          <DialogDescription>
            Shape your content for each channel.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <div className="form-grid">
          <label className="field">
            Post title{' '}
            <input
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A name to find this post later"
            />
          </label>
          <div className="field">
            <span>Channels</span>
            <div className="platform-options">
              {platforms.map((p) => (
                <label key={p} className="platform-option">
                  <Checkbox
                    checked={selected.includes(p)}
                    onCheckedChange={(checked) => {
                      setSelected(
                        checked
                          ? [...selected, p]
                          : selected.filter((s) => s !== p),
                      );
                      setTab('All');
                    }}
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList className="h-auto flex-wrap">
              {['All', ...selected].map((p) => (
                <TabsTrigger key={p} value={p} className="px-3 py-2">
                  {p === 'All' ? 'Base caption' : p}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <label className="field">
            {tab === 'All' ? 'Caption' : `${tab} caption (optional override)`}
            <textarea
              maxLength={5000}
              value={current}
              onChange={(e) =>
                tab === 'All'
                  ? setContent(e.target.value)
                  : setVariants({ ...variants, [tab]: e.target.value })
              }
              placeholder={
                tab === 'All'
                  ? 'What would you like to share?'
                  : 'Leave blank to use the base caption'
              }
            />
            <span className="muted small">
              {Array.from(current).length} characters
              {tab === 'X'
                ? ' · 280 max'
                : tab === 'Instagram'
                  ? ' · 2,200 max'
                  : tab === 'LinkedIn'
                    ? ' · 3,000 max'
                    : ''}
            </span>
          </label>
          <div className="field-row">
            <label className="field">
              Planned date & time · IST
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </label>
            <label className="field">
              Attach image or video
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4"
                disabled={busy}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBusy(true);
                  setError('');
                  try {
                    if (f.size > 20 * 1024 * 1024)
                      throw new Error('Choose a file smaller than 20 MB.');
                    const d = new FormData();
                    d.set('file', f);
                    const r = await request('/api/media', 'POST', d);
                    setMedia(r.id);
                    setUploadName(r.name);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <span className="muted small">
                JPG, PNG, WebP, MP4 · Up to 20 MB
              </span>
            </label>
          </div>
          {media && (
            <div className="toolbar-group">
              <a
                className="text-button"
                href={'/api/media?id=' + media}
                target="_blank"
                rel="noreferrer"
              >
                {uploadName || 'View attachment'}
              </a>
              <button
                className="text-button"
                onClick={() => {
                  setMedia(null);
                  setUploadName('');
                }}
              >
                Remove
              </button>
            </div>
          )}
          <div className="notice">
            Adding to the calendar saves a plan. Automatic background publishing
            is not active in this version.
          </div>
          <div className="form-actions">
            <button
              disabled={busy}
              className="secondary-button"
              onClick={() => save('draft')}
            >
              Save draft
            </button>
            <button
              disabled={busy}
              className="primary-button"
              onClick={() => save('planned')}
            >
              {busy ? 'Saving…' : 'Add to calendar'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
