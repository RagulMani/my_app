import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth-helpers';
import type { Task, CreateTaskInput, ApiError } from '@/lib/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ tasks: Task[] } | { task: Task } | ApiError>
) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  // ── GET /api/tasks ─────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { status, priority, assignee_id, related_type, related_id, overdue } = req.query;

      let sql = `
        SELECT
          t.*,
          u.name AS assignee_name
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assignee_id
        WHERE 1=1
      `;
      const params: unknown[] = [];
      let idx = 1;

      // Sales reps only see tasks assigned to them
      if (user.role === 'sales_rep') {
        sql += ` AND t.assignee_id = $${idx++}`;
        params.push(user.id);
      }

      if (status) {
        sql += ` AND t.status = $${idx++}`;
        params.push(status);
      }
      if (priority) {
        sql += ` AND t.priority = $${idx++}`;
        params.push(priority);
      }
      if (assignee_id) {
        sql += ` AND t.assignee_id = $${idx++}`;
        params.push(assignee_id);
      }
      if (related_type) {
        sql += ` AND t.related_type = $${idx++}`;
        params.push(related_type);
      }
      if (related_id) {
        sql += ` AND t.related_id = $${idx++}`;
        params.push(related_id);
      }
      if (overdue === 'true') {
        sql += ` AND t.due_date < now() AND t.status <> 'done'`;
      }

      sql += ' ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC';

      const tasks = await query<Task>(sql, params);
      return res.status(200).json({ tasks });
    } catch (err) {
      console.error('[GET /api/tasks]', err);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }

  // ── POST /api/tasks ────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body as CreateTaskInput;

      if (!body.title?.trim()) {
        return res.status(400).json({ error: 'Task title is required' });
      }

      const assigneeId = user.role === 'sales_rep' ? user.id : (body.assignee_id ?? user.id);

      const rows = await query<Task>(
        `INSERT INTO tasks (title, description, due_date, status, priority, related_type, related_id, assignee_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          body.title.trim(),
          body.description ?? null,
          body.due_date ?? null,
          body.status ?? 'open',
          body.priority ?? 'medium',
          body.related_type ?? null,
          body.related_id ?? null,
          assigneeId,
        ]
      );

      return res.status(201).json({ task: rows[0] });
    } catch (err) {
      console.error('[POST /api/tasks]', err);
      return res.status(500).json({ error: 'Failed to create task' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
