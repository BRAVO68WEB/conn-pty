import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowDown, Code, Palette, Zap, Sparkles } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router-dom";

const Hero = () => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });
  
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        duration: 0.8
      }
    }
  };

  const itemVariants = {
    hidden: { y: 50, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: [0.4, 0, 0.2, 1] as const
      }
    }
  };

  const floatingVariants = {
    animate: {
      y: [-10, 10, -10],
      rotate: [0, 5, -5, 0],
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut" as const
      }
    }
  };

  return (
    <section ref={ref} className="min-h-screen flex items-center justify-center bg-gradient-hero relative overflow-hidden">
      {/* Animated background elements */}
      <motion.div 
        className="absolute inset-0 opacity-20"
        style={{ y }}
      >
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-primary-glow rounded-full blur-xl"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 300 + 100}px`,
              height: `${Math.random() * 300 + 100}px`,
            }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.1, 0.4, 0.1],
              x: [0, Math.random() * 100 - 50, 0],
            }}
            transition={{
              duration: Math.random() * 6 + 4,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </motion.div>

      <motion.div 
        className="container mx-auto px-6 text-center relative z-10"
        style={{ opacity }}
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-5xl mx-auto"
        >
          <motion.div variants={itemVariants} className="mb-8">
            <motion.h1 
              className="text-6xl md:text-8xl font-bold mb-8 leading-tight"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <span className="bg-gradient-primary bg-clip-text text-transparent drop-shadow-lg">
                Conn-Pty
              </span>
              <br />
              <span className="text-gray-100 drop-shadow-2xl font-black">
                Easy Web SSH
              </span>
            </motion.h1>
          </motion.div>

          <motion.p
            variants={itemVariants}
            className="text-2xl md:text-3xl text-gray-200 mb-12 leading-relaxed max-w-4xl mx-auto font-medium drop-shadow-lg"
          >
            Connect to <span className="text-cyan-200 font-bold drop-shadow-md">remote server</span> effortlessly using <span className="text-cyan-200 font-bold drop-shadow-md">remote ssh</span>
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-8 justify-center items-center mb-20"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link to="/console" rel="noopener noreferrer">
                <Button
                  size="lg"
                  className="bg-gradient-secondary text-white px-12 py-8 text-xl font-bold shadow-glow hover:shadow-cyan-400 hover:scale-105 transition-all duration-300 rounded-full border-0"
                >
                  Access Console
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute bottom-8"
        style={{ opacity }}
      >
        Made with ❤️ by <span className="text-cyan-200 font-bold drop-shadow-md">@BRAVO68WEB</span>
      </motion.div>
    </section>
  );
};

export default Hero;