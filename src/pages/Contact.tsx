import React, { useEffect, useRef } from 'react';
import { Mail, Phone, MapPin, Send, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import gsap from 'gsap';

const Contact: React.FC = () => {
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dots: HTMLDivElement[] = [];
    const container = bgRef.current;
    if (!container) return;

    for (let i = 0; i < 50; i++) {
      const dot = document.createElement('div');
      dot.className = 'absolute w-1 h-1 bg-accent-primary rounded-full opacity-20 pointer-events-none';
      container.appendChild(dot);
      gsap.set(dot, {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
      });
      dots.push(dot);
    }

    const handleMouseMove = (e: MouseEvent) => {
      dots.forEach((dot, i) => {
        gsap.to(dot, {
          x: e.clientX + (Math.cos(i) * 100),
          y: e.clientY + (Math.sin(i) * 100),
          duration: 1 + (i * 0.05),
          ease: "power2.out"
        });
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      dots.forEach(dot => dot.remove());
    };
  }, []);

  return (
    <div className="container py-20 relative min-h-screen">
      <div ref={bgRef} className="absolute inset-0 -z-10 overflow-hidden" />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 relative z-10">
        {/* Contact Info */}
        <div className="space-y-16">
          <div className="space-y-6">
            <motion.h1 
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="text-5xl md:text-8xl font-black leading-none"
            >
              Let's <span className="gradient-text italic">Connect</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="text-xl text-text-secondary leading-relaxed max-w-lg"
            >
              Ready to start your next restoration or data extraction project? Reach out to our team of experts.
            </motion.p>
          </div>

          <div className="space-y-10">
            {[
              { icon: Mail, label: "Email Address", val: "contact@yourdomain.com", color: "from-blue-500 to-cyan-500" },
              { icon: Phone, label: "Phone Number", val: "+92-XXX-XXXXXXX", color: "from-green-500 to-emerald-500" },
              { icon: MapPin, label: "Office Location", val: "Gujrat, Punjab, Pakistan", color: "from-purple-500 to-pink-500" }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.8 + i * 0.1 }}
                className="flex items-center gap-8 group cursor-pointer"
              >
                <div className="p-5 glass-card group-hover:bg-accent-primary group-hover:scale-110 transition-all duration-300 shadow-xl shadow-accent-primary/5">
                  <item.icon className="w-8 h-8 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="text-xs font-black text-accent-primary uppercase tracking-[0.3em] mb-1">{item.label}</p>
                  <p className="text-2xl font-bold group-hover:translate-x-2 transition-transform duration-300">{item.val}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="p-10 glass-card space-y-6 border-accent-primary/20 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-accent-gradient opacity-0 group-hover:opacity-5 transition-opacity" />
            <h4 className="text-xs font-black uppercase tracking-[0.4em] text-accent-primary">Team Developers</h4>
            <div className="flex items-center gap-6">
               <div className="text-xl font-black hover:text-accent-primary transition-colors cursor-default">Shawaiz Ali</div>
               <div className="text-accent-primary font-black animate-pulse">/</div>
               <div className="text-xl font-black hover:text-accent-primary transition-colors cursor-default">Shoaib Akhtar</div>
            </div>
          </motion.div>
        </div>

        {/* Contact Form */}
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, type: "spring" }}
          className="glass-card p-10 md:p-16 space-y-10 border-white/5 shadow-2xl relative"
        >
          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
            <Send size={150} />
          </div>
          
          <h2 className="text-3xl font-black italic tracking-tight relative z-10">Tell us about your project</h2>
          <form className="space-y-8 relative z-10" onSubmit={(e) => e.preventDefault()}>
            <motion.div 
              whileFocus={{ y: -5 }}
              className="space-y-3"
            >
              <label className="text-xs font-black uppercase tracking-widest text-text-dim ml-2">Full Name</label>
              <input 
                type="text" 
                placeholder="Shawaiz Ali or Shoaib Akhtar"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-5 text-lg outline-none focus:border-accent-primary focus:ring-4 ring-accent-primary/5 transition-all"
                required
              />
            </motion.div>

            <motion.div 
              whileFocus={{ y: -5 }}
              className="space-y-3"
            >
              <label className="text-xs font-black uppercase tracking-widest text-text-dim ml-2">Project Type</label>
              <div className="relative">
                <select className="w-full bg-background-surface border border-white/10 rounded-2xl px-8 py-5 text-lg outline-none focus:border-accent-primary transition-all appearance-none cursor-pointer">
                  <option>Restoration</option>
                  <option>Data Extraction</option>
                  <option>Custom System</option>
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-accent-primary">
                   <Send size={18} className="rotate-90" />
                </div>
              </div>
            </motion.div>

            <motion.div 
              whileFocus={{ y: -5 }}
              className="space-y-3"
            >
              <label className="text-xs font-black uppercase tracking-widest text-text-dim ml-2">Requirements</label>
              <textarea 
                placeholder="Describe your needs..."
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-5 text-lg outline-none focus:border-accent-primary focus:ring-4 ring-accent-primary/5 transition-all resize-none"
                required
              ></textarea>
            </motion.div>

            <div className="flex flex-col xl:flex-row gap-6">
              <div className="flex-grow">
                 <motion.label 
                   whileHover={{ scale: 1.02 }}
                   whileTap={{ scale: 0.98 }}
                   className="flex items-center justify-center gap-4 px-8 py-5 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-all border-dashed"
                 >
                   <Upload size={24} className="text-accent-primary" />
                   <span className="text-base font-black uppercase tracking-widest">Share Files</span>
                   <input type="file" className="hidden" />
                 </motion.label>
              </div>
              <motion.button 
                whileHover={{ scale: 1.05, x: 5 }}
                whileTap={{ scale: 0.95 }}
                className="gradient-button flex items-center justify-center gap-3 text-lg px-12 py-5"
              >
                Send Message <Send size={20} />
              </motion.button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default Contact;
