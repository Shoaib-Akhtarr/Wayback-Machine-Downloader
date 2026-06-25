import React, { useEffect, useRef } from 'react';
import { Globe, Database, Download, Code, Cpu, Layers, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import gsap from 'gsap';

const Services: React.FC = () => {
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // GSAP Tilt Effect
    cardsRef.current.forEach((card) => {
      if (!card) return;
      const handleMouseMove = (e: MouseEvent) => {
        const { left, top, width, height } = card.getBoundingClientRect();
        const x = (e.clientX - (left + width / 2)) / 15;
        const y = (e.clientY - (top + height / 2)) / 15;
        gsap.to(card, { rotateY: x, rotateX: -y, transformPerspective: 1000, duration: 0.5 });
      };
      const handleMouseLeave = () => {
        gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.5 });
      };
      card.addEventListener('mousemove', handleMouseMove);
      card.addEventListener('mouseleave', handleMouseLeave);
      return () => {
        card.removeEventListener('mousemove', handleMouseMove);
        card.removeEventListener('mouseleave', handleMouseLeave);
      };
    });
  }, []);

  const services = [
    {
      icon: Globe,
      title: "Full Website Restoration",
      desc: "Complete reconstruction of websites from archived sources (Wayback, CDX, etc.). We bring legacy sites back to life with structural integrity."
    },
    {
      icon: Database,
      title: "CDX Data Extraction",
      desc: "Efficient extraction of historical snapshots and metadata. We handle the complex CDX APIs so you get clean, organized data."
    },
    {
      icon: Download,
      title: "Snapshot-Based Downloads",
      desc: "Targeted recovery of specific timeframes or versions of websites. Perfect for legal, research, or historical archiving."
    },
    {
      icon: Code,
      title: "Custom Web Scraping Solutions",
      desc: "Structured data extraction pipelines tailored for business and research needs. We handle both structured and unstructured data."
    },
    {
      icon: Cpu,
      title: "Automation Systems Development",
      desc: "Building specialized tools for repetitive and data-heavy workflows to increase efficiency and accuracy."
    },
    {
      icon: Layers,
      title: "Data Cleaning & Structuring",
      desc: "Converting raw scraped data into analysis-ready datasets. We turn noise into actionable insights."
    }
  ];

  return (
    <div className="container py-20 relative">
      <div className="blob -top-20 -right-20 !w-[600px] !h-[600px] opacity-10" />
      
      <div className="text-center space-y-6 mb-24">
        <motion.h1 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-7xl font-black leading-tight"
        >
          Our <span className="gradient-text animate-pulse">Expert Services</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="text-text-secondary max-w-2xl mx-auto text-lg"
        >
          We combine data science with professional engineering to provide comprehensive web archiving and automation solutions.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {services.map((service, i) => (
          <motion.div 
            key={i} 
            ref={(el) => (cardsRef.current[i] = el)}
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.6, type: "spring", stiffness: 100 }}
            className="glass-card p-12 flex flex-col items-center text-center group hover:bg-white/10 transition-colors border-white/5 relative overflow-hidden"
          >
            <motion.div 
              whileHover={{ scale: 1.2, rotate: 15 }}
              className="p-5 bg-gradient-to-tr from-accent-primary/20 to-accent-secondary/20 rounded-3xl mb-8 group-hover:from-accent-primary group-hover:to-accent-secondary transition-all shadow-xl shadow-accent-primary/5"
            >
              <service.icon className="w-10 h-10 text-accent-primary group-hover:text-white transition-colors" />
            </motion.div>
            <h3 className="text-2xl font-bold mb-5 group-hover:text-accent-primary transition-colors">{service.title}</h3>
            <p className="text-base text-text-secondary leading-relaxed mb-8">
              {service.desc}
            </p>
            <div className="mt-auto flex items-center justify-center gap-3 text-sm font-black text-accent-primary uppercase tracking-widely opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
              Explore Detail <CheckCircle2 size={18} className="animate-bounce" />
            </div>
            
            {/* Background Accent */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-accent-primary/5 rounded-full blur-3xl group-hover:bg-accent-primary/20 transition-all" />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Services;
