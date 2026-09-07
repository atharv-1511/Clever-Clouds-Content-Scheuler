'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  CalendarDays,
  FileText,
  Layers,
  MessageSquare,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CheckCircle2,
  Link2,
  LockKeyhole,
  ArrowUpRight,
  LogOut,
  Trash2,
  Send,
  LoaderCircle,
  Users,
  Calendar,
  ScrollText,
  Share2,
  Inbox as InboxIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
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
import Login from './login';
import Editor from './editor';
import Integrations, { type Connections } from './integrations';
import Inbox from './inbox';
import Clients from './clients';
import { request, istInput, displayDate } from '@/lib/client';
import { platforms, type Post } from '@/lib/catalog';
const nav = [
  ['Clients', Users],
  ['Calendar', Calendar],
  ['Posts & drafts', ScrollText],
  ['Social accounts', Share2],
  ['Inbox & review', InboxIcon],
] as const;
const statItems = [
  ['Planned', Clock3],
  ['Drafts', FileText],
  ['Published deliveries', CheckCircle2],
  ['Connected accounts', Link2],
] as const;
export default function Scheduler() {
  const [auth, setAuth] = useState<boolean | null>(null);
  const [view, setView] = useState('Clients');
  const [month, setMonth] = useState(() => {
    const d = istInput(new Date());
    return new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, 1);
  });
  const [posts, setPosts] = useState<Post[]>([]);
  const [connections, setConnections] = useState<Connections>({
    accounts: [],
    configured: [],
    origin: '',
  });
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<{ post?: Post; day?: string } | null>(
    null,
  );
  const [filter, setFilter] = useState('All channels');
  const [postFilter, setPostFilter] = useState('all');
  const [removing, setRemoving] = useState<Post | null>(null);
  const [publish, setPublish] = useState<Post | null>(null);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem('cc-theme') as 'dark' | 'light') || 'light';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('cc-theme', theme);
  }, [theme]);
  const refresh = useCallback(async () => {
    const [p, c, d] = await Promise.all([
      request('/api/posts'),
      request('/api/integrations'),
      request('/api/publish'),
    ]);
    setPosts(p);
    setConnections(c);
    setDeliveries(d);
  }, []);
  useEffect(() => {
    request('/api/auth')
      .then((r) => setAuth(r.authenticated))
      .catch((e) => {
        setError(e.message);
        setAuth(false);
      })
      .finally(() => setLoading(false));
    const q = new URLSearchParams(location.search);
    if (q.has('connected')) {
      setNotice(`${q.get('connected')} account connection(s) saved.`);
      setView('Social accounts');
    }
    if (q.has('connection_error')) {
      setError(q.get('connection_error') || 'Connection failed.');
      setView('Social accounts');
    }
    if (q.has('connected') || q.has('connection_error'))
      history.replaceState(null, '', '/');
  }, []);
  useEffect(() => {
    if (auth) {
      setLoading(true);
      refresh()
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [auth, refresh]);
  useEffect(() => {
    if (!auth) return;
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const registrations = [
      {
        name: 'list_content_posts',
        title: 'List content posts',
        description:
          'Read saved posts in the signed-in Clever Clouds workspace.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input: any) => {
          if (!input || Object.keys(input).length)
            throw new Error('Expected an empty object.');
          return request('/api/posts');
        },
      },
      {
        name: 'start_post_creation',
        title: 'Open post editor',
        description:
          'Open the post editor. Does not save, schedule, or publish a post.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: (input: any) => {
          if (!input || Object.keys(input).length)
            throw new Error('Expected an empty object.');
          setEditor({});
          return { editorOpened: true };
        },
      },
    ];
    for (const tool of registrations)
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    return () => lifecycle.abort();
  }, [auth]);
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const first = new Date(start);
  first.setDate(1 - ((start.getDay() + 6) % 7));
  const today = istInput(new Date()).slice(0, 10);
  const visiblePosts = posts.filter(
    (p) => filter === 'All channels' || p.platforms.includes(filter),
  );
  const numbers = [
    posts.filter((p) => p.status === 'planned').length,
    posts.filter((p) => p.status === 'draft').length,
    deliveries.filter((d) => d.status === 'published').length,
    connections.accounts.length,
  ];
  if (auth === null)
    return (
      <div
        className="empty-panel"
        style={{ minHeight: '100vh', display: 'grid', placeContent: 'center' }}
      >
        <LoaderCircle />
        <h2>Opening your workspace…</h2>
      </div>
    );
  if (!auth)
    return (
      <>
        <Login
          onLogin={() => {
            setError('');
            setAuth(true);
          }}
        />
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
      </>
    );
  const edit = (p: Post) => {
    if (['draft', 'planned'].includes(p.status)) setEditor({ post: p });
    else {
      setPublish(p);
      setTarget('');
    }
  };
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="brand">
            <img
              src="/cc-blue.png"
              width={43}
              height={43}
              alt="Clever Clouds"
            />
            <div className="flex flex-col ml-2 justify-center">
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--foreground)', lineHeight: 1 }}>
                Clever Clouds.
              </span>
              <div style={{ marginTop: 3, display: 'flex', alignItems: 'baseline', gap: '5px', whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: 'var(--primary)', fontWeight: 500, letterSpacing: '-0.3px' }}>
                  Let's Make it
                </span>
                <span style={{ fontFamily: 'Borel, cursive', fontSize: 14, color: '#fbb42c', fontWeight: 'normal' }}>
                  Amazing!
                </span>
              </div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <div className="workspace">
            <img className="avatar" src="/icon.png" alt="" />
            <div>
              <strong className="small">Clever Clouds</strong>
              <p className="muted small">Agency workspace</p>
            </div>
          </div>
          <p className="nav-label">WORKSPACE</p>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              className={'nav-button ' + (view === name ? 'active' : '')}
              onClick={() => setView(name)}
            >
              <Icon />
              {name}
            </button>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <div className="side-bottom">
            <div className="side-note">
              <strong className="small">Your content. In sync.</strong>
              <p>Bring your channels together in one workspace.</p>
              <button
                className="text-button"
                onClick={() => setView('Social accounts')}
              >
                Manage integrations ↗
              </button>
            </div>
            <div className="toolbar-group">
              <div className="avatar">CC</div>
              <div>
                <strong className="small">Clever Clouds team</strong>
                <p className="small muted">Internal workspace</p>
              </div>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <main className="min-w-0 flex-1">
        <header className="topbar">
          <div className="topbar-left">
            <span className="mobile-nav">
              <SidebarTrigger />
            </span>
            Workspace <span>/</span>
            <strong style={{ color: '#253853' }}>{view}</strong>
          </div>
          <div className="topbar-right">
            <button
              className="theme-toggle-btn"
              aria-label="Toggle dark/light mode"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await request('/api/auth', 'DELETE');
                  setAuth(false);
                  setPosts([]);
                  setConnections({ accounts: [], configured: [], origin: '' });
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <LogOut />
            </button>
            <img className="avatar" src="/icon.png" alt="Clever Clouds" />
          </div>
        </header>
        <div className="main-content">
          {view !== 'Clients' && (
            <div className="page-heading">
              <div>
                <div className="eyebrow">PLAN. CREATE. CONNECT.</div>
                <h1>{view === 'Calendar' ? 'Content calendar' : view}</h1>
                <p>
                  {view === 'Calendar'
                    ? 'A clear view of what’s next for your brand.'
                    : view === 'Social accounts'
                      ? 'Your channels. Your connections. All in one place.'
                      : view === 'Posts & drafts'
                        ? 'From the first idea to the final caption.'
                        : view === 'Inbox & review'
                          ? 'Stay close to your audience.'
                          : 'Your workspace, configured for you.'}
                </p>
              </div>
              <button className="primary-button" onClick={() => setEditor({})}>
                <Plus /> Create post
              </button>
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}{' '}
              <button
                className="text-button"
                onClick={() => {
                  setError('');
                  refresh().catch((e) => setError(e.message));
                }}
              >
                Retry
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}{' '}
              <button className="text-button" onClick={() => setNotice('')}>
                Dismiss
              </button>
            </div>
          )}
          {loading && (
            <p
              role="status"
              className="small muted"
              style={{ marginBottom: 16 }}
            >
              Loading your saved content…
            </p>
          )}
          {(view === 'Calendar' || view === 'Posts & drafts') && (
            <div className="stats">
              {statItems.map(([label, Icon], i) => (
                <div className="stat" key={label}>
                  <div className="stat-top">
                    {label}
                    <span className="stat-icon">
                      <Icon />
                    </span>
                  </div>
                  <div className="stat-number">{numbers[i]}</div>
                  <div className="stat-bottom">
                    {i === 3
                      ? 'Across your social channels'
                      : i === 2
                        ? 'Confirmed by the platform'
                        : i === 0
                          ? 'Dates reserved on your calendar'
                          : 'Ready for your next idea'}
                  </div>
                </div>
              ))}
            </div>
          )}
          {view === 'Calendar' && (
            <>
              <section className="calendar-shell">
                <div className="calendar-toolbar">
                  <div className="toolbar-group">
                    <h2>
                      {month.toLocaleDateString('en-IN', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </h2>
                    <button
                      className="icon-button"
                      aria-label="Previous month"
                      onClick={() =>
                        setMonth(
                          new Date(
                            month.getFullYear(),
                            month.getMonth() - 1,
                            1,
                          ),
                        )
                      }
                    >
                      <ChevronLeft />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Next month"
                      onClick={() =>
                        setMonth(
                          new Date(
                            month.getFullYear(),
                            month.getMonth() + 1,
                            1,
                          ),
                        )
                      }
                    >
                      <ChevronRight />
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        setMonth(
                          new Date(
                            Number(today.slice(0, 4)),
                            Number(today.slice(5, 7)) - 1,
                            1,
                          ),
                        )
                      }
                    >
                      Today
                    </button>
                  </div>
                  <Select
                    value={filter}
                    onValueChange={(v) => setFilter(v || 'All channels')}
                  >
                    <SelectTrigger
                      aria-label="Filter calendar by channel"
                      className="h-9"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['All channels', ...platforms].map((p) => (
                        <SelectItem value={p} key={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="calendar-scroll">
                  <div className="calendar">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
                      (d) => (
                        <div className="weekday" key={d}>
                          {d}
                        </div>
                      ),
                    )}
                    {Array.from({ length: 42 }, (_, i) => {
                      const d = new Date(first);
                      d.setDate(first.getDate() + i);
                      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      const dayPosts = visiblePosts.filter(
                        (p) =>
                          p.scheduled_at &&
                          istInput(new Date(p.scheduled_at)).slice(0, 10) ===
                            key,
                      );
                      return (
                        <div
                          className={
                            'day ' +
                            (d.getMonth() !== month.getMonth()
                              ? 'outside '
                              : '') +
                            (key === today ? 'today' : '')
                          }
                          key={key}
                        >
                          <button
                            className="day-number"
                            aria-label={'Create post for ' + key}
                            onClick={() => setEditor({ day: key })}
                          >
                            {d.getDate()}
                          </button>
                          <button
                            className="day-add"
                            aria-label={'Add post on ' + key}
                            onClick={() => setEditor({ day: key })}
                          >
                            <Plus size={14} />
                          </button>
                          {dayPosts.map((p) => (
                            <button
                              className="post-chip"
                              key={p.id}
                              onClick={() => edit(p)}
                            >
                              <strong>{p.title}</strong>
                              {istInput(new Date(p.scheduled_at!)).slice(
                                11,
                              )} ·{' '}
                              {p.platforms.join(', ')}
                              <span style={{ display: 'block', marginTop: 4 }}>
                                {p.status === 'partial'
                                  ? 'Delivery started'
                                  : p.status}
                              </span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <footer className="calendar-footer">
                  <span>
                    <i className="dot" /> Planned content · Click a date to add
                    a post
                  </span>
                  <span>India Standard Time (UTC+05:30)</span>
                </footer>
              </section>
              <div className="onboarding">
                <div className="onboarding-left">
                  <div className="onboarding-icon">
                    <Link2 />
                  </div>
                  <div>
                    <h3>
                      {connections.accounts.length
                        ? 'A little planning goes a long way.'
                        : 'Good content starts with a connection.'}
                    </h3>
                    <p>
                      {connections.accounts.length
                        ? 'Save a draft, choose a date, and keep your content moving.'
                        : 'Add your app credentials whenever you’re ready, then connect your accounts.'}
                    </p>
                  </div>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => setView('Social accounts')}
                >
                  Manage integrations <ArrowUpRight />
                </button>
              </div>
            </>
          )}
          {view === 'Posts & drafts' && (
            <>
              <Tabs
                value={postFilter}
                onValueChange={(v) => setPostFilter(String(v))}
                className="mb-6"
              >
                <TabsList className="h-10">
                  <TabsTrigger className="px-4" value="all">
                    All posts
                  </TabsTrigger>
                  <TabsTrigger className="px-4" value="draft">
                    In Draft
                  </TabsTrigger>
                  <TabsTrigger className="px-4" value="planned">
                    Scheduled
                  </TabsTrigger>
                  <TabsTrigger className="px-4" value="partial">
                    Published
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {posts
                .filter((p) => postFilter === 'all' || p.status === postFilter || (postFilter === 'partial' && p.status === 'published'))
                .map((p) => (
                  <article className="draft-row" key={p.id}>
                    <div>
                      <span className="status">
                        {p.status === 'partial' ? 'Delivery started' : p.status}
                      </span>
                      <h3 style={{ marginTop: 9 }}>{p.title}</h3>
                      <p>
                        {p.platforms.join(' · ')}
                        {p.scheduled_at
                          ? ' · ' + displayDate(p.scheduled_at) + ' IST'
                          : ''}
                      </p>
                    </div>
                    <div className="toolbar-group" style={{ flexWrap: 'wrap' }}>
                      {['draft', 'planned'].includes(p.status) && (
                        <>
                          <button
                            className="secondary-button"
                            onClick={() => setEditor({ post: p })}
                          >
                            Edit
                          </button>
                          <button
                            className="icon-button"
                            aria-label={'Delete ' + p.title}
                            onClick={() => setRemoving(p)}
                          >
                            <Trash2 />
                          </button>
                        </>
                      )}
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setPublish(p);
                          setTarget('');
                        }}
                      >
                        <Send /> Publish / history
                      </button>
                    </div>
                  </article>
                ))}
              {!posts.filter(
                (p) => postFilter === 'all' || p.status === postFilter,
              ).length && (
                <div className="empty-panel">
                  <FileText />
                  <h2>Your next great post starts here.</h2>
                  <p>Create a draft and tailor the caption for each channel.</p>
                  <button
                    className="primary-button"
                    onClick={() => setEditor({})}
                  >
                    <Plus /> Create a post
                  </button>
                </div>
              )}
            </>
          )}
          {view === 'Clients' && (
            <Clients connections={connections} refreshConnections={refresh} />
          )}
          {view === 'Social accounts' && (
            <Integrations data={connections} refresh={refresh} />
          )}
          {view === 'Inbox & review' && (
            <Inbox
              accounts={connections.accounts}
              setup={() => setView('Social accounts')}
            />
          )}

        </div>
      </main>
      {editor && (
        <Editor
          key={editor.post?.id || editor.day || 'new'}
          {...editor}
          connections={connections}
          close={() => setEditor(null)}
          saved={async () => {
            await refresh();
            setNotice('Post saved.');
          }}
        />
      )}
      <AlertDialog
        open={!!removing}
        onOpenChange={(o) => {
          if (!o && !busy) setRemoving(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Delete “{removing?.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the draft from your workspace and calendar.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep post</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await request('/api/posts', 'DELETE', {
                    id: removing?.id,
                    version: removing?.version,
                  });
                  setRemoving(null);
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete post
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={!!publish}
        onOpenChange={(o) => {
          if (!o && !busy) setPublish(null);
        }}
      >
        <DialogContent className="sm:max-w-xl p-6 max-h-[90vh] overflow-auto">
          <DialogTitle className="text-xl font-bold">
            Publish “{publish?.title}”
          </DialogTitle>
          <DialogDescription>
            Send this saved text post now to one connected account.
          </DialogDescription>
          <div className="notice" style={{ marginBottom: 15 }}>
            Publishing supports text, images, and video for Facebook, LinkedIn, X, and YouTube.
            Automated scheduling requires configuring a cron service to trigger /api/cron/publish.
          </div>
          {publish?.media_id && (
            <div style={{ marginBottom: 15 }}>
              <a
                className="secondary-button"
                href={'/api/media?id=' + publish.media_id}
                target="_blank"
                rel="noreferrer"
              >
                View attached media
              </a>
            </div>
          )}
              <Select value={target} onValueChange={(v) => setTarget(v || '')}>
                <SelectTrigger
                  className="w-full h-10"
                  aria-label="Publish to account"
                >
                  <SelectValue placeholder="Choose a destination account" />
                </SelectTrigger>
                <SelectContent>
                  {connections.accounts
                    .filter(
                      (a) =>
                        publish?.platforms.includes(a.platform) &&
                        ['Facebook', 'LinkedIn', 'X', 'YouTube', 'Instagram'].includes(a.platform),
                    )
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} · {a.platform}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div
                className="settings-box"
                style={{ maxHeight: 180, overflow: 'auto' }}
              >
                <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                  {publish?.variants[
                    connections.accounts.find((a) => a.id === target)
                      ?.platform || ''
                  ] || publish?.content}
                </p>
              </div>
              {(() => {
                const hasPublishedToTarget = deliveries.some(d => d.post_id === publish?.id && d.account_id === target && d.status === 'published');
                return (
                  <button
                    disabled={!target || busy || hasPublishedToTarget}
                    className="primary-button"
                    onClick={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        await request('/api/publish', 'POST', {
                          postId: publish?.id,
                          accountId: target,
                          version: publish?.version,
                        });
                        setNotice(
                          'The platform confirmed your post was published.',
                        );
                        await refresh();
                        setPublish(null);
                      } catch (e) {
                        setError((e as Error).message);
                        await refresh();
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? 'Publishing…' : hasPublishedToTarget ? 'Already published' : 'Publish now'}
                  </button>
                );
              })()}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <h3>Delivery history</h3>
          {deliveries
            .filter((d) => d.post_id === publish?.id)
            .map((d) => (
              <div className="small" key={d.id}>
                <strong>
                  {connections.accounts.find((a) => a.id === d.account_id)
                    ?.name || 'Disconnected account'}
                </strong>
                <p className="muted" style={{ marginTop: 6 }}>
                  {d.status === 'published'
                    ? 'Published'
                    : d.status === 'sending'
                      ? 'Sending / awaiting confirmation'
                      : 'Check the platform before retrying'}{' '}
                  · {displayDate(d.updated)}
                </p>
              </div>
            ))}
          {!deliveries.some((d) => d.post_id === publish?.id) && (
            <p className="small muted">No deliveries yet.</p>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
