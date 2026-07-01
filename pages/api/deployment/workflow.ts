/**
 * GET /api/deployment/workflow
 *
 * Returns the raw GitHub Actions workflow YAML file content
 * for deploying this Next.js CRM to Vercel via GitHub Actions.
 * The UI can display this for the user to copy into their repo.
 *
 * Query params:
 *   ?platform=vercel|railway|render  (default: vercel)
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth-helpers';

const WORKFLOWS: Record<string, { filename: string; content: string }> = {
  vercel: {
    filename: '.github/workflows/deploy-vercel.yml',
    content: `# GitHub Actions workflow: Deploy to Vercel
# 1. Push this file to .github/workflows/deploy-vercel.yml in your repo
# 2. Add these GitHub Secrets (Settings → Secrets → Actions):
#    - VERCEL_TOKEN       (from vercel.com/account/tokens)
#    - VERCEL_ORG_ID      (from .vercel/project.json after 'vercel link')
#    - VERCEL_PROJECT_ID  (from .vercel/project.json after 'vercel link')
#    - DATABASE_URL       (your PostgreSQL connection string)
#    - AUTH_SECRET        (random 32-char secret)
#    - NEXTAUTH_URL       (your production URL, e.g. https://mycrm.vercel.app)
#    - HUBSPOT_API_KEY    (from HubSpot developer portal)
#    - SENDGRID_API_KEY   (from SendGrid dashboard)

name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  VERCEL_ORG_ID: \${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: \${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit

  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    needs: typecheck
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Install Vercel CLI
        run: npm install --global vercel@latest
      - name: Pull Vercel environment
        run: vercel pull --yes --environment=production --token=\${{ secrets.VERCEL_TOKEN }}
      - name: Build project
        run: vercel build --prod --token=\${{ secrets.VERCEL_TOKEN }}
        env:
          DATABASE_URL: \${{ secrets.DATABASE_URL }}
          AUTH_SECRET: \${{ secrets.AUTH_SECRET }}
          NEXTAUTH_URL: \${{ secrets.NEXTAUTH_URL }}
          HUBSPOT_API_KEY: \${{ secrets.HUBSPOT_API_KEY }}
          SENDGRID_API_KEY: \${{ secrets.SENDGRID_API_KEY }}
      - name: Deploy to Vercel
        run: vercel deploy --prebuilt --prod --token=\${{ secrets.VERCEL_TOKEN }}
`,
  },
  railway: {
    filename: '.github/workflows/deploy-railway.yml',
    content: `# GitHub Actions workflow: Deploy to Railway
# 1. Push this file to .github/workflows/deploy-railway.yml in your repo
# 2. Add these GitHub Secrets (Settings → Secrets → Actions):
#    - RAILWAY_TOKEN      (from railway.app → Account Settings → Tokens)
#    - DATABASE_URL       (Railway PostgreSQL connection string)
#    - AUTH_SECRET        (random 32-char secret)
#    - NEXTAUTH_URL       (your Railway app URL)
#    - HUBSPOT_API_KEY    (from HubSpot developer portal)
#    - SENDGRID_API_KEY   (from SendGrid dashboard)

name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit

  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    needs: typecheck
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Install Railway CLI
        run: npm install --global @railway/cli
      - name: Deploy to Railway
        run: railway up --service=web
        env:
          RAILWAY_TOKEN: \${{ secrets.RAILWAY_TOKEN }}
`,
  },
  render: {
    filename: '.github/workflows/deploy-render.yml',
    content: `# GitHub Actions workflow: Deploy to Render
# Render auto-deploys from GitHub — this workflow adds a type check gate.
# 1. Connect your GitHub repo in the Render dashboard
# 2. Add these GitHub Secrets (Settings → Secrets → Actions):
#    - RENDER_API_KEY     (from render.com → Account → API Keys)
#    - RENDER_SERVICE_ID  (from your Render service URL)
# 3. Set environment variables in the Render dashboard:
#    DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL, HUBSPOT_API_KEY, SENDGRID_API_KEY

name: Type Check + Trigger Render Deploy

on:
  push:
    branches: [main]

jobs:
  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit

  deploy:
    name: Trigger Render Deploy
    runs-on: ubuntu-latest
    needs: typecheck
    steps:
      - name: Trigger deploy via Render API
        run: |
          curl -X POST "https://api.render.com/v1/services/\${{ secrets.RENDER_SERVICE_ID }}/deploys" \\
            -H "Authorization: Bearer \${{ secrets.RENDER_API_KEY }}" \\
            -H "Content-Type: application/json" \\
            -d '{"clearCache": false}'
`,
  },
};

export interface WorkflowResponse {
  platform: string;
  filename: string;
  content: string;
  setupSteps: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WorkflowResponse | { error: string }>
) {
  try {
    await requireUser(req);
  } catch {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const platform = (req.query.platform as string) || 'vercel';

  if (!WORKFLOWS[platform]) {
    return res.status(400).json({
      error: `Unknown platform "${platform}". Supported: ${Object.keys(WORKFLOWS).join(', ')}`,
    });
  }

  const workflow = WORKFLOWS[platform];

  const setupStepsByPlatform: Record<string, string[]> = {
    vercel: [
      'Create a Vercel account at vercel.com',
      'Install Vercel CLI: npm i -g vercel',
      'Run `vercel link` in your project root to get ORG_ID and PROJECT_ID',
      'Add VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID as GitHub Secrets',
      'Add DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL, HUBSPOT_API_KEY, SENDGRID_API_KEY as GitHub Secrets',
      `Copy the workflow YAML to ${workflow.filename} in your repo`,
      'Push to main branch — GitHub Actions will deploy automatically',
    ],
    railway: [
      'Create a Railway account at railway.app',
      'Create a new project and add a PostgreSQL plugin',
      'Get your Railway token from Account Settings → Tokens',
      'Add RAILWAY_TOKEN as a GitHub Secret',
      'Add DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL as GitHub Secrets',
      `Copy the workflow YAML to ${workflow.filename} in your repo`,
      'Push to main branch — GitHub Actions will deploy automatically',
    ],
    render: [
      'Create a Render account at render.com',
      'Create a new Web Service and connect your GitHub repo',
      'Add a PostgreSQL database in the Render dashboard',
      'Set all environment variables in the Render dashboard',
      'Get your Render API key from Account → API Keys',
      'Add RENDER_API_KEY and RENDER_SERVICE_ID as GitHub Secrets',
      `Copy the workflow YAML to ${workflow.filename} in your repo`,
      'Push to main branch — type check runs, then Render deploys',
    ],
  };

  try {
    return res.status(200).json({
      platform,
      filename: workflow.filename,
      content: workflow.content,
      setupSteps: setupStepsByPlatform[platform] ?? [],
    });
  } catch (serializeErr) {
    return res.status(500).json({ error: 'Failed to serialize workflow response' });
  }
}
