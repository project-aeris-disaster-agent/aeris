import { BANNED_PHRASES } from '../supabase/functions/_shared/bannedPhrases.ts';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wqwhlbmsafgjlsjujuel.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/generate-post`;

const TEST_CARD = {
  name: 'ArcherPerezz',
  bio: [
    "Yo, it's ARCHERPEREZZ, Head of Asia for @gallaxia, turning the gaming world YELLOW! 🟡",
    "I'm all about dominating Web3 gaming and creating killer content with 40M+ views on TikTok.",
  ],
  knowledge: ['Web3 gaming', 'content creation', 'F1'],
  topics: ['Web3 Gaming', 'F1', 'Content Creation'],
  style: {
    all: ['high-energy', 'motivational'],
    chat: ['supportive'],
    post: ['achievement-focused'],
  },
  postExamples: [
    "TURN YELLOW! Big week for @gallaxia — let's run it back 🟡",
    'Another milestone unlocked. The grind is real.',
  ],
  messageExamples: [],
};

const POST_STYLE = 'High-energy, hype, concise. Avoid corporate tone.';
const POST_EXAMPLES = TEST_CARD.postExamples.join('\n');

const BANNED_PHRASES_LOWER = BANNED_PHRASES.map((phrase) => phrase.toLowerCase());

function checkBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  BANNED_PHRASES_LOWER.forEach((phrase) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const normalized = escaped.replace(/'/g, "['’]");
    const pattern = new RegExp(`\\b${normalized}\\b`, 'i');
    if (pattern.test(lower)) {
      found.push(phrase);
    }
  });

  return found;
}

async function testGeneratePost() {
  if (!SUPABASE_ANON_KEY) {
    console.error('❌ VITE_SUPABASE_ANON_KEY not set');
    process.exit(1);
  }

  console.log('🧪 TESTING GENERATE-POST FOR BANNED PHRASES\n');
  console.log('='.repeat(80));

  const attempts = 5;
  const results: Array<{ text: string; banned: string[] }> = [];

  for (let i = 0; i < attempts; i += 1) {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: 'test-user',
        session_id: `test-session-${Date.now()}`,
        character_card: TEST_CARD,
        conversation_context: '',
        bio: TEST_CARD.bio.join(' '),
        post_style: POST_STYLE,
        post_examples: POST_EXAMPLES,
        custom_tags: ['Web3 gaming', 'F1'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Function error: ${response.status} - ${errorText}`);
      continue;
    }

    const data = await response.json();
    const post = data?.post_content || '';
    const banned = post ? checkBannedPhrases(post) : [];
    results.push({ text: post, banned });

    console.log(`\n[${i + 1}/${attempts}] ${post}`);
    console.log(`Banned: ${banned.length ? banned.join(', ') : 'none'}`);
  }

  const withBanned = results.filter((r) => r.banned.length > 0);
  console.log('\n' + '='.repeat(80));
  console.log(`Total posts: ${results.length}`);
  console.log(`With banned phrases: ${withBanned.length}`);
  if (withBanned.length) {
    console.log('⚠️ Some posts still contain banned phrases');
  } else {
    console.log('✅ No banned phrases detected in generated posts');
  }
}

testGeneratePost().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
