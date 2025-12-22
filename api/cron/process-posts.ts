// Vercel Cron API Route: Process Scheduled Posts
// Triggered every 5 minutes by Vercel Cron to execute due scheduled posts
// Calls the Supabase Edge Function `process-scheduled-posts`

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/ab3ebd77-2545-412d-b06f-2f603dbfb7bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/cron/process-posts.ts:9',message:'Cron handler called',data:{method:req.method,url:req.url,hasAuthHeader:!!req.headers.get('authorization')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  // Verify Vercel cron secret (Vercel sends this automatically for cron jobs)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/ab3ebd77-2545-412d-b06f-2f603dbfb7bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/cron/process-posts.ts:15',message:'Auth check',data:{hasCronSecret:!!cronSecret,hasAuthHeader:!!authHeader,authHeaderMatch:authHeader===`Bearer ${cronSecret}`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion

  // Allow requests from Vercel Cron (they include the secret) or authenticated requests
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ab3ebd77-2545-412d-b06f-2f603dbfb7bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/cron/process-posts.ts:20',message:'Auth failed',data:{received:authHeader?.substring(0,20),expected:`Bearer ${cronSecret?.substring(0,10)}...`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
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

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/ab3ebd77-2545-412d-b06f-2f603dbfb7bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/cron/process-posts.ts:28',message:'Before edge function call',data:{hasSupabaseUrl:!!supabaseUrl,edgeFunctionUrl:`${supabaseUrl}/functions/v1/process-scheduled-posts`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  // #endregion

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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ab3ebd77-2545-412d-b06f-2f603dbfb7bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/cron/process-posts.ts:52',message:'Edge function response',data:{status:response.status,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion

    const result = await response.json();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ab3ebd77-2545-412d-b06f-2f603dbfb7bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/cron/process-posts.ts:56',message:'Edge function result',data:{processed:result.processed,succeeded:result.succeeded,failed:result.failed,resultsCount:result.results?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

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

