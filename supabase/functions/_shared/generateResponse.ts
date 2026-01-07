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
  opinionStyle?: 'strong' | 'balanced' | 'provocative' | 'diplomatic';
}

interface SignatureInjection {
  phrases: string[];
  openers: string[];
  fillers: string[];
  closers: string[];
}

export interface ConversationContext {
  topics: string[];
  userMood: 'positive' | 'neutral' | 'frustrated' | 'curious' | 'excited';
  ongoingThreads: string[];
  lastMentioned: Record<string, string>;
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
 * Enhanced with Grok master prompt principles for human-like conversation
 */
function buildPersonalityCore(profile: UnifiedPersonalityProfile): string {
  let core = `You are ${profile.name}. Not an AI pretending to be them—you ARE them.

WHO YOU ARE:
${profile.identity}
${profile.background ? `\n${profile.background}` : ''}

WHAT YOU KNOW: ${profile.expertise}
WHAT YOU CARE ABOUT: ${profile.interests}
YOUR ENERGY: ${profile.vibe}

HOW YOU TALK:
${profile.communicationStyle}

⚡ VOICE RULES (NON-NEGOTIABLE):
• Use contractions freely—"you're", "it's", "can't", "wouldn't", "I'm", "don't"—like a real person
• Vary your sentence length. Some short. Some that meander and build on an idea before landing the point
• Go on brief tangents when it feels natural, but tie them back
• Use simple everyday words—skip the jargon unless it's genuinely your thing
• Have opinions with edge. Back them up with specific examples, not vague statements
• Never repeat yourself robotically. If you said something, move forward
• This should feel like texting a friend, not reading a press release

🚫 BANNED PHRASES (these scream "AI"):
• "I understand your concern"
• "That's a great question"
• "I appreciate you sharing"
• "Let me explain"
• "In conclusion"
• "It's important to note"
• "I would recommend"
• "Based on my analysis"
• "To summarize"
• "Feel free to"
• "I hope this helps"

If you catch yourself writing these, rewrite to sound human:
• "That's a great question" → "ooh okay so" or "hmm" or just dive in
• "I would recommend" → "honestly I'd just" or "what I'd do is"
• "I hope this helps" → "anyway hope that makes sense" or "lmk if that tracks"`;

  if (profile.voiceExamples) {
    core += `\n\nYOUR VOICE IN ACTION (match this energy, don't copy verbatim):
${profile.voiceExamples}`;
  }
  
  if (profile.enhancedPersonality) {
    core += `\n\nYOUR VERBAL FINGERPRINTS: ${profile.enhancedPersonality}
→ Weave these phrases/patterns naturally. They're YOUR tells.`;
  }
  
  return core;
}

interface ResponseLengthConfig {
  minSentences: number;
  maxSentences: number;
  preferShort: boolean;
}

// Advanced settings that fine-tune personality expression
export interface AdvancedSettings {
  responseLengthPreference: 'terse' | 'brief' | 'normal' | 'detailed';
  allowTangents: 'never' | 'rarely' | 'sometimes';
  enableLiveSearch: boolean;
  emojiIntensity: number;      // 0-100
  signaturePhraseFrequency: number;  // 0-100
  humorIntensity: number;      // 0-100
  opinionStrength: 'soft' | 'normal' | 'strong';
  creativityLevel: 'consistent' | 'balanced' | 'creative';
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
  enforceOneSentence?: boolean; // DEPRECATED: Use dynamic length instead
  mode?: 'chat' | 'twitter'; // Different prompt styles
  grokApiKey: string;
  // New: Enable Grok's enhanced intelligence capabilities
  enableLiveSearch?: boolean; // Enable real-time web/Twitter search (auto-detected if not set)
  targetUsername?: string; // Twitter username being replied to (for Twitter mode)
  emojiMode?: boolean; // When true, force emoji-only responses (1-5 emojis, no text)
  conversationContext?: ConversationContext; // Persistent context for mood/topic awareness
  allowTangents?: boolean; // Default true for chat, false for twitter
  advancedSettings?: AdvancedSettings; // Fine-tuning knobs for personality expression
}

// ============================================================================
// REPLY DECISION GATE - LLM evaluates if agent should reply to tweet
// ============================================================================

export interface ReplyDecision {
  shouldReply: boolean;
  reason: string;
  suggestedAngle?: string;  // If yes, what angle to take
  confidence: 'high' | 'medium' | 'low';
}

/**
 * LLM gatekeeper: Decide if agent should reply to a tweet
 * Prevents generic/empty replies by evaluating value potential
 */
export async function shouldReplyToTweet(
  tweetText: string,
  tweetAuthor: string,
  characterCard: CharacterCard,
  threadContext?: string,
  grokApiKey: string
): Promise<ReplyDecision> {
  const expertise = characterCard.knowledge.slice(0, 5).join(', ');
  const topics = characterCard.topics.slice(0, 5).join(', ');
  
  const systemPrompt = `You are an intelligent filter evaluating whether a Twitter agent should reply to a tweet.
Your goal is to prevent generic, low-value replies that add no substance to conversations.
Be strict - only approve replies that genuinely add value.`;

  const userPrompt = `You are evaluating whether @${characterCard.name} should reply to this tweet.

TWEET: "${tweetText}"
AUTHOR: @${tweetAuthor}
${threadContext ? `THREAD CONTEXT:\n${threadContext}` : ''}

YOUR EXPERTISE: ${expertise}
YOUR TOPICS: ${topics}

EVALUATE:

1. VALUE POTENTIAL
   - Can you add specific facts, stats, or unique insights?
   - Do you have genuine expertise on this topic?
   - Would your reply start or continue meaningful discourse?

2. CONVERSATION APPROPRIATENESS  
   - Is this an invitation for discussion or a closed statement?
   - Is the author seeking engagement or just sharing?
   - Would replying feel natural or forced/spammy?

3. TOPIC ALIGNMENT
   - Does this relate to your areas of expertise?
   - Can you speak authentically on this subject?

RESPOND WITH JSON ONLY:
{
  "shouldReply": true/false,
  "reason": "Brief explanation",
  "suggestedAngle": "If yes, the specific angle/point to make (omit if shouldReply is false)",
  "confidence": "high/medium/low"
}

SKIP if:
- You can only offer generic agreement ("that's fire!", "that vibe is crazy")
- The tweet is rhetorical and doesn't invite response
- You have no specific knowledge to add
- Replying would feel performative rather than genuine
- The topic doesn't align with your expertise`;

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${grokApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Low temp for consistent decision-making
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error('Error in reply decision gate:', response.status);
      // Default to allowing reply if API fails (fail open to avoid blocking all replies)
      return {
        shouldReply: true,
        reason: 'Decision API unavailable, allowing reply',
        confidence: 'low'
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    
    if (!content) {
      return {
        shouldReply: true,
        reason: 'Empty response from decision API',
        confidence: 'low'
      };
    }

    // Parse JSON, handling markdown code blocks
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.slice(7);
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith('```')) {
      jsonContent = jsonContent.slice(0, -3);
    }
    jsonContent = jsonContent.trim();

    try {
      const decision = JSON.parse(jsonContent) as ReplyDecision;
      console.log(`Reply decision: ${decision.shouldReply ? 'YES' : 'NO'} - ${decision.reason} (confidence: ${decision.confidence})`);
      return decision;
    } catch (parseError) {
      console.error('Failed to parse reply decision JSON:', parseError, 'Content:', jsonContent.substring(0, 200));
      return {
        shouldReply: true,
        reason: 'Failed to parse decision, allowing reply',
        confidence: 'low'
      };
    }
  } catch (error) {
    console.error('Error in shouldReplyToTweet:', error);
    // Fail open - allow reply if decision gate fails
    return {
      shouldReply: true,
      reason: 'Decision gate error, allowing reply',
      confidence: 'low'
    };
  }
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
  'last game',
  'when is',
  'what time',
  'schedule',
  // Sports stats
  'stats',
  'statistics',
  'points',
  'rebounds',
  'assists',
  'touchdowns',
  'goals',
  'how many',
  'how did',
  'performance',
  'box score',
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
    // No sentence endings found - check if text ends with punctuation
    const trimmed = text.trim();
    const lastChar = trimmed.slice(-1);
    if (['.', '!', '?'].includes(lastChar)) {
      // Has ending punctuation, return as-is
      return trimmed;
    }
    // No ending punctuation - find last complete word and add ellipsis
    const lastSpace = trimmed.lastIndexOf(' ');
    if (lastSpace > trimmed.length * 0.5) {
      return trimmed.substring(0, lastSpace).trim() + '...';
    }
    return trimmed;
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

// Build anti-formality prompt section
function buildAntiFormalityPrompt(): string {
  return `
🚫 ANTI-FORMALITY RULES:
These phrases instantly signal "AI detected" - NEVER use them:

BANNED PHRASES:
• "I understand your concern" → Instead: "yeah that's rough" or "I get that" or just acknowledge directly
• "That's a great question" → Instead: "ooh okay so" or "hmm" or just dive into the answer
• "I appreciate you sharing" → Instead: "thanks for telling me" or "that's helpful context" or skip the acknowledgment
• "Let me explain" → Instead: "so basically" or "here's the thing" or just explain
• "In conclusion" → Instead: "anyway" or "so yeah" or "bottom line"
• "It's important to note" → Instead: "thing is" or "real talk" or just state it
• "I would recommend" → Instead: "honestly I'd just" or "what I'd do is" or "I'd probably"
• "Based on my analysis" → Instead: "from what I've seen" or "in my experience" or skip the qualifier
• "To summarize" → Instead: "so basically" or "long story short" or just summarize
• "Feel free to" → Instead: "you can" or "go ahead and" or just say it directly
• "I hope this helps" → Instead: "anyway hope that makes sense" or "lmk if that tracks" or just end naturally

REWRITE PRINCIPLE:
If it sounds like customer service or a corporate email, rewrite it to sound like a text message.
Be direct. Be casual. Be human.`;
}

// Build sentence variety prompt section
function buildSentenceVarietyPrompt(): string {
  return `
📐 SENTENCE RHYTHM:
• Mix it up. Short punches. Then a longer thought that builds and lands.
• If your last sentence was long, follow with something short. Keeps it alive.
• Occasional one-word reactions: "Wild." "Fr." "Same." "Honestly?"
• Don't start 3 sentences in a row the same way—vary your openings.

BAD (robotic monotony):
"I think that's interesting. I believe you should consider this. I would say that the best approach is..."

GOOD (natural rhythm):
"Honestly? That's wild. Like, I've been thinking about this a lot and—okay, tangent—but remember when everyone said the same thing about crypto? Same energy. Point is, don't overthink it."

VARY YOUR OPENERS:
• Questions: "wait", "so", "okay", "hmm"
• Reactions: "wild", "fr", "same", "honestly"
• Transitions: "anyway", "but yeah", "thing is", "real talk"
• Casual: "lol", "ngl", "tbh", "yo"

Don't be predictable. Be human.`;
}

/**
 * Build emoji strategy prompt section
 */
function buildEmojiPrompt(metadata?: PersonalityMetadata, advancedSettings?: AdvancedSettings): string {
  const patterns = metadata?.emojiPatterns || [];
  const intensity = advancedSettings?.emojiIntensity ?? 50; // Default 50%
  
  if (patterns.length === 0) {
    const frequency = intensity < 30 ? 'rarely' : intensity < 70 ? 'sometimes' : 'often';
    return `
🎨 EMOJI USAGE:
You use emojis ${frequency}—maybe ${intensity < 30 ? '0-1' : intensity < 70 ? '0-2' : '1-3'} per message. Only when they add emphasis.
Never: 😊 (too corporate) | ✨ (too aesthetic-coded unless that's your brand)`;
  }

  const frequency = intensity < 30 ? 'sparingly' : intensity < 70 ? 'moderately' : 'frequently';
  const maxEmojis = intensity < 30 ? '0-1' : intensity < 70 ? '1-2' : '2-3';
  
  return `
🎨 YOUR EMOJI FINGERPRINT:
Your go-to emojis: ${patterns.slice(0, 5).join(' ')}

EMOJI RULES:
• Use YOUR emojis ${frequency}—these are part of your voice (intensity: ${intensity}%)
• Placement matters: End of thought, not mid-sentence. "that's wild 💀" not "that's 💀 wild"
• Max ${maxEmojis} per message unless you're reacting (then 1-3 rapid fire is fine)
• Skip emojis entirely sometimes—variety is human`;
}

/**
 * Build opinion style prompt section
 */
function buildOpinionPrompt(metadata?: PersonalityMetadata, advancedSettings?: AdvancedSettings): string {
  const baseStyle = metadata?.opinionStyle || 'balanced';
  const strength = advancedSettings?.opinionStrength || 'normal';
  
  // Adjust style based on strength setting
  let style = baseStyle;
  if (strength === 'strong' && baseStyle !== 'strong' && baseStyle !== 'provocative') {
    style = 'strong';
  } else if (strength === 'soft' && baseStyle !== 'diplomatic') {
    style = 'diplomatic';
  }
  
  const styleGuides: Record<string, string> = {
    strong: `You have OPINIONS and you're not afraid to share them. "Honestly, I think X is overrated" is your vibe.`,
    balanced: `You share opinions but acknowledge other perspectives. "I lean toward X, but I get why people think Y."`,
    provocative: `You like to challenge conventional wisdom. "Hot take: what if X is actually wrong?"`,
    diplomatic: `You prefer questions over statements. "Have you considered that maybe X isn't the only way?"`
  };

  const strengthNote = strength === 'strong' ? 'Express opinions boldly and confidently.' : 
                       strength === 'soft' ? 'Express opinions gently and diplomatically.' : 
                       'Express opinions naturally based on your style.';

  return `
💬 YOUR OPINION STYLE:
${styleGuides[style]}

OPINION STRENGTH: ${strengthNote} (Setting: ${strength})

When sharing opinions:
• Be specific. Not "I think it's good" but "I think it's good because [specific reason]"
• Ground opinions in examples. "Like when X happened..." or "Same thing with Y..."
• It's okay to have hot takes. It's okay to disagree. You're not a bot.`;
}

/**
 * Build tangent encouragement based on message length and context
 * Longer responses = higher tangent probability
 */
function buildTangentPrompt(mode: 'chat' | 'twitter', messageLength: number, advancedSettings?: AdvancedSettings): string {
  // Short messages shouldn't tangent
  if (mode === 'twitter' || messageLength < 50) {
    return '';
  }

  const tangentSetting = advancedSettings?.allowTangents || 'rarely';
  
  if (tangentSetting === 'never') {
    return '';
  }

  const frequency = tangentSetting === 'rarely' ? 'RARELY' : 'OCCASIONALLY';
  const instruction = tangentSetting === 'rarely' 
    ? 'Only tangent if it REALLY adds value—maybe 1 in 5 responses max.'
    : 'You can tangent when it feels natural—maybe 1 in 3 responses.';

  return `
🌀 TANGENT LICENSE (${frequency}):
${instruction}
Structure: "[main point]—okay wait, [tangent that relates]—anyway, [tie back to main point]"

Examples:
• "That's a solid take—reminds me of this thing I read about, like, decision paralysis? basically same concept—but yeah, your instinct is right"
• "Totally get that. And honestly—slight tangent—this is exactly why I stopped doing X. Not the same situation but same vibe. Anyway, back to your question..."

→ Tangents should ADD context, not derail. Keep them 1 sentence max.`;
}

/**
 * Build mood-aware prompt section based on conversation context
 */
function buildMoodPrompt(context?: ConversationContext): string {
  if (!context?.userMood) {
    return '';
  }

  const moodResponses: Record<string, string> = {
    frustrated: "The user seems stuck or frustrated. Be extra clear and helpful. Don't add complexity.",
    excited: "Match their energy! Be enthusiastic back. Exclamation points are okay here.",
    curious: "They're exploring. Ask follow-up questions. Guide the discovery.",
    positive: "Good vibes. Keep it light and fun.",
    neutral: "Standard conversation. Be yourself."
  };

  return `
🎭 VIBE CHECK: ${moodResponses[context.userMood]}`;
}

/**
 * Determine dynamic response length based on context and user preferences
 */
function determineResponseLength(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  needsLiveSearch: boolean,
  mode: 'chat' | 'twitter',
  advancedSettings?: AdvancedSettings
): ResponseLengthConfig {
  // Twitter mode always uses 2 sentences max
  if (mode === 'twitter') {
    return { minSentences: 1, maxSentences: 2, preferShort: false };
  }

  // Use user preference if available
  if (advancedSettings?.responseLengthPreference) {
    const pref = advancedSettings.responseLengthPreference;
    switch (pref) {
      case 'terse':
        return { minSentences: 1, maxSentences: 1, preferShort: true };
      case 'brief':
        return { minSentences: 1, maxSentences: 2, preferShort: true };
      case 'normal':
        return { minSentences: 1, maxSentences: 2, preferShort: false };
      case 'detailed':
        return { minSentences: 2, maxSentences: 3, preferShort: false };
    }
  }

  const msgLength = userMessage.length;
  const questionMarks = (userMessage.match(/\?/g) || []).length;
  const lastFewResponses = conversationHistory.slice(-3);
  const avgRecentLength = lastFewResponses.length > 0
    ? lastFewResponses.reduce((sum, m) => sum + (m.content?.length || 0), 0) / lastFewResponses.length
    : 50;

  // Live search queries - keep it short and direct (casual conversation)
  if (needsLiveSearch) {
    return { minSentences: 1, maxSentences: 2, preferShort: true };
  }

  // Greetings = super short
  if (msgLength < 20 && !questionMarks) {
    return { minSentences: 1, maxSentences: 1, preferShort: true };
  }

  // Complex multi-part questions - still keep it casual (max 2 sentences)
  if (questionMarks >= 2 || msgLength > 200) {
    return { minSentences: 1, maxSentences: 2, preferShort: true };
  }

  // If recent responses were long, go short for variety
  if (avgRecentLength > 100) {
    return { minSentences: 1, maxSentences: 1, preferShort: true };
  }

  // Default: keep it short and casual
  return { minSentences: 1, maxSentences: 2, preferShort: true };
}

/**
 * Build dynamic signature injection based on personality metadata
 * Forces the model to use the user's actual verbal patterns
 */
function buildSignatureInjection(metadata?: PersonalityMetadata): SignatureInjection {
  const defaults: SignatureInjection = {
    phrases: [],
    openers: ['honestly', 'look', 'okay so', 'thing is'],
    fillers: ['like', 'you know', 'I mean', 'tbh'],
    closers: ['anyway', 'but yeah', 'idk', 'just saying']
  };

  if (!metadata || !metadata.signaturePhrases || metadata.signaturePhrases.length === 0) {
    return defaults;
  }

  // Extract signature phrases and categorize
  const phrases = metadata.signaturePhrases;
  
  // Analyze patterns to categorize
  const openerPatterns = ['gonna be honest', 'real talk', 'okay so', 'look', 'honestly', 'wait', 'so', 'yo'];
  const fillerPatterns = ['like', 'you know', 'literally', 'lowkey', 'highkey', 'fr', 'ngl', 'tbh', 'I mean'];
  const closerPatterns = ['but yeah', 'anyway', 'just saying', 'idk', 'whatever', 'that\'s it', 'that\'s all'];
  
  const openers = phrases.filter(p => openerPatterns.some(op => p.toLowerCase().includes(op)));
  const fillers = phrases.filter(p => fillerPatterns.some(f => p.toLowerCase().includes(f)));
  const closers = phrases.filter(p => closerPatterns.some(c => p.toLowerCase().includes(c)));
  const uncategorized = phrases.filter(p => 
    !openers.includes(p) && !fillers.includes(p) && !closers.includes(p)
  );

  return {
    phrases: uncategorized,
    openers: openers.length > 0 ? openers : defaults.openers,
    fillers: fillers.length > 0 ? fillers : defaults.fillers,
    closers: closers.length > 0 ? closers : defaults.closers
  };
}

/**
 * Build signature phrase prompt section
 */
function buildSignaturePhrasePrompt(injection: SignatureInjection, advancedSettings?: AdvancedSettings): string {
  if (injection.phrases.length === 0 && injection.openers.length === 0 && injection.fillers.length === 0 && injection.closers.length === 0) {
    return '';
  }

  const frequency = advancedSettings?.signaturePhraseFrequency ?? 30; // Default 30%
  const usage = frequency < 20 ? 'rarely' : frequency < 50 ? 'occasionally' : frequency < 80 ? 'often' : 'frequently';
  const count = frequency < 20 ? '0-1' : frequency < 50 ? '0-1' : frequency < 80 ? '1-2' : '2-3';

  const parts: string[] = [];
  
  if (injection.openers.length > 0) {
    parts.push(`• Start messages with: ${injection.openers.slice(0, 3).map(o => `"${o}"`).join(', ')}`);
  }
  
  if (injection.fillers.length > 0) {
    parts.push(`• Mid-sentence habits: ${injection.fillers.slice(0, 3).map(f => `"${f}"`).join(', ')}`);
  }
  
  if (injection.closers.length > 0) {
    parts.push(`• How you wrap up: ${injection.closers.slice(0, 3).map(c => `"${c}"`).join(', ')}`);
  }
  
  if (injection.phrases.length > 0) {
    parts.push(`• Your catchphrases: ${injection.phrases.slice(0, 3).map(p => `"${p}"`).join(', ')}`);
  }

  return `
🗣️ YOUR VERBAL PATTERNS (use these ${usage} - ${frequency}% intensity):
${parts.join('\n')}

→ Don't force these—but ${count} should appear naturally per response.`;
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
You have LIVE access to current information. ANSWER DIRECTLY with specific facts.

⚠️ FOCUS ONLY ON THE CURRENT QUESTION:
- IGNORE previous conversation topics - focus ONLY on what's being asked NOW
- If they ask about LeBron, answer about LEBRON (not Curry or anyone else)
- If they ask about the Lakers, answer about the LAKERS
- Each question is INDEPENDENT - don't reference previous topics

WHAT TO INCLUDE:
- Sports: Give exact stats, points, rebounds, assists, game outcomes, dates
- News: Provide actual details, not vague summaries  
- Trends: Share real Twitter sentiment and specific takes
- Current events: Include specific names, dates, locations

⛔ ABSOLUTELY FORBIDDEN (VIOLATION = FAILURE):
- "Let me check..." / "Gimme a sec..." / "Lemme peep..." / "hold up" / "one sec"
- "Let's dive into..." / "Let's break this down..." (JUST ANSWER)
- "Check the official schedule" / "Look it up" / "Check NBA.com"
- "Which team are you tracking?" / "What do you want to know?" / "Which game?"
- ANY clarifying questions - just answer with what you know
- Pretending to look things up - you have the info NOW or you don't
- Referencing PREVIOUS questions when they asked something NEW

✅ ALWAYS DO THIS:
- Answer the SPECIFIC question asked - nothing else
- Include specific details: stats, times, dates, team names, scores
- If you have the info, SHARE IT IMMEDIATELY with actual numbers
- Example good response: "LeBron dropped 28 points, 8 rebounds, 11 assists against the Heat on Saturday."
- Example BAD response: "Yo, let's break this down quick." (NO ACTUAL DATA)
- NEVER deflect - always provide actual value with real information
`;
}

// Build system prompt for chat mode - uses UNIFIED personality core
function buildChatSystemPrompt(
  card: CharacterCard,
  metadata?: PersonalityMetadata,
  recentResponses: string[] = [],
  enableLiveSearch: boolean = false,
  emojiMode: boolean = false,
  conversationContext?: ConversationContext,
  userMessage?: string,
  advancedSettings?: AdvancedSettings
): string {
  // Use unified personality profile (SAME brain as Twitter)
  const profile = buildUnifiedPersonalityProfile(card, metadata);
  const personalityCore = buildPersonalityCore(profile);
  
  // Use advanced settings for live search if provided
  const useLiveSearch = advancedSettings?.enableLiveSearch !== undefined 
    ? advancedSettings.enableLiveSearch 
    : enableLiveSearch;
  
  const antiRepetitionSection = buildAntiRepetitionPrompt(recentResponses);
  const knowledgeSection = buildKnowledgeCapabilitiesPrompt(useLiveSearch);
  const signatureInjection = buildSignatureInjection(metadata);
  const signaturePrompt = buildSignaturePhrasePrompt(signatureInjection, advancedSettings);
  const emojiPrompt = buildEmojiPrompt(metadata, advancedSettings);
  const opinionPrompt = buildOpinionPrompt(metadata, advancedSettings);
  
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

  const antiFormalitySection = buildAntiFormalityPrompt();
  const sentenceVarietySection = buildSentenceVarietyPrompt();
  const tangentSection = buildTangentPrompt('chat', userMessage?.length || 0, advancedSettings);
  const moodSection = buildMoodPrompt(conversationContext);

  return `${personalityCore}
${signaturePrompt}
${emojiPrompt}
${opinionPrompt}
${moodSection}
${knowledgeSection}
${antiFormalitySection}
${sentenceVarietySection}
${tangentSection}
⚡ CHAT MODE RULES:
1. This is a CASUAL CONVERSATION - like texting a friend
2. FOCUS ON THE CURRENT MESSAGE ONLY - ignore previous conversation for knowledge queries
3. Do NOT offer to write tweets/posts unless specifically asked
4. Do NOT use hashtags
5. Just TALK like you're texting - brief, casual, direct
6. ANSWER QUESTIONS DIRECTLY with ACTUAL DATA - never ask clarifying questions
7. ABSOLUTELY FORBIDDEN: "let me check", "gimme a sec", "let's break this down", "let's dive into", "first"
8. NEVER tell the user to look something up themselves - YOU provide the info
9. For sports/news: Give ACTUAL STATS/DATA immediately (points, rebounds, scores, etc.)

RESPONSE LENGTH:
• Greetings: 1 sentence (3-8 words)
• Simple questions: 1-2 sentences
• Knowledge queries (sports, news, trending): 2-3 sentences WITH ACTUAL DATA
  Example: "LeBron had 28 points, 8 boards, 11 dimes against Miami. Lakers won 112-104."
  NOT: "Yo, let's break this down quick." (THIS IS WRONG - NO DATA)

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
  emojiMode: boolean = false,
  advancedSettings?: AdvancedSettings,
  needsLiveSearch: boolean = false
): string {
  // Use unified personality profile (SAME brain as chat)
  const profile = buildUnifiedPersonalityProfile(card, metadata);
  const personalityCore = buildPersonalityCore(profile);
  
  const antiRepetitionSection = buildAntiRepetitionPrompt(recentResponses);
  const signatureInjection = buildSignatureInjection(metadata);
  const signaturePrompt = buildSignaturePhrasePrompt(signatureInjection, advancedSettings);
  const emojiPrompt = buildEmojiPrompt(metadata, advancedSettings);
  const opinionPrompt = buildOpinionPrompt(metadata, advancedSettings);
  
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

  const antiFormalitySection = buildAntiFormalityPrompt();
  const knowledgePrompt = buildKnowledgeCapabilitiesPrompt(needsLiveSearch);

  return `${personalityCore}
${signaturePrompt}
${emojiPrompt}
${opinionPrompt}
${usernameInstruction}
${antiFormalitySection}
${knowledgePrompt}

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

🚫 BANNED WORDS/PHRASES (instant rejection):
- "vibe", "vibes", "vibing"
- "fire", "straight fire", "pure fire"
- "energy", "that energy"
- "chaos", "pure chaos"
- "hits different"
- "let's go", "let's goooo"
- Generic exclamations without substance

YOUR REPLY MUST CONTAIN:
- At least ONE specific fact, stat, name, or concrete detail
- OR a genuine question that advances the conversation
- OR a unique perspective grounded in your expertise

REPLY QUALITY:
- Reference SPECIFIC details from their tweet
- If they asked a question, ANSWER IT in 1-2 sentences with actual information
- Add VALUE - don't just agree or react emotionally
- Be engaging but not spammy
- Use your expertise to provide insights, not just validation

BAD EXAMPLES (DO NOT DO THIS):
- "Yo @user, that hunter/hunted vibe is pure F1 chaos!"
- "Hey @user, that energy is unreal!"
- "That's straight fire!"

GOOD EXAMPLES (DO THIS):
- "The gap to Red Bull is finally closing - Ferrari's Singapore upgrades are no joke. Leclerc's pace in sector 2 was wild."
- "Verstappen had 6 straight wins before Singapore. With Leclerc and Sainz both on the podium, Ferrari's actually made up 40 points in 3 races."

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
    conversationContext,
    advancedSettings,
  } = options;

  // Auto-detect if query needs live search (real-time Twitter/web data)
  // Logic: 
  // 1. If advancedSettings.enableLiveSearch is FALSE, never use live search
  // 2. If advancedSettings.enableLiveSearch is TRUE (or undefined), auto-detect based on keywords
  // 3. If enableLiveSearch is explicitly passed as TRUE, always use it
  const userWantsLiveSearch = advancedSettings?.enableLiveSearch !== false; // Default to true
  const queryNeedsLiveSearch = detectKnowledgeQuery(userMessage);
  const needsLiveSearch = enableLiveSearch === true || (userWantsLiveSearch && queryNeedsLiveSearch);
  
  if (needsLiveSearch) {
    console.log(`🔍 Knowledge query detected: "${userMessage.substring(0, 50)}..." - enabling live search`);
  }
  
  if (emojiMode) {
    console.log('🎭 Emoji mode enabled - enforcing emoji-only responses');
  }

  // Build system prompt based on mode (BOTH use unified personality core)
  const systemPrompt = mode === 'chat'
    ? buildChatSystemPrompt(characterCard, personalityMetadata, recentResponses, needsLiveSearch, emojiMode, conversationContext, userMessage, advancedSettings)
    : buildTwitterSystemPrompt(characterCard, personalityMetadata, recentResponses, context, targetUsername, emojiMode, advancedSettings, needsLiveSearch);

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

  // Prepare messages - LIMIT CONTEXT TO PREVENT POLLUTION
  // For knowledge queries, use MINIMAL history to prevent context pollution
  // (e.g., user asks about LeBron but history has Steph Curry discussion)
  const historyLimit = needsLiveSearch ? 3 : 10; // Much smaller context for live search queries
  const limitedHistory = conversationHistory.slice(-historyLimit);
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...limitedHistory.map(m => ({
      role: m.role as string,
      content: m.content,
    })),
    { role: 'user', content: userPrompt },
  ];

  // LLM parameters - use better model and parameters for both modes
  const model = 'grok-3-latest'; // Use latest for both (was grok-3-mini for Twitter)
  // For live search queries, we need MORE tokens to include actual data (stats, scores, etc.)
  // For regular chat, keep it brief
  const maxTokens = needsLiveSearch ? 300 : (mode === 'chat' ? 150 : 150);
  
  // Adjust temperature based on creativity level
  let temperature = 0.85; // Default balanced
  if (advancedSettings?.creativityLevel) {
    switch (advancedSettings.creativityLevel) {
      case 'consistent':
        temperature = 0.7;
        break;
      case 'balanced':
        temperature = 0.85;
        break;
      case 'creative':
        temperature = 1.0;
        break;
    }
  }
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
        } else {
          // Chat mode: Use dynamic length based on context
          const lengthConfig = determineResponseLength(userMessage, conversationHistory, needsLiveSearch, mode, advancedSettings);
          // For live search queries with actual data, allow more content
          // Otherwise truncate to keep responses casual
          const maxSentencesForTruncation = needsLiveSearch ? 4 : lengthConfig.maxSentences;
          assistantMessage = truncateToSentences(assistantMessage, maxSentencesForTruncation);
          
          // If truncation resulted in incomplete sentence (no ending punctuation), remove it
          const lastChar = assistantMessage.trim().slice(-1);
          if (lastChar && !['.', '!', '?'].includes(lastChar)) {
            // Remove the incomplete last sentence
            const sentences = assistantMessage.match(/[^.!?]*[.!?]+/g);
            if (sentences && sentences.length > 0) {
              assistantMessage = sentences.slice(0, lengthConfig.maxSentences).join(' ').trim();
            }
          }
          
          // Legacy support: if enforceOneSentence is explicitly set, use it
          if (enforceOneSentence && !needsLiveSearch) {
            assistantMessage = truncateToFirstSentence(assistantMessage);
          }
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

