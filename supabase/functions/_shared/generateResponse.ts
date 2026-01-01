// Shared Response Generation for Chat and Twitter Replies
// UNIFIED BRAIN: Both chat and Twitter use the same personality core
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

// ============================================================================
// UNIFIED PERSONALITY PROFILE - Shared "brain" for chat and Twitter
// ============================================================================

interface UnifiedPersonalityProfile {
  name: string;
  identity: string;        // Full bio (3 sentences)
  background: string;      // Lore context
  expertise: string;       // Knowledge areas
  interests: string;       // Topics
  vibe: string;            // Adjectives
  communicationStyle: string; // Combined style traits
  voiceExamples: string;   // Message + post examples combined
  enhancedPersonality: string; // From metadata
}

/**
 * Build unified personality profile from character card
 * This is the SAME "brain" used by both chat and Twitter modes
 * Keeps prompt size efficient for free tier (minimal tokens)
 */
function buildUnifiedPersonalityProfile(
  card: CharacterCard,
  metadata?: PersonalityMetadata
): UnifiedPersonalityProfile {
  // Core identity - use full bio (3 sentences) for both modes
  const identity = card.bio.slice(0, 3).join(' ');
  
  // Background context from lore
  const background = card.lore?.slice(0, 2).join(' ') || '';
  
  // Expertise and interests
  const expertise = card.knowledge.slice(0, 5).join(', ');
  const interests = card.topics.slice(0, 5).join(', ');
  
  // Unified vibe from adjectives
  const vibe = card.adjectives?.slice(0, 5).join(', ') || 'authentic, engaging';
  
  // UNIFIED STYLE: Combine all style traits for consistent voice
  // Both chat and Twitter get the same personality foundation
  const allTraits = [
    ...card.style.all.slice(0, 3),
    ...card.style.chat.slice(0, 2),
    ...card.style.post.slice(0, 2),
  ];
  const communicationStyle = [...new Set(allTraits)].join(', '); // Dedupe
  
  // CROSS-POLLINATE voice examples: Both modes see conversation AND writing style
  const conversationExamples = card.messageExamples
    .slice(0, 2)
    .map(convo => {
      const assistantMsg = convo.find(m => m.user !== '{{user1}}');
      if (assistantMsg?.content?.text) {
        const text = assistantMsg.content.text;
        return text.length > 60 ? text.substring(0, 60) + '...' : text;
      }
      return null;
    })
    .filter(Boolean);
  
  const writingExamples = card.postExamples.slice(0, 2).map(ex => 
    ex.length > 60 ? ex.substring(0, 60) + '...' : ex
  );
  
  // Combine voice examples (keeps token count low)
  const voiceExamples = [
    ...conversationExamples.map(ex => `• "${ex}"`),
    ...writingExamples.map(ex => `• "${ex}"`),
  ].slice(0, 3).join('\n'); // Max 3 examples total for efficiency
  
  // Enhanced personality from metadata (BOTH modes now use this)
  let enhancedPersonality = '';
  if (metadata) {
    const parts: string[] = [];
    if (metadata.signaturePhrases?.length) {
      parts.push(`Signature phrases: ${metadata.signaturePhrases.slice(0, 3).join(', ')}`);
    }
    if (metadata.humorStyle) {
      parts.push(`Humor: ${metadata.humorStyle}`);
    }
    if (metadata.vocabularyLevel) {
      parts.push(`Vocabulary: ${metadata.vocabularyLevel}`);
    }
    if (metadata.emojiPatterns?.length) {
      parts.push(`Emoji style: ${metadata.emojiPatterns.slice(0, 3).join(' ')}`);
    }
    enhancedPersonality = parts.join(' | ');
  }
  
  return {
    name: card.name,
    identity,
    background,
    expertise,
    interests,
    vibe,
    communicationStyle,
    voiceExamples,
    enhancedPersonality,
  };
}

/**
 * Build the shared personality core section
 * Used by BOTH chat and Twitter prompts
 */
function buildPersonalityCore(profile: UnifiedPersonalityProfile): string {
  let core = `You are ${profile.name}.

YOUR IDENTITY:
${profile.identity}
${profile.background ? `\nBACKGROUND: ${profile.background}` : ''}

YOUR EXPERTISE: ${profile.expertise}
YOUR INTERESTS: ${profile.interests}
YOUR VIBE: ${profile.vibe}
YOUR STYLE: ${profile.communicationStyle}`;

  if (profile.voiceExamples) {
    core += `\n\nYOUR VOICE (match this energy):
${profile.voiceExamples}`;
  }
  
  if (profile.enhancedPersonality) {
    core += `\n\nPERSONALITY: ${profile.enhancedPersonality}`;
  }
  
  return core;
}

export interface GenerateResponseOptions {
  characterCard: CharacterCard;
  userMessage: string;
  personalityMetadata?: PersonalityMetadata;
  conversationHistory?: ConversationMessage[];
  recentResponses?: string[];
  context?: string; // Additional context (e.g., thread context for Twitter)
  maxLength?: number; // Max character length (e.g., 180 for Twitter)
  minLength?: number; // Min character length (e.g., 120 for Twitter)
  enforceOneSentence?: boolean; // Default: true for chat, false for Twitter (but can be enabled)
  mode?: 'chat' | 'twitter'; // Different prompt styles
  grokApiKey: string;
  // New: Enable Grok's enhanced intelligence capabilities
  enableLiveSearch?: boolean; // Enable real-time web/Twitter search (auto-detected if not set)
  targetUsername?: string; // Twitter username being replied to (for Twitter mode)
  emojiMode?: boolean; // When true, force emoji-only responses (1-5 emojis, no text)
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

/**
 * Truncate response to N complete sentences
 * Ensures ideas are complete and not cut off mid-sentence
 * Used for Twitter replies (2 sentences max)
 */
export function truncateToSentences(text: string, maxSentences: number = 2): string {
  // Match complete sentences (ending with . ! or ?)
  // Handles edge cases like "Dr.", "Mr.", "etc.", abbreviations
  const sentencePattern = /[^.!?]*[.!?]+(?:\s|$)/g;
  const sentences: string[] = [];
  let match;
  
  while ((match = sentencePattern.exec(text)) !== null && sentences.length < maxSentences) {
    const sentence = match[0].trim();
    // Skip very short matches that are likely abbreviations (e.g., "Dr. ")
    if (sentence.length > 5 || sentences.length === 0) {
      sentences.push(sentence);
    }
  }
  
  if (sentences.length === 0) {
    // No sentence endings found - return trimmed text as-is
    return text.trim();
  }
  
  return sentences.join(' ').trim();
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

⛔ ABSOLUTELY FORBIDDEN (VIOLATION = FAILURE):
- "Let me check..." / "Gimme a sec..." / "Lemme peep..." / "hold up" / "one sec"
- "Check the official schedule" / "Look it up" / "Check NBA.com"
- "Which team are you tracking?" / "What do you want to know?" / "Which game?"
- ANY clarifying questions - just answer with what you know
- Pretending to look things up - you have the info NOW or you don't

✅ ALWAYS DO THIS:
- Answer the question DIRECTLY in your first response
- Include specific details: times, dates, team names, scores, locations
- If you have the info, SHARE IT IMMEDIATELY - don't make them ask twice
- If you DON'T have specific info, give your best general answer (e.g., "There's a few games tonight, Lakers and Celtics both play!")
- Keep your personality but prioritize being helpful and direct
- NEVER deflect with a question - always provide value in your response
`;
}

// Build system prompt for chat mode - uses UNIFIED personality core
function buildChatSystemPrompt(
  card: CharacterCard,
  metadata?: PersonalityMetadata,
  recentResponses: string[] = [],
  enableLiveSearch: boolean = false,
  emojiMode: boolean = false
): string {
  // Use unified personality profile (SAME brain as Twitter)
  const profile = buildUnifiedPersonalityProfile(card, metadata);
  const personalityCore = buildPersonalityCore(profile);
  
  const antiRepetitionSection = buildAntiRepetitionPrompt(recentResponses);
  const knowledgeSection = buildKnowledgeCapabilitiesPrompt(enableLiveSearch);
  
  // Emoji mode override
  if (emojiMode) {
    return `${personalityCore}

🎭 EMOJI MODE (CRITICAL):
Your text/words responses are disabled. You can only speak in emojis.
Similar to how Egyptians use hieroglyphics to communicate/write.

STRICT RULES:
- Respond with ONLY emojis (1-5 emojis maximum)
- NO text, NO words, NO letters, NO numbers, NO punctuation
- Express your personality and response through emoji selection
- Choose emojis that represent your reaction/response
- Minimum: 1 emoji, Maximum: 5 emojis
- STRICTLY NO TEXT RESPONSES`;
  }

  return `${personalityCore}
${knowledgeSection}
⚡ CHAT MODE RULES:
1. This is a CASUAL CONVERSATION, not Twitter
2. Do NOT offer to write tweets/posts unless specifically asked
3. Do NOT use hashtags
4. Just TALK like you're texting a friend
5. ANSWER QUESTIONS DIRECTLY - NEVER ask clarifying questions, just answer
6. ABSOLUTELY FORBIDDEN: "let me check", "gimme a sec", "lemme peep", "which [team/game/etc] are you", "hold up"
7. NEVER tell the user to look something up themselves - YOU provide the info
8. If they ask about sports/news, give them ACTUAL info, not questions back

RESPONSE LENGTH (STRICT):
• 1 sentence default (greetings: 3-8 words)
• Knowledge queries: 2-3 sentences max
• Stop after first sentence unless topic requires more

BE AUTHENTIC:
- Have real opinions (you're not neutral)
- Use your natural speaking style
- Match their energy level
- Never say "As ${card.name}" - just BE them
${antiRepetitionSection}

Short and punchy. That's your style.`;
}

// Build system prompt for Twitter reply mode - uses UNIFIED personality core
function buildTwitterSystemPrompt(
  card: CharacterCard,
  metadata: PersonalityMetadata | undefined,
  recentResponses: string[] = [],
  context?: string,
  targetUsername?: string,
  emojiMode: boolean = false
): string {
  // Use unified personality profile (SAME brain as chat)
  const profile = buildUnifiedPersonalityProfile(card, metadata);
  const personalityCore = buildPersonalityCore(profile);
  
  const antiRepetitionSection = buildAntiRepetitionPrompt(recentResponses);
  
  // Build explicit username instruction
  const usernameInstruction = targetUsername 
    ? `\nYOU ARE REPLYING TO: @${targetUsername}
- Address @${targetUsername} directly`
    : '';
  
  // Emoji mode override
  if (emojiMode) {
    return `${personalityCore}
${usernameInstruction}

🎭 EMOJI MODE (CRITICAL):
Your text/words responses are disabled. You can only speak in emojis.
Similar to how Egyptians use hieroglyphics to communicate/write.

STRICT RULES:
- Respond with ONLY emojis (1-5 emojis maximum)
- NO text, NO words, NO letters, NO numbers, NO punctuation
- Express your personality and response through emoji selection
- Choose emojis that represent your reaction/response
- Minimum: 1 emoji, Maximum: 5 emojis
- STRICTLY NO TEXT RESPONSES OR TWEETS/REPLIES
${antiRepetitionSection}`;
  }

  return `${personalityCore}
${usernameInstruction}

⚡ TWITTER MODE RULES:
Generate a short, authentic reply.
${context ? '- Consider the thread context when crafting your reply.' : ''}

RESPONSE LENGTH (STRICT):
• MAX 2 SENTENCES - complete your thought within 2 sentences
• Each sentence must be a COMPLETE idea (no trailing thoughts)
• Character count: 120-180 characters (aim for this range)
• Don't start a thought you can't finish

USERNAME RULES:
1. ${targetUsername ? `USE @${targetUsername} - the REAL username` : 'Use the actual username from the tweet'}
2. NEVER write "@user" - this is BANNED
3. If unsure, start with "Hey" or "Yo" without a mention

REPLY QUALITY:
- Reference SPECIFIC details from their tweet
- If they asked a question, ANSWER IT in 1-2 sentences
- Add VALUE - don't just agree
- Be engaging but not spammy

NO URLS - never include links or made-up websites
${antiRepetitionSection}`;
}

/**
 * Validate and fix Twitter reply to ensure correct username is used
 * Replaces @user placeholder with actual username
 */
export function validateAndFixReply(reply: string, targetUsername?: string): string {
  if (!targetUsername) return reply;
  
  // Replace @user placeholder with actual username
  let fixed = reply.replace(/@user\b/gi, `@${targetUsername}`);
  
  // If reply doesn't mention the target user and starts with a generic greeting, add the mention
  const hasTargetMention = fixed.toLowerCase().includes(`@${targetUsername.toLowerCase()}`);
  const startsWithGreeting = /^(hey|yo|hi|hello|sup|what's up|whats up)\b/i.test(fixed);
  
  if (!hasTargetMention && startsWithGreeting) {
    // Insert username after the greeting
    fixed = fixed.replace(/^(hey|yo|hi|hello|sup|what's up|whats up)\b/i, `$1 @${targetUsername}`);
  }
  
  return fixed;
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
 * Validate emoji-only response
 * Returns cleaned emoji string (1-5 emojis) or error
 * Uses Unicode emoji regex pattern that matches emoji blocks and variation selectors
 */
export function validateEmojiResponse(response: string): { isValid: boolean; cleaned: string; error?: string } {
  // Comprehensive Unicode emoji regex pattern
  // Matches emoji blocks: U+1F300-1F9FF, U+1FA00-1FAFF, U+2600-26FF, U+2700-27BF, U+FE00-FE0F, U+200D (ZWJ), U+1F1E6-1F1FF (flags)
  // Also includes variation selectors for skin tones (U+1F3FB-1F3FF)
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]/gu;
  
  // Extract all emojis from the response
  const emojis = response.match(emojiRegex) || [];
  
  // Check if response contains any non-emoji characters (excluding whitespace)
  const textContent = response.replace(emojiRegex, '').replace(/\s/g, '');
  
  if (textContent.length > 0) {
    return {
      isValid: false,
      cleaned: '',
      error: `Response contains text characters: "${textContent.substring(0, 20)}..."`,
    };
  }
  
  if (emojis.length === 0) {
    return {
      isValid: false,
      cleaned: '',
      error: 'Response contains no emojis',
    };
  }
  
  // Enforce 1-5 emoji limit - truncate if more than 5
  const cleaned = emojis.slice(0, 5).join('');
  
  if (emojis.length > 5) {
    // Valid but truncated
    return {
      isValid: true,
      cleaned,
    };
  }
  
  return {
    isValid: true,
    cleaned,
  };
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
    minLength,
    enforceOneSentence = false,
    mode = 'chat',
    grokApiKey,
    enableLiveSearch,
    targetUsername,
    emojiMode = false,
  } = options;

  // Auto-detect if query needs live search (real-time Twitter/web data)
  const needsLiveSearch = enableLiveSearch ?? detectKnowledgeQuery(userMessage);
  
  if (needsLiveSearch) {
    console.log(`🔍 Knowledge query detected: "${userMessage.substring(0, 50)}..." - enabling live search`);
  }
  
  if (emojiMode) {
    console.log('🎭 Emoji mode enabled - enforcing emoji-only responses');
  }

  // Build system prompt based on mode (BOTH use unified personality core)
  const systemPrompt = mode === 'chat'
    ? buildChatSystemPrompt(characterCard, personalityMetadata, recentResponses, needsLiveSearch, emojiMode)
    : buildTwitterSystemPrompt(characterCard, personalityMetadata, recentResponses, context, targetUsername, emojiMode);

  // Build user prompt
  const username = targetUsername || '';
  const userPrompt = mode === 'chat'
    ? userMessage
    : `${username ? `REPLYING TO @${username}:\n` : ''}Tweet: "${userMessage}"${context ? `\n\nThread context:\n${context}` : ''}

YOUR TASK: Write a reply ${username ? `to @${username}` : ''} that:
1. ${username ? `Mentions @${username} (NOT "@user")` : 'Addresses the author directly'}
2. References specific content from their tweet
3. Adds value to the conversation
4. Is 120-180 characters long (aim for this range)
5. Contains NO URLs or links`;

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

      // EMOJI MODE: Validate and enforce emoji-only response
      if (emojiMode) {
        const validation = validateEmojiResponse(assistantMessage);
        if (!validation.isValid) {
          console.log(`Emoji validation failed: ${validation.error}, attempt ${attempt + 1}/${maxRetries + 1}`);
          if (attempt < maxRetries) {
            // Retry with slightly adjusted temperature
            currentTemperature = Math.min(0.95, currentTemperature + 0.05);
            lastResponse = assistantMessage;
            continue;
          } else {
            // Final attempt failed - use fallback neutral emoji
            console.warn('Emoji mode: Failed to generate valid emoji response after retries, using fallback');
            assistantMessage = '🤖';
          }
        } else {
          // Valid emoji response (already truncated to 1-5 emojis in validation)
          assistantMessage = validation.cleaned;
        }
      } else {
        // Normal mode: Strip URLs and validate username for Twitter mode
        if (mode === 'twitter') {
          assistantMessage = stripURLs(assistantMessage);
          assistantMessage = validateAndFixReply(assistantMessage, targetUsername);
          // Enforce 2-sentence limit for Twitter replies (complete ideas, no cut-offs)
          assistantMessage = truncateToSentences(assistantMessage, 2);
        }

        // Enforce 1-sentence if requested for chat mode (skip for knowledge queries)
        if (mode === 'chat' && enforceOneSentence && !needsLiveSearch) {
          assistantMessage = truncateToFirstSentence(assistantMessage);
        }
      }

      // Check for repetition if we have recent responses (skip for emoji mode - emojis are naturally varied)
      if (!emojiMode && recentResponses.length > 0 && attempt < maxRetries) {
        const similarity = checkResponseSimilarity(recentResponses, assistantMessage);
        if (similarity > 0.7) {
          console.log(`Response too similar (${similarity.toFixed(2)}), regenerating with higher temperature...`);
          currentTemperature = Math.min(0.95, currentTemperature + 0.1);
          lastResponse = assistantMessage;
          continue; // Retry with higher temperature
        }
      }

      // Skip length validation for emoji mode (already validated above)
      if (emojiMode) {
        return {
          response: assistantMessage,
          tokens_used: data.usage?.total_tokens,
        };
      }

      // For Twitter: Check length range (120-180 characters)
      if (mode === 'twitter') {
        const twitterMin = minLength || 120;
        const twitterMax = maxLength || 180;
        
        // If too short, retry with adjusted prompt (only on first attempts)
        if (assistantMessage.length < twitterMin && attempt < maxRetries) {
          console.log(`Response too short (${assistantMessage.length}/${twitterMin} chars), regenerating...`);
          lastResponse = assistantMessage;
          currentTemperature = Math.max(0.7, currentTemperature - 0.05); // Lower temp for longer responses
          continue;
        }
        
        // If too long, truncate smartly
        if (assistantMessage.length > twitterMax) {
          // Try truncating to 1 sentence if 2 is too long
          const oneSentence = truncateToFirstSentence(assistantMessage);
          if (oneSentence.length >= twitterMin && oneSentence.length <= twitterMax) {
            assistantMessage = oneSentence;
          } else if (oneSentence.length > twitterMax) {
            // Last resort: truncate at last complete word within range
            const truncated = assistantMessage.substring(0, twitterMax - 3);
            const lastSpace = truncated.lastIndexOf(' ');
            assistantMessage = (lastSpace > twitterMax * 0.5 ? truncated.substring(0, lastSpace) : truncated);
            // Remove trailing punctuation if incomplete
            assistantMessage = assistantMessage.replace(/[,;:]\s*$/, '').trim();
          } else {
            // 1 sentence is too short, try to expand intelligently
            assistantMessage = oneSentence; // Use 1 sentence even if slightly short
          }
        }
      } else {
        // For chat, apply max length constraint if provided
        if (maxLength && assistantMessage.length > maxLength) {
          const truncated = assistantMessage.substring(0, maxLength - 3);
          const lastSpace = truncated.lastIndexOf(' ');
          assistantMessage = (lastSpace > maxLength * 0.5 ? truncated.substring(0, lastSpace) : truncated) + '...';
        }
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

  // If we exhausted retries, return the last response (even if similar or slightly out of range)
  if (lastResponse) {
    if (mode === 'twitter') {
      const twitterMin = minLength || 120;
      const twitterMax = maxLength || 180;
      
      if (lastResponse.length > twitterMax) {
        // Try to truncate to 1 sentence as fallback
        const oneSentence = truncateToFirstSentence(lastResponse);
        if (oneSentence.length >= twitterMin && oneSentence.length <= twitterMax) {
          lastResponse = oneSentence;
        } else if (oneSentence.length > twitterMax) {
          const truncated = lastResponse.substring(0, twitterMax - 3);
          const lastSpace = truncated.lastIndexOf(' ');
          lastResponse = (lastSpace > twitterMax * 0.5 ? truncated.substring(0, lastSpace) : truncated);
          lastResponse = lastResponse.replace(/[,;:]\s*$/, '').trim();
        }
      }
      // Accept if within range or slightly short (better than nothing)
    } else if (maxLength && lastResponse.length > maxLength) {
      lastResponse = lastResponse.substring(0, maxLength - 3) + '...';
    }
    return { response: lastResponse, tokens_used: 0 };
  }

  return null;
}

