// Vercel Cron API Route: Process Scheduled Posts
// Triggered every 5 minutes by Vercel Cron to execute due scheduled posts
// Calls the Supabase Edge Function `process-scheduled-posts`

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
    // Call Supabase Edge Function to process scheduled posts
    const response = await fetch(
      `${supabaseUrl}/functions/v1/process-scheduled-posts`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await response.json();

    console.log('Process scheduled posts result:', {
      status: response.status,
      processed: result.processed,
      results: result.results?.length || 0,
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
    console.error('Error calling process-scheduled-posts:', error);
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

