import React from 'react';

// Floating Orbs Component
export function FloatingOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Primary blue orb */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-30 dark:opacity-20 animate-blob"
        style={{
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)',
          top: '-10%',
          left: '-5%',
          filter: 'blur(60px)',
        }}
      />

      {/* Purple orb */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full opacity-30 dark:opacity-20 animate-blob"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
          top: '20%',
          right: '-10%',
          filter: 'blur(60px)',
          animationDelay: '2s',
        }}
      />

      {/* Pink orb */}
      <div
        className="absolute w-[350px] h-[350px] rounded-full opacity-25 dark:opacity-15 animate-blob"
        style={{
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.4) 0%, transparent 70%)',
          bottom: '10%',
          left: '20%',
          filter: 'blur(60px)',
          animationDelay: '4s',
        }}
      />

      {/* Cyan orb */}
      <div
        className="absolute w-[300px] h-[300px] rounded-full opacity-25 dark:opacity-15 animate-blob"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, transparent 70%)',
          bottom: '30%',
          right: '15%',
          filter: 'blur(60px)',
          animationDelay: '6s',
        }}
      />
    </div>
  );
}

// Mesh Gradient Background
export function MeshGradient({ className = '' }: { className?: string }) {
  return (
    <div className={`fixed inset-0 z-0 ${className}`}>
      <div className="absolute inset-0 mesh-gradient" />
      <div className="absolute inset-0 grid-pattern opacity-50" />
    </div>
  );
}

// Animated Grid Background
export function AnimatedGrid() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/50 dark:to-slate-900/50" />
    </div>
  );
}

// Particles Background
export function ParticlesBackground({ count = 30 }: { count?: number }) {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    delay: Math.random() * 10,
    duration: 10 + Math.random() * 20,
  }));

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-blue-500/20 dark:bg-blue-400/20 animate-float"
          style={{
            width: particle.size,
            height: particle.size,
            left: particle.left,
            top: particle.top,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

// Aurora Background
export function AuroraBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Aurora gradient */}
      <div
        className="absolute inset-0 opacity-30 dark:opacity-40"
        style={{
          background: `
            linear-gradient(
              to bottom right,
              rgba(59, 130, 246, 0.2) 0%,
              rgba(139, 92, 246, 0.2) 25%,
              rgba(236, 72, 153, 0.2) 50%,
              rgba(6, 182, 212, 0.2) 75%,
              rgba(16, 185, 129, 0.2) 100%
            )
          `,
        }}
      />

      {/* Animated aurora waves */}
      <svg
        className="absolute inset-0 w-full h-full opacity-20 dark:opacity-30"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="aurora-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.5)" />
            <stop offset="25%" stopColor="rgba(139, 92, 246, 0.5)" />
            <stop offset="50%" stopColor="rgba(236, 72, 153, 0.5)" />
            <stop offset="75%" stopColor="rgba(6, 182, 212, 0.5)" />
            <stop offset="100%" stopColor="rgba(59, 130, 246, 0.5)" />
          </linearGradient>
        </defs>
        <path
          d="M0,50 Q250,0 500,50 T1000,50 T1500,50 T2000,50 V100 H0 Z"
          fill="url(#aurora-gradient)"
          className="animate-pulse-soft"
          style={{ transform: 'scale(1.5)', transformOrigin: 'center' }}
        />
      </svg>
    </div>
  );
}

// Spotlight Effect
export function Spotlight() {
  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 pointer-events-none z-0">
      <div
        className="w-[800px] h-[600px] opacity-30 dark:opacity-20"
        style={{
          background: 'radial-gradient(ellipse at center top, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
    </div>
  );
}

// Combined Premium Background
export function PremiumBackground() {
  return (
    <>
      <MeshGradient />
      <FloatingOrbs />
      <Spotlight />
    </>
  );
}

// Glow Ring (for icons/avatars)
interface GlowRingProps {
  children: React.ReactNode;
  color?: 'blue' | 'purple' | 'pink' | 'cyan' | 'emerald';
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

const glowColors = {
  blue: 'from-blue-500 to-cyan-500',
  purple: 'from-purple-500 to-pink-500',
  pink: 'from-pink-500 to-rose-500',
  cyan: 'from-cyan-500 to-blue-500',
  emerald: 'from-emerald-500 to-green-500',
};

export function GlowRing({ children, color = 'blue', size = 'md', animate = true }: GlowRingProps) {
  const sizeClasses = {
    sm: 'p-0.5',
    md: 'p-1',
    lg: 'p-1.5',
  };

  return (
    <div
      className={`
        relative inline-flex rounded-full bg-gradient-to-r ${glowColors[color]}
        ${sizeClasses[size]}
        ${animate ? 'animate-pulse-glow' : ''}
      `}
    >
      <div className="relative rounded-full bg-white dark:bg-slate-900 p-0.5">
        {children}
      </div>
    </div>
  );
}

// Animated Icon Container
interface AnimatedIconProps {
  children: React.ReactNode;
  color?: 'blue' | 'purple' | 'pink' | 'cyan' | 'emerald' | 'orange';
  size?: 'sm' | 'md' | 'lg';
}

const iconBgColors = {
  blue: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
  pink: 'bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400',
  cyan: 'bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
  emerald: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  orange: 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
};

const iconSizes = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-14 h-14',
};

export function AnimatedIcon({ children, color = 'blue', size = 'md' }: AnimatedIconProps) {
  return (
    <div
      className={`
        ${iconSizes[size]} ${iconBgColors[color]}
        rounded-xl flex items-center justify-center
        transition-all duration-300
        hover:scale-110 hover:rotate-3
        group-hover:shadow-lg
      `}
    >
      {children}
    </div>
  );
}
