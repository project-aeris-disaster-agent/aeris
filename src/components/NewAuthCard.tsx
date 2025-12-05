import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Mail, Lock, Eye, EyeClosed, ArrowRight, User } from 'lucide-react';
import { cn } from "@/lib/utils";
import { getTwitterOAuthService } from '@/services/twitterOAuth';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

interface NewAuthCardProps {
  onSuccess?: (userData: { email: string; name?: string }) => void;
}

export function NewAuthCard({ onSuccess }: NewAuthCardProps) {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { showError } = useNotifications();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTwitterLoading, setIsTwitterLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For 3D card effect - increased rotation range for more pronounced 3D effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [10, -10]);
  const rotateY = useTransform(mouseX, [-300, 300], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    
    // Validation
    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    
    if (authMode === 'signup') {
      if (!name.trim()) {
        setError('Please enter your name.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
    }
    
    setIsLoading(true);
    
    try {
      if (authMode === 'signup') {
        const { error } = await signUp(email, password, name);
        
        if (error) {
          setError(error.message || 'Failed to create account. Please try again.');
          setIsLoading(false);
          return;
        }
        
        // Success - redirect to home
        onSuccess?.({ email, name });
        navigate('/home');
      } else {
        const { error } = await signIn(email, password);
        
        if (error) {
          setError(error.message || 'Failed to sign in. Please check your credentials.');
          setIsLoading(false);
          return;
        }
        
        // Success - redirect to home
        onSuccess?.({ email });
        navigate('/home');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleTwitterSignIn = async () => {
    try {
      setIsTwitterLoading(true);
      const oauthService = getTwitterOAuthService();
      const { url } = await oauthService.getAuthorizationUrl();
      
      // Redirect to Twitter OAuth
      window.location.href = url;
    } catch (error) {
      console.error('Twitter sign-in error:', error);
      setIsTwitterLoading(false);
      // Show error to user
      showError('Failed to initiate Twitter sign-in. Please check your environment variables.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="w-full max-w-sm relative z-10"
      style={{ perspective: 1500 }}
    >
      <motion.div
        className="relative"
        style={{ rotateX, rotateY }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        whileHover={{ z: 10 }}
      >
        <div className="relative group">
          {/* Card glow effect - reduced intensity */}
          <motion.div 
            className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-70 transition-opacity duration-700"
            animate={{
              boxShadow: [
                "0 0 10px 2px rgba(255,255,255,0.03)",
                "0 0 15px 5px rgba(255,255,255,0.05)",
                "0 0 10px 2px rgba(255,255,255,0.03)"
              ],
              opacity: [0.2, 0.4, 0.2]
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "easeInOut", 
              repeatType: "mirror" 
            }}
          />

          {/* Traveling light beam effect - reduced opacity */}
          <div className="absolute -inset-[1px] rounded-2xl overflow-hidden">
            {/* Top light beam - enhanced glow */}
            <motion.div 
              className="absolute top-0 left-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-white to-transparent opacity-70"
              initial={{ filter: "blur(2px)" }}
              animate={{ 
                left: ["-50%", "100%"],
                opacity: [0.3, 0.7, 0.3],
                filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"]
              }}
              transition={{ 
                left: {
                  duration: 2.5, 
                  ease: "easeInOut", 
                  repeat: Infinity,
                  repeatDelay: 1
                },
                opacity: {
                  duration: 1.2,
                  repeat: Infinity,
                  repeatType: "mirror"
                },
                filter: {
                  duration: 1.5,
                  repeat: Infinity,
                  repeatType: "mirror"
                }
              }}
            />
            
            {/* Right light beam - enhanced glow */}
            <motion.div 
              className="absolute top-0 right-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-white to-transparent opacity-70"
              initial={{ filter: "blur(2px)" }}
              animate={{ 
                top: ["-50%", "100%"],
                opacity: [0.3, 0.7, 0.3],
                filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"]
              }}
              transition={{ 
                top: {
                  duration: 2.5, 
                  ease: "easeInOut", 
                  repeat: Infinity,
                  repeatDelay: 1,
                  delay: 0.6
                },
                opacity: {
                  duration: 1.2,
                  repeat: Infinity,
                  repeatType: "mirror",
                  delay: 0.6
                },
                filter: {
                  duration: 1.5,
                  repeat: Infinity,
                  repeatType: "mirror",
                  delay: 0.6
                }
              }}
            />
            
            {/* Bottom light beam - enhanced glow */}
            <motion.div 
              className="absolute bottom-0 right-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-white to-transparent opacity-70"
              initial={{ filter: "blur(2px)" }}
              animate={{ 
                right: ["-50%", "100%"],
                opacity: [0.3, 0.7, 0.3],
                filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"]
              }}
              transition={{ 
                right: {
                  duration: 2.5, 
                  ease: "easeInOut", 
                  repeat: Infinity,
                  repeatDelay: 1,
                  delay: 1.2
                },
                opacity: {
                  duration: 1.2,
                  repeat: Infinity,
                  repeatType: "mirror",
                  delay: 1.2
                },
                filter: {
                  duration: 1.5,
                  repeat: Infinity,
                  repeatType: "mirror",
                  delay: 1.2
                }
              }}
            />
            
            {/* Left light beam - enhanced glow */}
            <motion.div 
              className="absolute bottom-0 left-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-white to-transparent opacity-70"
              initial={{ filter: "blur(2px)" }}
              animate={{ 
                bottom: ["-50%", "100%"],
                opacity: [0.3, 0.7, 0.3],
                filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"]
              }}
              transition={{ 
                bottom: {
                  duration: 2.5, 
                  ease: "easeInOut", 
                  repeat: Infinity,
                  repeatDelay: 1,
                  delay: 1.8
                },
                opacity: {
                  duration: 1.2,
                  repeat: Infinity,
                  repeatType: "mirror",
                  delay: 1.8
                },
                filter: {
                  duration: 1.5,
                  repeat: Infinity,
                  repeatType: "mirror",
                  delay: 1.8
                }
              }}
            />
            
            {/* Subtle corner glow spots - reduced opacity */}
            <motion.div 
              className="absolute top-0 left-0 h-[5px] w-[5px] rounded-full bg-white/40 blur-[1px]"
              animate={{ 
                opacity: [0.2, 0.4, 0.2] 
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                repeatType: "mirror"
              }}
            />
            <motion.div 
              className="absolute top-0 right-0 h-[8px] w-[8px] rounded-full bg-white/60 blur-[2px]"
              animate={{ 
                opacity: [0.2, 0.4, 0.2] 
              }}
              transition={{ 
                duration: 2.4, 
                repeat: Infinity,
                repeatType: "mirror",
                delay: 0.5
              }}
            />
            <motion.div 
              className="absolute bottom-0 right-0 h-[8px] w-[8px] rounded-full bg-white/60 blur-[2px]"
              animate={{ 
                opacity: [0.2, 0.4, 0.2] 
              }}
              transition={{ 
                duration: 2.2, 
                repeat: Infinity,
                repeatType: "mirror",
                delay: 1
              }}
            />
            <motion.div 
              className="absolute bottom-0 left-0 h-[5px] w-[5px] rounded-full bg-white/40 blur-[1px]"
              animate={{ 
                opacity: [0.2, 0.4, 0.2] 
              }}
              transition={{ 
                duration: 2.3, 
                repeat: Infinity,
                repeatType: "mirror",
                delay: 1.5
              }}
            />
          </div>

          {/* Card border glow - reduced opacity */}
          <div className="absolute -inset-[0.5px] rounded-2xl bg-gradient-to-r from-white/3 via-white/7 to-white/3 opacity-0 group-hover:opacity-70 transition-opacity duration-500" />
          
          {/* Glass card background */}
          <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/[0.05] shadow-2xl overflow-hidden">
            {/* Subtle card inner patterns */}
            <div className="absolute inset-0 opacity-[0.03]" 
              style={{
                backgroundImage: `linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)`,
                backgroundSize: '30px 30px'
              }}
            />

            {/* Logo and header */}
            <div className="text-center space-y-1 mb-5">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", duration: 0.8 }}
                className="mx-auto w-10 h-10 rounded-full border border-white/10 flex items-center justify-center relative overflow-hidden"
              >
                <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">S</span>
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80"
              >
                {authMode === 'signup' ? 'Create Account' : 'Welcome Back'}
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-white/60 text-xs"
              >
                {authMode === 'signup' ? 'Sign up to get started with SONA' : 'Sign in to continue to SONA'}
              </motion.p>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-xs"
              >
                {error}
              </motion.div>
            )}

            {/* Login/Signup form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <motion.div className="space-y-3">
                {/* Name input - only for signup */}
                {authMode === 'signup' && (
                  <motion.div 
                    className={`relative ${focusedInput === "name" ? 'z-10' : ''}`}
                    whileFocus={{ scale: 1.02 }}
                    whileHover={{ scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="absolute -inset-[0.5px] bg-gradient-to-r from-white/10 via-white/5 to-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300" />
                    
                    <div className="relative flex items-center overflow-hidden rounded-lg">
                      <User className={`absolute left-3 w-4 h-4 transition-all duration-300 ${
                        focusedInput === "name" ? 'text-white' : 'text-white/40'
                      }`} />
                      
                      <Input
                        type="text"
                        placeholder="Full Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onFocus={() => setFocusedInput("name")}
                        onBlur={() => setFocusedInput(null)}
                        className="w-full bg-white/5 border-transparent focus:border-white/20 text-white placeholder:text-white/30 h-10 transition-all duration-300 pl-10 pr-3 focus:bg-white/10"
                      />
                      
                      {focusedInput === "name" && (
                        <motion.div 
                          layoutId="input-highlight"
                          className="absolute inset-0 bg-white/5 -z-10"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        />
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Email input */}
                <motion.div 
                  className={`relative ${focusedInput === "email" ? 'z-10' : ''}`}
                  whileFocus={{ scale: 1.02 }}
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <div className="absolute -inset-[0.5px] bg-gradient-to-r from-white/10 via-white/5 to-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300" />
                  
                  <div className="relative flex items-center overflow-hidden rounded-lg">
                    <Mail className={`absolute left-3 w-4 h-4 transition-all duration-300 ${
                      focusedInput === "email" ? 'text-white' : 'text-white/40'
                    }`} />
                    
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedInput("email")}
                      onBlur={() => setFocusedInput(null)}
                      className="w-full bg-white/5 border-transparent focus:border-white/20 text-white placeholder:text-white/30 h-10 transition-all duration-300 pl-10 pr-3 focus:bg-white/10"
                    />
                    
                    {/* Input highlight effect */}
                    {focusedInput === "email" && (
                      <motion.div 
                        layoutId="input-highlight"
                        className="absolute inset-0 bg-white/5 -z-10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </div>
                </motion.div>

                {/* Password input */}
                <motion.div 
                  className={`relative ${focusedInput === "password" ? 'z-10' : ''}`}
                  whileFocus={{ scale: 1.02 }}
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <div className="absolute -inset-[0.5px] bg-gradient-to-r from-white/10 via-white/5 to-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300" />
                  
                  <div className="relative flex items-center overflow-hidden rounded-lg">
                    <Lock className={`absolute left-3 w-4 h-4 transition-all duration-300 ${
                      focusedInput === "password" ? 'text-white' : 'text-white/40'
                    }`} />
                    
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedInput("password")}
                      onBlur={() => setFocusedInput(null)}
                      className="w-full bg-white/5 border-transparent focus:border-white/20 text-white placeholder:text-white/30 h-10 transition-all duration-300 pl-10 pr-10 focus:bg-white/10"
                    />
                    
                    {/* Toggle password visibility */}
                    <div 
                      onClick={() => setShowPassword(!showPassword)} 
                      className="absolute right-3 cursor-pointer"
                    >
                      {showPassword ? (
                        <Eye className="w-4 h-4 text-white/40 hover:text-white transition-colors duration-300" />
                      ) : (
                        <EyeClosed className="w-4 h-4 text-white/40 hover:text-white transition-colors duration-300" />
                      )}
                    </div>
                    
                    {/* Input highlight effect */}
                    {focusedInput === "password" && (
                      <motion.div 
                        layoutId="input-highlight"
                        className="absolute inset-0 bg-white/5 -z-10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </div>
                </motion.div>

                {/* Confirm Password input - only for signup */}
                {authMode === 'signup' && (
                  <motion.div 
                    className={`relative ${focusedInput === "confirmPassword" ? 'z-10' : ''}`}
                    whileFocus={{ scale: 1.02 }}
                    whileHover={{ scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="absolute -inset-[0.5px] bg-gradient-to-r from-white/10 via-white/5 to-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300" />
                    
                    <div className="relative flex items-center overflow-hidden rounded-lg">
                      <Lock className={`absolute left-3 w-4 h-4 transition-all duration-300 ${
                        focusedInput === "confirmPassword" ? 'text-white' : 'text-white/40'
                      }`} />
                      
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onFocus={() => setFocusedInput("confirmPassword")}
                        onBlur={() => setFocusedInput(null)}
                        className="w-full bg-white/5 border-transparent focus:border-white/20 text-white placeholder:text-white/30 h-10 transition-all duration-300 pl-10 pr-10 focus:bg-white/10"
                      />
                      
                      {/* Toggle password visibility */}
                      <div 
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                        className="absolute right-3 cursor-pointer"
                      >
                        {showConfirmPassword ? (
                          <Eye className="w-4 h-4 text-white/40 hover:text-white transition-colors duration-300" />
                        ) : (
                          <EyeClosed className="w-4 h-4 text-white/40 hover:text-white transition-colors duration-300" />
                        )}
                      </div>
                      
                      {/* Input highlight effect */}
                      {focusedInput === "confirmPassword" && (
                        <motion.div 
                          layoutId="input-highlight"
                          className="absolute inset-0 bg-white/5 -z-10"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>

              {/* Remember me & Forgot password - only for login */}
              {authMode === 'login' && (
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={() => setRememberMe(!rememberMe)}
                        className="appearance-none h-4 w-4 rounded border border-white/20 bg-white/5 checked:bg-white checked:border-white focus:outline-none focus:ring-1 focus:ring-white/30 transition-all duration-200"
                      />
                      {rememberMe && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="absolute inset-0 flex items-center justify-center text-black pointer-events-none"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </motion.div>
                      )}
                    </div>
                    <label htmlFor="remember-me" className="text-xs text-white/60 hover:text-white/80 transition-colors duration-200 cursor-pointer">
                      Remember me
                    </label>
                  </div>
                  
                  <div className="text-xs relative group/link">
                    <Link to="/forgot-password" className="text-white/60 hover:text-white transition-colors duration-200">
                      Forgot password?
                    </Link>
                  </div>
                </div>
              )}

              {/* Sign in button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading}
                className="w-full relative group/button mt-5"
              >
                {/* Button glow effect - reduced intensity */}
                <div className="absolute inset-0 bg-white/10 rounded-lg blur-lg opacity-0 group-hover/button:opacity-70 transition-opacity duration-300" />
                
                <div className="relative overflow-hidden bg-white text-black font-medium h-10 rounded-lg transition-all duration-300 flex items-center justify-center">
                  {/* Button background animation */}
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 -z-10"
                    animate={{ 
                      x: ['-100%', '100%'],
                    }}
                    transition={{ 
                      duration: 1.5, 
                      ease: "easeInOut", 
                      repeat: Infinity,
                      repeatDelay: 1
                    }}
                    style={{ 
                      opacity: isLoading ? 1 : 0,
                      transition: 'opacity 0.3s ease'
                    }}
                  />
                  
                  <AnimatePresence mode="wait">
                    {isLoading ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center"
                      >
                        <div className="w-4 h-4 border-2 border-black/70 border-t-transparent rounded-full animate-spin" />
                      </motion.div>
                    ) : (
                      <motion.span
                        key="button-text"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-1 text-sm font-medium"
                      >
                        {authMode === 'signup' ? 'Sign Up' : 'Sign In'}
                        <ArrowRight className="w-3 h-3 group-hover/button:translate-x-1 transition-transform duration-300" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.button>

              {/* Minimal Divider */}
              <div className="relative mt-2 mb-5 flex items-center">
                <div className="flex-grow border-t border-white/5"></div>
                <motion.span 
                  className="mx-3 text-xs text-white/40"
                  initial={{ opacity: 0.7 }}
                  animate={{ opacity: [0.7, 0.9, 0.7] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  or
                </motion.span>
                <div className="flex-grow border-t border-white/5"></div>
              </div>

              {/* Twitter/X Sign In */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleTwitterSignIn}
                disabled={isTwitterLoading}
                className="w-full relative group/twitter mt-3"
              >
                <div className="absolute inset-0 bg-white/5 rounded-lg blur opacity-0 group-hover/twitter:opacity-70 transition-opacity duration-300" />
                
                <div className="relative overflow-hidden bg-white/5 text-white font-medium h-10 rounded-lg border border-white/10 hover:border-white/20 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50">
                  {isTwitterLoading ? (
                    <div className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 text-white/80 group-hover/twitter:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  )}
                  
                  <span className="text-white/80 group-hover/twitter:text-white transition-colors text-xs">
                    {isTwitterLoading ? 'Connecting...' : 'Sign in with X'}
                  </span>
                  
                  {/* Button hover effect */}
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%' }}
                    transition={{ 
                      duration: 1, 
                      ease: "easeInOut"
                    }}
                  />
                </div>
              </motion.button>

              {/* Toggle between login/signup */}
              <motion.p 
                className="text-center text-xs text-white/60 mt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'signup' : 'login');
                    setError(null);
                    // Clear form fields when switching modes
                    if (authMode === 'signup') {
                      setName("");
                      setConfirmPassword("");
                    }
                  }}
                  className="relative inline-block group/signup"
                >
                  <span className="relative z-10 text-white group-hover/signup:text-white/70 transition-colors duration-300 font-medium">
                    {authMode === 'login' ? 'Sign up' : 'Sign in'}
                  </span>
                  <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-white group-hover/signup:w-full transition-all duration-300" />
                </button>
              </motion.p>
            </form>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

