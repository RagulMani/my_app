import type { NextApiRequest, NextApiResponse } from 'next';
import { runIntegration } from '@/lib/integrations/connectors';
import type { ApiError } from '@/lib/types';

interface LeadAssignedPayload {
  lead_id: string;
  lead_title: string;
  assignee_email: string;
  assignee_name: string;
}

interface NotificationResult {
  ok: boolean;
  message: string;
}

/**
 * POST /api/notifications/lead-assigned
 *
 * Sends an email notification via SendGrid when a lead is assigned to a user.
 * Called internally by the leads PUT handler when owner_id changes.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<NotificationResult | ApiError>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lead_id, lead_title, assignee_email, assignee_name } =
    req.body as LeadAssignedPayload;

  if (!lead_id || !lead_title || !assignee_email) {
    return res.status(400).json({ error: 'lead_id, lead_title, and assignee_email are required' });
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'noreply@crm.example.com';
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000';

  try {
    await runIntegration(
      'sendgrid',
      {
        method: 'POST',
        endpoint: 'mail/send',
        body: {
          from: { email: fromEmail, name: 'CRM Sales Team' },
          personalizations: [
            {
              to: [{ email: assignee_email, name: assignee_name ?? assignee_email }],
              subject: `New lead assigned: ${lead_title}`,
            },
          ],
          subject: `New lead assigned: ${lead_title}`,
          content: [
            {
              type: 'text/html',
              value: `
                <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                  <h2 style="color: #4f46e5; margin-bottom: 8px;">New Lead Assigned</h2>
                  <p style="color: #374151; font-size: 16px;">
                    Hi ${assignee_name ?? 'there'},
                  </p>
                  <p style="color: #374151; font-size: 16px;">
                    A new lead has been assigned to you:
                  </p>
                  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <strong style="color: #111827; font-size: 18px;">${lead_title}</strong>
                  </div>
                  <a href="${appUrl}/leads/${lead_id}"
                     style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px;
                            border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 8px;">
                    View Lead
                  </a>
                  <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
                    This is an automated notification from your CRM.
                  </p>
                </div>
              `,
            },
            {
              type: 'text/plain',
              value: `Hi ${assignee_name ?? 'there'},\n\nA new lead has been assigned to you: "${lead_title}".\n\nView it at: ${appUrl}/leads/${lead_id}\n\nThis is an automated notification from your CRM.`,
            },
          ],
        },
      },
      {
        api_key: process.env.SENDGRID_API_KEY ?? '',
      }
    );

    return res.status(200).json({ ok: true, message: 'Notification sent' });
  } catch (err) {
    console.error('[POST /api/notifications/lead-assigned]', err);
    // Return 200 so the caller doesn't fail — notification is best-effort
    return res.status(200).json({ ok: false, message: 'Notification failed (non-critical)' });
  }
}
