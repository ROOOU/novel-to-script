import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireDeveloperChannelResponse } from '@/server/dev/channel';
import { getDeveloperChannelSummary, runDeveloperScenario } from '@/server/dev/scenarios';

const scenarioSchema = z.object({
  scenario: z.enum([
    'seed-demo-project',
    'grant-credits',
    'create-payment-order',
    'create-redeem-campaign',
  ]),
});

export async function GET() {
  const { viewer, response } = await requireDeveloperChannelResponse();
  if (response || !viewer) {
    return response;
  }

  return NextResponse.json({
    ok: true,
    summary: await getDeveloperChannelSummary(viewer),
  });
}

export async function POST(request: NextRequest) {
  const { viewer, response } = await requireDeveloperChannelResponse();
  if (response || !viewer) {
    return response;
  }

  const body = scenarioSchema.parse(await request.json());
  const result = await runDeveloperScenario({
    viewer,
    scenario: body.scenario,
  });

  return NextResponse.json({
    ok: true,
    result,
    summary: await getDeveloperChannelSummary(viewer),
  });
}
