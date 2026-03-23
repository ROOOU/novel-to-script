import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireViewerResponse } from '@/server/auth/http';
import { getPlatformRuntime } from '@/server/shared/platform';

const generateCodesSchema = z.object({
  count: z.number().int().positive().max(200),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  const { id } = await params;
  const runtime = getPlatformRuntime();
  const campaign = await runtime.redeemCodeCampaigns.getById(id);
  if (!campaign || (campaign.organizationId && campaign.organizationId !== viewer.organization.id)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'CAMPAIGN_NOT_FOUND',
      },
      { status: 404 }
    );
  }

  const body = generateCodesSchema.parse(await request.json());
  const codes = await Promise.all(
    Array.from({ length: body.count }, async () => {
      return runtime.redeemCodes.create({
        campaignId: campaign.id,
        code: buildRedeemCode(campaign.codePrefix ?? 'NS'),
        creditsGranted: campaign.creditsGranted,
        maxRedemptions: 1,
        createdByUserId: viewer.user.id,
      });
    })
  );

  return NextResponse.json({
    ok: true,
    codes,
  });
}

function buildRedeemCode(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix.trim().toUpperCase()}-${random}`;
}
