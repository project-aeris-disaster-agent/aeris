# Agent Diversity Testing Guide

## Overview
This document explains how to test that different agents generate diverse replies to the same tweet, avoiding "AI slop" where all agents sound the same.

## Changes Made

### 1. **Per-Agent Reply Archetypes**
Each agent now gets assigned a unique reply archetype based on their character card:
- **Analytical**: Data-driven, fact-focused (70-150 chars)
- **Conversational**: Friendly, engaging (90-180 chars)  
- **Contrarian**: Challenges assumptions (80-170 chars)
- **Storyteller**: Narrative-driven (100-200 chars)
- **Punchy**: Short, impactful (70-130 chars)

### 2. **Seeded Length Variability**
Response length is now seeded per agent, so different agents naturally use different sentence counts (1-3 sentences) even for the same tweet.

### 3. **Flexible Length Constraints**
Changed from rigid 120-180 character range to flexible 70-220 character range based on archetype.

### 4. **Suggested Angle Integration**
The reply decision gate's suggested angle is now passed to the generation function, giving each agent a unique perspective.

## Testing Methods

### Method 1: Edge Function Test (Recommended)

1. **Deploy the test function:**
   ```bash
   supabase functions deploy test-agent-diversity
   ```

2. **Call the function:**
   ```bash
   # Using curl (Linux/Mac)
   curl -X POST \
     "https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/test-agent-diversity" \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json"
   
   # Or use the PowerShell script (Windows)
   .\scripts\test-diversity-curl.ps1
   ```

3. **Expected Output:**
   - 5 different replies from 5 different agents
   - Average similarity < 30% = EXCELLENT
   - Average similarity < 50% = GOOD
   - Average similarity > 50% = NEEDS_IMPROVEMENT

### Method 2: Local Testing with Supabase CLI

1. **Start Supabase locally:**
   ```bash
   supabase start
   ```

2. **Serve functions locally:**
   ```bash
   supabase functions serve test-agent-diversity
   ```

3. **Call the local function:**
   ```bash
   curl -X POST \
     "http://localhost:54321/functions/v1/test-agent-diversity" \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json"
   ```

### Method 3: Manual Testing via Agent Actions

1. Set up multiple test accounts with different character cards
2. Configure agent mode to reply to the same target account
3. Wait for replies to be generated
4. Compare the replies - they should be noticeably different

## Test Tweet Used

The test uses this tweet from @lordsedano:
```
Had an 8 hour vibecoding session this morning with @shawmakesmagic and I feel like a freshly spawned alien 👽

On a side note I think Opus and GPT should fight to the death inside @hyperscapeai

Watch the stream 👇
```

## Expected Results

### Good Diversity Indicators:
- ✅ Different sentence structures (1 vs 2 vs 3 sentences)
- ✅ Different character lengths (70-220 range)
- ✅ Different opening styles (questions vs statements vs reactions)
- ✅ Different perspectives (analytical vs conversational vs contrarian)
- ✅ Different vocabulary and phrasing

### Bad Diversity Indicators (AI Slop):
- ❌ All replies are 2 sentences
- ❌ All replies are 120-180 characters
- ❌ Similar opening phrases ("Yo @user", "Hey @user")
- ❌ Same structure: greeting + fact + reaction
- ❌ High word overlap (>50% similarity)

## Verification Checklist

- [ ] Test function deploys successfully
- [ ] All 5 agents generate replies
- [ ] Replies have different lengths
- [ ] Replies have different structures
- [ ] Average similarity < 50%
- [ ] No banned phrases ("vibe", "fire", "energy", "chaos")
- [ ] Each reply references specific content from the tweet
- [ ] Replies feel authentic to each agent's personality

## Troubleshooting

### All replies are similar
- Check that character cards have distinct personalities
- Verify archetype selection is working (check logs)
- Ensure advanced settings are different per agent

### Replies are too short/long
- Check minLength/maxLength parameters
- Verify archetype character ranges
- Check if truncation is working correctly

### Function fails to deploy
- Ensure GROK_API_KEY is set in Supabase secrets
- Check function syntax with `supabase functions lint`
- Verify imports are correct

## Next Steps

If diversity is still low:
1. Increase temperature variance between agents
2. Add more archetype-specific guidance
3. Implement cross-agent anti-repetition
4. Add per-agent style seeds to force different patterns
