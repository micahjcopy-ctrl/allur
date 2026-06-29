import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0, y: '10vh' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div 
        className="text-center z-10 mb-12"
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 className="text-[5vw] font-display text-text-primary leading-[0.9]">
          EFFORTLESS <span className="text-accent">TRACKING</span>
        </h2>
      </motion.div>

      <div className="flex gap-[5vw] z-10 w-full justify-center">
        {/* Nutrition */}
        <motion.div 
          className="w-[25vw] relative"
          initial={{ opacity: 0, y: 50 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          <div className="aspect-[9/19.5] rounded-2xl overflow-hidden border-[4px] border-gray-800 bg-black relative">
            <img 
              src={`${import.meta.env.BASE_URL}app-screens/macros.jpg`} 
              alt="Macros" 
              className="absolute inset-0 w-full h-full object-cover" 
            />
            
            <motion.div 
              className="absolute inset-0 border-2 border-accent"
              initial={{ clipPath: 'inset(0% 100% 100% 0%)' }}
              animate={phase >= 3 ? { clipPath: 'inset(0% 0% 0% 0%)' } : { clipPath: 'inset(0% 100% 100% 0%)' }}
              transition={{ duration: 1, ease: "easeInOut" }}
            />
          </div>
        </motion.div>

        {/* Progress */}
        <motion.div 
          className="w-[25vw] relative"
          initial={{ opacity: 0, y: 50 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 0.1 }}
        >
          <div className="aspect-[9/19.5] rounded-2xl overflow-hidden border-[4px] border-gray-800 relative bg-black">
            <img 
              src={`${import.meta.env.BASE_URL}app-screens/progress.jpg`} 
              alt="Physique scan" 
              className="absolute inset-0 w-full h-full object-cover" 
            />
            
            <motion.div 
              className="absolute top-0 bottom-0 left-0 w-full bg-accent/10"
              initial={{ height: 0 }}
              animate={phase >= 3 ? { height: '100%' } : { height: 0 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            >
              <div className="w-full h-[2px] bg-accent shadow-[0_0_10px_#00E5FF]" />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}