import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  Loader2,
  Check,
  Edit3,
  Save,
  Download,
  RefreshCw,
  User,
  MessageSquare,
  Hash,
  Zap,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import type { ElizaOSCharacterCard, ProfileScores } from '@/types/database';
import {
  generateCharacterCard,
  saveCharacterCard,
  exportCharacterCardAsJSON,
  getTwitterAccessToken,
} from '@/services/characterCardService';

interface TwitterProfileData {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
  followers_count?: number;
  following_count?: number;
  tweet_count?: number;
}

interface CharacterCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  twitterAccessToken?: string;
  onSuccess?: (card: ElizaOSCharacterCard, twitterProfile?: TwitterProfileData, scores?: ProfileScores) => void;
}

type ModalState = 'generating' | 'preview' | 'editing' | 'saving' | 'saved' | 'error';

const statusMessages = [
  { text: 'Connecting to Twitter API...', icon: '🐦' },
  { text: 'Fetching your recent tweets...', icon: '📝' },
  { text: 'Analyzing your writing style...', icon: '✍️' },
  { text: 'Deep personality analysis (Pass 1)...', icon: '🧠' },
  { text: 'Identifying unique voice patterns...', icon: '🎯' },
  { text: 'Generating authentic examples (Pass 2)...', icon: '🤖' },
  { text: 'Building your character card...', icon: '✨' },
];

export function CharacterCardModal({
  isOpen,
  onClose,
  userId,
  twitterAccessToken: propAccessToken,
  onSuccess,
}: CharacterCardModalProps) {
  const [state, setState] = useState<ModalState>('generating');
  const [characterCard, setCharacterCard] = useState<ElizaOSCharacterCard | null>(null);
  const [editedCard, setEditedCard] = useState<ElizaOSCharacterCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusIndex, setStatusIndex] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    bio: true,
    style: true,
    topics: false,
    examples: false,
  });
  const [twitterProfile, setTwitterProfile] = useState<TwitterProfileData | null>(null);
  const [profileScores, setProfileScores] = useState<ProfileScores | null>(null);
  const [analysisMetadata, setAnalysisMetadata] = useState<{
    tweets_analyzed: number;
    analysis_summary?: {
      primary_topics: string[];
      core_traits: string[];
      vocabulary_level: string;
      humor_style: string;
    };
  } | null>(null);

  // Progress animation during generation
  useEffect(() => {
    if (state === 'generating') {
      const interval = setInterval(() => {
        setStatusIndex((prev) => (prev + 1) % statusMessages.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [state]);

  // Start generation when modal opens
  useEffect(() => {
    if (isOpen && state === 'generating') {
      startGeneration();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setState('generating');
        setCharacterCard(null);
        setEditedCard(null);
        setError(null);
        setStatusIndex(0);
        setTwitterProfile(null);
        setProfileScores(null);
        setAnalysisMetadata(null);
      }, 300);
    }
  }, [isOpen]);

  const startGeneration = async () => {
    setState('generating');
    setError(null);
    setStatusIndex(0);

    try {
      // Get access token from props or fetch from profile
      let accessToken = propAccessToken;
      if (!accessToken) {
        accessToken = await getTwitterAccessToken(userId) || undefined;
      }

      if (!accessToken) {
        throw new Error('Twitter not connected. Please connect your Twitter account first.');
      }

      const result = await generateCharacterCard(userId, accessToken);

      setCharacterCard(result.character_card);
      setEditedCard(result.character_card);
      setTwitterProfile(result.twitter_profile);
      setProfileScores(result.profile_scores);
      setAnalysisMetadata({
        tweets_analyzed: result.analysis_metadata.tweets_analyzed,
        analysis_summary: result.analysis_metadata.analysis_summary,
      });
      setState('preview');
    } catch (err: any) {
      console.error('Generation failed:', err);
      setError(err.message || 'Failed to generate character card');
      setState('error');
    }
  };

  const handleSave = async () => {
    if (!editedCard) return;

    setState('saving');
    try {
      await saveCharacterCard(userId, editedCard, {
        generatedBy: 'grok_api',
        generationMetadata: {
          twitter_username: twitterProfile?.username,
          twitter_metrics: twitterProfile ? {
            followers_count: twitterProfile.followers_count,
            following_count: twitterProfile.following_count,
            tweet_count: twitterProfile.tweet_count,
          } : null,
          profile_scores: profileScores,
          generated_at: new Date().toISOString(),
        },
      });
      setState('saved');
      onSuccess?.(editedCard, twitterProfile || undefined, profileScores || undefined);
    } catch (err: any) {
      console.error('Save failed:', err);
      setError(err.message || 'Failed to save character card');
      setState('error');
    }
  };

  const handleExport = () => {
    if (editedCard) {
      exportCharacterCardAsJSON(editedCard);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updateCardField = (field: string, value: any) => {
    if (!editedCard) return;
    setEditedCard({ ...editedCard, [field]: value });
  };

  // Note: updateStyleField is available for future use when style editing is implemented
  const _updateStyleField = (category: 'all' | 'chat' | 'post', value: string[]) => {
    if (!editedCard) return;
    setEditedCard({
      ...editedCard,
      style: { ...editedCard.style, [category]: value },
    });
  };
  void _updateStyleField; // Suppress unused warning

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && state !== 'generating' && state !== 'saving' && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/80 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-pink-600 to-cyan-500">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">AI Clone Generator</h2>
                <p className="text-xs text-white/50">
                  {state === 'generating' && 'Analyzing your Twitter presence...'}
                  {state === 'preview' && 'Preview your character card'}
                  {state === 'editing' && 'Edit your character card'}
                  {state === 'saving' && 'Saving...'}
                  {state === 'saved' && 'Character card saved!'}
                  {state === 'error' && 'Something went wrong'}
                </p>
              </div>
            </div>
            {state !== 'generating' && state !== 'saving' && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
            {/* Generating State */}
            {state === 'generating' && (
              <div className="flex flex-col items-center justify-center py-16">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="relative w-24 h-24 mb-8"
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-600 to-cyan-500 opacity-20 blur-xl" />
                  <div className="absolute inset-2 rounded-full bg-gradient-to-r from-pink-600 to-cyan-500 opacity-40" />
                  <div className="absolute inset-4 rounded-full bg-black flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                  </div>
                </motion.div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={statusIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-center"
                  >
                    <span className="text-3xl mb-2 block">{statusMessages[statusIndex].icon}</span>
                    <p className="text-white/70">{statusMessages[statusIndex].text}</p>
                  </motion.div>
                </AnimatePresence>

                <div className="flex gap-1 mt-8">
                  {statusMessages.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        idx === statusIndex ? 'bg-cyan-400' : 'bg-white/20'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Error State */}
            {state === 'error' && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Generation Failed</h3>
                <p className="text-white/60 text-center max-w-md mb-6">{error}</p>
                <div className="flex gap-3">
                  <button
                    onClick={startGeneration}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Preview/Edit State */}
            {(state === 'preview' || state === 'editing') && editedCard && (
              <div className="space-y-4">
                {/* Profile Header */}
                {twitterProfile && (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                    {twitterProfile.profile_image_url && (
                      <img
                        src={twitterProfile.profile_image_url}
                        alt={twitterProfile.name}
                        className="w-12 h-12 rounded-full border-2 border-cyan-400/50"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="text-white font-semibold">{twitterProfile.name}</h3>
                      <p className="text-white/50 text-sm">@{twitterProfile.username}</p>
                    </div>
                    {twitterProfile.followers_count && (
                      <div className="text-right">
                        <p className="text-white font-bold">{twitterProfile.followers_count.toLocaleString()}</p>
                        <p className="text-white/40 text-xs">followers</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Analysis Summary */}
                {analysisMetadata && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-pink-500/10 border border-cyan-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span className="text-white/80 text-sm font-medium">Analysis Summary</span>
                      <span className="text-white/40 text-xs">({analysisMetadata.tweets_analyzed} tweets analyzed)</span>
                    </div>
                    {analysisMetadata.analysis_summary && (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-white/50 uppercase mb-1">Vocabulary</p>
                          <p className="text-cyan-300">{analysisMetadata.analysis_summary.vocabulary_level}</p>
                        </div>
                        <div>
                          <p className="text-white/50 uppercase mb-1">Humor Style</p>
                          <p className="text-pink-300">{analysisMetadata.analysis_summary.humor_style}</p>
                        </div>
                        {analysisMetadata.analysis_summary.core_traits.length > 0 && (
                          <div className="col-span-2">
                            <p className="text-white/50 uppercase mb-1">Core Traits</p>
                            <div className="flex flex-wrap gap-1">
                              {analysisMetadata.analysis_summary.core_traits.slice(0, 5).map((trait, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded bg-white/10 text-white/70">
                                  {trait}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Character Name */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-cyan-400" />
                    <label className="text-white/70 text-sm font-medium">Character Name</label>
                  </div>
                  {state === 'editing' ? (
                    <input
                      type="text"
                      value={editedCard.name}
                      onChange={(e) => updateCardField('name', e.target.value)}
                      className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400/50"
                    />
                  ) : (
                    <p className="text-white font-semibold">{editedCard.name}</p>
                  )}
                </div>

                {/* Bio Section */}
                <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                  <button
                    onClick={() => toggleSection('bio')}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-pink-400" />
                      <span className="text-white font-medium">Bio & Personality</span>
                      <span className="text-white/40 text-xs">({editedCard.bio.length} entries)</span>
                    </div>
                    {expandedSections.bio ? (
                      <ChevronUp className="w-4 h-4 text-white/50" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-white/50" />
                    )}
                  </button>
                  {expandedSections.bio && (
                    <div className="px-4 pb-4 space-y-2">
                      {state === 'editing' ? (
                        editedCard.bio.map((bio, idx) => (
                          <textarea
                            key={idx}
                            value={bio}
                            onChange={(e) => {
                              const newBio = [...editedCard.bio];
                              newBio[idx] = e.target.value;
                              updateCardField('bio', newBio);
                            }}
                            className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white/80 text-sm focus:outline-none focus:border-cyan-400/50 resize-none"
                            rows={2}
                          />
                        ))
                      ) : (
                        editedCard.bio.map((bio, idx) => (
                          <p key={idx} className="text-white/70 text-sm">
                            • {bio}
                          </p>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Style Section */}
                <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                  <button
                    onClick={() => toggleSection('style')}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span className="text-white font-medium">Communication Style</span>
                    </div>
                    {expandedSections.style ? (
                      <ChevronUp className="w-4 h-4 text-white/50" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-white/50" />
                    )}
                  </button>
                  {expandedSections.style && (
                    <div className="px-4 pb-4 space-y-3">
                      {(['all', 'chat', 'post'] as const).map((category) => (
                        <div key={category}>
                          <p className="text-white/50 text-xs uppercase mb-1">{category} style</p>
                          <div className="flex flex-wrap gap-1">
                            {editedCard.style[category].map((trait, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 rounded-full bg-gradient-to-r from-pink-600/20 to-cyan-500/20 border border-white/10 text-white/80 text-xs"
                              >
                                {trait}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Topics Section */}
                <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                  <button
                    onClick={() => toggleSection('topics')}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-green-400" />
                      <span className="text-white font-medium">Topics & Interests</span>
                      <span className="text-white/40 text-xs">({editedCard.topics.length} topics)</span>
                    </div>
                    {expandedSections.topics ? (
                      <ChevronUp className="w-4 h-4 text-white/50" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-white/50" />
                    )}
                  </button>
                  {expandedSections.topics && (
                    <div className="px-4 pb-4">
                      <div className="flex flex-wrap gap-2">
                        {editedCard.topics.map((topic, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-300 text-sm"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                      {editedCard.adjectives && editedCard.adjectives.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <p className="text-white/50 text-xs uppercase mb-2">Adjectives</p>
                          <div className="flex flex-wrap gap-1">
                            {editedCard.adjectives.map((adj, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-white/5 text-white/60 text-xs"
                              >
                                {adj}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Post Examples Section */}
                <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                  <button
                    onClick={() => toggleSection('examples')}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-purple-400" />
                      <span className="text-white font-medium">Post Examples</span>
                      <span className="text-white/40 text-xs">({editedCard.postExamples.length} examples)</span>
                    </div>
                    {expandedSections.examples ? (
                      <ChevronUp className="w-4 h-4 text-white/50" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-white/50" />
                    )}
                  </button>
                  {expandedSections.examples && (
                    <div className="px-4 pb-4 space-y-2">
                      {editedCard.postExamples.slice(0, 5).map((example, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm"
                        >
                          "{example}"
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Saving State */}
            {state === 'saving' && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
                <p className="text-white/70">Saving your character card...</p>
              </div>
            )}

            {/* Saved State */}
            {state === 'saved' && (
              <div className="flex flex-col items-center justify-center py-16">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-16 h-16 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center mb-6"
                >
                  <Check className="w-8 h-8 text-white" />
                </motion.div>
                <h3 className="text-xl font-bold text-white mb-2">Character Card Saved!</h3>
                <p className="text-white/60 text-center max-w-md mb-6">
                  Your AI clone has been created. It will now use this personality when interacting on your behalf.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export JSON
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-600 to-cyan-500 text-white font-medium transition-transform hover:scale-105"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {(state === 'preview' || state === 'editing') && (
            <div className="sticky bottom-0 flex items-center justify-between px-6 py-4 border-t border-white/10 bg-black/80 backdrop-blur-md">
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  onClick={startGeneration}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </button>
              </div>
              <div className="flex gap-2">
                {state === 'preview' ? (
                  <>
                    <button
                      onClick={() => setState('editing')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-pink-600 to-cyan-500 text-white font-medium transition-transform hover:scale-105"
                    >
                      <Save className="w-4 h-4" />
                      Save Clone
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditedCard(characterCard);
                        setState('preview');
                      }}
                      className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setState('preview')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-pink-600 to-cyan-500 text-white font-medium transition-transform hover:scale-105"
                    >
                      <Check className="w-4 h-4" />
                      Done Editing
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

