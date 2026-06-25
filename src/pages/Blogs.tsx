import React, { useEffect, useRef } from 'react';
import { BookOpen, ArrowRight, Calendar, User } from 'lucide-react';
import { motion } from 'framer-motion';
import gsap from 'gsap';

const Blogs: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // GSAP Floating Elements
    const floatingElements = document.querySelectorAll('.float-decoration');
    floatingElements.forEach((el, i) => {
      gsap.to(el, {
        y: i % 2 === 0 ? 30 : -30,
        x: i % 2 === 0 ? 20 : -20,
        duration: 3 + i,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    });

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const x = (clientX - window.innerWidth / 2) * 0.01;
      const y = (clientY - window.innerHeight / 2) * 0.01;
      gsap.to(floatingElements, { x: `+=${x}`, y: `+=${y}`, duration: 0.5 });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const blogs = [
    {
      title: "How to Download a Website from the Wayback Machine: Step-by-Step Guide",
      date: "March 15, 2026",
      author: "Shawaiz Ali",
      desc: "Learn the precision techniques for downloading entire archived sites using our specialized tools and CDX APIs.",
      image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc51?q=80&w=2000&auto=format&fit=crop"
    },
    {
      title: "Understanding CDX APIs for Large Scale Data Extraction",
      date: "March 10, 2026",
      author: "Shoaib Akhtar",
      desc: "A deep dive into the metadata layer of web archives and how to leverage it for structural accuracy.",
      image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?q=80&w=2000&auto=format&fit=crop"
    },
    {
      title: "Data Cleaning: Turning Raw Scraped Data into Insights",
      date: "March 05, 2026",
      author: "Tech Team",
      desc: "Best practices for converting messy raw web data into clean, analysis-ready structured datasets.",
      image: "https://images.unsplash.com/photo-1551288049-bbbda536339a?q=80&w=2000&auto=format&fit=crop"
    }
  ];

  return (
    <div ref={containerRef} className="container py-20 space-y-24 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="float-decoration absolute top-20 right-10 w-4 h-4 rounded-full bg-accent-primary blur-[2px] opacity-10" />
      <div className="float-decoration absolute bottom-40 left-20 w-8 h-8 rounded-full bg-accent-secondary blur-[2px] opacity-10" />

      <div className="text-center space-y-6">
        <motion.h1 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-8xl font-black leading-none"
        >
          Our <span className="gradient-text italic">Blogs & Guides</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed underline decoration-accent-primary/20"
        >
          Deep dives into web reconstruction, data science, and historical digital archiving.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
        {blogs.map((blog, i) => (
          <motion.article 
            key={i} 
            initial={{ y: 100, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: i * 0.2, duration: 0.8 }}
            className="flex flex-col group cursor-pointer perspective-1000"
          >
            <div className="relative aspect-[4/3] rounded-[2rem] overflow-hidden mb-8 shadow-2xl border border-white/5">
              <img 
                src={blog.image} 
                alt={blog.title} 
                className="w-full h-full object-cover group-hover:scale-125 transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-transparent flex items-end p-8">
                 <div className="flex items-center gap-6 text-xs font-black text-white uppercase tracking-widest bg-accent-primary/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                   <span className="flex items-center gap-2"><Calendar size={14} className="text-accent-primary" /> {blog.date}</span>
                   <span className="flex items-center gap-2"><User size={14} className="text-accent-primary" /> {blog.author}</span>
                 </div>
              </div>
            </div>
            <h3 className="text-3xl font-black mb-5 group-hover:text-accent-primary transition-colors leading-tight relative">
              {blog.title}
              <span className="absolute -bottom-2 left-0 w-0 h-1 bg-accent-gradient transition-all duration-500 group-hover:w-full" />
            </h3>
            <p className="text-text-secondary text-base mb-8 flex-grow leading-relaxed line-clamp-3">
              {blog.desc}
            </p>
            <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.3em] group-hover:gap-6 transition-all group-hover:text-accent-primary">
              Read More <ArrowRight size={18} className="text-accent-primary group-hover:scale-125 transition-transform" />
            </div>
          </motion.article>
        ))}
      </div>

      {/* CTA Box */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass-card p-20 text-center space-y-10 relative overflow-hidden group border-white/5"
      >
        <div className="absolute inset-0 bg-accent-gradient opacity-0 group-hover:opacity-[0.02] transition-opacity duration-1000" />
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 3 }}
        >
          <BookOpen className="w-16 h-16 mx-auto text-accent-primary" />
        </motion.div>
        <h2 className="text-4xl md:text-5xl font-black max-w-3xl mx-auto">Want to learn more about site recovery?</h2>
        <p className="text-text-secondary text-lg max-w-lg mx-auto leading-relaxed">Sign up for our newsletter to receive the latest guides and data science insights.</p>
        <div className="max-w-xl mx-auto flex flex-col md:flex-row gap-4 relative z-10">
          <input 
            type="email" 
            placeholder="Email Address" 
            className="flex-grow bg-white/5 border border-white/10 rounded-full px-10 py-5 text-lg outline-none focus:border-accent-primary focus:ring-4 ring-accent-primary/10 transition-all placeholder:text-text-dim" 
          />
          <button className="gradient-button !px-12 text-lg active:scale-95">Subscribe</button>
        </div>
      </motion.div>
    </div>
  );
};

export default Blogs;
