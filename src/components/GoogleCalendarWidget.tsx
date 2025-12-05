import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown, ExternalLink } from 'lucide-react';

interface GoogleCalendarWidgetProps {
  isConnected?: boolean;
}

export function GoogleCalendarWidget({ isConnected = false }: GoogleCalendarWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500/20 to-red-500/20 border border-white/10">
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-left">
            <h3 className="text-white font-bold text-sm">Google Calendar</h3>
            <p className="text-white/40 text-xs">
              {isConnected ? 'Connected' : 'Not connected'}
            </p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-white/40" />
        </motion.div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-3 border-t border-white/10">
              {isConnected ? (
                <>
                  {/* Connected State */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-xl border border-green-500/30">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-green-400 text-xs font-medium">Calendar Connected</span>
                      </div>
                    </div>
                    
                    {/* Calendar Preview Placeholder */}
                    <div className="bg-white/5 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white/60 text-xs">Upcoming Events</span>
                        <button className="text-cyan-400 hover:text-cyan-300 text-xs flex items-center gap-1">
                          View All
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {/* Placeholder event items */}
                        <div className="flex items-start gap-2 p-2 bg-white/5 rounded-lg">
                          <div className="w-1 h-full bg-cyan-400 rounded-full mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white/80 text-xs font-medium truncate">No upcoming events</p>
                            <p className="text-white/40 text-[10px]">Connect your calendar to see events</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Not Connected State */}
                  <div className="space-y-3">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-white/60 text-xs mb-3">
                        Connect your Google Calendar to sync events and schedule posts around your availability.
                      </p>
                      
                      {/* Connect Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Implement Google Calendar OAuth flow
                          console.log('Connect Google Calendar clicked');
                        }}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span className="text-white font-medium text-sm">Connect Google Calendar</span>
                      </button>
                      
                      <p className="text-white/40 text-[10px] text-center">
                        You'll be redirected to Google to authorize access
                      </p>
                    </div>
                    
                    {/* Features List */}
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-2 text-white/50 text-xs">
                        <div className="w-1 h-1 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
                        <span>Sync your calendar events</span>
                      </div>
                      <div className="flex items-start gap-2 text-white/50 text-xs">
                        <div className="w-1 h-1 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
                        <span>Schedule posts around your availability</span>
                      </div>
                      <div className="flex items-start gap-2 text-white/50 text-xs">
                        <div className="w-1 h-1 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
                        <span>Auto-avoid posting during busy times</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

