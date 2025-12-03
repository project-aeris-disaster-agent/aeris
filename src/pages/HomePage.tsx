import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DitheringShader } from '@/components/ui/dithering-shader';
import { CharacterCardModal } from '@/components/CharacterCardModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCharacterCard } from '@/services/characterCardService';
import type { ElizaOSCharacterCard } from '@/types/database';
import { 
  Send, 
  Sparkles, 
  Settings, 
  MessageSquare,
  Twitter,
  Users,
  Heart,
  Repeat2,
  Eye,
  Zap,
  Bot,
  LogOut
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI Alter Ego. I can help you manage your social presence, draft posts, and engage with your community. What would you like to do today?",
      timestamp: new Date(),
    }
  ]);
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

          // If user has a character card, fetch it
          if (typedProfile.character_card_generated) {
            try {
              const card = await getCharacterCard(user.id);
              if (card) {
                setCharacterCard(card.card_data);
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          // We have a token, open the modal
          setIsModalOpen(true);
          return;
        }
      }
      
      // User hasn't connected Twitter
      alert('Please connect your Twitter account first to generate your AI clone.\n\nGo to the Auth page and sign in with Twitter.');
      return;
    }
    setIsModalOpen(true);
  };

  const handleCharacterCardSuccess = (card: ElizaOSCharacterCard) => {
    setCharacterCard(card);
    setHasAlterEgo(true);
    // Update the initial message to reflect the character's personality
    setMessages([{
      id: '1',
      role: 'assistant',
      content: `Hello! I'm ${card.name}, your AI Alter Ego. ${card.bio[0] || "I can help you manage your social presence, draft posts, and engage with your community."} What would you like to do today?`,
      timestamp: new Date(),
    }]);
  };

  // Compute display stats from profile or character card
  const displayStats = {
    followers: userProfile?.twitter_username ? '...' : '12.4K',
    following: '...',
    tweets: '...',
    likes: '...',
    impressions: '...',
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

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
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I understand your request. As your AI Alter Ego, I'm here to help you craft the perfect response. This is a placeholder - full AI integration coming soon!",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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
              
              {/* Stats */}
              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                <div className="bg-white/5 rounded-lg p-2">
                  <Users className="w-3 h-3 mx-auto text-cyan-400 mb-0.5" />
                  <p className="text-white font-bold text-xs">{displayStats.followers}</p>
                  <p className="text-white/40 text-[10px]">Followers</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <Heart className="w-3 h-3 mx-auto text-pink-500 mb-0.5" />
                  <p className="text-white font-bold text-xs">{displayStats.likes}</p>
                  <p className="text-white/40 text-[10px]">Likes</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <Eye className="w-3 h-3 mx-auto text-purple-400 mb-0.5" />
                  <p className="text-white font-bold text-xs">{displayStats.impressions}</p>
                  <p className="text-white/40 text-[10px]">Views</p>
                </div>
              </div>
              
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-center">
                <div className="bg-white/5 rounded-lg p-1.5 flex items-center justify-center gap-1">
                  <Repeat2 className="w-3 h-3 text-green-400" />
                  <span className="text-white/70 text-[10px]">{displayStats.tweets} Tweets</span>
                </div>
                <div className="bg-white/5 rounded-lg p-1.5 flex items-center justify-center gap-1">
                  <Users className="w-3 h-3 text-blue-400" />
                  <span className="text-white/70 text-[10px]">{displayStats.following} Following</span>
                </div>
              </div>
            </div>

            {/* Generate AI Clone Button */}
            <button
              onClick={handleGenerateClone}
              disabled={isLoadingProfile}
              className="w-full bg-gradient-to-r from-pink-600 to-cyan-500 rounded-xl p-[2px] hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100"
            >
              <div className="bg-black/80 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center justify-center gap-2">
                {hasAlterEgo ? (
                  <>
                    <Settings className="w-4 h-4 text-white" />
                    <span className="text-white font-bold text-sm">Edit Alter Ego</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-white" />
                    <span className="text-white font-bold text-sm">GENERATE AI CLONE</span>
                    <Zap className="w-3 h-3 text-yellow-400" />
                  </>
                )}
              </div>
            </button>
          </div>

          {/* Center Panel - Chat Interface */}
          <div className="flex-1 min-w-0 order-last lg:order-none">
            <div className="flex flex-col h-[500px] lg:h-[600px] bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              {/* Chat Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/30">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Bot className="w-5 h-5 text-cyan-400" />
                    <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${hasAlterEgo ? 'bg-green-400' : 'bg-yellow-400'}`} />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">
                      {characterCard?.name || 'AI Alter Ego'}
                    </h3>
                    <p className="text-white/40 text-xs">
                      {hasAlterEgo ? 'Online • Ready to assist' : 'Generate your clone to start'}
                    </p>
                  </div>
                </div>
                <MessageSquare className="w-4 h-4 text-white/40" />
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

      {/* Character Card Generation Modal */}
      {user && (
        <CharacterCardModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          userId={user.id}
          twitterAccessToken={userProfile?.twitter_access_token || undefined}
          onSuccess={handleCharacterCardSuccess}
        />
      )}
    </div>
  );
}
