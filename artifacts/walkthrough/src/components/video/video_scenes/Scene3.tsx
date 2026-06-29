import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-between px-[10vw]"
      initial={{ opacity: 0, scale: 1.2 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-[45vw] h-[75vh] relative z-10">
        <motion.div 
          className="absolute left-0 top-[5vh] w-[22vw] h-[65vh] bg-black rounded-[2vw] border-[4px] border-gray-800 shadow-[0_0_50px_rgba(0,229,255,0.1)] overflow-hidden"
          initial={{ opacity: 0, x: -50, rotateY: 15 }}
          animate={phase >= 2 ? { opacity: 1, x: 0, rotateY: 15 } : { opacity: 0, x: -50, rotateY: 15 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ transformPerspective: 1000 }}
        >
          <img 
            src={`${import.meta.env.BASE_URL}app-screens/plan.jpg`}
            className="w-full h-full object-cover object-top"
            alt="Workout Plan"
          />
        </motion.div>
        
        <motion.div 
          className="absolute left-[18vw] top-[10vh] w-[22vw] h-[65vh] bg-black rounded-[2vw] border-[4px] border-gray-800 shadow-[0_0_50px_rgba(0,229,255,0.1)] overflow-hidden"
          initial={{ opacity: 0, x: -50, rotateY: 15 }}
          animate={phase >= 3 ? { opacity: 1, x: 0, rotateY: 15 } : { opacity: 0, x: -50, rotateY: 15 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ transformPerspective: 1000 }}
        >
          <img 
            src={`${import.meta.env.BASE_URL}app-screens/coach.jpg`}
            className="w-full h-full object-cover object-top"
            alt="AI Coach"
          />
        </motion.div>
      </div>

      <div className="w-[45vw] z-10 relative">
        <motion.h2 
          className="text-[6vw] font-display text-text-primary leading-[0.9]"
          initial={{ opacity: 0, x: 50 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          REAL-TIME <br/><span className="text-accent">AI COACHING</span>
        </motion.h2>
        <motion.p 
          className="text-[1.5vw] text-text-secondary mt-6"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          Text or voice your AI coach. It answers training questions, adjusts your plan on the fly, and keeps you accountable.
        </motion.p>
      </div>
    </motion.div>
  );
}