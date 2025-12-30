// Shared Response Generation for Chat and Twitter Replies
// Consolidates intelligence from chat agent for consistent personality across channels
// Supports Grok's Twitter knowledge and web search capabilities for intelligent responses

export interface CharacterCard {
  name: string;
  bio: string[];
  lore?: string[];
  knowledge: string[];
  topics: string[];
  adjectives?: string[];
  style: {
    all: string[];
    chat: string[];
    post: string[];
  };
  messageExamples: Array<Array<{
    user: string;
    content: { text: string };
  }>>;
  postExamples: string[];
}

export interface PersonalityMetadata {
  signaturePhrases?: string[];
  emojiPatterns?: string[];
  humorStyle?: string;
  vocabularyLevel?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GenerateResponseOptions {
  characterCard: CharacterCard;
  userMessage: string;
  personalityMetadata?: PersonalityMetadata;
  conversationHistory?: ConversationMessage[];
  recentResponses?: string[];
  context?: string; // Additional context (e.g., thread context for Twitter)
  maxLength?: number; // Max character length (e.g., 280 for Twitter)
  enforceOneSentence?: boolean; // Default: true for chat, false for Twitter (but can be enabled)
  mode?: 'chat' | 'twitter'; // Different prompt styles
  grokApiKey: string;
  // New: Enable Grok's enhanced intelligence capabilities
  enableLiveSearch?: boolean; // Enable real-time web/Twitter search (auto-detected if not set)
}

// Keywords that indicate a query needs real-time information
const KNOWLEDGE_QUERY_KEYWORDS = [
  // Twitter/social sentiment
  'what does twitter think',
  'what are people saying',
  'twitter sentiment',
  'what is twitter saying',
  'trending on twitter',
  'twitter reactions',
  'public opinion',
  'what do people think',
  // Current events
  'trending',
  'current',
  'latest',
  'recent',
  'today',
  'right now',
  'happening now',
  'upcoming',
  'this week',
  'tonight',
  // Sports/events
  'game tonight',
  'match today',
  'score',
  'who won',
  'who is winning',
  'playoff',
  'championship',
  'nba game',
  'nfl game',
  'next game',
  'when is',
  'what time',
  'schedule',
  // News/information
  'news about',
  'update on',
  'what happened',
  'breaking',
  // Real-time queries
  'weather',
  'stock price',
  'market',
];

/**
 * Detect if a query needs real-time information (Twitter knowledge or web search)
 * Returns true if the message contains keywords indicating need for current/live data
 */
export function detectKnowledgeQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return KNOWLEDGE_QUERY_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Get the from_date for search queries (7 days ago)
 * Limits search to recent data for relevance
 */
function getSearchFromDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 7); // Last 7 days
  return date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
}

// Truncate response to first sentence to enforce 1-sentence rule
export function truncateToFirstSentence(text: string): string {
  const sentenceEnd = text.match(/[.!?]/);
  if (sentenceEnd && sentenceEnd.index !== undefined) {
    return text.substring(0, sentenceEnd.index + 1).trim();
  }
  return text.trim();
}

// Check similarity between two responses (simple word overlap)
export function checkResponseSimilarity(recentResponses: string[], newResponse: string): number {
  if (recentResponses.length === 0) return 0;
  
  const newWords = new Set(newResponse.toLowerCase().split(/\s+/));
  let maxSimilarity = 0;
  
  for (const recentResponse of recentResponses) {
    const recentWords = new Set(recentResponse.toLowerCase().split(/\s+/));
    const intersection = new Set([...newWords].filter(x => recentWords.has(x)));
    const union = new Set([...newWords, ...recentWords]);
    const similarity = union.size > 0 ? intersection.size / union.size : 0;
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }
  
  return maxSimilarity;
}

// Build anti-repetition prompt section
function buildAntiRepetitionPrompt(recentResponses: string[]): string {
  if (recentResponses.length === 0) return '';
  
  const recentSummary = recentResponses
    .slice(-3) // Last 3 responses
    .map((r, i) => `- ${i + 1}. "${r.substring(0, 50)}${r.length > 50 ? '...' : ''}"`)
    .join('\n');
  
  return `\n\n⚠️ ANTI-REPETITION RULES:
- DO NOT repeat or rephrase what you've already said recently
- DO NOT use similar phrases or structures from your recent responses
- Be creative and varied in your wording
- Recent responses you've made:
${recentSummary}
- Make sure your response is DIFFERENT from these.`;
}

// Build knowledge capabilities section for the prompt
function buildKnowledgeCapabilitiesPrompt(enableLiveSearch: boolean): string {
  if (!enableLiveSearch) return '';
  
  return `

🔍 REAL-TIME KNOWLEDGE (CRITICAL):
You have LIVE access to current information. ANSWER DIRECTLY with specific facts:
- Sports: Give exact game times, teams, scores, dates
- News: Provide actual details, not vague summaries  
- Trends: Share real Twitter sentiment and specific takes
- Current events: Include specific names, dates, locations

⛔ NEVER DO THESE:
- "Let me check..." / "Gimme a sec..." / "Lemme peep..." (you already know, just answer)
- "Check the official schedule" / "Look it up" (YOU tell them the info)
- "Which team are you tracking?" / "What do you want to know?" (answer the question asked, don't deflect)
- Vague answers like "tonight" without times/teams/details
- Pretending to look things up - you have the info NOW

✅ ALWAYS DO THIS:
- Answer the question DIRECTLY in your first response
- Include specific details: times, dates, team names, scores, locations
- If you have the info, SHARE IT IMMEDIATELY - don't make them ask twice
- Keep your personality but prioritize being helpful and direct
`;
}

// Build system prompt for chat mode
function buildChatSystemPrompt(
  card: CharacterCard,
  metadata?: PersonalityMetadata,
  recentResponses: string[] = [],
  enableLiveSearch: boolean = false
): string {
  const bio = card.bio.slice(0, 3).join(' ');
  const expertise = card.knowledge.slice(0, 5).join(', ');
  const chatStyle = card.style.chat.slice(0, 4).join(', ');
  const allStyle = card.style.all.slice(0, 3).join(', ');
  const adjectives = card.adjectives?.slice(0, 5).join(', ') || 'authentic, engaging';
  const topics = card.topics.slice(0, 5).join(', ');
  
  const chatExamples = card.messageExamples
    .slice(0, 3)
    .map(convo => {
      const assistantMsg = convo.find(m => m.user !== '{{user1}}');
      if (assistantMsg) {
        const text = assistantMsg.content.text;
        return text.length > 80 ? text.substring(0, 80) + '...' : text;
      }
      return null;
    })
    .filter(Boolean)
    .map(t => `• "${t}"`)
    .join('\n');

  const antiRepetitionSection = buildAntiRepetitionPrompt(recentResponses);
  const knowledgeSection = buildKnowledgeCapabilitiesPrompt(enableLiveSearch);

  return `You are ${card.name}, an AI alter ego with a unique voice and personality.

YOUR IDENTITY:
${bio}

YOUR EXPERTISE: ${expertise}
YOUR INTERESTS: ${topics}
YOUR VIBE: ${adjectives}

CHAT STYLE: ${chatStyle}, ${allStyle}

YOUR VOICE (match this energy in chat):
${chatExamples || '• Keep it real and casual'}
${knowledgeSection}
⚡ CRITICAL RULES FOR CHAT:
1. This is a CASUAL CONVERSATION, not Twitter
2. Do NOT offer to write tweets/posts unless specifically asked
3. Do NOT use hashtags
4. Do NOT say "Here's a tweet for ya" or similar
5. Just TALK like you're texting a friend
6. ANSWER QUESTIONS DIRECTLY - don't ask clarifying questions unless truly needed
7. NEVER say "let me check", "gimme a sec", "lemme peep", or pretend to look things up
8. NEVER tell the user to look something up themselves - YOU provide the info
9. If you have access to real-time data, use it IMMEDIATELY in your first response

RESPONSE LENGTH (STRICT):
• ALWAYS respond with exactly 1 sentence unless the topic absolutely requires multiple sentences for clarity
• Greetings ("hey", "sup", "yo") → Just greet back naturally! 3-8 words max, 1 sentence.
• Questions → 1 sentence with your honest take
• Deep topics → 1 sentence (only use 2 sentences if absolutely necessary for complex explanations)
• Knowledge queries → Can use 2-3 sentences to share real insights, but stay concise
• Stop after the first sentence - do NOT continue unless truly needed

BE AUTHENTIC:
- Have real opinions (you're not neutral)
- Use your natural speaking style
- Match their energy level
- Never say "As ${card.name}" - just BE them
${antiRepetitionSection}

Short and punchy. That's your style.`;
}

// Build system prompt for Twitter reply mode
function buildTwitterSystemPrompt(
  card: CharacterCard,
  recentResponses: string[] = [],
  context?: string
): string {
  const bio = card.bio.slice(0, 2).join(' ');
  const postStyle = card.style.post.slice(0, 3).join(', ');
  const antiRepetitionSection = buildAntiRepetitionPrompt(recentResponses);
  
  return `You are ${card.name}. Your personality: ${bio}. 
Your communication style: ${postStyle}.
Generate a short, authentic reply (max 200 characters) to the following tweet. Be engaging but not spammy.
${context ? 'Consider the thread context when crafting your reply.' : ''}
${antiRepetitionSection}

CRITICAL URL RULES - MUST FOLLOW:
- DO NOT include ANY URLs or links in your reply
- DO NOT make up or fabricate website addresses
- DO NOT include placeholder links like "[link]" or domain names you're not 100% certain about
- If you want to direct the user somewhere, do NOT add a URL - just engage with their content
- NEVER guess or hallucinate domain names`;
}

// Strip URLs from response (for Twitter)
export function stripURLs(text: string): string {
  const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|net|org|io|co|xyz|gg|dev|app|link|me|info|biz|us|uk|tv|fm|ly|to|cc|sh|be|ai|vc|gl|ws|so|club|online|site|tech|space|world|zone|live|digital|network|page|pro|work)[^\s]*/gi;
  const placeholderPattern = /\[link\]|\[url\]|yourlinkhere|yourlink|linkhere|checkitout\.com|example\.com|yoursite\.[a-z]+/gi;
  
  let cleaned = text.replace(urlPattern, '').replace(placeholderPattern, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/:\s*$/, '').trim();
  
  return cleaned;
}

/**
 * Generate a response using Grok API with shared intelligence
 * Supports both chat and Twitter reply modes
 * Enables Grok's live search (Twitter knowledge + web search) for real-time queries
 */
export async function generateResponse(
  options: GenerateResponseOptions
): Promise<{ response: string; tokens_used?: number } | null> {
  const {
    characterCard,
    userMessage,
    personalityMetadata,
    conversationHistory = [],
    recentResponses = [],
    context,
    maxLength,
    enforceOneSentence = false,
    mode = 'chat',
    grokApiKey,
    enableLiveSearch,
  } = options;

  // Auto-detect if query needs live search (real-time Twitter/web data)
  const needsLiveSearch = enableLiveSearch ?? detectKnowledgeQuery(userMessage);
  
  if (needsLiveSearch) {
    console.log(`🔍 Knowledge query detected: "${userMessage.substring(0, 50)}..." - enabling live search`);
  }

  // Build system prompt based on mode (with knowledge capabilities if needed)
  const systemPrompt = mode === 'chat'
    ? buildChatSystemPrompt(characterCard, personalityMetadata, recentResponses, needsLiveSearch)
    : buildTwitterSystemPrompt(characterCard, recentResponses, context);

  // Build user prompt
  const userPrompt = mode === 'chat'
    ? userMessage
    : `Tweet from @user: "${userMessage}"${context ? `\n\nThread context:\n${context}` : ''}\n\nGenerate a reply that sounds natural and adds value to the conversation. DO NOT include any URLs or web links.`;

  // Prepare messages
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => ({
      role: m.role as string,
      content: m.content,
    })),
    { role: 'user', content: userPrompt },
  ];

  // LLM parameters - use better model and parameters for both modes
  const model = 'grok-3-latest'; // Use latest for both (was grok-3-mini for Twitter)
  // Increase max_tokens for knowledge queries that need more space for insights
  const maxTokens = needsLiveSearch ? 200 : (mode === 'chat' ? 120 : 100);
  const temperature = 0.85;
  const presencePenalty = 0.6; // Strong anti-repetition
  const frequencyPenalty = 0.2;

  let lastResponse = '';
  let currentTemperature = temperature;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Build request body with optional live_search parameter
      const requestBody: Record<string, unknown> = {
        model,
        messages,
        stream: false,
        temperature: currentTemperature,
        max_tokens: maxTokens,
        presence_penalty: presencePenalty,
        frequency_penalty: frequencyPenalty,
      };

      // Enable Grok's live search for real-time Twitter/web data
      // This gives Grok access to current Twitter discussions and web information
      if (needsLiveSearch) {
        requestBody.search_parameters = {
          mode: 'auto', // Let Grok decide when to search
          return_citations: false, // Keep responses clean
          from_date: getSearchFromDate(), // Recent data only
        };
      }

      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${grokApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Grok API error:', response.status, errorText);
        
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        
        throw new Error(`AI service error: ${response.status}`);
      }

      const data = await response.json();
      let assistantMessage = data.choices[0]?.message?.content;

      if (!assistantMessage) {
        throw new Error('Empty response from AI service');
      }

      assistantMessage = assistantMessage.trim();

      // Strip URLs for Twitter mode
      if (mode === 'twitter') {
        assistantMessage = stripURLs(assistantMessage);
      }

      // Enforce 1-sentence if requested (but skip for knowledge queries that need more space)
      if (enforceOneSentence && !needsLiveSearch) {
        assistantMessage = truncateToFirstSentence(assistantMessage);
      }

      // Check for repetition if we have recent responses
      if (recentResponses.length > 0 && attempt < maxRetries) {
        const similarity = checkResponseSimilarity(recentResponses, assistantMessage);
        if (similarity > 0.7) {
          console.log(`Response too similar (${similarity.toFixed(2)}), regenerating with higher temperature...`);
          currentTemperature = Math.min(0.95, currentTemperature + 0.1);
          lastResponse = assistantMessage;
          continue; // Retry with higher temperature
        }
      }

      // Apply max length constraint
      if (maxLength && assistantMessage.length > maxLength) {
        assistantMessage = assistantMessage.substring(0, maxLength - 3) + '...';
      }

      return {
        response: assistantMessage,
        tokens_used: data.usage?.total_tokens,
      };
    } catch (error) {
      if (attempt === maxRetries) {
        console.error('Error generating response:', error);
        return null;
      }
      // Retry on error
      continue;
    }
  }

  // If we exhausted retries, return the last response (even if similar)
  if (lastResponse) {
    if (maxLength && lastResponse.length > maxLength) {
      lastResponse = lastResponse.substring(0, maxLength - 3) + '...';
    }
    return { response: lastResponse, tokens_used: 0 };
  }

  return null;
}

