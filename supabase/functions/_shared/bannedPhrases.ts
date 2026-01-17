export const BANNED_PHRASES = [
  // Original banned phrases
  'vibe',
  'vibes',
  'vibing',
  'fire',
  'straight fire',
  'pure fire',
  'energy',
  'that energy',
  'chaos',
  'pure chaos',
  'hits different',
  "let's go",
  "let's goooo",
  "i get why you'd",
  'i understand your point but',
  'i understand your concern',
  "that's a great question",
  'i appreciate you sharing',
  'let me explain',
  'in conclusion',
  "it's important to note",
  'i would recommend',
  'based on my analysis',
  'to summarize',
  'feel free to',
  'i hope this helps',
  // Soft-ban phrases that cause convergence
  'sounds intense',
  'sounds crazy',
  'sounds wild',
  'sounds insane',
  'sounds dope',
  'sounds sick',
  'sounds like a',  // Catches "sounds like a proper brain melt" etc.
  'sounds huge',
  'sounds epic',
  'i hear ya',
  'i hear you',
  'i feel that',
  'totally get that',
  'straight-up',
  'for real though',
  'no cap',
  'that said',
  'i gotta say',
  'not gonna lie',
  'at the end of the day',
  'it goes without saying',
  'needless to say',
  'the thing is',
  'the reality is',
  'bottom line',
  // Additional convergence phrases from testing
  'is wild',
  'is unreal',
  'is insane',
  'is huge',
  'pushing boundaries',
  'on another level',
  // NEW: Cross-agent similarity patterns (Jan 2026)
  'bet you',
  "bet you've",
  'bet that',
  'bet it',
  'props to',
  'props for',
  'wild stuff',
  'wild ideas',
  'cooked up',
  'ideas brewing',
  'gotta love',
  'gotta say',
  'gotta hand it to',
  'absolute chaos',
  'total chaos',
  'brain melt',
  'spawning',         // Overused in context of "ideas spawning"
  'game-changer',
  'game changer',
  'next level',
  'is epic',
];

export const AI_SLOP_PHRASES = [
  "i hear what you're saying but",
  "i see where you're coming from but",
  // Common AI acknowledgment patterns
  "i totally get that",
  "i completely understand",
  "that makes sense but",
  "valid point but",
  "fair point but",
  // NEW: Generic opener slop (Jan 2026)
  "i see why you'd",
  "i get why you'd",
  "gotta push back",
  "imagine the chaos",
  "imagine the possibilities",
  "this could change",
  "this is huge",
  "this is massive",
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildBannedPhrasePatterns(): RegExp[] {
  const normalized = BANNED_PHRASES.map((phrase) =>
    escapeRegex(phrase).replace(/'/g, "(?:'|’)")
  );

  return [
    ...normalized.map((phrase) => new RegExp(`\\b${phrase}\\b`, 'i')),
    // Catch common AI-slop opener variations
    /\bi get why you(?:'|’)?d\s+(say|call|think|feel|mean|would|are|were)\b/i,
  ];
}

export function buildAiSlopPatterns(): RegExp[] {
  const normalized = AI_SLOP_PHRASES.map((phrase) =>
    escapeRegex(phrase).replace(/'/g, "(?:'|’)")
  );

  return normalized.map((phrase) => new RegExp(`\\b${phrase}\\b`, 'i'));
}

export function findBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase().replace(/[’‘]/g, "'");
  return BANNED_PHRASES.filter((phrase) => {
    const escaped = escapeRegex(phrase).replace(/'/g, "['’]");
    return new RegExp(`\\b${escaped}\\b`, 'i').test(lower);
  });
}
