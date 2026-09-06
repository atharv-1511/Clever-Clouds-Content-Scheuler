import { db, AppError } from '@/lib/server';
import { access, api, type Account } from '@/lib/oauth';
import { supabaseAdmin } from '@/lib/supabase';

const bucket = () => process.env.SUPABASE_STORAGE_BUCKET || 'clever-clouds-media';

export async function publishPost(postId: string, accountId: string, version: number) {
  let delivery: string | null = null;
  try {
    const p = await db()
      .prepare('SELECT * FROM posts WHERE id=?')
      .bind(postId)
      .first<any>();
    const a = await db()
      .prepare('SELECT * FROM accounts WHERE id=?')
      .bind(accountId)
      .first<Account>();

    if (!p || !a) throw new AppError('Post or account was not found.');
    if (p.version !== version)
      throw new AppError('This post changed. Reload before publishing.', 409);
    if (!JSON.parse(p.platforms).includes(a.platform))
      throw new AppError('This account is not a selected post channel.');

    if (!['Facebook', 'LinkedIn', 'X', 'YouTube'].includes(a.platform))
      throw new AppError(
        'Direct publishing for this platform is not available in this version.',
      );
      
    let mediaBlob: Blob | null = null;
    let mediaType = '';
    
    if (p.media_id) {
      // Fetch the media type from the DB first (Blob.type from Supabase can be empty)
      const mediaRecord = await db()
        .prepare('SELECT type FROM media WHERE id=?')
        .bind(p.media_id)
        .first<{ type: string }>();
      if (mediaRecord) mediaType = mediaRecord.type;
      
      const downloaded = await supabaseAdmin().storage.from(bucket()).download(p.media_id);
      if (downloaded.error || !downloaded.data) throw new AppError('Media file not found in storage.');
      mediaBlob = downloaded.data;
      // Fall back to blob type if DB record is missing
      if (!mediaType) mediaType = mediaBlob.type || 'application/octet-stream';
    }

    const caption = JSON.parse(p.variants)[a.platform] || p.content;
    const token = await access(a);
    delivery = p.id + '|' + a.id;

    const inserted = await db()
      .prepare(
        "INSERT INTO deliveries(id,post_id,account_id,status,updated) VALUES(?,?,?,'sending',?) ON CONFLICT(id) DO NOTHING",
      )
      .bind(delivery, p.id, a.id, new Date().toISOString())
      .run();

    if (!inserted.meta.changes) {
      delivery = null;
      throw new AppError(
        'This post has already been sent or attempted for that account. Check delivery history before taking further action.',
        409,
      );
    }

    const locked = await db()
      .prepare(
        "UPDATE posts SET status='partial',version=version+1,updated=? WHERE id=? AND version=?",
      )
      .bind(new Date().toISOString(), p.id, p.version)
      .run();

    if (!locked.meta.changes)
      throw new AppError(
        'This post changed before delivery. No post was sent.',
        409,
      );

    let external: string = '';
    
    if (a.platform === 'YouTube') {
      if (!mediaBlob || !mediaType.startsWith('video/')) {
        throw new AppError('YouTube requires a video attachment.');
      }
      
      const metadata = {
        snippet: {
          title: p.title,
          description: caption,
        },
        status: {
          privacyStatus: 'public', // or 'unlisted' / 'private'
          selfDeclaredMadeForKids: false,
        },
      };

      // 1. Initialize Resumable Upload
      const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Length': mediaBlob.size.toString(),
          'X-Upload-Content-Type': mediaType,
        },
        body: JSON.stringify(metadata),
      });

      if (!initRes.ok) throw new AppError(`YouTube initialization failed with ${initRes.status}`);
      const uploadUrl = initRes.headers.get('Location');
      if (!uploadUrl) throw new AppError('YouTube did not provide an upload URL.');

      // 2. Upload Video Binary
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': mediaBlob.size.toString(),
          'Content-Type': mediaType,
        },
        body: await mediaBlob.arrayBuffer(),
      });

      if (!uploadRes.ok) throw new AppError(`YouTube upload failed with ${uploadRes.status}`);
      const videoData = await uploadRes.json();
      external = videoData.id || '';
    } else if (a.platform === 'X') {
      const payload: any = { text: caption };
      
      if (mediaBlob) {
        const formData = new FormData();
        formData.append('media', mediaBlob);
        
        const uploadRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });
        
        if (!uploadRes.ok) throw new AppError(`X media upload failed with ${uploadRes.status}`);
        const mediaData = await uploadRes.json();
        payload.media = { media_ids: [mediaData.media_id_string] };
      }

      const r = await api('https://api.x.com/2/tweets', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      external = r.data?.id || '';
    } else if (a.platform === 'Facebook') {
      if (mediaBlob) {
        const formData = new FormData();
        const endpoint = mediaType.startsWith('video/') ? 'videos' : 'photos';
        formData.append('source', mediaBlob);
        if (endpoint === 'videos') {
          formData.append('description', caption);
        } else {
          formData.append('message', caption);
        }
        
        const r = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(a.external_id)}/${endpoint}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });
        if (!r.ok) throw new AppError(`Facebook media upload failed with ${r.status}`);
        const data = await r.json();
        external = data.id || '';
      } else {
        const r = await api(
          `https://graph.facebook.com/v23.0/${encodeURIComponent(a.external_id)}/feed`,
          token,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: caption }),
          },
        );
        external = r.id || '';
      }
    } else if (a.platform === 'LinkedIn') {
      let mediaUrn: string | null = null;
      let shareMediaCategory = 'NONE';
      
      if (mediaBlob) {
        const isVideo = mediaType.startsWith('video/');
        shareMediaCategory = isVideo ? 'VIDEO' : 'IMAGE';
        
        // 1. Register Upload
        const registerRes = await api('https://api.linkedin.com/v2/assets?action=registerUpload', token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: [isVideo ? 'urn:li:digitalmediaRecipe:feedshare-video' : 'urn:li:digitalmediaRecipe:feedshare-image'],
              owner: 'urn:li:person:' + a.external_id,
              serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
            },
          }),
        });
        
        mediaUrn = registerRes.value.asset;
        const uploadUrl = registerRes.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
        
        // 2. Upload Binary
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: await mediaBlob.arrayBuffer(),
        });
        
        if (!uploadRes.ok) throw new AppError(`LinkedIn media upload failed with ${uploadRes.status}`);
      }

      const specificContent: any = {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: caption },
          shareMediaCategory,
        },
      };
      
      if (mediaUrn) {
        specificContent['com.linkedin.ugc.ShareContent'].media = [
          { status: 'READY', media: mediaUrn }
        ];
      }

      const r = await api('https://api.linkedin.com/v2/ugcPosts', token, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          author: 'urn:li:person:' + a.external_id,
          lifecycleState: 'PUBLISHED',
          specificContent,
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        }),
      });
      external = r.id || '';
    }


    await db().batch([
      db()
        .prepare(
          "UPDATE deliveries SET status='published',external_id=?,updated=? WHERE id=?",
        )
        .bind(external, new Date().toISOString(), delivery),
      db()
        .prepare(
          "UPDATE posts SET status='partial',updated=?,version=version+1 WHERE id=?",
        )
        .bind(new Date().toISOString(), p.id),
    ]);

    return { ok: true, externalId: external };
  } catch (e: any) {
    if (delivery)
      await db()
        .prepare(
          "UPDATE deliveries SET status='check_required',error=?,updated=? WHERE id=?",
        )
        .bind(
          e.message || 'Delivery was not confirmed. Check the social account before retrying.',
          new Date().toISOString(),
          delivery,
        )
        .run();
    throw e;
  }
}
