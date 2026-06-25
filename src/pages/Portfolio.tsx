import React, { useEffect, useRef } from 'react';
import { ExternalLink, Briefcase, Zap, Search, Layout } from 'lucide-react';
import { motion } from 'framer-motion';
import gsap from 'gsap';

const Portfolio: React.FC = () => {
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!spotlightRef.current) return;
      const { left, top } = spotlightRef.current.getBoundingClientRect();
      const x = e.clientX - left;
      const y = e.clientY - top;
      gsap.to(spotlightRef.current, {
        background: `radial-gradient(600px circle at ${x}px ${y}px, rgba(255,140,0,0.15), transparent 40%)`,
        duration: 0.3
      });
    };
    const section = spotlightRef.current;
    if (section) {
      section.addEventListener('mousemove', handleMouseMove);
      return () => section.removeEventListener('mousemove', handleMouseMove);
    }
  }, []);

  const projects = [
    {
      icon: Layout,
      title: "Legacy Website Restoration",
      desc: "Reshaped and restored archived websites from early 2000s archives with high structural accuracy and modern compatibility.",
      tag: "Restoration"
    },
    {
      icon: Search,
      title: "CDX Historical Structuring",
      desc: "Extracted and structured massive historical datasets from CDX APIs and web archives for academic and business research.",
      tag: "Data Extraction"
    },
    {
      icon: Zap,
      title: "Automated Reconstruction Tools",
      desc: "Developed custom automated tools for full-site downloads and snapshot-based website reconstruction from the Wayback Machine.",
      tag: "Automation"
    },
    {
      icon: Briefcase,
      title: "Custom Scraping Pipelines",
      desc: "Built robust scraping pipelines for extracting structured data from unstructured web sources across various industries.",
      tag: "Web Scraping"
    }
  ];

  return (
    <div className="container py-20 space-y-24">
      <div className="flex flex-col md:flex-row items-end justify-between gap-8 py-10">
        <div className="space-y-6">
          <motion.h1 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-8xl font-black leading-none"
          >
            Our <span className="gradient-text italic">Portfolio</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="text-xl text-text-secondary max-w-lg leading-relaxed"
          >
            A showcase of our most complex and successful web data reconstruction and automation projects.
          </motion.p>
        </div>
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", delay: 0.8 }}
          className="glass-card px-8 py-6 flex items-center gap-6 border-accent-primary/20 shadow-2xl shadow-accent-primary/10"
        >
          <div className="text-5xl font-black text-accent-primary">100+</div>
          <div className="text-sm font-black uppercase tracking-widest text-text-dim leading-tight">Projects <br /> Completed</div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {projects.map((project, i) => (
          <motion.div 
            key={i} 
            initial={{ x: i % 2 === 0 ? -100 : 100, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="glass-card p-1 overflow-hidden group hover:border-accent-primary/30 transition-all duration-500"
          >
            <div className="p-10 space-y-6">
              <div className="flex items-center justify-between mb-10">
                <span className="text-xs font-black uppercase tracking-[0.2em] bg-accent-primary/10 px-4 py-2 rounded-full text-accent-primary group-hover:bg-accent-primary group-hover:text-white transition-all duration-300">
                  {project.tag}
                </span>
                <motion.div whileHover={{ rotate: 45, scale: 1.2 }}>
                  <ExternalLink size={24} className="text-text-dim group-hover:text-white transition-colors" />
                </motion.div>
              </div>
              <h3 className="text-3xl font-bold group-hover:translate-x-2 transition-transform duration-300">{project.title}</h3>
              <p className="text-text-secondary text-base leading-relaxed">
                {project.desc}
              </p>
            </div>
            {/* Visual Decor */}
            <div className="h-2 bg-accent-gradient scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left" />
          </motion.div>
        ))}
      </div>

      {/* Highlights Section */}
      <motion.div 
        ref={spotlightRef}
        initial={{ opacity: 0, y: 100 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="glass-card p-20 relative overflow-hidden bg-white/5 border-white/5 shadow-2xl"
      >
        <div className="relative z-10 space-y-10 text-center">
          <motion.h4 
            animate={{ letterSpacing: ["0.3em", "0.5em", "0.3em"] }}
            transition={{ repeat: Infinity, duration: 4 }}
            className="text-sm font-black uppercase text-accent-primary"
          >
            Strong Highlight
          </motion.h4>
          <h2 className="text-4xl md:text-6xl font-black max-w-4xl mx-auto leading-tight italic">
            “Recovered and reconstructed legacy website data from early 2000s archives with <span className="gradient-text">high structural accuracy</span>”
          </h2>
          <div className="pt-10">
             <motion.button 
               whileHover={{ scale: 1.1 }}
               whileTap={{ scale: 0.9 }}
               className="gradient-button text-lg px-12 py-5"
             >
               Inquire About Custom Projects
             </motion.button>
          </div>
        </div>
        <div className="absolute top-0 right-0 p-20 opacity-5 pointer-events-none">
           <Zap size={300} />
        </div>
      </motion.div>
    </div>
  );
};

export default Portfolio;
