# RAG External Reference Fix - Applied & Tested

## Problem Identified

The agent was referring users to PAGASA website instead of using RAG knowledge base, violating the emergency response principle of providing immediate, direct answers.

## Root Causes

1. **Weak RAG Instructions**: "Use this information..." was too permissive
2. **No External Reference Prohibition**: Missing explicit "NEVER refer to external websites" instruction
3. **Character Card Conflict**: "be honest about what you know" encouraged hedging
4. **Generic Query Mismatch**: "when will storm leave" doesn't match "forecast track" terminology well

## Fixes Applied

### 1. ✅ Strengthened RAG Instructions (`llm/prompt_builder.py`)
- Changed from suggestion to **mandatory requirement**
- Added 8-point critical instruction list
- Explicitly prohibits external website references
- Emphasizes emergency response context

### 2. ✅ Added External Reference Prohibition (`llm/prompt_builder.py`)
- Final instructions now check if RAG was injected
- If RAG exists: STRONG prohibition against external references
- If no RAG: Standard instruction

### 3. ✅ Updated Character Card (`characters/aeris.character.json`)
- Modified "be honest" instruction to: "be honest...but when you have information from your knowledge base, use it confidently and directly without referring users elsewhere"

### 4. ✅ Increased Weather Query Retrieval (`llm/prompt_builder.py`)
- Detects weather/storm queries automatically
- Retrieves 5 chunks instead of 3 for weather queries
- Increases content preview to 1000 chars (from 800) for forecast tracks

### 5. ✅ Added Response Validation (`bot/message_handler.py`)
- Monitors responses for external references
- Logs critical violations when LLM ignores RAG
- Detects phrases like "check PAGASA", "visit website", etc.

## Test Results

✅ **RAG Retrieval**: Working correctly
- Generic query retrieves 3-5 chunks
- Specific queries ("forecast track", "120 hour") retrieve better matches
- Weather queries automatically get 5 chunks

✅ **Prompt Building**: Working correctly
- RAG context injected successfully
- Critical instructions present
- External reference prohibition present

⚠️ **Query Matching**: 
- Generic queries ("when will storm leave") may not match forecast terminology perfectly
- More specific queries work better
- **Solution**: Stronger instructions force LLM to extract what it can from retrieved chunks

## Expected Behavior After Fixes

1. **When RAG is available**: LLM MUST use it, NEVER refer to external sources
2. **When RAG doesn't have exact answer**: LLM should say what it CAN tell from the information
3. **Emergency context**: Emphasized that users need immediate answers, not referrals

## Monitoring

The system now logs:
- ✅ When RAG is injected
- ⚠️ When RAG is missing (may need better retrieval)
- ❌ When LLM ignores RAG and refers to external sources (critical violation)

## Next Steps

1. **Test with actual bot conversation** - verify LLM follows instructions
2. **Monitor logs** - watch for external reference violations
3. **Query improvement** (optional) - could add query expansion/rewriting for better matching

## Files Modified

- `llm/prompt_builder.py` - Strengthened RAG instructions, added prohibition
- `characters/aeris.character.json` - Updated character instruction
- `bot/message_handler.py` - Added validation and monitoring

