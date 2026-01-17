# LLM/AI Capabilities & Grok API Cost Audit

**Date:** January 2025  
**Purpose:** Comprehensive audit of LLM usage, Grok API expenses, and cost per user analysis

---

## Executive Summary

This audit examines all LLM/AI capabilities in the SONA platform, identifies Grok API usage patterns, and calculates estimated costs per user. The platform uses **xAI's Grok API** as the primary LLM provider for all AI-powered features.

### Key Findings

- **Primary LLM Provider:** xAI Grok API
- **Models Used:** `grok-3-latest` (primary), `grok-4-latest` (post generation)
- **Usage Points:** 4 major features
- **Token Tracking:** Partial (stored in `chat_messages.tokens_used`, but not aggregated)
- **Cost Optimization:** Opportunities exist for caching and model selection

---

## 1. LLM/AI Capabilities Overview

### 1.1 Core AI Features

| Feature | Edge Function | Model | Frequency | Purpose |
|---------|--------------|-------|-----------|---------|
| **Chat with Clone** | `chat-with-clone` | `grok-3-latest` | Per message | Real-time conversation with AI alter ego |
| **Twitter Replies** | `process-agent-actions`<br>`execute-agent-actions-instant` | `grok-3-latest` | Per engagement action | Generate authentic replies to tweets |
| **Post Generation** | `generate-post` | `grok-4-latest` | Per post request | Generate social media posts |
| **Character Card** | `generate-character-card` | `grok-3-latest` | Per user (one-time) | Analyze tweets and generate personality profile |

### 1.2 Model Usage Breakdown

#### `grok-3-latest` (Primary Model)
- **Used for:** Chat, Twitter replies, Character card generation
- **Pricing:** Not publicly available (likely similar to grok-4 pricing structure)
- **Estimated Cost:** Assuming similar to grok-4: **$3/1M input tokens, $15/1M output tokens**

#### `grok-4-latest` (Premium Model)
- **Used for:** Post generation only
- **Pricing:** 
  - Input: **$3.00 per 1M tokens**
  - Output: **$15.00 per 1M tokens**
  - Cached input: **$0.75 per 1M tokens** (if applicable)

---

## 2. Detailed Usage Analysis

### 2.1 Chat with Clone (`chat-with-clone`)

**Location:** `supabase/functions/chat-with-clone/index.ts`

**Model:** `grok-3-latest`

**Token Usage Per Request:**
- **System Prompt:** ~1,500-2,500 tokens (personality core + conversation context)
- **User Message:** ~10-50 tokens (average message)
- **Conversation History:** ~100-500 tokens (last 10 messages, limited to 3 for live search queries)
- **Output:** ~50-150 tokens (response length)
- **Total per request:** ~1,660-3,200 tokens

**Estimated Cost per Chat Message:**
- Input: ~2,000 tokens × $3/1M = **$0.006**
- Output: ~100 tokens × $15/1M = **$0.0015**
- **Total: ~$0.0075 per chat message**

**Live Search Queries:**
- When `enableLiveSearch` is true, adds `search_parameters` to request
- May increase token usage by 10-20% due to search context
- **Estimated: ~$0.008-0.009 per live search query**

### 2.2 Twitter Replies (`process-agent-actions` / `execute-agent-actions-instant`)

**Location:** 
- `supabase/functions/process-agent-actions/index.ts`
- `supabase/functions/execute-agent-actions-instant/index.ts`

**Model:** `grok-3-latest`

**Token Usage Per Reply:**
- **System Prompt:** ~1,500-2,000 tokens (Twitter-specific prompt with personality)
- **Tweet Context:** ~50-200 tokens (original tweet + thread context)
- **Output:** ~50-150 tokens (reply length: 70-220 characters)
- **Total per reply:** ~1,600-2,350 tokens

**Estimated Cost per Twitter Reply:**
- Input: ~1,900 tokens × $3/1M = **$0.0057**
- Output: ~100 tokens × $15/1M = **$0.0015**
- **Total: ~$0.0072 per Twitter reply**

**Rate Limits:**
- Default: 5 replies per account per day
- Global: 20 engagements per day per user
- **Max cost per user per day:** 20 × $0.0072 = **$0.144/day**

### 2.3 Post Generation (`generate-post`)

**Location:** `supabase/functions/generate-post/index.ts`

**Model:** `grok-4-latest` (premium model)

**Token Usage Per Post:**
- **System Prompt:** ~800-1,200 tokens (character card + posting style)
- **User Context:** ~100-300 tokens (conversation context, topics)
- **Output:** ~50-150 tokens (post length: 50-280 characters)
- **Total per post:** ~950-1,650 tokens

**Estimated Cost per Post:**
- Input: ~1,200 tokens × $3/1M = **$0.0036**
- Output: ~100 tokens × $15/1M = **$0.0015**
- **Total: ~$0.0051 per post**

**Rate Limits:**
- 10 post generations per minute per user
- **Max cost per user per day (100 posts):** 100 × $0.0051 = **$0.51/day**

### 2.4 Character Card Generation (`generate-character-card`)

**Location:** `supabase/functions/generate-character-card/index.ts`

**Model:** `grok-3-latest`

**Token Usage Per Generation:**
This is a **two-pass process** with 2 separate API calls:

**Pass 1: Deep Personality Analysis**
- **System Prompt:** ~500 tokens
- **User Prompt:** ~2,000-5,000 tokens (tweets + profile data)
- **Output:** ~1,500-2,500 tokens (JSON analysis)
- **Total Pass 1:** ~4,000-8,000 tokens

**Pass 2: Character Card Generation**
- **System Prompt:** ~500 tokens
- **User Prompt:** ~1,500-3,000 tokens (analysis results + examples request)
- **Output:** ~2,000-4,000 tokens (JSON character card)
- **Total Pass 2:** ~4,000-7,500 tokens

**Total per Character Card:**
- **Pass 1:** ~6,000 tokens
- **Pass 2:** ~5,000 tokens
- **Total: ~11,000 tokens**

**Estimated Cost per Character Card:**
- Pass 1 Input: ~6,000 tokens × $3/1M = **$0.018**
- Pass 1 Output: ~2,000 tokens × $15/1M = **$0.03**
- Pass 2 Input: ~5,000 tokens × $3/1M = **$0.015**
- Pass 2 Output: ~3,000 tokens × $15/1M = **$0.045**
- **Total: ~$0.108 per character card generation**

**Frequency:** One-time per user (regenerated only when user requests)

---

## 3. Cost Per User Analysis

### 3.1 Average User Profile

**Assumptions:**
- **Active user:** Uses platform 3-5 days per week
- **Chat messages:** 20-50 messages per week
- **Twitter replies:** 10-20 replies per week (agent mode)
- **Post generation:** 5-10 posts per week
- **Character card:** 1 generation (one-time)

### 3.2 Weekly Cost Breakdown

| Feature | Usage | Cost per Unit | Weekly Cost |
|---------|-------|---------------|-------------|
| Chat Messages | 35 messages | $0.0075 | **$0.26** |
| Twitter Replies | 15 replies | $0.0072 | **$0.11** |
| Post Generation | 7 posts | $0.0051 | **$0.04** |
| Character Card | 0.1 (one-time amortized) | $0.108 | **$0.01** |
| **TOTAL** | | | **~$0.42/week** |

### 3.3 Monthly Cost Per User

- **Weekly:** $0.42
- **Monthly (4.33 weeks):** **~$1.82/month per active user**

### 3.4 Heavy User Profile

**Assumptions:**
- **Chat messages:** 100 messages per week
- **Twitter replies:** 50 replies per week (maxing out limits)
- **Post generation:** 20 posts per week
- **Character card:** 1 generation (one-time)

| Feature | Usage | Cost per Unit | Weekly Cost |
|---------|-------|---------------|-------------|
| Chat Messages | 100 messages | $0.0075 | **$0.75** |
| Twitter Replies | 50 replies | $0.0072 | **$0.36** |
| Post Generation | 20 posts | $0.0051 | **$0.10** |
| Character Card | 0.1 (one-time amortized) | $0.108 | **$0.01** |
| **TOTAL** | | | **~$1.22/week** |

**Monthly:** **~$5.29/month per heavy user**

### 3.5 Cost Scaling Projections

| Users | Avg Monthly Cost/User | Total Monthly Cost |
|-------|----------------------|-------------------|
| 10 | $1.82 | **$18.20** |
| 50 | $1.82 | **$91.00** |
| 100 | $1.82 | **$182.00** |
| 500 | $1.82 | **$910.00** |
| 1,000 | $1.82 | **$1,820.00** |

**Note:** Assumes 80% active users (20% churn/inactive)

---

## 4. Current Token Tracking

### 4.1 Database Tracking

**Location:** `chat_messages` table

**Fields:**
- `tokens_used` (number | null) - Stores token count from API response
- `model_used` (string | null) - Stores model name

**Coverage:**
- ✅ Chat messages: **Tracked**
- ❌ Twitter replies: **Not tracked** (no database record)
- ❌ Post generation: **Not tracked** (no database record)
- ❌ Character card: **Not tracked** (no database record)

### 4.2 API Response Tracking

**Location:** `supabase/functions/_shared/generateResponse.ts`

```typescript
return {
  response: assistantMessage,
  tokens_used: data.usage?.total_tokens, // ✅ Captured from API
};
```

**Status:** Token usage is captured from Grok API responses but only stored for chat messages.

---

## 5. Cost Optimization Opportunities

### 5.1 Model Selection

**Current:**
- Chat/Replies: `grok-3-latest` ✅ (appropriate)
- Posts: `grok-4-latest` ⚠️ (premium model, may be overkill)

**Recommendation:**
- Consider using `grok-3-latest` for post generation to reduce costs by ~20-30%
- **Potential savings:** ~$0.001 per post = **$0.007/week per user**

### 5.2 Caching Strategy

**Current:** No caching implemented

**Opportunities:**
1. **Character Card Caching:**
   - Cache analysis results for 7-30 days
   - Only regenerate when tweets change significantly
   - **Potential savings:** 80-90% reduction in character card costs

2. **Response Caching:**
   - Cache similar chat responses (same question = same answer)
   - Cache post templates for similar topics
   - **Potential savings:** 10-20% reduction in chat/post costs

### 5.3 Prompt Optimization

**Current System Prompt Sizes:**
- Chat: ~1,500-2,500 tokens
- Twitter: ~1,500-2,000 tokens
- Post: ~800-1,200 tokens

**Optimization:**
- Reduce system prompt verbosity by 20-30%
- Use more concise personality descriptions
- **Potential savings:** ~$0.001-0.002 per request

### 5.4 Live Search Usage

**Current:** Auto-detected based on keywords

**Optimization:**
- Limit live search to truly time-sensitive queries
- Cache recent search results (5-10 minutes)
- **Potential savings:** 15-25% reduction in live search costs

### 5.5 Batch Processing

**Current:** Individual API calls per action

**Opportunity:**
- Batch multiple post generations in single request (if API supports)
- **Potential savings:** Minimal (Grok API doesn't support batching)

---

## 6. Recommendations

### 6.1 Immediate Actions

1. **Implement Token Tracking**
   - Add `tokens_used` field to all AI operations
   - Create `api_usage_log` table to track all Grok API calls
   - Build dashboard to monitor costs in real-time

2. **Cost Monitoring Dashboard**
   - Track costs per user, per feature, per day/week/month
   - Set up alerts for cost spikes
   - Display cost estimates to users (optional)

3. **Model Optimization**
   - Test `grok-3-latest` for post generation
   - Compare quality vs cost trade-off
   - Switch if quality is acceptable

### 6.2 Short-term (1-2 months)

1. **Character Card Caching**
   - Implement 7-day cache for character card analysis
   - Only regenerate when user requests or tweets change significantly
   - **Expected savings:** $0.09 per user per month

2. **Response Caching**
   - Cache frequently asked questions
   - Cache post templates for common topics
   - **Expected savings:** $0.05-0.10 per user per month

3. **Usage Analytics**
   - Track which features are most expensive
   - Identify power users and their cost patterns
   - Optimize based on actual usage data

### 6.3 Long-term (3-6 months)

1. **Multi-Model Strategy**
   - Use cheaper models for simple tasks
   - Reserve premium models for complex requests
   - Implement model routing based on query complexity

2. **Cost-Based Rate Limiting**
   - Implement cost-aware rate limits
   - Warn users approaching cost thresholds
   - Offer premium tiers for higher usage

3. **Alternative Providers**
   - Evaluate other LLM providers (OpenAI, Anthropic, etc.)
   - Implement provider fallback/rotation
   - Optimize for cost vs quality

---

## 7. Database Schema Recommendations

### 7.1 New Table: `api_usage_log`

```sql
CREATE TABLE api_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  feature TEXT NOT NULL, -- 'chat', 'twitter_reply', 'post_generation', 'character_card'
  model TEXT NOT NULL, -- 'grok-3-latest', 'grok-4-latest'
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost DECIMAL(10, 6), -- Cost in USD
  request_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_usage_user_date ON api_usage_log(user_id, created_at DESC);
CREATE INDEX idx_api_usage_feature ON api_usage_log(feature);
```

### 7.2 Cost Aggregation View

```sql
CREATE VIEW user_cost_summary AS
SELECT 
  user_id,
  DATE_TRUNC('month', created_at) as month,
  feature,
  COUNT(*) as request_count,
  SUM(total_tokens) as total_tokens,
  SUM(estimated_cost) as total_cost
FROM api_usage_log
GROUP BY user_id, DATE_TRUNC('month', created_at), feature;
```

---

## 8. Cost Monitoring Queries

### 8.1 Daily Cost by User

```sql
SELECT 
  user_id,
  DATE(created_at) as date,
  SUM(estimated_cost) as daily_cost,
  COUNT(*) as request_count
FROM api_usage_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id, DATE(created_at)
ORDER BY daily_cost DESC;
```

### 8.2 Cost by Feature

```sql
SELECT 
  feature,
  COUNT(*) as requests,
  SUM(total_tokens) as total_tokens,
  SUM(estimated_cost) as total_cost,
  AVG(estimated_cost) as avg_cost_per_request
FROM api_usage_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY feature
ORDER BY total_cost DESC;
```

### 8.3 Top Cost Users

```sql
SELECT 
  user_id,
  COUNT(*) as total_requests,
  SUM(total_tokens) as total_tokens,
  SUM(estimated_cost) as total_cost
FROM api_usage_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY total_cost DESC
LIMIT 20;
```

---

## 9. Summary

### 9.1 Current State

- **Average cost per user:** ~$1.82/month
- **Heavy user cost:** ~$5.29/month
- **Token tracking:** Partial (only chat messages)
- **Cost optimization:** Minimal (no caching, premium models used)

### 9.2 Estimated Monthly Costs

| User Count | Monthly Cost |
|------------|--------------|
| 10 users | $18.20 |
| 50 users | $91.00 |
| 100 users | $182.00 |
| 500 users | $910.00 |
| 1,000 users | $1,820.00 |

### 9.3 Optimization Potential

With recommended optimizations:
- **Character card caching:** -$0.09/user/month
- **Model optimization:** -$0.01/user/month
- **Response caching:** -$0.05/user/month
- **Total potential savings:** **~$0.15/user/month (8% reduction)**

**Optimized cost per user:** **~$1.67/month**

---

## 10. Applied Optimizations (January 2025)

### 10.1 Model Optimization - APPLIED

**Change:** Switched `generate-post` from `grok-4-latest` to `grok-3-latest`

**Files Modified:**
- `supabase/functions/generate-post/index.ts`

**Estimated Savings:** ~20-30% reduction in post generation costs (~$0.001 per post)

### 10.2 Prompt Optimization - APPLIED

**Changes:** Reduced verbose prompt sections across all LLM functions

**Files Modified:**
- `supabase/functions/generate-post/index.ts` - Reduced system prompt from ~800 tokens to ~200 tokens
- `supabase/functions/_shared/generateResponse.ts` - Optimized multiple prompt builders:
  - `buildAntiFormalityPrompt()`: ~300 tokens → ~25 tokens
  - `buildSentenceVarietyPrompt()`: ~200 tokens → ~20 tokens
  - `buildOpeningVarietyPrompt()`: ~250 tokens → ~30 tokens
  - `buildEmojiPrompt()`: ~150 tokens → ~30 tokens
  - `buildOpinionPrompt()`: ~200 tokens → ~20 tokens
  - `buildTangentPrompt()`: ~200 tokens → ~15 tokens
  - `buildMoodPrompt()`: ~100 tokens → ~15 tokens
  - Emoji mode prompts: ~150 tokens → ~25 tokens

**Total Prompt Reduction:** ~1,550 tokens → ~180 tokens per request (**~88% reduction**)

**Estimated Savings:**
- Chat messages: ~$0.004 saved per message (was $0.0075, now ~$0.0035)
- Twitter replies: ~$0.003 saved per reply (was $0.0072, now ~$0.0042)
- Post generation: ~$0.002 saved per post (was $0.0051, now ~$0.003)

### 10.3 Updated Cost Estimates

| Feature | Old Cost | New Cost | Savings |
|---------|----------|----------|---------|
| Chat Message | $0.0075 | $0.0035 | **53%** |
| Twitter Reply | $0.0072 | $0.0042 | **42%** |
| Post Generation | $0.0051 | $0.003 | **41%** |
| Character Card | $0.108 | $0.108 | 0% (unchanged) |

### 10.4 Updated Monthly Cost Per User

**Before Optimization:**
- Average user: ~$1.82/month
- Heavy user: ~$5.29/month

**After Optimization:**
- Average user: **~$0.88/month** (52% reduction)
- Heavy user: **~$2.56/month** (52% reduction)

### 10.5 Future Optimizations (Not Yet Applied)

1. ⬜ Implement `api_usage_log` table for cost tracking
2. ⬜ Build cost monitoring dashboard
3. ⬜ Character card caching (7-day TTL)
4. ⬜ Response caching for common queries

---

**Document Version:** 1.1  
**Last Updated:** January 2025  
**Changes:** Applied model and prompt optimizations  
**Next Review:** February 2025
