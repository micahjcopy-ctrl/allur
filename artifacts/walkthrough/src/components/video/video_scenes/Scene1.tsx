import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 3000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ duration: 0.8 }}
    >
      <div className="absolute inset-0 bg-black/40 z-0" />
      
      <div className="relative z-10 text-center flex flex-col items-center">
        <motion.div 
          className="text-accent text-[2vw] tracking-[0.3em] font-bold uppercase mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          Stop Guessing. Start Transforming.
        </motion.div>
        
        <motion.h1 
          className="text-[12vw] font-display text-text-primary leading-none tracking-tighter"
          style={{ textShadow: '0 10px 30px rgba(0,229,255,0.2)' }}
        >
          {'ALLUR'.split('').map((char, i) => (
            <motion.span 
              key={i} 
              className="inline-block"
              initial={{ opacity: 0, y: 50, rotateX: -60 }}
              animate={phase >= 2 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 50, rotateX: -60 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: phase >= 2 ? i * 0.05 : 0 }}
            >
              {char}
            </motion.span>
          ))}
        </motion.h1>

        <motion.div 
          className="mt-8 flex gap-8 items-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {['STRONG', 'MODERN', 'REFINED'].map((word, i) => (
            <div key={i} className="flex items-center gap-8">
              <span className="text-[1.5vw] font-display text-text-secondary tracking-widest">{word}</span>
              {i < 2 && <div className="w-2 h-2 rounded-full bg-accent opacity-50" />}
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}