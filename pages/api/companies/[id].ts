import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth-helpers';
import type { Company, UpdateCompanyInput, ApiError } from '@/lib/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ company: Company } | ApiError>
) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const { id } = req.query as { id: string };

  // ── GET /api/companies/[id] ────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const rows = await query<Company>(
        'SELECT * FROM companies WHERE id = $1',
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Company not found' });
      return res.status(200).json({ company: rows[0] });
    } catch (err) {
      console.error('[GET /api/companies/[id]]', err);
      return res.status(500).json({ error: 'Failed to fetch company' });
    }
  }

  // ── PUT /api/companies/[id] ────────────────────────────────────────────────
  if (req.method === 'PUT') {
    try {
      const body = req.body as UpdateCompanyInput;

      const rows = await query<Company>(
        `UPDATE companies
         SET name       = COALESCE($1, name),
             industry   = COALESCE($2, industry),
             website    = COALESCE($3, website),
             phone      = COALESCE($4, phone),
             address    = COALESCE($5, address),
             updated_at = now()
         WHERE id = $6
         RETURNING *`,
        [
          body.name ?? null,
          body.industry ?? null,
          body.website ?? null,
          body.phone ?? null,
          body.address ?? null,
          id,
        ]
      );

      if (rows.length === 0) return res.status(404).json({ error: 'Company not found' });
      return res.status(200).json({ company: rows[0] });
    } catch (err) {
      console.error('[PUT /api/companies/[id]]', err);
      return res.status(500).json({ error: 'Failed to update company' });
    }
  }

  // ── DELETE /api/companies/[id] ─────────────────────────────────────────────
  if (req.method === 'DELETE') {
    // Only admin can delete companies
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admin only' });
    }

    try {
      const rows = await query<{ id: string }>(
        'DELETE FROM companies WHERE id = $1 RETURNING id',
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Company not found' });
      return res.status(200).json({ company: { id } as Company });
    } catch (err) {
      console.error('[DELETE /api/companies/[id]]', err);
      return res.status(500).json({ error: 'Failed to delete company' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
