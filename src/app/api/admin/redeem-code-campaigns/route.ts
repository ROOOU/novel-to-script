import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireViewerResponse } from '@/server/auth/http';
import { getPlatformRuntime } from '@/server/shared/platform';

const createCampaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  creditsGranted: z.number().int().positive(),
  codePrefix: z.string().optional(),
  totalLimit: z.number().int().positive().optional(),
  perOrganizationLimit: z.number().int().positive().optional(),
  status: z.enum(['draft', 'active']).optional(),
});

export async function POST(request: NextRequest) {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  const body = createCampaignSchema.parse(await request.json());
  const runtime = getPlatformRuntime();
  const campaign = await runtime.redeemCodeCampaigns.create({
    organizationId: viewer.organization.id,
    name: body.name,
    description: body.description,
    status: body.status ?? 'draft',
    creditsGranted: body.creditsGranted,
    codePrefix: body.codePrefix,
    totalLimit: body.totalLimit,
    perOrganizationLimit: body.perOrganizationLimit,
    createdByUserId: viewer.user.id,
  });

  return NextResponse.json({
    ok: true,
    campaign,
  });
}
