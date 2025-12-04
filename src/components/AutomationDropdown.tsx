import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  ChevronDown, 
  Twitter, 
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// Custom icons matching HomePage
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
import type { ElizaOSCharacterCard } from '@/types/database';
import type { ChatMessage } from '@/services/chatService';
import { 
  generateRecommendedPost, 
  schedulePost, 
  postImmediately,
  calculateNextScheduleTime,
  type RecommendedPost 
} from '@/services/automationService';

interface AutomationDropdownProps {
  userId: string;
  characterCard: ElizaOSCharacterCard | null;
  conversationHistory: ChatMessage[];
  sessionId: string | null;
  connectedPlatforms: {
    twitter: boolean;
    farcaster: boolean;
    baseapp: boolean;
  };
}

type ScheduleType = 'instant' | '24hrs' | '48hrs' | '72hrs' | 'daily' | 'weekly' | 'custom';

export function AutomationDropdown({
  userId,
  characterCard,
  conversationHistory,
  sessionId,
  connectedPlatforms,
}: AutomationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [recommendedPost, setRecommendedPost] = useState<RecommendedPost | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [scheduleType, setScheduleType] = useState<ScheduleType>('instant');
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postStatus, setPostStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Auto-generate post when dropdown opens
  useEffect(() => {
    if (isOpen && characterCard && sessionId && !recommendedPost && !isGenerating) {
      handleGeneratePost();
    }
  }, [isOpen, characterCard, sessionId]);

  // Update selected platforms based on connected platforms
  useEffect(() => {
    const platforms: string[] = [];
    if (connectedPlatforms.twitter) platforms.push('twitter');
    if (connectedPlatforms.farcaster) platforms.push('farcaster');
    if (connectedPlatforms.baseapp) platforms.push('baseapp');
    setSelectedPlatforms(platforms);
  }, [connectedPlatforms]);

  const handleGeneratePost = async () => {
    if (!characterCard || !sessionId) return;

    setIsGenerating(true);
    setPostStatus(null);

    try {
      const post = await generateRecommendedPost(
        userId,
        characterCard,
        conversationHistory,
        sessionId
      );
      setRecommendedPost(post);
    } catch (error) {
      console.error('Failed to generate post:', error);
      setPostStatus({
        type: 'error',
        message: 'Failed to generate post. Please try again.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePost = async () => {
    if (!recommendedPost || selectedPlatforms.length === 0) {
      setPostStatus({
        type: 'error',
        message: 'Please select at least one platform.',
      });
      return;
    }

    setIsPosting(true);
    setPostStatus(null);

    try {
      if (scheduleType === 'instant') {
        // Post immediately
        const results = await postImmediately(userId, recommendedPost.content, selectedPlatforms);
        const allSuccess = results.every(r => r.success);
        
        if (allSuccess) {
          setPostStatus({
            type: 'success',
            message: `Posted successfully to ${selectedPlatforms.join(', ')}!`,
          });
          // Reset after 3 seconds
          setTimeout(() => {
            setPostStatus(null);
            setIsOpen(false);
          }, 3000);
        } else {
          const errors = results.filter(r => !r.success);
          setPostStatus({
            type: 'error',
            message: `Failed to post to: ${errors.map(e => e.platform).join(', ')}`,
          });
        }
      } else {
        // Schedule post
        let scheduledDate: Date;

        if (scheduleType === 'custom') {
          if (!customDate || !customTime) {
            setPostStatus({
              type: 'error',
              message: 'Please select both date and time.',
            });
            setIsPosting(false);
            return;
          }
          scheduledDate = new Date(`${customDate}T${customTime}`);
        } else {
          scheduledDate = calculateNextScheduleTime(scheduleType as '24hrs' | '48hrs' | '72hrs' | 'daily' | 'weekly');
        }

        await schedulePost(userId, recommendedPost.content, scheduledDate, selectedPlatforms);
        
        setPostStatus({
          type: 'success',
          message: `Post scheduled for ${scheduledDate.toLocaleString()}!`,
        });
        
        setTimeout(() => {
          setPostStatus(null);
          setIsOpen(false);
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to post:', error);
      setPostStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to post. Please try again.',
      });
    } finally {
      setIsPosting(false);
    }
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const scheduleOptions: { value: ScheduleType; label: string; shortLabel: string }[] = [
    { value: 'instant', label: 'Post Now', shortLabel: 'Now' },
    { value: '24hrs', label: 'In 24 Hours', shortLabel: '24h' },
    { value: '48hrs', label: 'In 48 Hours', shortLabel: '48h' },
    { value: '72hrs', label: 'In 72 Hours', shortLabel: '72h' },
    { value: 'daily', label: 'Daily', shortLabel: 'Daily' },
    { value: 'weekly', label: 'Weekly', shortLabel: 'Weekly' },
    { value: 'custom', label: 'Custom Date & Time', shortLabel: 'Custom' },
  ];

  const availablePlatforms = [
    { id: 'twitter', name: 'Twitter / X', icon: Twitter, enabled: connectedPlatforms.twitter },
    { id: 'farcaster', name: 'Farcaster', icon: FarcasterIcon, enabled: connectedPlatforms.farcaster },
    { id: 'baseapp', name: 'BASEapp', icon: BaseIcon, enabled: connectedPlatforms.baseapp },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Automation Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full mt-3 bg-gradient-to-r from-yellow-600/80 to-orange-500/80 hover:from-yellow-600 hover:to-orange-500 rounded-xl p-[2px] transition-all duration-200 hover:scale-[1.02]"
      >
        <div className="bg-black/80 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center justify-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-white font-bold text-sm">AUTOMATION</span>
          <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Panel - Premium Gold/Black Theme */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 right-0 z-50 overflow-hidden
              bottom-full mb-2 
              lg:bottom-auto lg:top-full lg:mt-2"
            style={{
              // Simple, reliable calculation: viewport height - footer (80px) - margins (20px)
              maxHeight: `calc(100vh - 100px)`,
            }}
          >
            {/* Premium Gold Border Container */}
            <div className="bg-gradient-to-br from-yellow-600/20 via-yellow-500/10 to-orange-500/20 rounded-2xl p-[2px] shadow-2xl h-full flex flex-col">
              <div className="bg-black/95 backdrop-blur-xl rounded-2xl border-2 border-yellow-500/30 relative overflow-hidden h-full flex flex-col">
                {/* Decorative Corner Accents */}
                <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-yellow-500/50 rounded-tl-2xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-yellow-500/50 rounded-tr-2xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-yellow-500/50 rounded-bl-2xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-yellow-500/50 rounded-br-2xl" />
                
                <div className="p-3 space-y-2.5 relative z-10 flex-1 flex flex-col min-h-0">
                  {/* Premium Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-yellow-500/20">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-500/30">
                        <Zap className="w-4 h-4 text-yellow-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-sm flex items-center gap-2">
                          Recommended Post
                        </h3>
                        <p className="text-yellow-400/70 text-[10px] font-medium">Premium Automation</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 hover:bg-yellow-500/10 rounded-lg transition-colors border border-yellow-500/20 hover:border-yellow-500/40"
                    >
                      <X className="w-3.5 h-3.5 text-yellow-400/80" />
                    </button>
                  </div>

                  {/* Premium Post Content */}
                  {isGenerating ? (
                    <div className="bg-gradient-to-br from-black/60 to-black/40 rounded-lg p-4 border-2 border-yellow-500/20 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-2 bg-yellow-500/10 rounded-full border border-yellow-500/30">
                          <RefreshCw className="w-5 h-5 text-yellow-400 animate-spin" />
                        </div>
                        <p className="text-yellow-400/80 text-xs font-medium">Generating...</p>
                      </div>
                    </div>
                  ) : recommendedPost ? (
                    <div className="bg-gradient-to-br from-black/60 to-black/40 rounded-lg p-3 border-2 border-yellow-500/20 relative">
                      <div className="absolute top-1.5 left-1.5 w-2.5 h-2.5 border-l-2 border-t-2 border-yellow-500/50" />
                      <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 border-r-2 border-t-2 border-yellow-500/50" />
                      <div className="absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-l-2 border-b-2 border-yellow-500/50" />
                      <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-r-2 border-b-2 border-yellow-500/50" />
                      
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-semibold rounded border border-yellow-500/30">
                            AI-GENERATED
                          </span>
                        </div>
                        <button
                          onClick={handleGeneratePost}
                          className="p-1.5 hover:bg-yellow-500/10 rounded-lg transition-colors border border-yellow-500/20 hover:border-yellow-500/40"
                          title="Regenerate"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-yellow-400/80" />
                        </button>
                      </div>
                      <p className="text-white text-xs leading-tight whitespace-pre-wrap mb-2">
                        {recommendedPost.content}
                      </p>
                      {recommendedPost.suggestedTopics.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-yellow-500/10 flex flex-wrap gap-1.5">
                          {recommendedPost.suggestedTopics.map((topic, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-[10px] font-medium rounded-full border border-yellow-500/30"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gradient-to-br from-black/60 to-black/40 rounded-lg p-4 text-center border-2 border-yellow-500/20">
                      <p className="text-yellow-400/70 text-xs mb-3">Ready to generate your premium post</p>
                      <button
                        onClick={handleGeneratePost}
                        className="px-4 py-2 bg-gradient-to-r from-yellow-600/80 to-orange-500/80 hover:from-yellow-600 hover:to-orange-500 rounded-lg text-white text-xs font-bold hover:scale-105 transition-transform border border-yellow-500/30"
                      >
                        Generate Post
                      </button>
                    </div>
                  )}

                  {/* Simplified Platform Selection - Simple Checkboxes */}
                  <div>
                    <label className="text-yellow-400/80 text-[10px] font-semibold mb-1.5 block">
                      Platforms
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availablePlatforms.map((platform) => {
                        const Icon = platform.icon;
                        const isSelected = selectedPlatforms.includes(platform.id);
                        const isDisabled = !platform.enabled;

                        return (
                          <label
                            key={platform.id}
                            className={`flex items-center gap-1.5 cursor-pointer transition-all ${
                              isDisabled ? 'opacity-40 cursor-not-allowed' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => !isDisabled && togglePlatform(platform.id)}
                              disabled={isDisabled}
                              className="w-3.5 h-3.5 rounded border-2 border-yellow-500/40 bg-transparent checked:bg-yellow-500 checked:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <Icon className={`w-3 h-3 ${isSelected ? 'text-yellow-400' : 'text-white/50'}`} />
                            <span className={`text-[10px] ${isSelected ? 'text-yellow-400' : 'text-white/60'}`}>
                              {platform.id === 'twitter' ? 'X' : platform.id === 'farcaster' ? 'FC' : 'BASE'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Simplified Schedule Options - Numbers Only */}
                  <div>
                    <label className="text-yellow-400/80 text-[10px] font-semibold mb-1.5 block">
                      Schedule
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {scheduleOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setScheduleType(option.value)}
                          className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                            scheduleType === option.value
                              ? 'bg-gradient-to-r from-yellow-600/80 to-orange-500/80 text-white border border-yellow-500/50'
                              : 'bg-black/40 text-white/60 hover:text-white border border-yellow-500/20 hover:border-yellow-500/40'
                          }`}
                        >
                          {option.shortLabel}
                        </button>
                      ))}
                    </div>

                    {/* Simplified Custom Date/Time Picker */}
                    {scheduleType === 'custom' && (
                      <div className="mt-2 flex gap-1.5">
                        <input
                          type="date"
                          value={customDate}
                          onChange={(e) => setCustomDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="flex-1 bg-black/60 border border-yellow-500/30 rounded px-1.5 py-1 text-white text-[10px] focus:outline-none focus:border-yellow-500/60"
                        />
                        <input
                          type="time"
                          value={customTime}
                          onChange={(e) => setCustomTime(e.target.value)}
                          className="flex-1 bg-black/60 border border-yellow-500/30 rounded px-1.5 py-1 text-white text-[10px] focus:outline-none focus:border-yellow-500/60"
                        />
                      </div>
                    )}
                  </div>

                  {/* Premium Status Message */}
                  {postStatus && (
                    <div
                      className={`p-2 rounded-lg flex items-center gap-2 border-2 ${
                        postStatus.type === 'success'
                          ? 'bg-green-500/10 border-green-500/50'
                          : 'bg-red-500/10 border-red-500/50'
                      }`}
                    >
                      {postStatus.type === 'success' ? (
                        <div className="p-1 bg-green-500/20 rounded border border-green-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        </div>
                      ) : (
                        <div className="p-1 bg-red-500/20 rounded border border-red-500/30">
                          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        </div>
                      )}
                      <p
                        className={`text-xs font-semibold ${
                          postStatus.type === 'success' ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {postStatus.message}
                      </p>
                    </div>
                  )}

                  {/* Highlighted AUTOMATE NOW Button */}
                  <div className="pt-2 border-t-2 border-yellow-500/30">
                    <button
                      onClick={handlePost}
                      disabled={isPosting || !recommendedPost || selectedPlatforms.length === 0}
                      className="w-full bg-gradient-to-r from-yellow-500 via-yellow-600 to-orange-500 hover:from-yellow-400 hover:via-yellow-500 hover:to-orange-400 rounded-lg px-4 py-3 text-black font-extrabold text-sm hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 border-2 border-yellow-400/60 shadow-2xl shadow-yellow-500/40 disabled:shadow-none uppercase tracking-wider"
                    >
                      {isPosting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span className="text-xs">{scheduleType === 'instant' ? 'Posting...' : 'Scheduling...'}</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          {scheduleType === 'instant' ? 'AUTOMATE NOW' : 'SCHEDULE POST'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
}

