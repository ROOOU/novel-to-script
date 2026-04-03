import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { grantCredits } from '@/server/billing/service';
import { requireViewerPlatformContext } from '@/server/auth/http';
import { applyPlatformResponseHeaders } from '@/server/shared/platform';
import { getPlatformRuntime } from '@/server/shared/platform';

const redeemSchema = z.object({
  code: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const { viewer, context, response } = await requireViewerPlatformContext(request);
  if (response || !viewer) {
    return response;
  }

  try {
    const body = redeemSchema.parse(await request.json());
    const runtime = getPlatformRuntime();
    const redeemCode = await runtime.redeemCodes.getByCode(body.code);
    if (!redeemCode) {
      throw new Error('REDEEM_CODE_NOT_FOUND');
    }
    if (redeemCode.status !== 'active') {
      throw new Error('REDEEM_CODE_INACTIVE');
    }
    if (redeemCode.expiresAt && redeemCode.expiresAt < new Date().toISOString()) {
      throw new Error('REDEEM_CODE_EXPIRED');
    }
    if (redeemCode.redeemedCount >= redeemCode.maxRedemptions) {
      throw new Error('REDEEM_CODE_LIMIT_REACHED');
    }

    const existingRedemptions = await runtime.redeemCodeRedemptions.listByRedeemCodeId(redeemCode.id);
    if (existingRedemptions.some((entry) => entry.organizationId === viewer.organization.id)) {
      throw new Error('REDEEM_CODE_ALREADY_USED');
    }

    const campaign = await runtime.redeemCodeCampaigns.getById(redeemCode.campaignId);
    if (!campaign) {
      throw new Error('REDEEM_CAMPAIGN_NOT_FOUND');
    }
    if (campaign.status !== 'active') {
      throw new Error('REDEEM_CAMPAIGN_INACTIVE');
    }
    if (campaign.endsAt && campaign.endsAt < new Date().toISOString()) {
      throw new Error('REDEEM_CAMPAIGN_EXPIRED');
    }

    const grant = await grantCredits({
      organizationId: viewer.organization.id,
      userId: viewer.user.id,
      credits: redeemCode.creditsGranted,
      kind: 'redeem_code_grant',
      redeemCodeId: redeemCode.id,
      note: `Redeemed ${redeemCode.code}`,
    });

    await runtime.redeemCodes.update(redeemCode.id, {
      redeemedCount: redeemCode.redeemedCount + 1,
      updatedByUserId: viewer.user.id,
    });

    const redemption = await runtime.redeemCodeRedemptions.create({
      redeemCodeId: redeemCode.id,
      campaignId: campaign.id,
      organizationId: viewer.organization.id,
      userId: viewer.user.id,
      creditLedgerEntryId: grant.ledgerEntry.id,
      createdByUserId: viewer.user.id,
    });

    return applyPlatformResponseHeaders(
      NextResponse.json({
        ok: true,
        redemption,
        creditAccount: grant.account,
      }),
      context
    );
  } catch (error) {
    return applyPlatformResponseHeaders(
      NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : 'REDEEM_FAILED',
        },
        { status: 400 }
      ),
      context
    );
  }
}
