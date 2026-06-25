import React, { useEffect, useRef } from 'react';
import { Target, Cpu, BarChart3, Users, Lightbulb, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import gsap from 'gsap';

const About: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // GSAP Curtain Closing Animation
    const curtains = document.querySelectorAll('.curtain');
    gsap.to(curtains, {
      xPercent: 100,
      stagger: 0.1,
      duration: 1.2,
      ease: "power4.inOut",
      onComplete: () => {
        gsap.set(curtains, { display: 'none' });
      }
    });

    // Image Parallax
    const moveImage = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const x = (clientX - window.innerWidth / 2) * 0.02;
      const y = (clientY - window.innerHeight / 2) * 0.02;
      gsap.to(imageRef.current, { x, y, duration: 0.5 });
    };
    window.addEventListener('mousemove', moveImage);
    return () => window.removeEventListener('mousemove', moveImage);
  }, []);


  const titleWords = "Technology driven.".split("");

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {/* Page Loader Curtain */}
      <div className="fixed inset-0 z-50 pointer-events-none flex flex-col">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="curtain flex-grow bg-accent-primary w-full" />
        ))}
      </div>

      <div className="container py-20 space-y-32">
        {/* Hero */}
        <section className="text-center space-y-8 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-8xl font-black italic leading-none">
            <span className="flex justify-center flex-wrap">
              {titleWords.map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.03, duration: 0.5 }}
                >
                  {char === " " ? "\u00A0" : char}
                </motion.span>
              ))}
            </span>
            <br />
            <motion.span 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.5, type: "spring" }}
              className="gradient-text inline-block"
            >
              Data Focused.
            </motion.span>
          </h1>
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="text-xl text-text-secondary leading-relaxed"
          >
            We are a technology-driven team focused on data extraction, web reconstruction, and intelligent system development. Our mission is to transform fragmented or lost web data into structured, usable, and modern digital assets.
          </motion.p>
        </section>

        {/* Stats/Highlight */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Target, title: "Our Mission", desc: "Transforming web archives into modern structured assets." },
            { icon: Cpu, title: "Our Tech", desc: "Built with Data Science and practical engineering precision." },
            { icon: Lightbulb, title: "Our Innovation", desc: "Developing intelligent systems for real-world problems." }
          ].map((item, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2, duration: 0.8 }}
              className="glass-card p-12 space-y-6 text-center hover:bg-white/10 group"
            >
              <motion.div 
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.8 }}
                className="p-5 bg-accent-primary/10 rounded-2xl w-fit mx-auto text-accent-primary group-hover:bg-accent-primary group-hover:text-white transition-colors"
              >
                <item.icon size={40} />
              </motion.div>
              <h3 className="text-2xl font-bold">{item.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </section>

        {/* Detailed Content */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <motion.div 
            ref={imageRef}
            initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1 }}
            className="relative aspect-square rounded-[2rem] overflow-hidden glass-card p-3"
          >
             <img 
               src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2000&auto=format&fit=crop" 
               alt="Technology Team" 
               className="w-full h-full object-cover rounded-[1.5rem] opacity-60 grayscale hover:grayscale-0 transition-all duration-1000 scale-110 hover:scale-100" 
             />
             <div className="absolute inset-0 bg-gradient-to-tr from-accent-primary/20 to-transparent pointer-events-none" />
          </motion.div>
          <div className="space-y-10">
            <motion.h2 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              className="text-4xl md:text-6xl font-black leading-tight"
            >
              Analytical Thinking. <br /> 
              <span className="text-outline-white">Engineering Precision.</span>
            </motion.h2>
            <p className="text-lg text-text-secondary leading-relaxed">
              With a strong foundation in Data Science and practical development, we specialize in rebuilding websites, extracting historical data, and creating automation systems that solve real-world problems. 
            </p>
            <div className="space-y-6">
              {[
                { icon: BarChart3, text: "Data-driven decision making" },
                { icon: Users, text: "Scalable and efficient solutions" },
                { icon: ShieldCheck, text: "High structural accuracy in reconstruction" }
              ].map((point, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-5 group"
                >
                  <div className="p-3 bg-gradient-to-tr from-accent-primary to-accent-secondary rounded-xl group-hover:rotate-12 transition-transform shadow-lg shadow-accent-primary/20">
                    <point.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-lg group-hover:text-accent-primary transition-colors">{point.text}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default About;
