// Vercel Cron API Route: Process Agent Mode Actions
// Triggered every hour by Vercel Cron to check agent mode users and schedule engagement actions
// Calls the Supabase Edge Function `process-agent-actions`

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  // Verify Vercel cron secret (Vercel sends this automatically for cron jobs)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Allow requests from Vercel Cron (they include the secret) or authenticated requests
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error('Unauthorized cron request');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

  if (!supabaseUrl) {
    console.error('Missing SUPABASE_URL environment variable');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Call Supabase Edge Function to process agent actions
    const response = await fetch(
      `${supabaseUrl}/functions/v1/process-agent-actions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await response.json();

    console.log('Process agent actions result:', {
      status: response.status,
      processed: result.processed,
      skipped: result.skipped,
      failed: result.failed,
      totalActionsScheduled: result.totalActionsScheduled,
    });

    return new Response(
      JSON.stringify({
        success: response.ok,
        ...result,
      }),
      {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error calling process-agent-actions:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

