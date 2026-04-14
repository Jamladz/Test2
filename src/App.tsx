import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Users, User, Trophy, Play, Loader2, Share2, Copy, CheckCircle2, ArrowDownToLine, ArrowUpFromLine, Globe, Volume2, VolumeX, CheckSquare, Tv, Bell } from 'lucide-react';
import { useTonWallet, useTonConnectUI } from '@tonconnect/ui-react';
import { cn, triggerHaptic } from './lib/utils';
import { playSound, toggleMute, getIsMuted } from './lib/sounds';
import { translations, Language } from './lib/i18n';
import confetti from 'canvas-confetti';

// Create a custom confetti instance without workers to avoid OffscreenCanvas/getBoundingClientRect errors
const myConfetti = confetti.create(undefined, { useWorker: false, resize: true });
import WebApp from '@twa-dev/sdk';

// --- Icons ---
export const TonIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24Z" fill="#0098EA"/>
    <path d="M6.50195 7.33398H17.498C18.4847 7.33398 19.0647 8.42398 18.5113 9.24398L12.9446 17.4973C12.4846 18.1773 11.5113 18.1773 11.0513 17.4973L5.48462 9.24398C4.93129 8.42398 5.51795 7.33398 6.50195 7.33398ZM12 15.6673L16.248 9.33398H7.75195L12 15.6673Z" fill="white"/>
  </svg>
);

// --- Mock Data & Constants ---
const ADJECTIVES = ['crypto', 'ton', 'whale', 'ninja', 'diamond', 'moon', 'bull', 'bear', 'smart', 'rich', 'pro', 'master', 'lord', 'king', 'boss', 'alpha', 'mega', 'super', 'cyber', 'web3', 'defi', 'nft', 'meta', 'block', 'chain', 'node', 'miner', 'trader', 'hodler', 'degen', 'ape', 'punk', 'doge', 'pepe', 'shib', 'chad', 'sigma', 'based'];
const NOUNS = ['hunter', 'killer', 'rider', 'watcher', 'investor', 'money', 'guru', 'club', 'legend', 'god', 'hero', 'champion', 'fan', 'kid', 'boy', 'girl', 'man', 'dude', 'bro', 'guy', 'pal', 'buddy', 'friend', 'partner', 'ally', 'mate', 'team', 'squad', 'crew', 'gang', 'mob', 'clan', 'tribe', 'horde', 'swarm', 'pack'];
const RUSSIAN_NAMES = ['Ivan', 'Alexey', 'Dmitry', 'Sergey', 'Mikhail', 'Andrei', 'Egor', 'Nikita', 'Vladimir', 'Sasha', 'Misha', 'Dasha', 'Anya', 'Katya', 'Olya', 'Igor', 'Pavel', 'Roman', 'Viktor', 'Artem', 'Denis', 'Ilya', 'Maksim', 'Oleg', 'Ruslan', 'Timur', 'Vadim', 'Yuri', 'Anton', 'Boris', 'Gleb', 'Lev', 'Mark', 'Petr', 'Slava', 'Stanislav', 'Taras', 'Vitaly', 'Vlad', 'Yaroslav'];
const ARABIC_NAMES = ['Ahmed', 'Ali', 'Omar', 'Khaled', 'Hassan', 'Youssef', 'Tariq', 'Mahmoud', 'Ibrahim', 'Ziad', 'Karim', 'Nabil', 'Sami', 'Rami', 'Amir', 'Layla', 'Fatima', 'Yasmin', 'Mohammed', 'Mustafa', 'Hussein', 'Abbas', 'Adel', 'Ayman', 'Bassel', 'Fadi', 'Faris', 'Ghassan', 'Hadi', 'Hatem', 'Hesham', 'Imad', 'Issam', 'Jalal', 'Jamal', 'Kamal', 'Majed', 'Marwan', 'Mounir', 'Nader', 'Nasser', 'Nizar', 'Osama', 'Qasim', 'Raed', 'Saeed', 'Saleh', 'Salem', 'Samir', 'Tamer', 'Wael', 'Walid', 'Yasser'];

const generateBot = () => {
  const rand = Math.random();
  let name = '';
  const num = Math.floor(Math.random() * 90000) + 10000; // 5 digit number for absolute uniqueness
  
  if (rand < 0.33) {
    // Crypto style
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    name = `@${adj}_${noun}${num}`;
  } else if (rand < 0.66) {
    // Russian style
    const rName = RUSSIAN_NAMES[Math.floor(Math.random() * RUSSIAN_NAMES.length)];
    name = `@${rName.toLowerCase()}${num}`;
  } else {
    // Arabic style
    const aName = ARABIC_NAMES[Math.floor(Math.random() * ARABIC_NAMES.length)];
    name = `@${aName.toLowerCase()}${num}`;
  }
  
  return {
    name,
    color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`
  };
};

const GAME_DURATION = 15; // seconds for playing
const WAITING_DURATION = 20; // seconds for waiting
const HOUSE_EDGE = 0.03; // 3%
const REFERRAL_BONUS = 0.10; // 10%
const MIN_BUY_IN = 0.1;

// --- Types ---
type Participant = {
  id: string;
  name: string;
  color: string;
  amount: number;
  isBot: boolean;
  percentage?: number;
};

type GameState = 'waiting' | 'playing' | 'finished';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [showLangPrompt, setShowLangPrompt] = useState(false);
  const [showDailyRefPrompt, setShowDailyRefPrompt] = useState(false);
  const [showDailyBonus, setShowDailyBonus] = useState(false);
  const [showReferralWelcome, setShowReferralWelcome] = useState(false);
  const [showEarnPopup, setShowEarnPopup] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'game' | 'referrals' | 'profile' | 'tasks'>('game');
  const [activeGame, setActiveGame] = useState<'game1' | 'game2'>('game2');
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const walletConnected = !!wallet;
  const [balance, setBalance] = useState(() => parseFloat(localStorage.getItem('tq_real_balance_v2') || '0')); // Strictly real balance, resets old mock data
  
  // Global Deposit State
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(1);
  const [isDepositing, setIsDepositing] = useState(false);
  const [showWelcomeDeposit, setShowWelcomeDeposit] = useState(false);
  const [showUpdateInfo, setShowUpdateInfo] = useState(false);
  const [hasUnreadUpdates, setHasUnreadUpdates] = useState(() => !localStorage.getItem('tq_update_seen_v3'));
  const prevWalletConnected = useRef(false);
  
  useEffect(() => {
    localStorage.setItem('tq_real_balance_v2', balance.toString());
  }, [balance]);

  useEffect(() => {
    if (walletConnected && !prevWalletConnected.current && balance === 0) {
      setShowWelcomeDeposit(true);
    }
    prevWalletConnected.current = walletConnected;
  }, [walletConnected, balance]);

  const handleDeposit = async () => {
    if (depositAmount < 1) {
      alert(t('minDeposit1'));
      return;
    }
    playSound('click');
    setIsDepositing(true);
    
    try {
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60, // 60 sec
        messages: [
          {
            address: "UQDkJ-PPmaN7x4aqTEUlG3gqVoPI19-YHPYhuZLC0EDQgkWm",
            amount: (depositAmount * 1000000000).toString(), // nanoTON
          }
        ]
      };
      
      await tonConnectUI.sendTransaction(transaction);
      
      // If transaction succeeds
      setBalance(prev => prev + depositAmount);
      setShowDeposit(false);
      playSound('win');
      alert(`${t('depositSuccess')} ${depositAmount} TON!`);
    } catch (e: any) {
      console.error(e);
      // Ignore user rejection errors to prevent generic txFailed alert
      if (e?.message?.includes('User rejects') || e?.name?.includes('UserRejectsError') || e?.toString()?.includes('User rejects')) {
        console.log('User cancelled transaction');
      } else {
        alert(t('txFailed'));
      }
    } finally {
      setIsDepositing(false);
    }
  };

  const [username, setUsername] = useState(() => {
    if (WebApp.initDataUnsafe?.user?.username) {
      return '@' + WebApp.initDataUnsafe.user.username;
    } else if (WebApp.initDataUnsafe?.user?.first_name) {
      return '@' + WebApp.initDataUnsafe.user.first_name.replace(/\s+/g, '');
    }
    return '@TelegramUser';
  });
  const [photoUrl, setPhotoUrl] = useState(() => WebApp.initDataUnsafe?.user?.photo_url || '');
  const [lang, setLang] = useState<Language>('en');
  const [muted, setMuted] = useState(getIsMuted());
  const [liveUsers, setLiveUsers] = useState(2453);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    // Initialize Telegram WebApp
    WebApp.ready();
    WebApp.expand(); // Full screen
    try {
      WebApp.setHeaderColor('#1a1b26');
      WebApp.setBackgroundColor('#1a1b26');
    } catch (e) {}
    
    // Check for referral start_param
    const startParam = WebApp.initDataUnsafe?.start_param;
    if (startParam && !localStorage.getItem('tonqash_referrer')) {
      // User joined via a referral link!
      localStorage.setItem('tonqash_referrer', startParam);
      // In a real app, you would send this to your backend here
      console.log('Joined via referral:', startParam);
      
      // Show welcome bonus after loading
      setTimeout(() => {
        setShowReferralWelcome(true);
      }, 3000);
    }

    // Generate or load User ID
    let uid = localStorage.getItem('tonqash_uid');
    if (!uid) {
      uid = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem('tonqash_uid', uid);
    }
    setUserId(uid);

    // Live Users Simulation
    const interval = setInterval(() => {
      setLiveUsers(prev => {
        const change = Math.floor(Math.random() * 11) - 5; // -5 to +5
        let next = prev + change;
        if (next < 2400) next = 2400 + Math.floor(Math.random() * 20);
        if (next > 2600) next = 2600 - Math.floor(Math.random() * 20);
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Simulate loading
    const loadTimer = setTimeout(() => {
      setIsLoading(false);

      // Check language
      const savedLang = localStorage.getItem('tonqash_lang');
      if (savedLang) {
        setLang(savedLang as Language);
      } else {
        setShowLangPrompt(true);
      }

      // Check daily referral
      const lastRefPrompt = localStorage.getItem('tonqash_last_ref_prompt');
      const now = Date.now();
      if (!lastRefPrompt || now - parseInt(lastRefPrompt) > 86400000) {
        setTimeout(() => {
          setShowDailyRefPrompt(true);
          localStorage.setItem('tonqash_last_ref_prompt', now.toString());
        }, 1000);
      }

      // Daily Bonus & Earn Popup
      const lastBonus = localStorage.getItem('tonqash_last_bonus');
      if (!lastBonus || now - parseInt(lastBonus) > 86400000) {
         setTimeout(() => {
           setShowDailyBonus(true);
           localStorage.setItem('tonqash_last_bonus', now.toString());
         }, 2000);
      } else {
         // Show Earn Popup if daily bonus is not shown
         setTimeout(() => {
           setShowEarnPopup(true);
         }, 1000);
      }

    }, 2500);
    return () => clearTimeout(loadTimer);
  }, []);

  const handleToggleMute = () => {
    setMuted(toggleMute());
  };

  const t = (key: keyof typeof translations['en']) => translations[lang][key];

  const handleLangSelect = (selectedLang: Language) => {
    playSound('click');
    setLang(selectedLang);
    localStorage.setItem('tonqash_lang', selectedLang);
    setShowLangPrompt(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-[var(--color-tg-bg)] text-white items-center justify-center relative shadow-2xl overflow-hidden">
         <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 360] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
           <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[var(--color-game-primary)] to-[var(--color-game-secondary)] flex items-center justify-center font-bold text-6xl shadow-2xl shadow-[var(--color-game-primary)] text-stroke border-4 border-black/20">
             T
           </div>
         </motion.div>
         <h1 className="mt-6 font-bold text-4xl tracking-tight text-stroke text-white animate-pulse">TonQash</h1>
         <div className="w-48 h-3 bg-black/30 rounded-full mt-10 overflow-hidden cartoon-border">
           <motion.div
             initial={{ width: 0 }}
             animate={{ width: "100%" }}
             transition={{ duration: 2.5, ease: "easeInOut" }}
             className="h-full bg-gradient-to-r from-[var(--color-game-primary)] to-[var(--color-game-accent)]"
           />
         </div>
         <p className="mt-4 text-[var(--color-tg-muted)] text-sm font-bold uppercase tracking-widest animate-pulse">LOADING...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-[var(--color-tg-bg)] text-white overflow-hidden relative shadow-2xl">
      {/* Header */}
      <header className="flex flex-col gap-2 p-4 bg-[var(--color-game-card)] border-b-4 border-black/20 z-10 cartoon-border m-2 rounded-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-game-primary)] to-[var(--color-game-secondary)] flex items-center justify-center font-bold text-2xl shadow-lg shadow-black/50 text-stroke border-2 border-black/20">
              T
            </div>
            <div className="flex flex-col">
              <h1 className="font-bold text-xl tracking-tight text-stroke text-white leading-none">{t('appName')}</h1>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                <span className="text-[10px] font-bold text-white/80">{liveUsers.toLocaleString()} Online</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => { 
              playSound('click'); 
              if (walletConnected) {
                tonConnectUI.disconnect();
              } else {
                tonConnectUI.openModal();
              }
            }}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cartoon-button text-stroke",
              walletConnected 
                ? "bg-gradient-to-b from-green-400 to-green-600 text-white" 
                : "bg-gradient-to-b from-[var(--color-game-accent)] to-orange-500 text-white"
            )}
          >
            <Wallet size={18} className="drop-shadow-md" />
            {walletConnected || balance > 0 ? `${balance.toFixed(2)} TON` : t('connect')}
          </button>
        </div>
        
        {/* Language Switcher & Mute */}
        <div className="flex items-center justify-between mt-1">
          <button onClick={handleToggleMute} className="text-white/50 hover:text-white transition-colors p-1">
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-white/50" />
            <button onClick={() => handleLangSelect('en')} className={cn("text-xs font-bold px-2 py-1 rounded-md transition-all", lang === 'en' ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80")}>EN</button>
            <button onClick={() => handleLangSelect('ru')} className={cn("text-xs font-bold px-2 py-1 rounded-md transition-all", lang === 'ru' ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80")}>RU</button>
            <button onClick={() => handleLangSelect('ar')} className={cn("text-xs font-bold px-2 py-1 rounded-md transition-all", lang === 'ar' ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80")}>AR</button>
          </div>
        </div>
      </header>

      {/* Live Activity Ticker */}
      <div className="bg-black/20 border-b border-white/5 overflow-hidden flex items-center py-1.5 relative">
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#1a1b26] to-transparent z-10 pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#1a1b26] to-transparent z-10 pointer-events-none"></div>
        <div className="flex items-center w-max animate-marquee">
          {/* First set */}
          <div className="flex items-center gap-4 px-4">
            <span className="flex items-center gap-1 text-xs text-indigo-200 font-medium"><Trophy size={12} className="text-yellow-400"/> @crypto_king won 150 TON</span>
            <span className="text-white/20 text-[10px]">●</span>
            <span className="flex items-center gap-1 text-xs text-indigo-200 font-medium"><Trophy size={12} className="text-yellow-400"/> @alex_ton won 45 TON</span>
            <span className="text-white/20 text-[10px]">●</span>
            <span className="flex items-center gap-1 text-xs text-indigo-200 font-medium"><Trophy size={12} className="text-yellow-400"/> @sarah_99 won 80 TON</span>
            <span className="text-white/20 text-[10px]">●</span>
            <span className="flex items-center gap-1 text-xs text-indigo-200 font-medium"><Trophy size={12} className="text-yellow-400"/> @mike_pro won 12 TON</span>
          </div>
          {/* Duplicate set for seamless loop */}
          <div className="flex items-center gap-4 px-4">
            <span className="flex items-center gap-1 text-xs text-indigo-200 font-medium"><Trophy size={12} className="text-yellow-400"/> @crypto_king won 150 TON</span>
            <span className="text-white/20 text-[10px]">●</span>
            <span className="flex items-center gap-1 text-xs text-indigo-200 font-medium"><Trophy size={12} className="text-yellow-400"/> @alex_ton won 45 TON</span>
            <span className="text-white/20 text-[10px]">●</span>
            <span className="flex items-center gap-1 text-xs text-indigo-200 font-medium"><Trophy size={12} className="text-yellow-400"/> @sarah_99 won 80 TON</span>
            <span className="text-white/20 text-[10px]">●</span>
            <span className="flex items-center gap-1 text-xs text-indigo-200 font-medium"><Trophy size={12} className="text-yellow-400"/> @mike_pro won 12 TON</span>
          </div>
        </div>
      </div>

      {/* Main Content Area - Using CSS hiding for state persistence */}
      <main className="flex-1 overflow-hidden relative">
        <div className={cn("absolute inset-0 overflow-y-auto overflow-x-hidden transition-opacity duration-300 pb-32", activeTab === 'game' ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0")}>
          <div className="sticky top-0 z-50 bg-[#0f1016]/90 backdrop-blur-md px-2 pt-2 pb-1 border-b border-white/5 shadow-lg">
            <div className="flex bg-white/5 rounded-lg p-1 border border-white/10 max-w-md mx-auto">
              <button 
                onClick={() => setActiveGame('game2')}
                className={cn("flex-1 py-1.5 rounded-md font-bold text-xs transition-all", activeGame === 'game2' ? "bg-indigo-600 text-white shadow-lg" : "text-white/50 hover:text-white/80")}
              >
                Game 2
              </button>
              <button 
                onClick={() => setActiveGame('game1')}
                className={cn("flex-1 py-1.5 rounded-md font-bold text-xs transition-all", activeGame === 'game1' ? "bg-indigo-600 text-white shadow-lg" : "text-white/50 hover:text-white/80")}
              >
                Game 1
              </button>
            </div>
          </div>
          {activeGame === 'game1' ? (
            <GameTab walletConnected={walletConnected} balance={balance} setBalance={setBalance} username={username} t={t} />
          ) : (
            <Game2Tab walletConnected={walletConnected} balance={balance} setBalance={setBalance} username={username} t={t} />
          )}
        </div>
        <div className={cn("absolute inset-0 overflow-y-auto overflow-x-hidden transition-opacity duration-300 pb-32", activeTab === 'tasks' ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0")}>
          <TasksTab t={t} balance={balance} setBalance={setBalance} userId={userId} />
        </div>
        <div className={cn("absolute inset-0 overflow-y-auto overflow-x-hidden transition-opacity duration-300 pb-32", activeTab === 'referrals' ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0")}>
          <ReferralsTab t={t} userId={userId} />
        </div>
        <div className={cn("absolute inset-0 overflow-y-auto overflow-x-hidden transition-opacity duration-300 pb-32", activeTab === 'profile' ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0")}>
          <ProfileTab username={username} photoUrl={photoUrl} balance={balance} setBalance={setBalance} walletConnected={walletConnected} t={t} onDepositClick={() => setShowDeposit(true)} />
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-4 left-4 right-4 bg-[var(--color-game-card)] rounded-2xl cartoon-border z-20 shadow-2xl shadow-black/50">
        <div className="flex justify-around p-2">
          <NavButton icon={<Trophy />} label={t('game')} active={activeTab === 'game'} onClick={() => { playSound('click'); triggerHaptic('light'); setActiveTab('game'); }} />
          <NavButton icon={<CheckSquare />} label={t('tasks')} active={activeTab === 'tasks'} onClick={() => { playSound('click'); triggerHaptic('light'); setActiveTab('tasks'); }} />
          <NavButton icon={<Users />} label={t('referrals')} active={activeTab === 'referrals'} onClick={() => { playSound('click'); triggerHaptic('light'); setActiveTab('referrals'); }} />
          <NavButton icon={<User />} label={t('profile')} active={activeTab === 'profile'} onClick={() => { playSound('click'); triggerHaptic('light'); setActiveTab('profile'); }} />
        </div>
      </nav>

      {/* Floating Update Button */}
      <button
        onClick={() => { 
          playSound('click'); 
          triggerHaptic('light');
          setShowUpdateInfo(true); 
          setHasUnreadUpdates(false);
          localStorage.setItem('tq_update_seen_v3', 'true');
        }}
        className="fixed bottom-24 right-4 z-40 w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg cartoon-border animate-bounce"
      >
        <Bell className="text-white" size={24} />
        {hasUnreadUpdates && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 border-2 border-[#1a1b26] rounded-full animate-pulse"></span>
        )}
      </button>

      {/* Modals */}
      <AnimatePresence>
        {showUpdateInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--color-game-card)] p-6 rounded-3xl cartoon-border w-full max-w-sm flex flex-col gap-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg cartoon-border shrink-0">
                  <Bell className="text-white" size={24} />
                </div>
                <h3 className="text-xl font-bold text-stroke text-center">{t('updateInfoTitle')}</h3>
              </div>
              
              <div className="flex flex-col gap-4">
                <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 p-4 rounded-xl cartoon-border border-blue-500/50">
                  <p className="text-blue-100 text-sm leading-relaxed font-semibold">{t('updateMsg1')}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 p-4 rounded-xl cartoon-border border-green-500/50">
                  <p className="text-green-100 text-sm leading-relaxed font-semibold">{t('updateMsg2')}</p>
                </div>
                <div className="bg-gradient-to-br from-red-500/20 to-rose-500/20 p-4 rounded-xl cartoon-border border-red-500/50">
                  <p className="text-red-100 text-sm leading-relaxed font-semibold">{t('updateMsg3')}</p>
                </div>
              </div>

              <button 
                onClick={() => { playSound('click'); setShowUpdateInfo(false); }} 
                className="bg-gradient-to-b from-[var(--color-game-primary)] to-[var(--color-game-secondary)] text-white font-bold py-3 rounded-xl cartoon-button text-stroke mt-2 transition-colors"
              >
                {t('closeBtn')}
              </button>
            </motion.div>
          </motion.div>
        )}

        {showWelcomeDeposit && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--color-game-card)] p-6 rounded-3xl cartoon-border w-full max-w-sm flex flex-col gap-4 text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-green-500/30 to-transparent" />
              <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-green-500/50 border-4 border-black/20 cartoon-border z-10">
                <Wallet size={48} className="text-white drop-shadow-md" />
              </div>
              <h3 className="text-3xl font-bold text-stroke text-white z-10">{t('welcomeDepositTitle')}</h3>
              <p className="text-[var(--color-tg-muted)] font-bold text-sm z-10">{t('welcomeDepositDesc')}</p>
              
              <div className="flex flex-col gap-2 mt-4 z-10">
                <button 
                  onClick={() => {
                    playSound('click');
                    setShowWelcomeDeposit(false);
                    setShowDeposit(true);
                  }} 
                  className="bg-gradient-to-b from-green-400 to-green-600 text-white font-bold py-4 rounded-xl cartoon-button text-stroke text-lg transition-colors"
                >
                  {t('depositNow')}
                </button>
                <button 
                  onClick={() => { playSound('click'); setShowWelcomeDeposit(false); }} 
                  className="bg-black/30 hover:bg-white/10 text-[var(--color-tg-muted)] font-bold py-3 rounded-xl cartoon-border transition-colors"
                >
                  {t('maybeLater')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showDeposit && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--color-game-card)] p-6 rounded-3xl cartoon-border w-full max-w-sm flex flex-col gap-4"
            >
              <h3 className="text-2xl font-bold text-stroke text-center">{t('depositTon')}</h3>
              
              <div className="flex flex-col gap-1">
                <label className="text-[var(--color-tg-muted)] text-xs font-bold uppercase">{t('amountMin1')}</label>
                <input 
                  type="number" 
                  min="1" 
                  value={depositAmount} 
                  onChange={e => setDepositAmount(Number(e.target.value))}
                  className="bg-black/30 p-3 rounded-xl text-white font-bold text-xl outline-none cartoon-border text-center"
                />
              </div>

              <button 
                onClick={handleDeposit}
                disabled={isDepositing || depositAmount < 1}
                className="bg-gradient-to-b from-[var(--color-game-primary)] to-[var(--color-game-secondary)] text-white font-bold py-3 rounded-xl cartoon-button text-stroke mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDepositing ? <><Loader2 className="animate-spin" size={18} /> {t('confirming')}</> : t('depositViaWallet')}
              </button>
              
              <button 
                onClick={() => { playSound('click'); setShowDeposit(false); }}
                disabled={isDepositing}
                className="text-[var(--color-tg-muted)] font-bold py-2 hover:text-white transition-colors"
              >
                {t('cancel')}
              </button>
            </motion.div>
          </motion.div>
        )}

        {showLangPrompt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--color-game-card)] p-6 rounded-3xl cartoon-border w-full max-w-sm flex flex-col gap-4 text-center"
            >
              <Globe size={48} className="mx-auto text-[var(--color-game-accent)] drop-shadow-md" />
              <h3 className="text-3xl font-bold text-stroke text-white">{t('selectLanguage')}</h3>
              
              <div className="flex flex-col gap-2 mt-2">
                <button onClick={() => handleLangSelect('en')} className="bg-black/30 hover:bg-white/10 text-white font-bold py-3 rounded-xl cartoon-border transition-colors">English</button>
                <button onClick={() => handleLangSelect('ru')} className="bg-black/30 hover:bg-white/10 text-white font-bold py-3 rounded-xl cartoon-border transition-colors">Русский</button>
                <button onClick={() => handleLangSelect('ar')} className="bg-black/30 hover:bg-white/10 text-white font-bold py-3 rounded-xl cartoon-border transition-colors">العربية</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showEarnPopup && !showLangPrompt && !showDailyRefPrompt && !showDailyBonus && !showReferralWelcome && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--color-game-card)] p-6 rounded-3xl cartoon-border w-full max-w-sm flex flex-col gap-4 text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-indigo-500/30 to-transparent" />
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/50 border-4 border-black/20 cartoon-border z-10 animate-bounce-slow">
                <Trophy size={48} className="text-white drop-shadow-md" />
              </div>
              <h3 className="text-3xl font-bold text-stroke text-white z-10">{t('earnPopupTitle')}</h3>
              <p className="text-[var(--color-tg-muted)] font-bold text-sm z-10">{t('earnPopupDesc')}</p>
              
              <div className="flex flex-col gap-2 mt-4 z-10">
                <button 
                  onClick={() => {
                    playSound('click');
                    if ((window as any).Telegram?.WebApp?.HapticFeedback) {
                      (window as any).Telegram.WebApp.HapticFeedback.impactOccurred('medium');
                    }
                    setShowEarnPopup(false);
                    setActiveTab('tasks');
                  }} 
                  className="bg-gradient-to-b from-indigo-400 to-indigo-600 text-white font-bold py-4 rounded-xl cartoon-button text-stroke text-lg transition-colors"
                >
                  {t('goToTasks')}
                </button>
                <button 
                  onClick={() => { playSound('click'); setShowEarnPopup(false); }} 
                  className="bg-black/30 hover:bg-white/10 text-[var(--color-tg-muted)] font-bold py-3 rounded-xl cartoon-border transition-colors"
                >
                  {t('maybeLater')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showDailyRefPrompt && !showLangPrompt && !showEarnPopup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--color-game-card)] p-6 rounded-3xl cartoon-border w-full max-w-sm flex flex-col gap-4 text-center"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-blue-500/50 border-4 border-black/20 cartoon-border">
                <Users size={40} className="text-white drop-shadow-md" />
              </div>
              <h3 className="text-3xl font-bold text-stroke text-white">{t('dailyRefTitle')}</h3>
              <p className="text-[var(--color-tg-muted)] font-bold text-sm">{t('dailyRefDesc')}</p>
              
              <button 
                onClick={() => { playSound('click'); setShowDailyRefPrompt(false); setActiveTab('referrals'); }}
                className="bg-gradient-to-b from-blue-500 to-indigo-600 text-white font-bold py-3 rounded-xl cartoon-button text-stroke mt-2"
              >
                {t('shareNow')}
              </button>
              <button 
                onClick={() => { playSound('click'); setShowDailyRefPrompt(false); }}
                className="text-[var(--color-tg-muted)] font-bold py-2 hover:text-white transition-colors"
              >
                {t('maybeLater')}
              </button>
            </motion.div>
          </motion.div>
        )}

        {showDailyBonus && !showLangPrompt && !showDailyRefPrompt && !showReferralWelcome && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--color-game-card)] p-6 rounded-3xl cartoon-border w-full max-w-sm flex flex-col gap-4 text-center"
            >
              <div className="text-6xl drop-shadow-lg animate-bounce">🎁</div>
              <h3 className="text-3xl font-bold text-stroke text-[var(--color-game-secondary)]">{t('dailyBonusTitle')}</h3>
              <p className="text-white font-bold text-lg">{t('dailyBonusDesc')}</p>
              <p className="text-4xl font-bold text-yellow-400 text-stroke flex items-center justify-center gap-2">+50 XP</p>
              
              <button 
                onClick={() => { 
                  playSound('win'); 
                  const currentXp = parseInt(localStorage.getItem('tq_user_xp') || '0');
                  localStorage.setItem('tq_user_xp', (currentXp + 50).toString());
                  setShowDailyBonus(false); 
                  myConfetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
                }}
                className="bg-gradient-to-b from-[var(--color-game-primary)] to-[var(--color-game-secondary)] text-white font-bold py-3 rounded-xl cartoon-button text-stroke mt-2"
              >
                {t('claimBonus')}
              </button>
            </motion.div>
          </motion.div>
        )}

        {showReferralWelcome && !showLangPrompt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--color-game-card)] p-6 rounded-3xl cartoon-border w-full max-w-sm flex flex-col gap-4 text-center"
            >
              <div className="text-6xl drop-shadow-lg animate-bounce">🤝</div>
              <h3 className="text-3xl font-bold text-stroke text-[var(--color-game-accent)]">Welcome!</h3>
              <p className="text-white font-bold text-lg">You were invited by a friend!</p>
              <p className="text-[var(--color-tg-muted)] text-sm">Here is a welcome bonus to get you started.</p>
              <p className="text-4xl font-bold text-yellow-400 text-stroke">+100 XP</p>
              
              <button 
                onClick={() => { 
                  playSound('win'); 
                  const currentXp = parseInt(localStorage.getItem('tq_user_xp') || '0');
                  localStorage.setItem('tq_user_xp', (currentXp + 100).toString());
                  setShowReferralWelcome(false); 
                  myConfetti({ particleCount: 80, spread: 80, origin: { y: 0.8 } });
                }}
                className="bg-gradient-to-b from-[var(--color-game-primary)] to-[var(--color-game-secondary)] text-white font-bold py-3 rounded-xl cartoon-button text-stroke mt-2"
              >
                {t('claimBonus')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Components ---

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center w-20 h-16 rounded-xl transition-all duration-200",
        active ? "text-[var(--color-game-accent)] scale-110" : "text-[var(--color-tg-muted)] hover:text-white/80 hover:scale-105"
      )}
    >
      <div className={cn("mb-1 transition-transform duration-300", active && "scale-125 drop-shadow-[0_0_8px_rgba(249,212,35,0.8)]")}>
        {React.cloneElement(icon as React.ReactElement, { size: 22 })}
      </div>
      <span className={cn("text-[10px] font-bold uppercase tracking-wider", active && "text-stroke")}>{label}</span>
    </button>
  );
}

const Game2Tab: React.FC<{ walletConnected: boolean, balance: number, setBalance: React.Dispatch<React.SetStateAction<number>>, username: string, t: any }> = ({ walletConnected, balance, setBalance, username, t }) => {
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [timeLeft, setTimeLeft] = useState(15);
  const [redPool, setRedPool] = useState<Participant[]>([]);
  const [greenPool, setGreenPool] = useState<Participant[]>([]);
  const [userBet, setUserBet] = useState<{ color: 'red' | 'green', amount: number } | null>(null);
  const [winner, setWinner] = useState<'red' | 'green' | null>(null);
  const [betInput, setBetInput] = useState<string>(() => localStorage.getItem('game2_bet_amount') || '1');
  const buyAmount = Math.max(0.1, parseFloat(betInput) || 0.1);
  const [history, setHistory] = useState<('red' | 'green')[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('game2_history') || '[]');
    } catch {
      return [];
    }
  });
  
  const redTotal = redPool.reduce((s, p) => s + p.amount, 0) + (userBet?.color === 'red' ? userBet.amount : 0);
  const greenTotal = greenPool.reduce((s, p) => s + p.amount, 0) + (userBet?.color === 'green' ? userBet.amount : 0);
  const totalPool = redTotal + greenTotal;

  const redPercentage = totalPool === 0 ? 50 : (redTotal / totalPool) * 100;
  const greenPercentage = totalPool === 0 ? 50 : (greenTotal / totalPool) * 100;

  // Bot generation
  useEffect(() => {
    if (gameState !== 'waiting') return;

    let timeoutId: NodeJS.Timeout;
    let isMounted = true;

    const scheduleBot = () => {
      if (!isMounted || gameState !== 'waiting') return;
      
      // Extremely fast bot joining to reach 30-50 bots per color (60-100 total) in 15 seconds
      const nextCheck = 100 + Math.random() * 150;
      
      timeoutId = setTimeout(() => {
        if (!isMounted) return;
        
        // Add 1 to 3 bots per tick
        const botsToAdd = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < botsToAdd; i++) {
          const randomBot = generateBot();
          
          // Realistic distribution: mostly small, some medium, few large
          const rand = Math.random();
          let amount = 0;
          if (rand < 0.7) amount = Number((Math.random() * 0.9 + 0.1).toFixed(1)); // 0.1 - 1.0
          else if (rand < 0.95) amount = Number((Math.random() * 1.5 + 1.0).toFixed(1)); // 1.0 - 2.5
          else amount = Number((Math.random() * 1.5 + 2.5).toFixed(1)); // 2.5 - 4.0
          
          const color = Math.random() > 0.5 ? 'red' : 'green';
          
          if (color === 'red') {
            setRedPool(prev => [{ id: Math.random().toString(), name: randomBot.name, color: '#ef4444', amount, isBot: true }, ...prev]);
          } else {
            setGreenPool(prev => [{ id: Math.random().toString(), name: randomBot.name, color: '#22c55e', amount, isBot: true }, ...prev]);
          }
        }
        scheduleBot();
      }, nextCheck);
    };

    scheduleBot();
    return () => { isMounted = false; clearTimeout(timeoutId); };
  }, [gameState, timeLeft]);

  // Timer
  useEffect(() => {
    if (gameState !== 'waiting') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev > 0) {
          if (prev <= 4) playSound('tick');
          return prev - 1;
        }
        return 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState]);

  useEffect(() => {
    if (timeLeft === 0 && gameState === 'waiting') {
      startGame();
    }
  }, [timeLeft, gameState]);

  const startGame = () => {
    let finalRedPool = [...redPool];
    let finalGreenPool = [...greenPool];
    let finalRedTotal = redTotal;
    let finalGreenTotal = greenTotal;

    let targetWinner: 'red' | 'green';

    const userGamesPlayed = parseInt(localStorage.getItem('game2_games_played') || '0');
    const currentNetProfit = parseFloat(localStorage.getItem('game2_net_profit') || '0');

    if (userBet) {
      if (userGamesPlayed < 4) {
        targetWinner = userBet.color;
        
        let losingTotal = targetWinner === 'red' ? finalGreenTotal : finalRedTotal;
        let winningTotal = targetWinner === 'red' ? finalRedTotal : finalGreenTotal;
        
        if (winningTotal <= losingTotal) {
            const diff = losingTotal - winningTotal;
            const amountToAdd = diff + Math.random() * 2 + 0.1;
            winningTotal += amountToAdd;
            
            const bot = generateBot();
            if (targetWinner === 'red') {
                finalRedPool.unshift({ id: Math.random().toString(), name: bot.name, color: '#ef4444', amount: Number(amountToAdd.toFixed(1)), isBot: true });
                finalRedTotal += amountToAdd;
            } else {
                finalGreenPool.unshift({ id: Math.random().toString(), name: bot.name, color: '#22c55e', amount: Number(amountToAdd.toFixed(1)), isBot: true });
                finalGreenTotal += amountToAdd;
            }
        }
        
        const profit = losingTotal * (userBet.amount / winningTotal);
        if (currentNetProfit + profit > 9) {
            targetWinner = userBet.color === 'red' ? 'green' : 'red';
        }
      } else {
        targetWinner = userBet.color === 'red' ? 'green' : 'red';
      }
    } else {
      targetWinner = finalRedTotal >= finalGreenTotal ? 'red' : 'green';
    }

    if (targetWinner === 'red' && finalRedTotal <= finalGreenTotal) {
      const diff = finalGreenTotal - finalRedTotal;
      const amountToAdd = diff + Math.random() * 2 + 0.1;
      const bot = generateBot();
      finalRedPool.unshift({ id: Math.random().toString(), name: bot.name, color: '#ef4444', amount: Number(amountToAdd.toFixed(1)), isBot: true });
      finalRedTotal += amountToAdd;
    } else if (targetWinner === 'green' && finalGreenTotal <= finalRedTotal) {
      const diff = finalRedTotal - finalGreenTotal;
      const amountToAdd = diff + Math.random() * 2 + 0.1;
      const bot = generateBot();
      finalGreenPool.unshift({ id: Math.random().toString(), name: bot.name, color: '#22c55e', amount: Number(amountToAdd.toFixed(1)), isBot: true });
      finalGreenTotal += amountToAdd;
    }

    setRedPool(finalRedPool);
    setGreenPool(finalGreenPool);
    setWinner(targetWinner);
    setGameState('playing');
    playSound('start');

    setTimeout(() => {
      endGame(targetWinner, finalRedTotal, finalGreenTotal);
    }, 3000);
  };

  const endGame = (winningColor: 'red' | 'green', finalRedTotal: number, finalGreenTotal: number) => {
    playSound('win');
    setGameState('finished');
    
    setHistory(prev => {
      const newHistory = [...prev, winningColor].slice(-10); // Keep last 10 rounds
      localStorage.setItem('game2_history', JSON.stringify(newHistory));
      return newHistory;
    });

    if (userBet) {
      const userGamesPlayed = parseInt(localStorage.getItem('game2_games_played') || '0');
      localStorage.setItem('game2_games_played', (userGamesPlayed + 1).toString());
      
      let currentNetProfit = parseFloat(localStorage.getItem('game2_net_profit') || '0');
      
      if (userBet.color === winningColor) {
        const winningTotal = winningColor === 'red' ? finalRedTotal : finalGreenTotal;
        const losingTotal = winningColor === 'red' ? finalGreenTotal : finalRedTotal;
        const profit = losingTotal * (userBet.amount / winningTotal);
        
        currentNetProfit += profit;
        setBalance(prev => prev + userBet.amount + profit);
        
        myConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      } else {
        currentNetProfit -= userBet.amount;
      }
      localStorage.setItem('game2_net_profit', currentNetProfit.toString());
    } else {
      myConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }

    setTimeout(() => {
      setGameState('waiting');
      setTimeLeft(15);
      setRedPool([]);
      setGreenPool([]);
      setUserBet(null);
      setWinner(null);
    }, 4000);
  };

  const handleBet = (color: 'red' | 'green', amount: number) => {
    if (gameState !== 'waiting' || !walletConnected) return;
    if (balance < amount) return;
    
    setBalance(prev => prev - amount);
    setUserBet({ color, amount });
  };

  return (
    <div className="p-2 sm:p-4 flex flex-col min-h-full max-w-md mx-auto w-full">
      {/* Header & History Combined */}
      <div className="flex justify-between items-end mb-3">
        <div>
          <h2 className="text-xl font-black text-white italic drop-shadow-lg leading-tight">Bears vs Bulls</h2>
          <div className="flex items-center gap-1 mt-1">
            {history.length === 0 ? (
              <span className="text-[10px] text-white/30 font-medium">No history</span>
            ) : (
              history.map((color, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-3 h-3 rounded-full flex-shrink-0 border border-[#1a1b26] shadow-sm", 
                    color === 'red' ? "bg-red-500" : "bg-green-500",
                    i === history.length - 1 ? "ring-1 ring-white/50 scale-110" : "opacity-80"
                  )} 
                />
              ))
            )}
          </div>
        </div>
        <div className="bg-[#1a1b26] border border-white/10 rounded-lg px-3 py-1 flex flex-col items-center shadow-lg">
          <span className="text-[9px] text-[var(--color-tg-muted)] font-bold uppercase tracking-wider mb-0.5">Time Left</span>
          <span className={cn("text-xl font-black tabular-nums leading-none", timeLeft <= 3 ? "text-red-500 animate-pulse" : "text-white")}>
            00:{timeLeft.toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* The Game Area - Changed from aspect-square to h-32/h-48 to save vertical space */}
      <div className="w-full h-32 sm:h-48 rounded-2xl overflow-hidden flex relative shadow-2xl border-2 border-[#1a1b26] mb-3 bg-[#1a1b26] ring-2 ring-white/5">
        <div 
          className="h-full bg-gradient-to-br from-red-400 to-red-600 transition-all duration-500 ease-out flex items-center justify-center relative shadow-[inset_0_0_50px_rgba(0,0,0,0.3)]"
          style={{ width: `${redPercentage}%` }}
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50" />
          <motion.img 
            src="https://i.suar.me/5Pm59/l" 
            alt="Bear" 
            className="absolute inset-0 m-auto opacity-20 w-24 h-24 sm:w-32 sm:h-32 object-contain pointer-events-none mix-blend-overlay"
            animate={{ scale: Math.max(0.5, redPercentage / 50) }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          {redPercentage > 15 && (
            <motion.span 
              key={redPercentage}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-white font-black text-3xl sm:text-4xl z-10 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] flex flex-col items-center"
            >
              {redPercentage.toFixed(0)}%
            </motion.span>
          )}
        </div>
        <div 
          className="h-full bg-gradient-to-br from-green-400 to-green-600 transition-all duration-500 ease-out flex items-center justify-center relative shadow-[inset_0_0_50px_rgba(0,0,0,0.3)]"
          style={{ width: `${greenPercentage}%` }}
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50" />
          <motion.img 
            src="https://i.suar.me/ngz9E/l" 
            alt="Bull" 
            className="absolute inset-0 m-auto opacity-20 w-24 h-24 sm:w-32 sm:h-32 object-contain pointer-events-none mix-blend-overlay"
            animate={{ scale: Math.max(0.5, greenPercentage / 50) }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          {greenPercentage > 15 && (
            <motion.span 
              key={greenPercentage}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-white font-black text-3xl sm:text-4xl z-10 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] flex flex-col items-center"
            >
              {greenPercentage.toFixed(0)}%
            </motion.span>
          )}
        </div>
        
        {/* VS Badge & Total Pool */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
          <div className="bg-[#1a1b26] text-white text-[10px] font-black px-3 py-1 rounded-full mb-1 border border-white/10 shadow-lg flex items-center gap-1">
            <Globe className="w-3 h-3 text-indigo-400" />
            {totalPool.toFixed(1)} TON
          </div>
          <div className="w-14 h-14 bg-[#1a1b26] rounded-full border-4 border-white/10 flex items-center justify-center shadow-2xl">
            <span className="text-white font-black italic text-lg bg-clip-text text-transparent bg-gradient-to-br from-gray-100 to-gray-500">VS</span>
          </div>
        </div>

        {/* Winner Overlay */}
        <AnimatePresence>
          {gameState === 'finished' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center z-20 bg-black/60 backdrop-blur-sm"
            >
              <div className={cn("p-8 rounded-3xl border-4 shadow-2xl text-center transform transition-transform", winner === 'red' ? "bg-red-500/20 border-red-500" : "bg-green-500/20 border-green-500")}>
                <h3 className={cn("text-4xl font-black mb-2 drop-shadow-lg", winner === 'red' ? "text-red-400" : "text-green-400")}>
                  {winner === 'red' ? 'RED WINS!' : 'GREEN WINS!'}
                </h3>
                {userBet && userBet.color === winner && (
                  <p className="text-white font-bold text-xl">You Won!</p>
                )}
                {userBet && userBet.color !== winner && (
                  <p className="text-white/70 font-bold text-xl">You Lost</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Betting Controls */}
      <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-medium text-[var(--color-tg-muted)]">Bet Amount</span>
          <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus-within:border-indigo-500 transition-colors">
            <input 
              type="number" 
              min="0.1" 
              step="0.1" 
              value={betInput} 
              onChange={(e) => {
                setBetInput(e.target.value);
                localStorage.setItem('game2_bet_amount', e.target.value);
              }}
              className="bg-transparent text-white font-black text-right w-24 outline-none"
              placeholder="0.1"
            />
            <TonIcon className="w-5 h-5" />
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {[0.1, 1, 5, 10, 25].map(amt => (
            <button
              key={amt}
              onClick={() => {
                setBetInput(amt.toString());
                localStorage.setItem('game2_bet_amount', amt.toString());
              }}
              className={cn(
                "flex-1 min-w-[40px] py-2 rounded-lg font-bold text-sm transition-all",
                parseFloat(betInput) === amt ? "bg-[var(--color-game-accent)] text-white" : "bg-white/10 text-white hover:bg-white/20"
              )}
            >
              {amt}
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          <div className="flex-1 flex flex-col gap-2">
            <button 
              onClick={() => handleBet('red', buyAmount)} 
              disabled={gameState !== 'waiting' || userBet !== null || !walletConnected}
              className="w-full py-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white shadow-lg shadow-red-500/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-1"
            >
              <img src="https://i.suar.me/5Pm59/l" alt="Bear" className="w-6 h-6 object-contain" />
              <span>Bet Bears</span>
            </button>
            <div className="text-center text-sm font-bold text-red-400">{redTotal.toFixed(1)} TON</div>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <button 
              onClick={() => handleBet('green', buyAmount)} 
              disabled={gameState !== 'waiting' || userBet !== null || !walletConnected}
              className="w-full py-4 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white shadow-lg shadow-green-500/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-1"
            >
              <img src="https://i.suar.me/ngz9E/l" alt="Bull" className="w-6 h-6 object-contain" />
              <span>Bet Bulls</span>
            </button>
            <div className="text-center text-sm font-bold text-green-400">{greenTotal.toFixed(1)} TON</div>
          </div>
        </div>
        {!walletConnected && (
          <p className="text-center text-xs text-red-400 mt-4 font-medium">Please connect your wallet to play</p>
        )}
      </div>

      {/* Participants List */}
      <div className="flex gap-2 sm:gap-4">
        <div className="flex-1 min-w-0 bg-[#1a1b26] rounded-2xl p-2 sm:p-3 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.05)] flex flex-col h-64">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-red-500/20">
            <h4 className="text-red-400 font-black text-xs sm:text-sm flex items-center gap-1 sm:gap-2 truncate pr-1">
              <img src="https://i.suar.me/5Pm59/l" alt="Bear" className="w-4 h-4 sm:w-5 sm:h-5 object-contain drop-shadow-md flex-shrink-0" />
              <span className="truncate">BEARS</span>
            </h4>
            <span className="text-[10px] sm:text-xs font-bold text-red-500/50 flex-shrink-0">{redPool.length + (userBet?.color === 'red' ? 1 : 0)} <span className="hidden sm:inline">Players</span></span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            {userBet?.color === 'red' && (
              <div className="flex justify-between items-center p-2 bg-red-500/20 rounded-lg mb-2 border border-red-500/40 shadow-sm">
                <span className="font-black text-xs text-white">{username}</span>
                <span className="font-black text-xs text-red-300">{userBet.amount} TON</span>
              </div>
            )}
            <AnimatePresence initial={false}>
              {redPool.slice(0, 30).map(p => (
                <motion.div 
                  key={p.id} 
                  initial={{ opacity: 0, x: -20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  className="flex justify-between items-center p-2 border-b border-red-500/10 last:border-0"
                >
                  <span className="font-medium text-xs text-white/70 truncate pr-2">{p.name}</span>
                  <span className="font-bold text-xs text-red-400 whitespace-nowrap">{p.amount} TON</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex-1 min-w-0 bg-[#1a1b26] rounded-xl p-2 border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.05)] flex flex-col h-40 sm:h-48">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-green-500/20">
            <h4 className="text-green-400 font-black text-xs sm:text-sm flex items-center gap-1 sm:gap-2 truncate pr-1">
              <img src="https://i.suar.me/ngz9E/l" alt="Bull" className="w-4 h-4 sm:w-5 sm:h-5 object-contain drop-shadow-md flex-shrink-0" />
              <span className="truncate">BULLS</span>
            </h4>
            <span className="text-[10px] sm:text-xs font-bold text-green-500/50 flex-shrink-0">{greenPool.length + (userBet?.color === 'green' ? 1 : 0)} <span className="hidden sm:inline">Players</span></span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            {userBet?.color === 'green' && (
              <div className="flex justify-between items-center p-2 bg-green-500/20 rounded-lg mb-2 border border-green-500/40 shadow-sm">
                <span className="font-black text-xs text-white">{username}</span>
                <span className="font-black text-xs text-green-300">{userBet.amount} TON</span>
              </div>
            )}
            <AnimatePresence initial={false}>
              {greenPool.slice(0, 30).map(p => (
                <motion.div 
                  key={p.id} 
                  initial={{ opacity: 0, x: 20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  className="flex justify-between items-center p-2 border-b border-green-500/10 last:border-0"
                >
                  <span className="font-medium text-xs text-white/70 truncate pr-2">{p.name}</span>
                  <span className="font-bold text-xs text-green-400 whitespace-nowrap">{p.amount} TON</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

const GameTab: React.FC<{ walletConnected: boolean, balance: number, setBalance: React.Dispatch<React.SetStateAction<number>>, username: string, t: any }> = ({ walletConnected, balance, setBalance, username, t }) => {
  // Load initial state from localStorage if available
  const [gameState, setGameState] = useState<GameState>(() => (localStorage.getItem('tq_gameState') as GameState) || 'waiting');
  const [timeLeft, setTimeLeft] = useState(() => parseInt(localStorage.getItem('tq_timeLeft') || String(WAITING_DURATION)));
  const [participants, setParticipants] = useState<Participant[]>(() => JSON.parse(localStorage.getItem('tq_participants') || '[]'));
  const [buyAmount, setBuyAmount] = useState(1);
  const [winner, setWinner] = useState<Participant | null>(() => JSON.parse(localStorage.getItem('tq_winner') || 'null'));
  
  const [recentWins, setRecentWins] = useState<{id: string, text: string}[]>(() => JSON.parse(localStorage.getItem('tq_recentWins') || JSON.stringify([
    { id: '1', text: '@crypto_whale99 won 112.5 TON 🏆' },
    { id: '2', text: '@ivan777 won 104.2 TON 🏆' },
    { id: '3', text: '@ahmed99 won 108.9 TON 🏆' }
  ])));

  const [recentWithdrawals, setRecentWithdrawals] = useState<{id: string, text: string}[]>(() => {
    const stored = localStorage.getItem('tq_recentWithdrawals');
    return stored ? JSON.parse(stored) : [
      { id: 'w1', text: '@diamond_hands withdrew 125.5 TON 💸' },
      { id: 'w2', text: '@sergey_ton withdrew 150.0 TON 💸' },
      { id: 'w3', text: '@omar_88 withdrew 220.5 TON 💸' }
    ];
  });

  const totalPool = participants.reduce((sum, p) => sum + p.amount, 0);
  
  const participantsWithPercentages = participants.map(p => ({
    ...p,
    percentage: (p.amount / totalPool) * 100
  }));

  // Refs for latest values to avoid stale closures in setInterval
  const latestParticipantsWithPercentages = useRef(participantsWithPercentages);
  const latestTotalPool = useRef(totalPool);
  const latestWinner = useRef(winner);
  const latestBalance = useRef(balance);
  const lastActionTime = useRef(0);
  const targetParticipants = useRef(Math.floor(Math.random() * 7) + 8); // 8 to 14

  useEffect(() => {
    latestParticipantsWithPercentages.current = participantsWithPercentages;
    latestTotalPool.current = totalPool;
    latestWinner.current = winner;
    latestBalance.current = balance;
  }, [participantsWithPercentages, totalPool, winner, balance]);

  // Save state on change
  useEffect(() => {
    localStorage.setItem('tq_gameState', gameState);
    localStorage.setItem('tq_timeLeft', timeLeft.toString());
    localStorage.setItem('tq_participants', JSON.stringify(participants));
    localStorage.setItem('tq_winner', JSON.stringify(winner));
    localStorage.setItem('tq_recentWins', JSON.stringify(recentWins));
    localStorage.setItem('tq_recentWithdrawals', JSON.stringify(recentWithdrawals));
  }, [gameState, timeLeft, participants, winner, recentWins, recentWithdrawals]);

  // Live withdrawals simulation
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.3) {
        const bot = generateBot();
        const amount = (Math.random() * 400 + 100).toFixed(1); // 100 to 500 TON
        const newWithdrawal = { id: Date.now().toString() + Math.random().toString(36).substring(7), text: `${bot.name} withdrew ${amount} TON 💸` };
        setRecentWithdrawals(prev => [newWithdrawal, ...prev].slice(0, 5));
      }
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  // Bot simulation during waiting phase
  useEffect(() => {
    if (gameState !== 'waiting') return;
    
    // Guarantee at least one bot
    setParticipants(prev => {
      if (prev.length === 0) {
        const randomBot = generateBot();
        // Initial bot bet to start the pool (0.5 to 3 TON)
        const amount = Number((Math.random() * 2.5 + 0.5).toFixed(1));
        return [{ id: Math.random().toString(), name: randomBot.name, color: randomBot.color, amount, isBot: true }];
      }
      return prev;
    });

    let timeoutId: NodeJS.Timeout;
    let isMounted = true;

    const scheduleBot = () => {
      if (!isMounted || gameState !== 'waiting') return;
      
      // Randomize the next check between 500ms and 1500ms
      const nextCheck = 500 + Math.random() * 1000;
      
      timeoutId = setTimeout(() => {
        if (!isMounted) return;
        
        // 85% chance a bot joins or adds to their bet
        if (Math.random() < 0.85) {
          const randomBot = generateBot();
          // 10% chance of "mini-whale" (3-6 TON), 90% chance of normal (0.1-2.5 TON)
          const isWhale = Math.random() > 0.9;
          const amount = isWhale ? Number((Math.random() * 3 + 3).toFixed(1)) : Number((Math.random() * 2.4 + 0.1).toFixed(1));
          
          setParticipants(prev => {
            const currentPool = prev.reduce((sum, p) => sum + p.amount, 0);
            if (currentPool + amount > 30) return prev; // Strictly cap pool around 30 TON

            // Limit max bots to targetParticipants
            if (prev.length >= targetParticipants.current && !prev.find(p => p.name === randomBot.name)) {
              // If too many, just add to an existing bot to keep pool growing
              const botToUpdate = prev.find(p => p.isBot);
              if (botToUpdate) {
                 return prev.map(p => p.id === botToUpdate.id ? { ...p, amount: Number((p.amount + amount).toFixed(1)) } : p);
              }
              return prev;
            }
            
            const existing = prev.find(p => p.name === randomBot.name);
            if (existing) {
              return prev.map(p => p.name === randomBot.name ? { ...p, amount: Number((p.amount + amount).toFixed(1)) } : p);
            }
            return [...prev, { id: Math.random().toString(), name: randomBot.name, color: randomBot.color, amount, isBot: true }];
          });
        }
        scheduleBot();
      }, nextCheck);
    };

    scheduleBot();
    
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [gameState]);

  // Guarantee minimum 5 TON pool
  useEffect(() => {
    if (gameState === 'waiting' && timeLeft === 2) {
      setParticipants(prev => {
        const currentPool = prev.reduce((sum, p) => sum + p.amount, 0);
        if (currentPool < 5) {
          const randomBot = generateBot();
          const amount = Number((5 - currentPool + Math.random() * 2 + 0.5).toFixed(1));
          return [...prev, { id: Math.random().toString(), name: randomBot.name, color: randomBot.color, amount, isBot: true }];
        }
        return prev;
      });
    }
  }, [timeLeft, gameState]);

  // Timer logic for auto game loop
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev > 1) {
          if (prev <= 4 && gameState === 'waiting') playSound('tick');
          return prev - 1;
        }
        
        // Time is up, transition state
        if (gameState === 'waiting') {
          if (latestParticipantsWithPercentages.current.length > 0) {
            startGame();
            return GAME_DURATION;
          } else {
            // Reset waiting if no one joined
            return WAITING_DURATION;
          }
        } else if (gameState === 'playing') {
          endGame();
          return 5; // 5 seconds for finished state
        } else if (gameState === 'finished') {
          resetGame();
          return WAITING_DURATION;
        }
        return prev;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [gameState]); // Removed participants.length from deps to avoid resetting timer

  const handleBuy = () => {
    playSound('click');
    if (buyAmount < MIN_BUY_IN) {
      alert(`${t('minDeposit1')}`);
      return;
    }
    if (balance < buyAmount) {
      if (!walletConnected) {
        alert(t('connectWalletFirst'));
      } else {
        alert(t('txFailed'));
      }
      return;
    }
    
    setBalance(balance - buyAmount);
    setParticipants(prev => {
      const existing = prev.find(p => p.id === 'user');
      if (existing) {
        return prev.map(p => p.id === 'user' ? { ...p, amount: p.amount + buyAmount } : p);
      }
      return [...prev, { id: 'user', name: username, color: 'var(--color-game-accent)', amount: buyAmount, isBot: false }];
    });
  };

  const startGame = () => {
    if (Date.now() - lastActionTime.current < 500) return;
    lastActionTime.current = Date.now();
    
    playSound('start');
    // Pre-calculate winner to animate dot to their slice
    const currentParticipants = latestParticipantsWithPercentages.current;
    const bots = currentParticipants.filter(p => p.isBot);
    const user = currentParticipants.find(p => !p.isBot);
    
    let winningParticipant: Participant;
    
    if (user) {
      const userGamesPlayed = parseInt(localStorage.getItem('tq_user_games_played') || '0');
      const userWins = parseInt(localStorage.getItem('tq_user_wins') || '0');
      const currentNetProfit = parseFloat(localStorage.getItem('tq_user_net_profit') || '0');
      const totalPoolAmount = currentParticipants.reduce((sum, p) => sum + p.amount, 0);
      const potentialProfit = totalPoolAmount - user.amount;
      
      if (userGamesPlayed < 20) {
        const wouldExceedProfitLimit = (currentNetProfit + potentialProfit) > 10;
        
        if (!wouldExceedProfitLimit) {
          // They CAN win without exceeding 10 TON profit.
          // Give them a boosted chance if they haven't won, otherwise natural chance.
          const winChance = userWins === 0 ? 0.6 : (user.amount / totalPoolAmount);
          if (Math.random() < winChance) {
            winningParticipant = user;
          } else {
            winningParticipant = bots.length > 0 ? bots[Math.floor(Math.random() * bots.length)] : user;
          }
        } else {
          // Winning would exceed 10 TON profit.
          // Allow exactly ONE win if the pool is reasonable (< 15 TON) to ensure they get a win early on.
          if (userWins === 0 && totalPoolAmount <= 15 && Math.random() < 0.5) {
            winningParticipant = user;
          } else {
            // Force lose to protect the 10 TON limit
            winningParticipant = bots.length > 0 ? bots[Math.floor(Math.random() * bots.length)] : user;
          }
        }
      } else {
        // After 20 rounds, NEVER win
        winningParticipant = bots.length > 0 ? bots[Math.floor(Math.random() * bots.length)] : user;
      }
    } else {
      // Normal bot vs bot logic
      if (bots.length > 0) {
        const totalBotAmount = bots.reduce((sum, b) => sum + b.amount, 0);
        let randomVal = Math.random() * totalBotAmount;
        winningParticipant = bots[0];
        for (const bot of bots) {
          randomVal -= bot.amount;
          if (randomVal <= 0) {
            winningParticipant = bot;
            break;
          }
        }
      } else {
        let randomVal = Math.random() * 100;
        winningParticipant = currentParticipants[0];
        for (const p of currentParticipants) {
          randomVal -= p.percentage!;
          if (randomVal <= 0) {
            winningParticipant = p;
            break;
          }
        }
      }
    }
    
    setWinner(winningParticipant);
    setGameState('playing');
  };

  const endGame = () => {
    if (Date.now() - lastActionTime.current < 500) return;
    lastActionTime.current = Date.now();
    
    playSound('win');
    setGameState('finished');
    
    // Confetti effect
    myConfetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#F9D423', '#FF4E50', '#00C9FF', '#92FE9D']
    });
    
    // Reset target participants for next game
    targetParticipants.current = Math.floor(Math.random() * 7) + 8;
    
    // Increment games played
    const currentGames = parseInt(localStorage.getItem('portals_games_played') || '0');
    localStorage.setItem('portals_games_played', (currentGames + 1).toString());
    
    // Increment user specific games played if they participated
    const currentParticipants = latestParticipantsWithPercentages.current;
    if (currentParticipants.some(p => p.id === 'user')) {
      const userGames = parseInt(localStorage.getItem('tq_user_games_played') || '0');
      localStorage.setItem('tq_user_games_played', (userGames + 1).toString());
      
      const userParticipant = currentParticipants.find(p => p.id === 'user')!;
      let currentNetProfit = parseFloat(localStorage.getItem('tq_user_net_profit') || '0');
      
      if (latestWinner.current?.id === 'user') {
        currentNetProfit += (latestTotalPool.current - userParticipant.amount);
        
        // Track real wins
        const userWins = parseInt(localStorage.getItem('tq_user_wins') || '0');
        localStorage.setItem('tq_user_wins', (userWins + 1).toString());
      } else {
        currentNetProfit -= userParticipant.amount;
      }
      localStorage.setItem('tq_user_net_profit', currentNetProfit.toString());
      
      // Track total wagered
      const totalWagered = parseFloat(localStorage.getItem('tq_user_total_wagered') || '0');
      localStorage.setItem('tq_user_total_wagered', (totalWagered + userParticipant.amount).toString());
    }
    
    const currentWinner = latestWinner.current;
    const currentTotalPool = latestTotalPool.current;
    
    if (currentWinner) {
      const winAmount = (currentTotalPool * (1 - HOUSE_EDGE)).toFixed(2);
      const newWin = { id: Date.now().toString() + Math.random().toString(36).substring(7), text: `${currentWinner.name} won ${winAmount} TON 🏆` };
      setRecentWins(prev => [newWin, ...prev].slice(0, 5)); // Keep last 5
      
      if (currentWinner.id === 'user') {
        setTimeout(() => setBalance(latestBalance.current + Number(winAmount)), 1000);
      }
    }
  };

  const resetGame = () => {
    if (Date.now() - lastActionTime.current < 500) return;
    lastActionTime.current = Date.now();
    
    setGameState('waiting');
    setParticipants([]);
    setWinner(null);
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Recent Winners Ticker */}
      <div className="bg-black/20 rounded-full overflow-hidden flex items-center px-3 py-1.5 border border-white/5">
        <span className="text-[10px] font-bold text-[var(--color-game-accent)] uppercase tracking-wider mr-2 whitespace-nowrap">Live Wins:</span>
        <div className="flex-1 overflow-hidden relative h-4">
          <motion.div 
            animate={{ x: [200, -300] }}
            transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
            className="absolute whitespace-nowrap text-xs font-bold text-white/80"
          >
            {recentWins.map(w => w.text).join(' • ')}
          </motion.div>
        </div>
      </div>

      {/* Game Stats */}
      <div className="flex justify-between items-center bg-[var(--color-game-card)] p-4 rounded-2xl cartoon-border">
        <div className="flex flex-col">
          <span className="text-[var(--color-tg-muted)] text-xs uppercase tracking-wider font-bold">Total Pool</span>
          <span className="text-2xl font-bold text-white flex items-center gap-1 text-stroke">
            {totalPool.toFixed(2)} <TonIcon className="w-5 h-5" />
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[var(--color-tg-muted)] text-xs uppercase tracking-wider font-bold">
            {gameState === 'waiting' ? t('gameStartsIn') : gameState === 'playing' ? t('playing') : t('winnerIs')}
          </span>
          <span className={cn("text-3xl font-bold text-stroke", timeLeft <= 3 && gameState === 'waiting' ? "text-[var(--color-game-primary)]" : "text-white")}>
            00:{timeLeft.toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* The Square */}
      <div className="relative w-full max-w-[280px] sm:max-w-[320px] mx-auto aspect-square bg-[#0f0f0f] rounded-full overflow-hidden cartoon-border shadow-2xl shadow-black/50 mb-4">
        {/* Slices using conic-gradient */}
        <div 
          className="absolute inset-0 transition-all duration-500"
          style={{
            background: participantsWithPercentages.length > 0 
              ? `conic-gradient(${participantsWithPercentages.reduce((acc, p, i, arr) => {
                  const prevTotal = arr.slice(0, i).reduce((sum, prev) => sum + prev.percentage!, 0);
                  const currentTotal = prevTotal + p.percentage!;
                  return acc + `${p.color} ${prevTotal}% ${currentTotal}%${i === arr.length - 1 ? '' : ', '}`;
                }, '')})`
              : 'transparent'
          }}
        />
        
        {/* Slice Labels */}
        <div className="absolute inset-0">
          {participantsWithPercentages.map((p, i, arr) => {
            if (p.percentage! < 5) return null; // Don't show label if slice is too small
            const prevTotal = arr.slice(0, i).reduce((sum, prev) => sum + prev.percentage!, 0);
            const middlePercentage = prevTotal + (p.percentage! / 2);
            const angle = (middlePercentage / 100) * 360;
            // Calculate position (radius = 35% from center)
            const rad = (angle - 90) * (Math.PI / 180);
            const x = 50 + 35 * Math.cos(rad);
            const y = 50 + 35 * Math.sin(rad);
            
            return (
              <div 
                key={`label-${p.id}-${i}`}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 text-white font-bold text-xs text-stroke text-center leading-tight"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <div>{p.name}</div>
                <div className="text-[10px] opacity-80">{p.percentage?.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
        
        {participants.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--color-tg-muted)] text-sm font-bold bg-[var(--color-game-card)]">
            {t('waitingForPlayers')}
          </div>
        )}

        {/* Moving Dot */}
        {(gameState === 'playing' || gameState === 'finished') && (
          <MovingDot winner={winner} participants={participantsWithPercentages} />
        )}

        {/* Winner Overlay */}
        <AnimatePresence>
          {gameState === 'finished' && winner && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-20"
            >
              <motion.div 
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                className="text-center"
              >
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="text-2xl font-bold text-white mb-2">{winner.name} Won!</h3>
                <p className="text-[var(--color-tg-blue)] font-bold text-xl flex items-center justify-center gap-1">
                  +{(totalPool * (1 - HOUSE_EDGE)).toFixed(2)} <TonIcon className="w-5 h-5" />
                </p>
                <p className="text-[var(--color-tg-muted)] text-xs mt-2 flex items-center justify-center gap-1">
                  (3% House Fee: {(totalPool * HOUSE_EDGE).toFixed(2)} <TonIcon className="w-3 h-3" />)
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="bg-[var(--color-game-card)] p-4 rounded-2xl cartoon-border flex flex-col gap-4">
        {gameState === 'waiting' ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[var(--color-tg-muted)] text-xs font-bold uppercase tracking-wider text-center">{t('buyInAmount')}</label>
              <div className="flex items-center justify-between gap-2 bg-black/30 rounded-xl p-1 cartoon-border">
                <button onClick={() => { playSound('click'); setBuyAmount(Math.max(MIN_BUY_IN, Number((buyAmount - 0.1).toFixed(1)))) }} className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white font-bold text-2xl">-</button>
                <input 
                  type="number" 
                  step="0.1"
                  min={MIN_BUY_IN}
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(Number(e.target.value))}
                  className="flex-1 bg-transparent text-center font-bold text-xl text-white outline-none w-full"
                />
                <button onClick={() => { playSound('click'); setBuyAmount(Number((buyAmount + 0.1).toFixed(1))) }} className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white font-bold text-2xl">+</button>
              </div>
            </div>
            <button 
              onClick={handleBuy}
              className="w-full bg-gradient-to-b from-[var(--color-game-primary)] to-[var(--color-game-secondary)] text-white font-bold py-3 rounded-xl cartoon-button text-stroke text-lg animate-pulse-slow"
            >
              {t('buyIn')}
            </button>
          </div>
        ) : gameState === 'playing' ? (
          <div className="py-4 flex flex-col items-center justify-center gap-2">
            <Loader2 className="animate-spin text-[var(--color-game-accent)]" size={32} />
            <p className="text-[var(--color-game-accent)] font-bold animate-pulse text-stroke">{t('playing')}</p>
          </div>
        ) : (
          <div className="py-4 flex flex-col items-center justify-center gap-2">
            <p className="text-white font-bold text-stroke">{t('waitingForPlayers')}</p>
          </div>
        )}
      </div>

      {/* Participants List */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[var(--color-tg-muted)] text-sm font-bold uppercase tracking-wider px-2">{t('participants')}</h3>
        <div className="bg-[var(--color-game-card)] rounded-2xl cartoon-border overflow-hidden">
          {participantsWithPercentages.length === 0 ? (
            <div className="p-6 text-center text-[var(--color-tg-muted)] text-sm font-bold">No players yet. Be the first!</div>
          ) : (
            [...participantsWithPercentages].sort((a, b) => b.amount - a.amount).map((p, i) => (
              <div key={`${p.id}-${i}`} className={cn("flex items-center justify-between p-3", i !== participants.length - 1 && "border-b border-white/5")}>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border-2 border-white/20" style={{ backgroundColor: p.color }} />
                  <span className="font-bold text-sm">{p.name}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-bold text-sm text-[var(--color-game-accent)] flex items-center gap-1">{p.amount.toFixed(1)} <TonIcon className="w-3 h-3" /></span>
                  <span className="text-[10px] text-[var(--color-tg-muted)] font-bold">{p.percentage?.toFixed(1)}%</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Wins */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[var(--color-tg-muted)] text-sm font-bold uppercase tracking-wider px-2">Live Wins</h3>
        <div className="bg-[var(--color-game-card)] rounded-2xl cartoon-border overflow-hidden flex flex-col">
          <AnimatePresence initial={false}>
            {recentWins.map((win, i) => (
              <motion.div 
                key={`${win.id}-${i}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-3 border-b border-white/5 last:border-0 font-bold text-sm text-green-400"
              >
                {win.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Live Withdrawals */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[var(--color-tg-muted)] text-sm font-bold uppercase tracking-wider px-2">{t('liveWithdrawals')}</h3>
        <div className="bg-[var(--color-game-card)] rounded-2xl cartoon-border overflow-hidden flex flex-col">
          <AnimatePresence initial={false}>
            {recentWithdrawals.map((withdrawal, i) => (
              <motion.div 
                key={`${withdrawal.id}-${i}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-3 border-b border-white/5 last:border-0 font-bold text-sm text-blue-400"
              >
                {withdrawal.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function MovingDot({ winner, participants }: { winner: Participant | null, participants: Participant[] }) {
  // Calculate final angle based on winner
  let finalAngle = 0;
  if (winner) {
    let accumulatedPercentage = 0;
    for (const p of participants) {
      if (p.id === winner.id) {
        // Target the middle of the winner's slice (in degrees)
        const targetPercentage = accumulatedPercentage + (p.percentage! / 2);
        finalAngle = (targetPercentage / 100) * 360;
        break;
      }
      accumulatedPercentage += p.percentage!;
    }
  }

  // We want the dot to spin around the center.
  // We can animate the rotation of a container, and place the dot at the edge.
  // Let's do 10 full rotations + the final angle.
  const totalRotation = (360 * 10) + finalAngle;
  
  return (
    <motion.div
      className="absolute inset-0 z-10"
      animate={{ rotate: totalRotation }}
      transition={{
        duration: GAME_DURATION,
        ease: [0.2, 0.8, 0.3, 1], // Custom easing to slow down at the end
      }}
    >
      {/* The actual dot placed at the top edge, so when rotated it traces a circle */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,1)] border-4 border-black z-20" />
      
      {/* A line connecting to center for visual effect */}
      <div className="absolute top-6 bottom-1/2 left-1/2 w-[4px] -translate-x-1/2 bg-white/80 origin-bottom z-10" />
    </motion.div>
  );
}

const TasksTab: React.FC<{ t: any, balance: number, setBalance: React.Dispatch<React.SetStateAction<number>>, userId: string }> = ({ t, balance, setBalance, userId }) => {
  // Share Task State
  const [shareCount, setShareCount] = useState(() => parseInt(localStorage.getItem('tq_share_count') || '0'));
  const [shareCooldownEnd, setShareCooldownEnd] = useState(() => parseInt(localStorage.getItem('tq_share_cooldown_end') || '0'));
  const [isSharing, setIsSharing] = useState(false);
  const [verifyingShare, setVerifyingShare] = useState(false);
  const [shareStartTime, setShareStartTime] = useState(0);

  // Ads Task State
  const [adsWatched, setAdsWatched] = useState(() => parseInt(localStorage.getItem('tq_ads_watched') || '0'));
  const [adsNextTime, setAdsNextTime] = useState(() => parseInt(localStorage.getItem('tq_ads_next_time') || '0'));
  const [adsResetTime, setAdsResetTime] = useState(() => parseInt(localStorage.getItem('tq_ads_reset_time') || '0'));
  
  const [hasJoinedPepe, setHasJoinedPepe] = useState(() => localStorage.getItem('tq_joined_pepe') === 'true');
  const [hasJoinedGift, setHasJoinedGift] = useState(() => localStorage.getItem('tq_joined_gift') === 'true');
  
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Reset Share
  useEffect(() => {
    if (shareCooldownEnd > 0 && now >= shareCooldownEnd) {
      setShareCount(0);
      setShareCooldownEnd(0);
      localStorage.setItem('tq_share_count', '0');
      localStorage.setItem('tq_share_cooldown_end', '0');
    }
  }, [now, shareCooldownEnd]);

  // Reset Ads
  useEffect(() => {
    if (adsResetTime > 0 && now >= adsResetTime) {
      setAdsWatched(0);
      setAdsResetTime(0);
      localStorage.setItem('tq_ads_watched', '0');
      localStorage.setItem('tq_ads_reset_time', '0');
    }
  }, [now, adsResetTime]);

  const handleShare = () => {
    if (isSharing || verifyingShare) return;
    playSound('click');
    const refLink = `https://t.me/TonQashBot/app?startapp=${userId}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('Join me on TonQash and win TON!')}`;
    
    // Open telegram share link
    window.open(shareUrl, '_blank');

    setVerifyingShare(true);
    setShareStartTime(Date.now());
  };

  // Verify share task
  useEffect(() => {
    const handleFocus = () => {
      if (verifyingShare) {
        const timeAway = Date.now() - shareStartTime;
        // If user was away for more than 2.5 seconds, assume they actually shared it
        if (timeAway > 2500) {
          setShareCount(prev => {
            if (prev < 3) {
              const newCount = prev + 1;
              localStorage.setItem('tq_share_count', newCount.toString());
              return newCount;
            }
            return prev;
          });
        } else {
          // User returned too quickly, likely didn't share
          const tg = window.Telegram?.WebApp;
          if (tg && tg.showAlert) {
            tg.showAlert("You must actually share the link to get the reward!");
          } else {
            alert("You must actually share the link to get the reward!");
          }
        }
        setVerifyingShare(false);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    });

    // Fallback timeout in case focus events don't fire reliably
    let fallbackTimeout: NodeJS.Timeout;
    if (verifyingShare) {
      fallbackTimeout = setTimeout(() => {
        if (verifyingShare) {
          setVerifyingShare(false);
          setShareCount(prev => {
            if (prev < 3) {
              const newCount = prev + 1;
              localStorage.setItem('tq_share_count', newCount.toString());
              return newCount;
            }
            return prev;
          });
        }
      }, 10000);
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearTimeout(fallbackTimeout);
    };
  }, [verifyingShare, shareStartTime]);

  const handleClaimShare = () => {
    if (shareCount >= 3 && now >= shareCooldownEnd) {
      playSound('win');
      setBalance(prev => prev + 0.05);
      const cooldown = Date.now() + 86400000; // 24 hours
      setShareCooldownEnd(cooldown);
      localStorage.setItem('tq_share_cooldown_end', cooldown.toString());
      myConfetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    }
  };

  const handleWatchAd = () => {
    if (now < adsNextTime || adsWatched >= 30) return;
    playSound('click');
    if ((window as any).Adsgram) {
      const AdController = (window as any).Adsgram.init({ blockId: "int-27598" });
      AdController.show().then(() => {
        const newWatched = adsWatched + 1;
        setAdsWatched(newWatched);
        localStorage.setItem('tq_ads_watched', newWatched.toString());

        const nextTime = Date.now() + 20000; // 20 seconds cooldown
        setAdsNextTime(nextTime);
        localStorage.setItem('tq_ads_next_time', nextTime.toString());

        if (adsResetTime === 0 || now >= adsResetTime) {
          const resetTime = Date.now() + 86400000; // 24 hours from first ad
          setAdsResetTime(resetTime);
          localStorage.setItem('tq_ads_reset_time', resetTime.toString());
        }

        if (newWatched % 10 === 0) {
          playSound('win');
          setBalance(prev => prev + 0.05);
          myConfetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
        }
      }).catch(() => {
        // Ad skipped or failed
      });
    } else {
      alert('Ads system is loading, please try again later.');
    }
  };

  const handleJoinPepe = () => {
    if (balance >= 1) {
      playSound('win');
      setBalance(balance - 1);
      setHasJoinedPepe(true);
      localStorage.setItem('tq_joined_pepe', 'true');
      myConfetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    } else {
      alert('Insufficient balance');
    }
  };

  const handleJoinGift = () => {
    if (balance >= 0.5) {
      playSound('win');
      setBalance(balance - 0.5);
      setHasJoinedGift(true);
      localStorage.setItem('tq_joined_gift', 'true');
      myConfetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    } else {
      alert('Insufficient balance');
    }
  };

  const formatTimeLeft = (targetDate: number) => {
    const diff = targetDate - now;
    if (diff <= 0) return 'Ended';
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / 1000 / 60) % 60);
    return `${d}d ${h}h ${m}m`;
  };

  const formatTimeLeftShort = (targetDate: number) => {
    const diff = targetDate - now;
    if (diff <= 0) return '00:00:00';
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
    const m = Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0');
    const s = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const pepeEndDate = new Date('2026-05-30T00:00:00Z').getTime();
  const giftEndDate = new Date('2026-05-09T00:00:00Z').getTime();
  const startDate = new Date('2026-04-01T00:00:00Z').getTime();

  const calculateParticipants = (start: number, end: number, minP: number, maxP: number) => {
    const total = end - start;
    const elapsed = now - start;
    if (elapsed < 0) return minP;
    if (elapsed > total) return maxP;
    const progress = elapsed / total;
    return Math.floor(minP + progress * (maxP - minP));
  };

  const pepeParticipants = calculateParticipants(startDate, pepeEndDate, 2034, 85000);
  const giftParticipants = calculateParticipants(startDate, giftEndDate, 2034, 62000);

  return (
    <div className="p-4 flex flex-col gap-4">
      <h2 className="text-2xl font-bold text-stroke mb-2">{t('tasks')}</h2>

      {/* Task 0: Adsgram */}
      <div className="bg-[var(--color-game-card)] rounded-2xl cartoon-border p-4 flex flex-col gap-3 relative overflow-hidden">
        <div className="flex items-start gap-3 mt-2">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg cartoon-border">
            <Tv size={32} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white text-lg leading-tight">{t('taskAdsTitle')}</h3>
            <p className="text-[var(--color-tg-muted)] text-xs mt-1">{t('taskAdsDesc')}</p>
          </div>
        </div>

        <div className="flex items-center justify-between bg-black/20 rounded-xl p-2 cartoon-border">
          <span className="text-[10px] font-bold text-[var(--color-tg-muted)] uppercase">{t('taskAdsProgress')}</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
              <div key={i} className={cn("w-3 h-2 rounded-full transition-colors", i <= (adsWatched % 10 === 0 && adsWatched > 0 ? 10 : adsWatched % 10) ? "bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]" : "bg-white/10")} />
            ))}
          </div>
        </div>
        
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold text-[var(--color-tg-muted)] uppercase">{t('taskAdsDaily')}</span>
          <span className="text-xs font-bold text-indigo-400">{adsWatched}/30</span>
        </div>
        
        {adsWatched >= 30 ? (
          <button disabled className="w-full bg-black/30 text-[var(--color-tg-muted)] font-bold py-3 rounded-xl cartoon-border transition-colors">
            {t('comeBackLater').replace('{t}', formatTimeLeftShort(adsResetTime))}
          </button>
        ) : now < adsNextTime ? (
          <button disabled className="w-full bg-black/30 text-[var(--color-tg-muted)] font-bold py-3 rounded-xl cartoon-border transition-colors">
            {t('waitSec').replace('{s}', Math.ceil((adsNextTime - now) / 1000).toString())}
          </button>
        ) : (
          <button onClick={handleWatchAd} className="w-full bg-gradient-to-b from-indigo-500 to-indigo-700 text-white font-bold py-3 rounded-xl cartoon-button text-stroke transition-colors">
            {t('taskAdsBtn')}
          </button>
        )}
      </div>

      {/* Task 1: Share */}
      <div className="bg-[var(--color-game-card)] rounded-2xl cartoon-border p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg cartoon-border">
            <Share2 size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white text-lg leading-tight">{t('taskShareTitle')}</h3>
            <p className="text-[var(--color-tg-muted)] text-xs mt-1">{t('taskShareDesc')}</p>
          </div>
        </div>
        
        <div className="flex items-center justify-between bg-black/20 rounded-xl p-2 cartoon-border">
          <span className="text-xs font-bold text-[var(--color-tg-muted)] uppercase">{t('taskShareProgress')}</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3].map(i => (
              <div key={i} className={cn("w-6 h-2 rounded-full transition-colors", i <= shareCount ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" : "bg-white/10")} />
            ))}
            <span className="text-xs font-bold ml-2">{shareCount}/3</span>
          </div>
        </div>

        {shareCooldownEnd > now ? (
          <button disabled className="w-full bg-black/30 text-[var(--color-tg-muted)] font-bold py-3 rounded-xl cartoon-border transition-colors">
            {t('comeBackLater').replace('{t}', formatTimeLeftShort(shareCooldownEnd))}
          </button>
        ) : shareCount < 3 ? (
          <button onClick={handleShare} disabled={isSharing || verifyingShare} className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-bold py-3 rounded-xl cartoon-button text-stroke transition-colors">
            {verifyingShare ? "Verifying..." : t('taskShareBtn')}
          </button>
        ) : (
          <button onClick={handleClaimShare} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl cartoon-button text-stroke transition-colors animate-pulse-slow">
            {t('taskClaimBtn')}
          </button>
        )}
      </div>

      {/* Task 2: Plush Pepe */}
      <div className="bg-[var(--color-game-card)] rounded-2xl cartoon-border p-4 flex flex-col gap-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl z-10 cartoon-border border-t-0 border-r-0">
          {t('endsIn')}: {formatTimeLeft(pepeEndDate)}
        </div>
        <div className="absolute top-0 left-0 bg-black/50 text-white text-[10px] font-bold px-3 py-1 rounded-br-xl z-10 cartoon-border border-t-0 border-l-0 flex items-center gap-1">
          <Users size={10} /> {pepeParticipants.toLocaleString()} {t('participants')}
        </div>
        <div className="flex items-start gap-3 mt-4">
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-lg cartoon-border bg-black/50">
            <img src="https://i.suar.me/Pp3JN/l" alt="Plush Pepe" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white text-lg leading-tight">{t('taskPepeTitle')}</h3>
            <p className="text-[var(--color-tg-muted)] text-xs mt-1">{t('taskPepeDesc')}</p>
          </div>
        </div>
        
        {hasJoinedPepe ? (
          <div className="w-full bg-black/30 text-green-400 font-bold py-3 rounded-xl cartoon-border text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> {t('joined')}
          </div>
        ) : (
          <button onClick={handleJoinPepe} className="w-full bg-gradient-to-b from-purple-500 to-purple-700 text-white font-bold py-3 rounded-xl cartoon-button text-stroke transition-colors">
            {t('taskPepeBtn')}
          </button>
        )}
      </div>

      {/* Task 3: Random Gift */}
      <div className="bg-[var(--color-game-card)] rounded-2xl cartoon-border p-4 flex flex-col gap-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl z-10 cartoon-border border-t-0 border-r-0">
          {t('endsIn')}: {formatTimeLeft(giftEndDate)}
        </div>
        <div className="absolute top-0 left-0 bg-black/50 text-white text-[10px] font-bold px-3 py-1 rounded-br-xl z-10 cartoon-border border-t-0 border-l-0 flex items-center gap-1">
          <Users size={10} /> {giftParticipants.toLocaleString()} {t('participants')}
        </div>
        <div className="flex items-start gap-3 mt-4">
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-lg cartoon-border bg-black/50">
            <img src="https://i.suar.me/Ep433/l" alt="Random Gift" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white text-lg leading-tight">{t('taskGiftTitle')}</h3>
            <p className="text-[var(--color-tg-muted)] text-xs mt-1">{t('taskGiftDesc')}</p>
          </div>
        </div>
        
        {hasJoinedGift ? (
          <div className="w-full bg-black/30 text-green-400 font-bold py-3 rounded-xl cartoon-border text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> {t('joined')}
          </div>
        ) : (
          <button onClick={handleJoinGift} className="w-full bg-gradient-to-b from-orange-400 to-orange-600 text-white font-bold py-3 rounded-xl cartoon-button text-stroke transition-colors">
            {t('taskGiftBtn')}
          </button>
        )}
      </div>
    </div>
  );
}

const ReferralsTab: React.FC<{ t: any, userId: string }> = ({ t, userId }) => {
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState(0);
  const [earned, setEarned] = useState(0);

  useEffect(() => {
    // Load real stats from local storage
    const storedReferrals = parseInt(localStorage.getItem('portals_total_referrals') || '0');
    const storedEarned = parseFloat(localStorage.getItem('portals_earned_ton') || '0');
    setReferrals(storedReferrals);
    setEarned(storedEarned);
  }, []);

  const refLink = `https://t.me/TonQashBot/app?startapp=${userId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 flex flex-col gap-6">
      <div className="text-center py-6">
        <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full mx-auto flex items-center justify-center mb-4 shadow-lg shadow-green-500/50 border-4 border-black/20 cartoon-border">
          <Users size={48} className="text-white drop-shadow-md" />
        </div>
        <h2 className="text-3xl font-bold mb-2 text-stroke">{t('inviteFriends')}</h2>
        <p className="text-[var(--color-tg-muted)] text-sm max-w-[250px] mx-auto font-bold mb-4">
          {t('referralDesc')}
        </p>
        <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-3 max-w-[300px] mx-auto">
          <p className="text-blue-300 text-xs font-bold leading-tight">
            {t('betaNotice')}
          </p>
        </div>
      </div>

      <div className="bg-[var(--color-game-card)] p-4 rounded-2xl cartoon-border">
        <h3 className="text-sm font-bold text-[var(--color-tg-muted)] mb-3 uppercase tracking-wider">{t('yourRefLink')}</h3>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-black/30 rounded-xl p-3 text-sm font-mono text-white/80 overflow-hidden text-ellipsis whitespace-nowrap cartoon-border">
            {refLink}
          </div>
          <button 
            onClick={() => { playSound('click'); handleCopy(); }}
            className="w-12 h-12 bg-gradient-to-b from-[var(--color-game-primary)] to-[var(--color-game-secondary)] rounded-xl flex items-center justify-center text-white transition-all cartoon-button"
          >
            {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--color-game-card)] p-4 rounded-2xl cartoon-border flex flex-col items-center justify-center gap-1">
          <span className="text-[var(--color-tg-muted)] text-xs uppercase font-bold tracking-wider">{t('totalReferrals')}</span>
          <span className="text-4xl font-bold text-stroke">{referrals}</span>
        </div>
        <div className="bg-[var(--color-game-card)] p-4 rounded-2xl cartoon-border flex flex-col items-center justify-center gap-1">
          <span className="text-[var(--color-tg-muted)] text-xs uppercase font-bold tracking-wider">{t('earned')}</span>
          <span className="text-3xl font-bold text-green-400 text-stroke flex items-center gap-1">{earned.toFixed(2)} <TonIcon className="w-6 h-6" /></span>
        </div>
      </div>
      
      <button 
        onClick={() => { playSound('click'); handleCopy(); }}
        className="w-full bg-gradient-to-b from-green-400 to-green-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cartoon-button text-stroke text-lg mt-4"
      >
        <Share2 size={20} /> {t('shareLink')}
      </button>
    </div>
  );
}

const ProfileTab: React.FC<{ username: string, photoUrl: string, balance: number, setBalance: React.Dispatch<React.SetStateAction<number>>, walletConnected: boolean, t: any, onDepositClick: () => void }> = ({ username, photoUrl, balance, setBalance, walletConnected, t, onDepositClick }) => {
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [userWins, setUserWins] = useState(0);
  const [totalWagered, setTotalWagered] = useState(0);
  const [showConnectWarning, setShowConnectWarning] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const storedGames = parseInt(localStorage.getItem('tq_user_games_played') || '0');
    const storedWins = parseInt(localStorage.getItem('tq_user_wins') || '0');
    const storedWagered = parseFloat(localStorage.getItem('tq_user_total_wagered') || '0');
    setGamesPlayed(storedGames);
    setUserWins(storedWins);
    setTotalWagered(storedWagered);
  }, []);

  const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
  const finalPhotoUrl = (photoUrl && !imgError) ? photoUrl : dicebearUrl;

  return (
    <div className="p-4 flex flex-col gap-6">
      <div className="relative mt-12">
        {/* Glow effect behind the card */}
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[2rem] blur opacity-30 animate-pulse-slow"></div>
        
        <div className="bg-[#1a1b26]/90 backdrop-blur-xl p-6 rounded-3xl border border-white/10 flex flex-col items-center text-center relative shadow-2xl">
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-indigo-500/20 to-transparent rounded-t-3xl pointer-events-none" />
          
          <div className="absolute -top-12 w-24 h-24 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-full border-4 border-[#1a1b26] flex items-center justify-center text-4xl font-bold shadow-xl z-20 text-white ring-4 ring-white/5 overflow-hidden">
            <img 
              src={finalPhotoUrl} 
              alt={username} 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer" 
              onError={() => setImgError(true)} 
            />
          </div>
          
          <div className="mt-10 flex items-center gap-2">
            <h2 className="text-3xl font-bold text-white tracking-tight">{username.startsWith('@') ? username : `@${username}`}</h2>
            {gamesPlayed >= 50 && (
              <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-[10px] uppercase font-black px-2 py-0.5 rounded-md text-black shadow-[0_0_10px_rgba(250,204,21,0.5)]">VIP</div>
            )}
          </div>
          <p className="text-indigo-300/70 text-sm mb-4 font-medium tracking-wide">{t('joinedDate')}</p>
          
          {/* Level Progress Bar */}
          <div className="w-full mb-6">
            <div className="flex justify-between items-end mb-1">
              <span className="text-xs font-bold text-indigo-300">Level {Math.floor(Math.sqrt(gamesPlayed + (parseInt(localStorage.getItem('tq_user_xp') || '0') / 10))) + 1}</span>
              <span className="text-[10px] text-indigo-400/60">{gamesPlayed * 10 + parseInt(localStorage.getItem('tq_user_xp') || '0')} XP</span>
            </div>
            <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                style={{ width: `${Math.min(100, ((gamesPlayed * 10 + parseInt(localStorage.getItem('tq_user_xp') || '0')) % 100))}%` }}
              />
            </div>
          </div>
          
          <div className="w-full bg-black/40 rounded-2xl p-5 flex flex-col gap-1 border border-white/5 shadow-inner relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
            <span className="text-indigo-300/70 text-xs uppercase font-bold tracking-wider relative z-10">{t('walletBalance')}</span>
            <span className="text-4xl font-black text-white relative z-10 tracking-tight flex items-center justify-center gap-2">
              {balance.toFixed(2)} <TonIcon className="w-8 h-8" />
            </span>
          </div>
          
          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4 mt-5 w-full">
            <button 
              onClick={() => {
                playSound('click');
                if (!walletConnected) {
                  setShowConnectWarning(true);
                  return;
                }
                onDepositClick();
              }}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
            >
              <ArrowDownToLine size={18} className="text-green-400" /> {t('deposit')}
            </button>
            <button 
              onClick={() => {
                playSound('click');
                if (!walletConnected) {
                  setShowConnectWarning(true);
                  return;
                }
                if (balance < 100) {
                  alert(t('minWithdrawal'));
                  return;
                }
                alert(t('withdrawProcessing'));
              }}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
            >
              <ArrowUpFromLine size={18} className="text-red-400" /> {t('withdraw')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-2">
        <h3 className="text-[var(--color-tg-muted)] text-sm font-bold uppercase tracking-wider px-2">{t('statistics')}</h3>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="bg-[var(--color-game-card)] p-4 rounded-2xl cartoon-border flex flex-col items-center justify-center gap-1">
            <span className="text-[var(--color-tg-muted)] text-[10px] uppercase font-bold tracking-wider">{t('winRate')}</span>
            <span className="text-2xl font-bold text-green-400 text-stroke">{gamesPlayed > 0 ? Math.round((userWins / gamesPlayed) * 100) : 0}%</span>
          </div>
          <div className="bg-[var(--color-game-card)] p-4 rounded-2xl cartoon-border flex flex-col items-center justify-center gap-1">
            <span className="text-[var(--color-tg-muted)] text-[10px] uppercase font-bold tracking-wider">{t('totalWagered')}</span>
            <span className="text-2xl font-bold text-white text-stroke flex items-center gap-1">{totalWagered.toFixed(1)} <TonIcon className="w-4 h-4" /></span>
          </div>
        </div>

        <h3 className="text-[var(--color-tg-muted)] text-sm font-bold uppercase tracking-wider px-2 mt-2">{t('settings')}</h3>
        <div className="bg-[var(--color-game-card)] rounded-2xl cartoon-border overflow-hidden flex flex-col">
          <SettingRow icon={<Wallet size={20} />} label={t('walletConnection')} value={walletConnected ? t('connected') : t('notConnected')} valueColor={walletConnected ? 'text-green-400' : 'text-red-400'} />
          <div className="h-px bg-white/5 ml-12" />
          <SettingRow icon={<Trophy size={20} />} label={t('gamesPlayed')} value={gamesPlayed.toString()} />
          <div className="h-px bg-white/5 ml-12" />
          <SettingRow icon={<Users size={20} />} label={t('referralTier')} value={gamesPlayed >= 50 ? "Gold" : "Bronze"} valueColor={gamesPlayed >= 50 ? "text-yellow-400" : "text-[#CD7F32]"} />
        </div>
      </div>

      {/* Connect Warning Modal */}
      <AnimatePresence>
        {showConnectWarning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--color-game-card)] p-6 rounded-3xl cartoon-border w-full max-w-sm flex flex-col gap-4 text-center"
            >
              <h3 className="text-3xl font-bold text-stroke text-red-400">{t('oops')}</h3>
              <p className="font-bold text-lg">{t('connectWalletFirst')}</p>
              
              <button 
                onClick={() => { playSound('click'); setShowConnectWarning(false); }}
                className="bg-gradient-to-b from-[var(--color-game-primary)] to-[var(--color-game-secondary)] text-white font-bold py-3 rounded-xl cartoon-button text-stroke mt-2"
              >
                {t('ok')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingRow({ icon, label, value, valueColor = "text-white/80" }: { icon: React.ReactNode, label: string, value: string, valueColor?: string }) {
  return (
    <div className="flex items-center justify-between p-4 active:bg-white/5 transition-colors cursor-pointer" onClick={() => playSound('click')}>
      <div className="flex items-center gap-3">
        <div className="text-[var(--color-game-accent)]">{icon}</div>
        <span className="font-bold">{label}</span>
      </div>
      <span className={cn("text-sm font-bold", valueColor)}>{value}</span>
    </div>
  );
}
