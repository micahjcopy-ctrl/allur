import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-bg-dark"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <motion.div 
        className="w-[800px] h-[800px] absolute mix-blend-screen opacity-20"
        style={{ background: 'radial-gradient(circle, var(--color-accent), transparent)' }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 4, ease: "easeInOut" }}
      />
      
      <motion.h1 
        className="text-[15vw] font-display text-white leading-none tracking-tighter relative z-10"
        initial={{ opacity: 0, scale: 0.8, filter: 'blur(20px)' }}
        animate={phase >= 1 ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : { opacity: 0, scale: 0.8, filter: 'blur(20px)' }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        style={{ textShadow: '0 0 50px rgba(0,229,255,0.3)' }}
      >
        ALLUR
      </motion.h1>
      
      <motion.div 
        className="text-[2vw] text-accent tracking-[0.4em] font-display mt-4 relative z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
        transition={{ duration: 0.6 }}
      >
        STRONG. MODERN. REFINED.
      </motion.div>
      
      <motion.div 
        className="mt-12 text-white/50 text-[1.2vw] border border-white/10 px-6 py-3 rounded-full relative z-10 bg-white/5 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.8 }}
      >
        AVAILABLE NOW
      </motion.div>
    </motion.div>
  );
}