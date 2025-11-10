# Aeris Chat API Setup Guide

## Overview

The `/api/llm/chat` endpoint is now fully integrated with your Aeris LLM system, including:
- ✅ Character personality (Aeris character card)
- ✅ RAG knowledge base integration
- ✅ OpenAI API integration
- ✅ Bearer token authentication

## API Endpoint

**URL**: `POST /api/llm/chat`

**Base URL**: 
- Production: `https://aeris.vercel.app/api/llm/chat` (or your Vercel domain)
- Local: `http://localhost:3000/api/llm/chat` (if running Vercel dev)

## Request Format

```json
{
  "messages": [
    {"role": "user", "content": "Hello!"},
    {"role": "assistant", "content": "Hi there!"}
  ]
}
```

**Headers**:
```
Content-Type: application/json
Authorization: Bearer {LLM_API_KEY}
```

## Response Format

```json
{
  "message": "AI response here",
  "content": "AI response here",  // Alternative field name
  "response": "AI response here"  // Alternative field name
}
```

## Status Codes

- `200` - Success
- `400` - Bad request (invalid JSON, missing fields, etc.)
- `401` - Unauthorized (missing or invalid API key)
- `405` - Method not allowed (must be POST)
- `500` - Server error

## Environment Variables

Add to your Vercel project settings (or `.env.local` for local development):

```bash
LLM_API_KEY=your_secret_key_here
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini  # Optional, defaults to gpt-4o-mini
```

### Setting Environment Variables in Vercel

1. Go to your Vercel project: https://vercel.com/agent-aeris-projects/aeris
2. Navigate to **Settings** → **Environment Variables**
3. Add:
   - `LLM_API_KEY` = your secret key (e.g., generate a random string)
   - `OPENAI_API_KEY` = your OpenAI API key
   - `OPENAI_MODEL` = `gpt-4o-mini` (optional)

## Frontend Configuration

In your frontend `.env.local`:

```bash
NEXT_PUBLIC_LLM_API_URL=https://aeris.vercel.app/api/llm/chat
LLM_API_KEY=your_secret_key_here  # Same as backend
```

## Testing

### Using cURL

```bash
curl -X POST https://aeris.vercel.app/api/llm/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_secret_key" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello! What can you help me with?"}
    ]
  }'
```

### Using JavaScript/TypeScript

```typescript
const response = await fetch('https://aeris.vercel.app/api/llm/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.LLM_API_KEY}`
  },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Hello! What can you help me with?' }
    ]
  })
});

const data = await response.json();
console.log(data.message); // AI response
```

### Using Python

```python
import requests

url = "https://aeris.vercel.app/api/llm/chat"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer your_secret_key"
}
data = {
    "messages": [
        {"role": "user", "content": "Hello! What can you help me with?"}
    ]
}

response = requests.post(url, json=data, headers=headers)
result = response.json()
print(result["message"])
```

## Features

### Character Personality
- Uses Aeris character card (`characters/aeris.character.json`)
- Maintains warm, personal, emergency-focused personality
- Includes character bio and style guidelines

### RAG Knowledge Base
- Automatically retrieves relevant knowledge base chunks
- Injects context into system prompt
- Supports weather queries, disaster protocols, etc.

### Error Handling
- Comprehensive request validation
- Detailed error messages
- Proper HTTP status codes
- Logging for debugging

## Deployment

1. **Commit and push** your changes:
   ```bash
   git add api/llm/chat.py env.example
   git commit -m "Add Aeris Chat API endpoint"
   git push
   ```

2. **Vercel will auto-deploy** (since GitHub is connected)

3. **Set environment variables** in Vercel dashboard

4. **Test the endpoint** using the examples above

## Troubleshooting

### 401 Unauthorized
- Check that `LLM_API_KEY` is set in Vercel environment variables
- Verify the Authorization header format: `Bearer {key}`
- Ensure no extra spaces in the token

### 500 Internal Server Error
- Check Vercel function logs in dashboard
- Verify `OPENAI_API_KEY` is set
- Ensure character card file exists at `characters/aeris.character.json`
- Check that all dependencies are in `requirements.txt`

### Character Card Not Found
- Verify file exists: `characters/aeris.character.json`
- Check file path resolution (should work automatically)

### No Response from LLM
- Check OpenAI API key is valid
- Verify OpenAI account has credits
- Check Vercel function timeout (set to 60s in `vercel.json`)

## Next Steps

- [ ] Set `LLM_API_KEY` in Vercel environment variables
- [ ] Test the endpoint with a simple request
- [ ] Connect your frontend to the endpoint
- [ ] Monitor Vercel logs for any issues

## Support

Check Vercel function logs:
1. Go to Vercel dashboard
2. Select your project
3. Navigate to **Logs** tab
4. Filter by function: `api/llm/chat`

