import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  expires: integer('expires').notNull(),
});
export const attempts = sqliteTable('attempts', {
  id: text('id').primaryKey(),
  count: integer('count').notNull(),
  expires: integer('expires').notNull(),
});
export const integrations = sqliteTable('integrations', {
  id: text('id').primaryKey(),
  secret: text('secret').notNull(),
  updated: text('updated').notNull(),
});
export const oauthStates = sqliteTable('oauth_states', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  session: text('session').notNull(),
  verifier: text('verifier').notNull(),
  expires: integer('expires').notNull(),
});
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  platform: text('platform').notNull(),
  name: text('name').notNull(),
  externalId: text('external_id').notNull(),
  token: text('token').notNull(),
  updated: text('updated').notNull(),
});
export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    platforms: text('platforms').notNull(),
    variants: text('variants').notNull(),
    scheduledAt: text('scheduled_at'),
    status: text('status').notNull(),
    mediaId: text('media_id'),
    created: text('created').notNull(),
    updated: text('updated').notNull(),
    version: integer('version').notNull().default(1),
  },
  (t) => [index('idx_posts_date').on(t.scheduledAt)],
);
export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  size: integer('size').notNull(),
});
export const deliveries = sqliteTable('deliveries', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull(),
  accountId: text('account_id').notNull(),
  status: text('status').notNull(),
  externalId: text('external_id'),
  error: text('error'),
  updated: text('updated').notNull(),
});
