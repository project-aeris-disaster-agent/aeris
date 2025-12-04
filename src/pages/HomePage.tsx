import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DitheringShader } from '@/components/ui/dithering-shader';
import { CharacterCardModal } from '@/components/CharacterCardModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCharacterCard } from '@/services/characterCardService';
import { 
  sendMessage as sendChatMessage, 
  getOrCreateSession, 
  getSessionMessages
} from '@/services/chatService';
import type { ElizaOSCharacterCard, ProfileScores, LetterGrade } from '@/types/database';
import { 
  Send, 
  Sparkles, 
  Settings, 
  MessageSquare,
  Twitter,
  Users,
  Heart,
  TrendingUp,
  FileText,
  Zap,
  Bot,
  LogOut,
  Award
} from 'lucide-react';
import { AutomationDropdown } from '@/components/AutomationDropdown';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface UserProfile {
  twitter_username: string | null;
  twitter_access_token: string | null;
  twitter_user_id: string | null;
  profile_photo_url: string | null;
  character_card_generated: boolean;
}

interface TwitterMetricsState {
  followers_count: number;
  following_count: number;
  tweet_count: number;
}

// Grade color mapping
const gradeColors: Record<LetterGrade, string> = {
  'A+': 'text-emerald-400',
  'A': 'text-green-400',
  'B+': 'text-cyan-400',
  'B': 'text-blue-400',
  'C+': 'text-yellow-400',
  'C': 'text-orange-400',
  'D': 'text-red-400',
};

const gradeBgColors: Record<LetterGrade, string> = {
  'A+': 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/50',
  'A': 'from-green-500/20 to-green-600/20 border-green-500/50',
  'B+': 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/50',
  'B': 'from-blue-500/20 to-blue-600/20 border-blue-500/50',
  'C+': 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/50',
  'C': 'from-orange-500/20 to-orange-600/20 border-orange-500/50',
  'D': 'from-red-500/20 to-red-600/20 border-red-500/50',
};

const FarcasterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.24 1.2H5.76C3.26 1.2 1.2 3.26 1.2 5.76v12.48c0 2.5 2.06 4.56 4.56 4.56h12.48c2.5 0 4.56-2.06 4.56-4.56V5.76c0-2.5-2.06-4.56-4.56-4.56zm.72 15.84c0 .48-.38.86-.86.86H5.9c-.48 0-.86-.38-.86-.86V6.96c0-.48.38-.86.86-.86h12.2c.48 0 .86.38.86.86v10.08z"/>
  </svg>
);

const BaseIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M12 6v12M8 10l4-4 4 4M8 14l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
);

export function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // Initial welcome message - will be updated when character card loads
  const getWelcomeMessage = useCallback((card?: ElizaOSCharacterCard | null): Message => ({
    id: 'welcome',
    role: 'assistant',
    content: card 
      ? `Hey! I'm ${card.name}, your AI Alter Ego. ${card.bio[0] || "Ready to chat whenever you are."} What's on your mind?`
      : "Hello! I'm ready to become your AI Alter Ego. Generate your clone first so I can learn your personality and start chatting in your unique voice!",
    timestamp: new Date(),
  }), []);

  const [messages, setMessages] = useState<Message[]>([getWelcomeMessage()]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasAlterEgo, setHasAlterEgo] = useState(false);
  const [characterCard, setCharacterCard] = useState<ElizaOSCharacterCard | null>(null);
  const [socialAutomation, setSocialAutomation] = useState({
    twitter: false,
    farcaster: false,
    baseapp: false,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [twitterMetrics, setTwitterMetrics] = useState<TwitterMetricsState | null>(null);
  const [profileScores, setProfileScores] = useState<ProfileScores | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch user profile and character card status
  useEffect(() => {
    async function fetchUserData() {
      if (!user?.id) {
        setIsLoadingProfile(false);
        return;
      }

      try {
        // Fetch user profile from Supabase
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('twitter_username, twitter_access_token, twitter_user_id, profile_photo_url, character_card_generated')
          .eq('id', user.id)
          .maybeSingle(); // Use maybeSingle to not error if no row found

        if (error) {
          console.error('Error fetching profile:', error);
          // Still continue - user might be authenticated but profile not created yet
        }
        
        if (profile) {
          const typedProfile = profile as unknown as UserProfile;
          setUserProfile(typedProfile);
          setHasAlterEgo(typedProfile.character_card_generated || false);

          // If user has a character card, fetch it along with metadata
          if (typedProfile.character_card_generated) {
            try {
              const card = await getCharacterCard(user.id);
              if (card) {
                setCharacterCard(card.card_data);
                
                // Extract metrics and scores from generation_metadata
                const metadata = card.generation_metadata as any;
                if (metadata?.twitter_metrics) {
                  setTwitterMetrics(metadata.twitter_metrics);
                }
                if (metadata?.profile_scores) {
                  setProfileScores(metadata.profile_scores);
                }
              }
            } catch (cardErr) {
              console.error('Error fetching character card:', cardErr);
            }
          }
        } else {
          console.log('No profile found for user, may need to complete Twitter login');
        }
      } catch (err) {
        console.error('Error in fetchUserData:', err);
      } finally {
        setIsLoadingProfile(false);
      }
    }

    fetchUserData();
  }, [user?.id]);

  // Initialize chat session when user has a character card
  useEffect(() => {
    async function initChatSession() {
      if (!user?.id || !hasAlterEgo || sessionId) return;
      
      setIsLoadingSession(true);
      try {
        const newSessionId = await getOrCreateSession(user.id);
        setSessionId(newSessionId);
        
        // Load existing messages from this session
        const existingMessages = await getSessionMessages(newSessionId, 20);
        if (existingMessages.length > 0) {
          setMessages(existingMessages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })));
        }
      } catch (err) {
        console.error('Failed to initialize chat session:', err);
      } finally {
        setIsLoadingSession(false);
      }
    }
    
    initChatSession();
  }, [user?.id, hasAlterEgo, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Track modal mode
  const [modalMode, setModalMode] = useState<'generate' | 'edit'>('generate');

  const handleGenerateClone = async () => {
    // Check if we have a Twitter access token
    if (!userProfile?.twitter_access_token) {
      // Try to fetch it directly if profile state is stale
      if (user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('twitter_access_token')
          .eq('id', user.id)
          .maybeSingle();
        
        if (data && (data as any).twitter_access_token) {
          // We have a token, open the modal in generate mode
          setModalMode('generate');
          setIsModalOpen(true);
          return;
        }
      }
      
      // User hasn't connected Twitter
      alert('Please connect your Twitter account first to generate your AI clone.\n\nGo to the Auth page and sign in with Twitter.');
      return;
    }
    setModalMode('generate');
    setIsModalOpen(true);
  };

  const handleEditClone = () => {
    if (!characterCard) {
      alert('No character card found. Please generate your AI clone first.');
      return;
    }
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleCharacterCardSuccess = (
    card: ElizaOSCharacterCard, 
    twitterProfile?: { followers_count?: number; following_count?: number; tweet_count?: number },
    scores?: ProfileScores
  ) => {
    setCharacterCard(card);
    setHasAlterEgo(true);
    
    // Store metrics and scores
    if (twitterProfile) {
      setTwitterMetrics({
        followers_count: twitterProfile.followers_count || 0,
        following_count: twitterProfile.following_count || 0,
        tweet_count: twitterProfile.tweet_count || 0,
      });
    }
    if (scores) {
      setProfileScores(scores);
    }
    
    // Reset session to start fresh with new personality
    setSessionId(null);
    
    // Update the initial message to reflect the character's personality
    setMessages([getWelcomeMessage(card)]);
  };

  // Format number for display (e.g., 12400 -> "12.4K")
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim()) return;
    if (!user?.id) return;
    
    // If no character card, show placeholder response
    if (!characterCard) {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: inputValue,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
      setInputValue('');
      setIsTyping(true);
      
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I'd love to chat with you! But first, you need to generate your AI clone so I can learn your personality. Click 'Generate AI Clone' to get started! 🚀",
          timestamp: new Date(),
        }]);
        setIsTyping(false);
      }, 1000);
      return;
    }

    // Ensure we have a session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        currentSessionId = await getOrCreateSession(user.id);
        setSessionId(currentSessionId);
      } catch (err) {
        console.error('Failed to create session:', err);
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputValue;
    setInputValue('');
    setIsTyping(true);

    try {
      // Send message to AI clone via Edge Function
      const response = await sendChatMessage(
        user.id,
        currentSessionId,
        messageText,
        characterCard
      );

      if (response.success) {
        setMessages(prev => [...prev, {
          id: response.message.id,
          role: 'assistant',
          content: response.message.content,
          timestamp: response.message.timestamp,
        }]);
      } else {
        // Show error response
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.error || "Sorry, I'm having trouble responding right now. Please try again.",
          timestamp: new Date(),
        }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Oops! Something went wrong. Let me try that again in a moment.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [inputValue, user?.id, characterCard, sessionId]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      {/* Background Shader - Full screen fixed */}
      <DitheringShader 
        shape="wave"
        type="8x8"
        colorBack="#001122"
        colorFront="#ff0088"
        pxSize={3}
        speed={0.6}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
        }}
      />
      
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/5 bg-black/40 backdrop-blur-md">
        <img src="/sona-weblogo.svg" alt="SONA Logo" className="h-8 sm:h-10 w-auto" />
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <Settings className="w-4 h-4 text-white/70" />
          </button>
          <button 
            onClick={async () => {
              await logout();
              navigate('/auth');
            }}
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/50 transition-colors group"
            title="Logout"
          >
            <LogOut className="w-4 h-4 text-white/70 group-hover:text-red-400" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 p-4 sm:p-6 pb-24">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-4 lg:gap-6">
          
          {/* Left Panel - Profile & Controls */}
          <div className="w-full lg:w-72 flex-shrink-0 space-y-4 order-first">
            
            {/* Profile Card */}
            <div className="bg-black/60 backdrop-blur-xl rounded-2xl border border-cyan-400/30 p-4 relative overflow-hidden">
              {/* HUD corners */}
              <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-400" />
              <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-400" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-pink-500" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-pink-500" />
              
              {/* Final Rating Badge - Upper Left */}
              {profileScores && (
                <div className={`absolute top-2 left-2 px-2 py-1 rounded-lg bg-gradient-to-r ${gradeBgColors[profileScores.finalRating]} border backdrop-blur-sm`}>
                  <div className="flex items-center gap-1">
                    <Award className={`w-3 h-3 ${gradeColors[profileScores.finalRating]}`} />
                    <span className={`font-bold text-sm ${gradeColors[profileScores.finalRating]}`}>
                      {profileScores.finalRating}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Profile Image */}
              <div className="relative mx-auto w-28 h-28 sm:w-32 sm:h-32">
                <motion.div 
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'conic-gradient(from 0deg, transparent, rgba(0, 255, 255, 0.5), transparent, rgba(255, 0, 136, 0.5), transparent)' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-1 rounded-full bg-black/80" />
                <div className="absolute inset-2 rounded-full overflow-hidden border-2 border-white/20">
                  <img 
                    src={userProfile?.profile_photo_url || "/sonora-profile.png"} 
                    alt="AI Twin Profile" 
                    className="w-full h-full object-cover object-top" 
                  />
                </div>
                <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-black ${hasAlterEgo ? 'bg-green-400' : 'bg-yellow-400'}`} />
              </div>
              
              {/* User Info */}
              <div className="text-center mt-3">
                <h3 className="text-white font-bold text-base">
                  {userProfile?.twitter_username ? `@${userProfile.twitter_username}` : '@YourUsername'}
                </h3>
                <p className="text-white/50 text-xs">
                  {hasAlterEgo ? 'AI Twin Active' : 'Connect Twitter to start'}
                </p>
              </div>
              
              {/* Real Metrics - Followers & Following */}
              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                <div className="bg-white/5 rounded-lg p-2">
                  <Users className="w-3 h-3 mx-auto text-cyan-400 mb-0.5" />
                  <p className="text-white font-bold text-xs">
                    {twitterMetrics ? formatNumber(twitterMetrics.followers_count) : '--'}
                  </p>
                  <p className="text-white/40 text-[10px]">Followers</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <Heart className="w-3 h-3 mx-auto text-pink-500 mb-0.5" />
                  <p className={`font-bold text-xs ${profileScores ? gradeColors[profileScores.engagement] : 'text-white'}`}>
                    {profileScores ? profileScores.engagement : '--'}
                  </p>
                  <p className="text-white/40 text-[10px]">Engage</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <TrendingUp className="w-3 h-3 mx-auto text-purple-400 mb-0.5" />
                  <p className={`font-bold text-xs ${profileScores ? gradeColors[profileScores.reach] : 'text-white'}`}>
                    {profileScores ? profileScores.reach : '--'}
                  </p>
                  <p className="text-white/40 text-[10px]">Reach</p>
                </div>
              </div>
              
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-center">
                <div className="bg-white/5 rounded-lg p-1.5 flex items-center justify-center gap-1">
                  <FileText className="w-3 h-3 text-green-400" />
                  <span className="text-white/70 text-[10px]">
                    {twitterMetrics ? formatNumber(twitterMetrics.tweet_count) : '--'} Tweets
                  </span>
                </div>
                <div className="bg-white/5 rounded-lg p-1.5 flex items-center justify-center gap-1">
                  <Users className="w-3 h-3 text-blue-400" />
                  <span className="text-white/70 text-[10px]">
                    {twitterMetrics ? formatNumber(twitterMetrics.following_count) : '--'} Following
                  </span>
                </div>
              </div>
            </div>

            {/* Generate/Edit AI Clone Button */}
            {hasAlterEgo ? (
              <button
                onClick={handleEditClone}
                disabled={isLoadingProfile}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-500 rounded-xl p-[2px] hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100"
              >
                <div className="bg-black/80 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center justify-center gap-2">
                  <Settings className="w-4 h-4 text-white" />
                  <span className="text-white font-bold text-sm">Edit Alter Ego</span>
                </div>
              </button>
            ) : (
              <button
                onClick={handleGenerateClone}
                disabled={isLoadingProfile}
                className="w-full bg-gradient-to-r from-pink-600 to-cyan-500 rounded-xl p-[2px] hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100"
              >
                <div className="bg-black/80 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-white" />
                  <span className="text-white font-bold text-sm">GENERATE AI CLONE</span>
                  <Zap className="w-3 h-3 text-yellow-400" />
                </div>
              </button>
            )}
          </div>

          {/* Center Panel - Chat Interface */}
          <div className="flex-1 min-w-0 order-last lg:order-none">
            <div className="flex flex-col h-[500px] lg:h-[600px] bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              {/* Chat Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/30">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Bot className="w-5 h-5 text-cyan-400" />
                    <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                      isTyping ? 'bg-yellow-400 animate-pulse' : 
                      hasAlterEgo ? 'bg-green-400' : 'bg-gray-400'
                    }`} />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">
                      {characterCard?.name || 'AI Alter Ego'}
                    </h3>
                    <p className="text-white/40 text-xs">
                      {isTyping ? 'Typing...' :
                       isLoadingSession ? 'Loading session...' :
                       hasAlterEgo ? 'Online • Ready to chat' : 'Generate your clone to start'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sessionId && (
                    <span className="text-[10px] text-white/20 font-mono">
                      {sessionId.slice(-6)}
                    </span>
                  )}
                  <MessageSquare className="w-4 h-4 text-white/40" />
                </div>
              </div>
              
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <AnimatePresence>
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        message.role === 'user' 
                          ? 'bg-gradient-to-r from-pink-600/80 to-pink-500/80 text-white' 
                          : 'bg-white/10 text-white/90 border border-white/5'
                      }`}>
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        <p className="text-[10px] mt-1 opacity-50">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white/10 rounded-2xl px-4 py-2.5 border border-white/5">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input Area */}
              <div className="p-3 border-t border-white/10 bg-black/30">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Message your AI Alter Ego..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 text-sm"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim()}
                    className="p-2.5 bg-gradient-to-r from-pink-600 to-cyan-500 rounded-xl disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Automation Button - Below Chat Window */}
            {hasAlterEgo && characterCard && sessionId && (
              <AutomationDropdown
                userId={user?.id || ''}
                characterCard={characterCard}
                conversationHistory={messages}
                sessionId={sessionId}
                connectedPlatforms={socialAutomation}
              />
            )}
          </div>

          {/* Right Panel - Social Media Automation */}
          <div className="w-full lg:w-72 flex-shrink-0 order-2 lg:order-last">
            <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-yellow-400" />
                Social Media Automation
              </h3>
              
              <div className="space-y-2.5">
                {/* Twitter */}
                <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={socialAutomation.twitter}
                    onChange={(e) => setSocialAutomation(prev => ({ ...prev, twitter: e.target.checked }))}
                    className="sr-only"
                  />
                  <div className={`w-9 h-5 rounded-full relative transition-colors ${socialAutomation.twitter ? 'bg-gradient-to-r from-pink-600 to-cyan-500' : 'bg-white/10'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-lg transition-transform ${socialAutomation.twitter ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </div>
                  <Twitter className="w-4 h-4 text-[#1DA1F2]" />
                  <span className="text-white/80 text-sm flex-1">Twitter / X</span>
                  {socialAutomation.twitter && <span className="text-xs text-green-400">Active</span>}
                </label>
                
                {/* Farcaster */}
                <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={socialAutomation.farcaster}
                    onChange={(e) => setSocialAutomation(prev => ({ ...prev, farcaster: e.target.checked }))}
                    className="sr-only"
                  />
                  <div className={`w-9 h-5 rounded-full relative transition-colors ${socialAutomation.farcaster ? 'bg-gradient-to-r from-pink-600 to-cyan-500' : 'bg-white/10'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-lg transition-transform ${socialAutomation.farcaster ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </div>
                  <FarcasterIcon className="w-4 h-4 text-purple-400" />
                  <span className="text-white/80 text-sm flex-1">Farcaster</span>
                  {socialAutomation.farcaster && <span className="text-xs text-green-400">Active</span>}
                </label>
                
                {/* BASEapp */}
                <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={socialAutomation.baseapp}
                    onChange={(e) => setSocialAutomation(prev => ({ ...prev, baseapp: e.target.checked }))}
                    className="sr-only"
                  />
                  <div className={`w-9 h-5 rounded-full relative transition-colors ${socialAutomation.baseapp ? 'bg-gradient-to-r from-pink-600 to-cyan-500' : 'bg-white/10'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-lg transition-transform ${socialAutomation.baseapp ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </div>
                  <BaseIcon className="w-4 h-4 text-blue-500" />
                  <span className="text-white/80 text-sm flex-1">BASEapp</span>
                  {socialAutomation.baseapp && <span className="text-xs text-green-400">Active</span>}
                </label>
              </div>
              
              {/* Status */}
              <div className="mt-4 p-3 bg-white/5 rounded-xl">
                <p className="text-white/40 text-xs">
                  {Object.values(socialAutomation).filter(Boolean).length} platform(s) connected
                </p>
                <div className="mt-2 flex gap-1">
                  <div className={`w-2 h-2 rounded-full ${socialAutomation.twitter ? 'bg-green-400' : 'bg-white/20'}`} />
                  <div className={`w-2 h-2 rounded-full ${socialAutomation.farcaster ? 'bg-green-400' : 'bg-white/20'}`} />
                  <div className={`w-2 h-2 rounded-full ${socialAutomation.baseapp ? 'bg-green-400' : 'bg-white/20'}`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer - Fixed at bottom */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3 border-t border-white/5 bg-black/60 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <p className="text-white/40 text-xs">coming soon on</p>
          <img src="/Sandchain.png" alt="Sandchain Logo" className="h-6 sm:h-8 w-auto" />
          <p className="text-white/30 text-[10px] sm:text-xs">
            New Prontera Corp. 2025™ All Rights Reserved
          </p>
        </div>
      </footer>

      {/* Character Card Generation/Edit Modal */}
      {user && (
        <CharacterCardModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          userId={user.id}
          twitterAccessToken={userProfile?.twitter_access_token || undefined}
          mode={modalMode}
          existingCard={characterCard || undefined}
          existingScores={profileScores || undefined}
          existingMetrics={twitterMetrics || undefined}
          onSuccess={handleCharacterCardSuccess}
        />
      )}
    </div>
  );
}
