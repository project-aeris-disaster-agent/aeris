# ElizaOS Character Card Structure

This document outlines the structure of character cards used in SONA.BIO, based on the ElizaOS framework format.

## Reference Example

Based on the Anakin Skywalker character card from [elizaOS/characters](https://github.com/elizaOS/characters).

## Character Card Schema

```typescript
interface ElizaOSCharacterCard {
  // Basic Information
  name: string;                    // Character identifier (e.g., "Anakin_Skywalker")
  
  // Platform Configuration
  clients?: string[];              // Supported platforms: ["twitter", "discord", "telegram"]
  
  // Model Configuration
  modelProvider?: string;          // LLM provider: "groq", "openai", "anthropic", etc.
  
  // Voice Settings
  settings?: {
    voice?: {
      model?: string;               // Voice model: "en_US-GuyNeural"
    };
  };
  
  // Plugin Configuration
  plugins?: string[];               // Array of plugin identifiers
  
  // Personality Definition
  bio: string[];                   // Array of personality descriptions (2-5 sentences each)
  
  // Background & Context
  lore: string[];                  // Background information and context
  
  // Knowledge Base
  knowledge: string[];             // Areas of expertise and knowledge
  
  // Conversation Examples
  messageExamples: Array<Array<{
    user: string;                  // "{{user1}}" or character name
    content: {
      text: string;                // Message content
    };
  }>>;
  
  // Post Style Examples
  postExamples: string[];          // Sample posts showing writing style
  
  // Topic Interests
  topics: string[];                // Key topics the character discusses
  
  // Communication Style
  style: {
    all: string[];                 // General personality traits
    chat: string[];                // Chat-specific traits
    post: string[];                // Post-specific traits
  };
  
  // Personality Adjectives
  adjectives: string[];            // Descriptive words
  
  // Twitter Spaces Configuration (if applicable)
  twitterSpaces?: {
    maxSpeakers?: number;
    topics?: string[];
    typicalDurationMinutes?: number;
    idleKickTimeoutMs?: number;
    minIntervalBetweenSpacesMinutes?: number;
    businessHoursOnly?: boolean;
    randomChance?: number;
    enableIdleMonitor?: boolean;
    enableSttTts?: boolean;
    enableRecording?: boolean;
    voiceId?: string;
    sttLanguage?: string;
    gptModel?: string;
    systemPrompt?: string;
    speakerMaxDurationMs?: number;
  };
  
  // Posting Schedule
  schedule?: {
    intervalMinutes?: number;      // Minutes between posts
    enabled?: boolean;              // Whether scheduling is active
  };
  
  // Commenting Behavior
  commenting?: {
    enabled?: boolean;              // Whether auto-commenting is enabled
  };
}
```

## SONA.BIO Character Card Generation

When generating a character card from a user's Twitter profile, we'll populate these fields as follows:

### `name`
- Use Twitter username or user-selected name
- Format: `{username}` or `{username}_AlterEgo`

### `bio`
- Analyze tweet content for personality traits
- Extract from Twitter bio if available
- Generate 3-5 descriptive sentences

### `lore`
- User's Twitter join date
- Notable achievements or milestones
- Key life events mentioned in tweets

### `knowledge`
- Extract from tweet topics and hashtags
- Identify expertise areas based on content
- Include professional background if detectable

### `messageExamples`
- Generate based on user's actual tweet style
- Create conversation examples that match their voice
- Include common phrases and expressions

### `postExamples`
- Sample from user's actual tweets (with permission)
- Generate similar-style examples
- Maintain user's typical post length and format

### `topics`
- Extract from tweet hashtags and content
- Identify recurring themes
- Include user's stated interests

### `style`
- Analyze writing patterns:
  - Formality level
  - Emoji usage
  - Post length
  - Engagement style
- Generate traits that match their actual behavior

### `adjectives`
- Derive from sentiment analysis
- Extract from how others describe them (mentions)
- Generate from their own self-descriptions

### `schedule`
- Analyze posting frequency
- Determine optimal posting times
- Set default schedule based on user's patterns

## Example: Generated Character Card

```json
{
  "name": "tech_enthusiast_alterego",
  "clients": ["twitter"],
  "modelProvider": "groq",
  "settings": {
    "voice": {
      "model": "en_US-GuyNeural"
    }
  },
  "plugins": [],
  "bio": [
    "A tech enthusiast passionate about AI, web development, and open source.",
    "Known for sharing insights on emerging technologies and developer tools.",
    "Engages actively with the tech community through thoughtful discussions.",
    "Values authenticity and knowledge sharing in online interactions."
  ],
  "lore": [
    "Active on Twitter since 2020, building a community around tech discussions.",
    "Regularly shares coding tips, project updates, and industry observations."
  ],
  "knowledge": [
    "Web development frameworks and best practices",
    "AI and machine learning trends",
    "Open source software and community building",
    "Developer tools and productivity tips"
  ],
  "messageExamples": [
    [
      {
        "user": "{{user1}}",
        "content": {
          "text": "What do you think about the latest AI developments?"
        }
      },
      {
        "user": "tech_enthusiast_alterego",
        "content": {
          "text": "The pace of innovation is incredible! I'm particularly excited about how these tools are becoming more accessible to developers."
        }
      }
    ]
  ],
  "postExamples": [
    "Just discovered an amazing new tool that's going to change how I work. Can't wait to share it!",
    "The intersection of AI and web development is fascinating. Here's what I'm learning...",
    "Open source communities continue to amaze me with their innovation and collaboration."
  ],
  "topics": [
    "Web Development",
    "Artificial Intelligence",
    "Open Source",
    "Developer Tools",
    "Tech Trends"
  ],
  "style": {
    "all": ["Enthusiastic", "Knowledgeable", "Engaging", "Thoughtful"],
    "chat": ["Conversational", "Helpful", "Detailed", "Friendly"],
    "post": ["Informative", "Engaging", "Community-focused", "Balanced"]
  },
  "adjectives": [
    "Tech-savvy",
    "Curious",
    "Community-oriented",
    "Knowledgeable",
    "Enthusiastic"
  ],
  "schedule": {
    "intervalMinutes": 240,
    "enabled": true
  },
  "commenting": {
    "enabled": true
  }
}
```

## Customization Options

Users can customize their character card through:
1. **Bio Editor**: Modify personality descriptions
2. **Style Adjustments**: Change communication traits
3. **Topic Management**: Add/remove topics of interest
4. **Schedule Settings**: Adjust posting frequency
5. **Example Editing**: Modify conversation and post examples

## Validation Rules

- `name`: Required, alphanumeric + underscore, max 50 chars
- `bio`: Required, minimum 2 items, each max 200 chars
- `lore`: Optional, each max 300 chars
- `knowledge`: Required, minimum 3 items
- `messageExamples`: Required, minimum 1 example conversation
- `postExamples`: Required, minimum 3 examples
- `topics`: Required, minimum 3 topics
- `style.all`: Required, minimum 3 traits
- `adjectives`: Required, minimum 3 adjectives

