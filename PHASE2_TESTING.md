# Phase 2 Testing Guide

## ✅ All Tests Passed!

Your Phase 2 setup is complete:
- ✅ Character card loads successfully
- ✅ OpenRouter connection works
- ✅ Full integration test passed

## Next: Test with Real Conversations

### Step 1: Restart Your Bot

Stop any running bot processes and start fresh:

```bash
python main.py
```

### Step 2: Test AERIS Personality

Send these types of messages to your bot:

#### Test 1: Disaster Scenario
**You**: "I'm scared about the hurricane warning. What should I do?"

**Expected**: AERIS should respond with:
- Compassionate acknowledgment
- Clear, step-by-step guidance
- Safety-focused advice

#### Test 2: Panic/De-escalation
**You**: "I'm panicking. Everything is falling apart."

**Expected**: AERIS should:
- Validate your emotions
- Provide calming guidance
- Offer breathing exercises or grounding techniques

#### Test 3: General Question
**You**: "What's the latest news about the earthquake?"

**Expected**: AERIS should:
- Acknowledge the question
- Provide helpful information
- Ask about your safety

#### Test 4: Family Finder
**You**: "I need to find my family member. They're missing."

**Expected**: AERIS should:
- Show empathy
- Ask for details systematically
- Guide through the process

### Step 3: Observe Character Personality

Watch for:
- ✅ Compassionate tone
- ✅ Clear, actionable guidance
- ✅ Safety prioritization
- ✅ Trauma-informed language
- ✅ Step-by-step instructions

### Step 4: Check Logs

Monitor the terminal for:
- Character card loading: "Loaded character card: AERIS"
- LLM requests: "Sending request to OpenRouter"
- Responses: Check if responses match AERIS personality

## Troubleshooting

**Bot still using echo mode?**
- Check logs for "LLM components not available"
- Verify OPENROUTER_API_KEY is set correctly
- Make sure character card exists at `characters/aeris.character.json`

**Responses don't match personality?**
- Character card may need refinement
- Check system prompt in logs
- Adjust character card JSON if needed

**Slow responses?**
- Normal for LLM processing (1-3 seconds)
- Free models may be slower
- Consider upgrading to paid model for faster responses

## Character Card Refinement

If responses don't match desired personality, you can edit:
- `characters/aeris.character.json`
- Adjust `bio`, `style`, or `messageExamples`
- Restart bot to reload changes

## Ready to Test!

Start your bot and try the test scenarios above!

