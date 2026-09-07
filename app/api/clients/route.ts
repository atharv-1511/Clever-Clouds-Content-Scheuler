import { authorize, body, db, fail, json, sameOrigin, text, AppError } from '@/lib/server';

export async function GET(request: Request) {
  try {
    await authorize();
    const r = await db().prepare('SELECT * FROM clients ORDER BY created DESC').all();
    return json(r.results);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await authorize();
    const b = await body(request);
    
    const name = text(b.name, 120);
    const address = b.address ? text(b.address, 500, false) : null;
    const phone = b.phone ? text(b.phone, 50) : null;
    const email = b.email ? text(b.email, 120) : null;
    const social_urls = b.social_urls ? text(b.social_urls, 1000, false) : null;
    
    if (!name) throw new AppError('Client name is required.');

    const now = new Date().toISOString();
    let id = b.id ? text(b.id, 80) : crypto.randomUUID();

    if (b.id) {
      await db()
        .prepare('UPDATE clients SET name=?, address=?, phone=?, email=?, social_urls=?, updated=? WHERE id=?')
        .bind(name, address, phone, email, social_urls, now, id)
        .run();
    } else {
      await db()
        .prepare('INSERT INTO clients(id, name, address, phone, email, social_urls, created, updated) VALUES(?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, name, address, phone, email, social_urls, now, now)
        .run();
    }

    return json({ ok: true, id });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    await authorize();
    const b = await body(request);
    const id = text(b.id, 80);
    
    // Check if there are connected integrations
    const intgCount = await db().prepare('SELECT count(*) as c FROM integrations WHERE client_id=?').bind(id).first<{c: number}>();
    if (intgCount && intgCount.c > 0) {
      throw new AppError('Cannot delete a client that has connected social integrations. Disconnect them first.', 409);
    }

    await db().prepare('DELETE FROM clients WHERE id=?').bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
