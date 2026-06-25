import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Globe, Menu, X, Github, Mail, Phone, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Layout: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen flex flex-col selection:bg-accent-primary/50 relative">
      {/* Dynamic Background Blobs */}
      <div className="blob -top-40 -left-60" />
      <div className="blob -bottom-40 -right-60 !opacity-5" />

      {/* Header */}
      <header className="sticky top-0 z-[100] bg-[#060113]/50 backdrop-blur-2xl border-b border-white/5 transition-all duration-300">
        <div className="container py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative p-2.5 bg-accent-gradient rounded-2xl group-hover:rotate-12 group-hover:scale-110 transition-all duration-500 shadow-xl shadow-accent-primary/20">
              <Globe className="w-6 h-6 text-white" />
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity rounded-2xl" />
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="text-2xl font-black tracking-tight uppercase leading-none">Wayback</span>
              <span className="text-xs font-black tracking-[0.4em] uppercase text-accent-primary leading-none">Pro Archive</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-10 text-xs font-black uppercase tracking-[0.2em] text-text-secondary">
            {[
              { label: 'Home', path: '/' },
              { label: 'Services', path: '/services' },
              { label: 'Portfolio', path: '/portfolio' },
              { label: 'Guides', path: '/blogs' },
              { label: 'About', path: '/about' },
            ].map((link) => (
              <Link 
                key={link.path} 
                to={link.path} 
                className="hover:text-accent-primary hover:scale-105 transition-all relative group"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent-gradient transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </nav>

          <Link to="/contact" className="hidden lg:block">
            <button className="gradient-button !px-8 !py-3.5 text-xs">Let's Talk</button>
          </Link>

          {/* Mobile Menu Toggle */}
          <button 
            className="lg:hidden p-3 text-white glass-card !rounded-xl active:scale-90 transition-transform"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="lg:hidden absolute top-full left-0 w-full bg-[#0b051e]/95 backdrop-blur-3xl border-b border-white/5 py-10 px-6 flex flex-col gap-6"
            >
               {[
                { label: 'Home', path: '/' },
                { label: 'Services', path: '/services' },
                { label: 'Portfolio', path: '/portfolio' },
                { label: 'Guides', path: '/blogs' },
                { label: 'About', path: '/about' },
              ].map((link) => (
                <Link 
                  key={link.path} 
                  to={link.path} 
                  onClick={() => setIsMenuOpen(false)}
                  className="text-xl font-black uppercase tracking-widest hover:text-accent-primary transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <Link 
                to="/contact" 
                onClick={() => setIsMenuOpen(false)} 
                className="gradient-button text-center mt-4"
              >
                Start Project
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="relative bg-[#0b051e] border-t border-white/5 py-32 mt-32 overflow-hidden">
        <div className="blob -bottom-60 -left-60 opacity-10" />
        <div className="container relative z-10 grid grid-cols-1 md:grid-cols-12 gap-16">
          <div className="md:col-span-4 space-y-10">
            <Link to="/" className="flex items-center gap-3">
              <div className="p-3 bg-accent-gradient rounded-2xl shadow-lg shadow-accent-primary/20">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <div className="flex flex-col -space-y-1">
                <span className="text-3xl font-black tracking-tight uppercase">Wayback</span>
                <span className="text-xs font-black tracking-[0.4em] uppercase text-accent-primary leading-none">Archives Pro</span>
              </div>
            </Link>
            <p className="text-text-secondary text-lg leading-relaxed max-w-sm">
              Transforming fragmented or lost web data into structured, usable, and modern digital assets with precision and intelligence.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://github.com/Shoaib-Akhtarr/Wayback-Machine-Downloader" className="p-4 glass-card hover:bg-accent-primary hover:scale-110 transition-all duration-300 text-white">
                <Github size={24} />
              </a>
              <a href="mailto:contact@yourdomain.com" className="p-4 glass-card hover:bg-accent-primary hover:scale-110 transition-all duration-300 text-white">
                <Mail size={24} />
              </a>
            </div>
          </div>

          <div className="md:col-span-2 space-y-8">
            <h4 className="text-sm font-black uppercase tracking-[0.3em] text-accent-primary">Solutions</h4>
            <ul className="space-y-4 text-base font-bold text-text-secondary">
              <li><Link to="/" className="hover:text-white transition-colors">Home Archive</Link></li>
              <li><Link to="/services" className="hover:text-white transition-colors">Restoration</Link></li>
              <li><Link to="/portfolio" className="hover:text-white transition-colors">Showcase</Link></li>
              <li><Link to="/blogs" className="hover:text-white transition-colors">Knowledge Base</Link></li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-8">
            <h4 className="text-sm font-black uppercase tracking-[0.3em] text-accent-primary">Capabilities</h4>
            <ul className="space-y-4 text-base font-bold text-text-secondary">
              <li className="hover:text-white transition-colors cursor-default">Full Website Recovery</li>
              <li className="hover:text-white transition-colors cursor-default">CDX API Integration</li>
              <li className="hover:text-white transition-colors cursor-default">Python Automation</li>
              <li className="hover:text-white transition-colors cursor-default">Legacy Data Structuring</li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-8">
            <h4 className="text-sm font-black uppercase tracking-[0.3em] text-accent-primary">Get in Touch</h4>
            <ul className="space-y-6 text-base font-bold text-text-secondary">
              <li className="flex items-center gap-4 group">
                <div className="p-2 rounded-lg bg-white/5 group-hover:text-accent-primary transition-colors">
                  <Mail size={20} />
                </div>
                <span>contact@archivepro.com</span>
              </li>
              <li className="flex items-center gap-4 group">
                <div className="p-2 rounded-lg bg-white/5 group-hover:text-accent-primary transition-colors">
                  <Phone size={20} />
                </div>
                <span>+92-XXX-XXXXXXX</span>
              </li>
              <li className="flex items-center gap-4 group">
                <div className="p-2 rounded-lg bg-white/5 group-hover:text-accent-primary transition-colors">
                  <MapPin size={20} />
                </div>
                <span>Gujrat, Punjab, Pakistan</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="container mt-32 pt-10 border-t border-white/5 text-center">
          <p className="text-xs font-black uppercase tracking-[0.5em] text-text-dim">
            &copy; {new Date().getFullYear()} Wayback Archive Pro. Shawaiz Ali & Shoaib Akhtar.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
