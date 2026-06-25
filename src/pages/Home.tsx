import React, { useState, useEffect, useRef } from 'react';
import { Search, Database, Clock, Package, ArrowRight, Shield, Zap, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { startExtraction, ExtractionProgress } from '../utils/downloader';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const Home: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [extractionState, setExtractionState] = useState<ExtractionProgress>({
    status: 'idle',
    current: 0,
    total: 0,
    message: ''
  });
  
  const heroRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleStartExtraction = async () => {
    if (!domain) {
      setExtractionState({
        status: 'error',
        current: 0,
        total: 0,
        message: 'Please enter a valid domain.'
      });
      return;
    }

    // Clean domain
    const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    await startExtraction(cleanDomain, (progress) => {
      setExtractionState(progress);
    });
  };

  useEffect(() => {
    // GSAP Parallax for background blobs
    const blobs = document.querySelectorAll('.blob');
    blobs.forEach((blob, i) => {
      gsap.to(blob, {
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 1.5,
        },
        y: (i + 1) * 150,
        x: (i % 2 === 0 ? 50 : -50),
        rotate: 180,
      });
    });

  }, []);

  const titleWords = "Entire Archived Sites".split(" ");

  return (
    <div ref={containerRef} className="space-y-20 pb-20 relative overflow-hidden">
      {/* Background Blobs */}
      <div className="blob top-20 -left-20" />
      <div className="blob top-[40%] -right-20 !bg-accent-secondary" />
      <div className="blob bottom-0 left-1/4" />

      {/* Hero Section */}
      <section ref={heroRef} className="relative pt-20 pb-32">
        <div className="container text-center space-y-8">
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="inline-flex items-center gap-2 px-4 py-2 glass-card rounded-full text-xs font-bold uppercase tracking-widest text-orange-500"
          >
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Zap className="w-3 h-3" />
            </motion.div>
            Next-Gen Wayback Downloader
          </motion.div>

          <h1 className="text-6xl md:text-9xl font-[900] tracking-tighter leading-[0.85] overflow-hidden py-4">
            <motion.span
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="block mb-4"
            >
              Extract and <br className="hidden md:block" /> Package
            </motion.span>
            <span className="gradient-text block relative">
              {titleWords.map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.5, y: 50 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ 
                    duration: 0.8, 
                    delay: 0.8 + i * 0.1,
                    ease: [0.16, 1, 0.3, 1]
                  }}
                  className="inline-block mr-[0.2em]"
                >
                  {word}
                </motion.span>
              ))}
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ delay: 1.5, duration: 1 }}
                className="absolute -bottom-2 left-0 h-2 bg-accent-gradient opacity-30 rounded-full"
              />
            </span>
          </h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 1 }}
            className="text-text-secondary text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed font-medium"
          >
            The ultimate tool for precision site recovery. Reconstruct legacy data, extract historical snapshots, and package them into a single, clean ZIP with one click.
          </motion.p>
          
          {/* Main Tool Input */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 1 }}
            className="max-w-4xl mx-auto mt-20"
          >
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleStartExtraction();
              }}
              className="glass-card p-3 flex flex-col md:flex-row gap-4 group focus-within:ring-4 ring-accent-primary/20 transition-all shadow-2xl relative w-full"
            >
              <div className="absolute inset-0 bg-accent-gradient opacity-0 group-focus-within:opacity-[0.03] transition-opacity rounded-3xl" />
              <div className="flex-grow flex items-center px-6 gap-4 relative z-10">
                <Search className="text-text-dim group-focus-within:text-accent-primary transition-colors w-6 h-6" />
                <input 
                  type="text" 
                  placeholder="Enter domain (e.g., chromesecuritysystems.com)"
                  className="bg-transparent border-none outline-none text-white w-full py-5 text-xl font-bold placeholder:text-text-dim"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>
              <motion.button 
                type="submit"
                ref={buttonRef}
                whileHover={{ scale: (extractionState.status === 'idle' || extractionState.status === 'error' || extractionState.status === 'completed') ? 1.02 : 1 }}
                whileTap={{ scale: (extractionState.status === 'idle' || extractionState.status === 'error' || extractionState.status === 'completed') ? 0.98 : 1 }}
                disabled={extractionState.status !== 'idle' && extractionState.status !== 'error' && extractionState.status !== 'completed'}
                className={`gradient-button flex items-center justify-center gap-3 group/btn whitespace-nowrap !text-base !py-5 ${
                  (extractionState.status !== 'idle' && extractionState.status !== 'error' && extractionState.status !== 'completed') ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {extractionState.status === 'idle' || extractionState.status === 'error' || extractionState.status === 'completed' ? (
                  <>
                    Start Extraction 
                    <ArrowRight size={20} className="group-hover/btn:translate-x-2 transition-transform" />
                  </>
                ) : (
                  <>
                    Processing...
                    <Loader2 size={20} className="animate-spin" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Progress UI */}
            <AnimatePresence>
              {extractionState.status !== 'idle' && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -20 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -20 }}
                  className="mt-10 overflow-hidden"
                >
                  <div className="glass-card p-8 border-white/10 relative overflow-hidden">
                    {/* Animated background glow */}
                    <div className="absolute inset-0 bg-accent-gradient opacity-[0.05] animate-pulse" />
                    
                    <div className="relative z-10 space-y-6">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <h4 className="text-sm font-black uppercase tracking-widest text-text-dim flex items-center gap-2">
                            {extractionState.status === 'error' ? (
                              <AlertCircle size={14} className="text-red-500" />
                            ) : extractionState.status === 'completed' ? (
                              <CheckCircle size={14} className="text-green-500" />
                            ) : (
                              <Loader2 size={14} className="text-accent-primary animate-spin" />
                            )}
                            Current Status
                          </h4>
                          <p className="text-xl font-bold text-white transition-all">
                            {extractionState.message}
                          </p>
                        </div>
                        {extractionState.total > 0 && (
                          <div className="text-right">
                            <span className="text-3xl font-black gradient-text">
                              {Math.round((extractionState.current / extractionState.total) * 100)}%
                            </span>
                            <p className="text-xs font-bold text-text-dim uppercase tracking-tighter">
                              {extractionState.current} / {extractionState.total} Files
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Progress Bar Container */}
                      <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/5 p-1">
                        <motion.div 
                          className="h-full bg-accent-gradient rounded-full"
                          initial={{ width: 0 }}
                          animate={{ 
                            width: extractionState.total > 0 
                              ? `${(extractionState.current / extractionState.total) * 100}%` 
                              : (extractionState.status === 'completed' ? '100%' : '5%') 
                          }}
                          transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                        />
                      </div>
                      
                      {extractionState.status === 'completed' && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center justify-center gap-2 text-green-400 text-sm font-bold"
                        >
                          <CheckCircle size={16} /> Extraction Successful! Your download has started.
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="mt-8 flex items-center justify-center gap-4 text-xs font-black uppercase tracking-[0.4em] text-text-dim">
              <div className="h-px w-12 bg-white/10" />
              Built for precision site recovery
              <div className="h-px w-12 bg-white/10" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="container py-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            { icon: Database, title: "CDX Extraction", desc: "Lists every archived page known to Wayback with high structural accuracy." },
            { icon: Clock, title: "Snapshot Focus", desc: "Downloads the specific snapshot you need, focusing on legacy data integrity." },
            { icon: Package, title: "ZIP Packaging", desc: "Maintains folder structure for offline browsing and seamless deployment." }
          ].map((feature, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2, duration: 0.8 }}
              className="glass-card p-12 space-y-8 group hover:-translate-y-2"
            >
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 bg-accent-gradient opacity-20 blur-xl group-hover:opacity-40 transition-opacity" />
                <div className="relative z-10 p-4 bg-accent-gradient rounded-2xl text-white shadow-lg shadow-accent-primary/20">
                  <feature.icon className="w-8 h-8" />
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-3xl font-black">{feature.title}</h3>
                <p className="text-text-secondary text-base leading-relaxed">{feature.desc}</p>
              </div>
              <div className="h-1 w-0 bg-accent-gradient group-hover:w-full transition-all duration-500 rounded-full" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Trust Section */}
      <section className="container pb-40">
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="glass-card p-16 md:p-24 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-16 border-white/5"
        >
          <div className="absolute inset-0 bg-accent-gradient opacity-[0.03] pointer-events-none" />
          <div className="max-w-xl space-y-8 relative z-10">
            <span className="text-xs font-black uppercase tracking-[0.5em] text-accent-primary">Global Verification</span>
            <motion.h2 
              className="text-5xl md:text-7xl font-black italic uppercase leading-[0.85]"
            >
              Trusted <br /> 
              <span className="text-outline-white">By 1240+</span> <br /> 
              Enterprises
            </motion.h2>
            <p className="text-lg text-text-secondary font-medium leading-relaxed">
              Providing professional data recovery and web archive services since 2015. Our infrastructure is battle-tested.
            </p>
          </div>
          <div className="flex-grow flex items-center justify-center relative z-10">
             <motion.div 
               animate={{ 
                 rotate: 360,
               }}
               transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
               className="relative"
             >
               <div className="w-64 h-64 border-2 border-dashed border-accent-primary/30 rounded-full flex items-center justify-center">
                 <Shield className="text-accent-primary w-24 h-24" />
               </div>
               <div className="absolute -top-4 -left-4 w-12 h-12 bg-accent-gradient rounded-full blur-xl opacity-50" />
             </motion.div>
             <div className="absolute text-sm font-black uppercase tracking-[0.3em] text-accent-primary rotate-90 translate-x-48 opacity-20 whitespace-nowrap">
               Verified Infrastructure
             </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
};

export default Home;
