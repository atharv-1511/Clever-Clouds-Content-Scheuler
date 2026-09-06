export const platforms = [
  'Instagram',
  'Facebook',
  'YouTube',
  'LinkedIn',
  'X',
] as const;
export const providers = [
  {
    id: 'meta',
    name: 'Meta',
    symbol: '∞',
    channels: 'Instagram & Facebook',
    help: 'Connect Facebook Pages and linked Instagram professional accounts.',
    docs: 'https://developers.facebook.com/apps/',
    scopes:
      'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,pages_messaging,instagram_manage_messages',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    symbol: '▶',
    channels: 'YouTube',
    help: 'Connect a channel through a Google OAuth web application.',
    docs: 'https://console.cloud.google.com/apis/credentials',
    scopes:
      'https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/youtube.upload',
  },
  {
    id: 'gbp',
    name: 'Google Business Profile',
    symbol: 'G',
    channels: 'Business reviews',
    help: 'Manage reviews for verified business locations with approved API access.',
    docs: 'https://console.cloud.google.com/apis/credentials',
    scopes: 'https://www.googleapis.com/auth/business.manage',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    symbol: 'in',
    channels: 'LinkedIn',
    help: 'Connect your personal profile with Share on LinkedIn and OpenID Connect products.',
    docs: 'https://www.linkedin.com/developers/apps',
    scopes: 'openid profile w_member_social',
  },
  {
    id: 'x',
    name: 'X',
    symbol: '𝕏',
    channels: 'X / Twitter',
    help: 'Connect an account using an OAuth 2.0 web app with read and write access.',
    docs: 'https://console.x.com/',
    scopes: 'tweet.read tweet.write users.read offline.access',
  },
] as const;
export type ProviderId = (typeof providers)[number]['id'];
export const validProvider = (id: string): id is ProviderId =>
  providers.some((p) => p.id === id);
export type Post = {
  id: string;
  title: string;
  content: string;
  platforms: string[];
  variants: Record<string, string>;
  scheduled_at: string | null;
  status: string;
  media_id: string | null;
  created: string;
  updated: string;
  version: number;
};
