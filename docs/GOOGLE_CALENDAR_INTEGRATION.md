# Google Calendar Integration for Scheduled Posts

## Overview

This document outlines how to integrate the "schedule post" automation feature with Google Calendar, so that when a post is scheduled, it automatically creates a corresponding event entry in the user's Google Calendar.

## Current Architecture

### Existing Components

1. **`src/services/automationService.ts`**
   - `schedulePost()` - Saves scheduled posts to `scheduled_posts` table
   - Returns the scheduled post ID after insertion

2. **`src/components/AutomationDropdown.tsx`**
   - UI component for scheduling posts
   - Calls `schedulePost()` when user schedules a post (line 176)
   - Supports multiple schedule types: instant, 24hrs, 48hrs, 72hrs, daily, weekly, custom

3. **`src/components/GoogleCalendarWidget.tsx`**
   - Placeholder UI component (not yet connected)
   - Has a "Connect Google Calendar" button (TODO on line 95)

4. **Database Table: `scheduled_posts`**
   - Stores scheduled post information
   - Fields: `id`, `user_id`, `content`, `scheduled_for`, `status`, `post_metadata`, etc.

## Integration Flow

### High-Level Flow

```
User schedules post
    ↓
schedulePost() saves to database
    ↓
Check if user has Google Calendar connected
    ↓
If connected → Create calendar event via Edge Function
    ↓
Store calendar event ID in post_metadata
    ↓
User sees confirmation with calendar link
```

## Implementation Steps

### 1. Database Schema Updates

#### Add Google Calendar fields to `profiles` table:

```sql
-- Add Google Calendar OAuth fields
ALTER TABLE profiles
ADD COLUMN google_calendar_access_token TEXT,
ADD COLUMN google_calendar_refresh_token TEXT,
ADD COLUMN google_calendar_connected_at TIMESTAMPTZ,
ADD COLUMN google_calendar_calendar_id TEXT; -- Primary calendar ID
```

#### Update `scheduled_posts.post_metadata` structure:

The `post_metadata` JSONB field should include:
```typescript
{
  platform: string;
  generated_by: 'ai';
  scheduled_at: string;
  calendar_event_id?: string;  // Google Calendar event ID
  calendar_event_link?: string; // Link to view event in Google Calendar
}
```

### 2. Google Calendar OAuth Setup

#### 2.1 Create Google OAuth Service

**File: `src/services/googleCalendarOAuth.ts`**

Similar to `twitterOAuth.ts`, create a service for Google Calendar OAuth:

```typescript
export class GoogleCalendarOAuthService {
  private config: {
    clientId: string;
    redirectUri: string;
    scopes: string[];
  };

  // Generate OAuth URL
  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      access_type: 'offline', // Required for refresh token
      prompt: 'consent', // Force consent screen to get refresh token
      state: this.generateState(),
    });
    
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  // Scopes needed:
  // - https://www.googleapis.com/auth/calendar.events (create events)
  // - https://www.googleapis.com/auth/calendar.readonly (optional: read events)
}
```

#### 2.2 Environment Variables

Add to `.env`:
```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
```

### 3. Backend Edge Function: Create Calendar Event

**File: `supabase/functions/create-calendar-event/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface CreateCalendarEventRequest {
  user_id: string;
  scheduled_post_id: string;
  title: string;
  description: string;
  scheduled_for: string; // ISO date string
  platforms: string[];
}

serve(async (req) => {
  try {
    // Get user's Google Calendar tokens from database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, scheduled_post_id, title, description, scheduled_for, platforms } = 
      await req.json() as CreateCalendarEventRequest;

    // Fetch user's Google Calendar tokens
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('google_calendar_access_token, google_calendar_refresh_token, google_calendar_calendar_id')
      .eq('id', user_id)
      .single();

    if (profileError || !profile?.google_calendar_access_token) {
      return new Response(
        JSON.stringify({ error: 'Google Calendar not connected' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Refresh token if needed (implement token refresh logic)
    let accessToken = profile.google_calendar_access_token;
    // TODO: Check token expiry and refresh if needed

    // Create Google Calendar event
    const eventStart = new Date(scheduled_for);
    const eventEnd = new Date(eventStart.getTime() + 15 * 60 * 1000); // 15 min event

    const calendarEvent = {
      summary: `📱 Scheduled Post: ${platforms.join(', ')}`,
      description: `${description}\n\nPlatforms: ${platforms.join(', ')}\nPost ID: ${scheduled_post_id}`,
      start: {
        dateTime: eventStart.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: eventEnd.toISOString(),
        timeZone: 'UTC',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 5 }, // 5 min before
        ],
      },
    };

    // Call Google Calendar API
    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${profile.google_calendar_calendar_id || 'primary'}/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(calendarEvent),
      }
    );

    if (!calendarResponse.ok) {
      const error = await calendarResponse.json();
      throw new Error(`Google Calendar API error: ${error.error?.message}`);
    }

    const createdEvent = await calendarResponse.json();

    // Update scheduled_post metadata with calendar event info
    await supabase
      .from('scheduled_posts')
      .update({
        post_metadata: {
          calendar_event_id: createdEvent.id,
          calendar_event_link: createdEvent.htmlLink,
          // ... existing metadata
        },
      })
      .eq('id', scheduled_post_id);

    return new Response(
      JSON.stringify({
        success: true,
        event_id: createdEvent.id,
        event_link: createdEvent.htmlLink,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### 4. Update `schedulePost()` Function

**File: `src/services/automationService.ts`**

Modify the `schedulePost()` function to optionally create a calendar event:

```typescript
export async function schedulePost(
  userId: string,
  content: string,
  scheduledFor: Date,
  platforms: string[],
  postType: 'tweet' | 'reply' | 'thread' = 'tweet',
  createCalendarEvent: boolean = true // New parameter
): Promise<string> {
  // ... existing code to insert into scheduled_posts ...
  
  const { data, error } = await db
    .from('scheduled_posts')
    .insert(posts)
    .select('id')
    .single();

  if (error) {
    console.error('Failed to schedule post:', error);
    throw new Error('Failed to schedule post');
  }

  const scheduledPostId = data.id;

  // Create Google Calendar event if enabled and user has calendar connected
  if (createCalendarEvent) {
    try {
      // Check if user has Google Calendar connected
      const { data: profile } = await db
        .from('profiles')
        .select('google_calendar_access_token')
        .eq('id', userId)
        .single();

      if (profile?.google_calendar_access_token) {
        // Call edge function to create calendar event
        const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-calendar-event`;
        
        await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            user_id: userId,
            scheduled_post_id: scheduledPostId,
            title: `Scheduled Post: ${platforms.join(', ')}`,
            description: content,
            scheduled_for: scheduledFor.toISOString(),
            platforms,
          }),
        });
      }
    } catch (error) {
      // Log error but don't fail the scheduling
      console.error('Failed to create calendar event:', error);
      // Optionally notify user that post was scheduled but calendar event failed
    }
  }

  return scheduledPostId;
}
```

### 5. Update `AutomationDropdown.tsx`

**File: `src/components/AutomationDropdown.tsx`**

After scheduling (line 176), update the success message to include calendar link:

```typescript
await schedulePost(userId, recommendedPost.content, scheduledDate, selectedPlatforms);

// Fetch the scheduled post to get calendar event link
const { data: scheduledPost } = await db
  .from('scheduled_posts')
  .select('post_metadata')
  .eq('id', scheduledPostId)
  .single();

const calendarLink = scheduledPost?.post_metadata?.calendar_event_link;

setPostStatus({
  type: 'success',
  message: `Post scheduled for ${scheduledDate.toLocaleString()}!${
    calendarLink ? ' 📅 Added to Google Calendar' : ''
  }`,
});
```

### 6. Complete Google Calendar OAuth Flow

#### 6.1 Update `GoogleCalendarWidget.tsx`

**File: `src/components/GoogleCalendarWidget.tsx`**

```typescript
const handleConnectCalendar = async () => {
  // Get OAuth URL
  const oauthService = getGoogleCalendarOAuthService();
  const authUrl = oauthService.getAuthorizationUrl();
  
  // Store state for validation
  localStorage.setItem('google_calendar_state', oauthService.getState());
  
  // Redirect to Google
  window.location.href = authUrl;
};
```

#### 6.2 Create Callback Page

**File: `src/pages/GoogleCalendarCallbackPage.tsx`**

Similar to `TwitterCallbackPage.tsx`, handle the OAuth callback:

```typescript
// Extract code from URL
// Validate state
// Call edge function to exchange code for tokens
// Update user profile with tokens
// Redirect back to home page
```

#### 6.3 Create Edge Function for Token Exchange

**File: `supabase/functions/google-calendar-oauth-callback/index.ts`**

```typescript
// Exchange authorization code for access/refresh tokens
// Store tokens in user's profile
// Return success
```

### 7. Token Refresh Logic

Google Calendar access tokens expire. Implement refresh logic in the edge function:

```typescript
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  return data.access_token;
}
```

## Integration Points Summary

1. **When Post is Scheduled:**
   - `AutomationDropdown.tsx` → `schedulePost()` → Edge Function → Google Calendar API

2. **When User Connects Calendar:**
   - `GoogleCalendarWidget.tsx` → OAuth Flow → Callback Page → Edge Function → Store Tokens

3. **When Post is Posted:**
   - (Optional) Update calendar event status or delete it

## Database Changes Required

```sql
-- Add to profiles table
ALTER TABLE profiles
ADD COLUMN google_calendar_access_token TEXT,
ADD COLUMN google_calendar_refresh_token TEXT,
ADD COLUMN google_calendar_connected_at TIMESTAMPTZ,
ADD COLUMN google_calendar_calendar_id TEXT DEFAULT 'primary';

-- No changes needed to scheduled_posts table
-- (uses existing post_metadata JSONB field)
```

## Environment Variables

```env
# Google Calendar OAuth
VITE_GOOGLE_CLIENT_ID=your_client_id
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback

# Backend (Edge Functions)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

## Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Google Calendar API"
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:5173/auth/google/callback` (dev)
   - `https://yourdomain.com/auth/google/callback` (prod)
6. Add scopes:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly` (optional)

## Testing Checklist

- [ ] User can connect Google Calendar via OAuth
- [ ] Tokens are stored securely in database
- [ ] When scheduling a post, calendar event is created
- [ ] Calendar event includes correct date/time
- [ ] Calendar event includes post content and platforms
- [ ] Calendar event link is stored in post_metadata
- [ ] User sees confirmation with calendar link
- [ ] Token refresh works when access token expires
- [ ] Error handling for disconnected calendar
- [ ] Error handling for API failures

## Future Enhancements

1. **Sync Calendar Events Back:**
   - Read user's calendar events
   - Suggest optimal posting times based on availability

2. **Update Calendar Events:**
   - When post is edited, update calendar event
   - When post is cancelled, delete calendar event
   - When post is posted, mark event as completed

3. **Multiple Calendars:**
   - Let user choose which calendar to use
   - Support multiple calendar accounts

4. **Smart Scheduling:**
   - Analyze calendar to find best posting times
   - Avoid scheduling during busy periods
   - Suggest times based on engagement patterns

## Security Considerations

1. **Token Storage:**
   - Store refresh tokens securely (encrypted at rest)
   - Never expose tokens in client-side code
   - Use Row Level Security (RLS) policies

2. **OAuth Security:**
   - Always validate state parameter
   - Use PKCE for additional security
   - Implement proper CSRF protection

3. **API Security:**
   - All Google Calendar API calls should be server-side (Edge Functions)
   - Never expose client secrets in frontend
   - Use service role key for database operations

## Related Files

- `src/services/automationService.ts` - Post scheduling logic
- `src/components/AutomationDropdown.tsx` - Scheduling UI
- `src/components/GoogleCalendarWidget.tsx` - Calendar connection UI
- `src/services/twitterOAuth.ts` - Reference implementation for OAuth
- `supabase/functions/post-to-social/index.ts` - Reference for Edge Functions

