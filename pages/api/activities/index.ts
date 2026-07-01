import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth-helpers';
import type { Activity, CreateActivityInput, ApiError } from '@/lib/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ activities: Activity[] } | { activity: Activity } | ApiError>
) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  // ── GET /api/activities ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { related_type, related_id, type, limit } = req.query;

      let sql = `
        SELECT
          a.*,
          u.name AS user_name
        FROM activities a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE 1=1
      `;
      const params: unknown[] = [];
      let idx = 1;

      if (related_type) {
        sql += ` AND a.related_type = $${idx++}`;
        params.push(related_type);
      }
      if (related_id) {
        sql += ` AND a.related_id = $${idx++}`;
        params.push(related_id);
      }
      if (type) {
        sql += ` AND a.type = $${idx++}`;
        params.push(type);
      }

      sql += ' ORDER BY a.created_at DESC';

      if (limit) {
        const limitNum = parseInt(String(limit), 10);
        if (!isNaN(limitNum) && limitNum > 0) {
          sql += ` LIMIT $${idx++}`;
          params.push(limitNum);
        }
      }

      const activities = await query<Activity>(sql, params);
      return res.status(200).json({ activities });
    } catch (err) {
      console.error('[GET /api/activities]', err);
      return res.status(500).json({ error: 'Failed to fetch activities' });
    }
  }

  // ── POST /api/activities ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body as CreateActivityInput;

      if (!body.type) {
        return res.status(400).json({ error: 'Activity type is required' });
      }

      const validTypes = ['note', 'call', 'email', 'meeting'];
      if (!validTypes.includes(body.type)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      }

      const rows = await query<Activity>(
        `INSERT INTO activities (type, body, related_type, related_id, user_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          body.type,
          body.body ?? null,
          body.related_type ?? null,
          body.related_id ?? null,
          user.id,
        ]
      );

      return res.status(201).json({ activity: rows[0] });
    } catch (err) {
      console.error('[POST /api/activities]', err);
      return res.status(500).json({ error: 'Failed to create activity' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
