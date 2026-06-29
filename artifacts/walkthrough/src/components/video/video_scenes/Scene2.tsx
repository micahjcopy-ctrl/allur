import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-between px-[10vw]"
      initial={{ opacity: 0, x: '10vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '-10vw', filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="w-[40vw] z-10 relative">
        <motion.div 
          className="w-16 h-1 bg-accent mb-8"
          initial={{ scaleX: 0, originX: 0 }}
          animate={phase >= 1 ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
        <motion.h2 
          className="text-[6vw] font-display text-text-primary leading-[0.9]"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          HYPER-PERSONALIZED <br/><span className="text-accent">ONBOARDING</span>
        </motion.h2>
        <motion.p 
          className="text-[1.5vw] text-text-secondary mt-6 max-w-lg"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          Tell the AI your goals, target physique, and dietary restrictions. Get a customized transformation plan instantly.
        </motion.p>
      </div>

      <div className="w-[30vw] h-[70vh] relative z-10">
        <motion.div 
          className="absolute inset-0 bg-black rounded-[2vw] border-[4px] border-gray-800 shadow-2xl overflow-hidden flex flex-col items-center justify-center"
          initial={{ opacity: 0, y: 50, rotateY: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0, rotateY: -5 } : { opacity: 0, y: 50, rotateY: 20 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          style={{ transformPerspective: 1000 }}
        >
          <img 
            src={`${import.meta.env.BASE_URL}app-screens/dashboard.jpg`}
            className="w-full h-full object-cover object-top"
            alt="Dashboard"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}