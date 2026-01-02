import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'hover' | 'glow' | 'gradient';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  delay?: number;
  onClick?: () => void;
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-10',
};

export function GlassCard({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  animate = false,
  delay = 0,
  onClick,
}: GlassCardProps) {
  const baseClasses = `
    relative overflow-hidden rounded-2xl
    backdrop-blur-xl border transition-all duration-300
    bg-white/70 dark:bg-slate-800/70
    border-white/50 dark:border-white/10
    shadow-lg shadow-black/5 dark:shadow-black/20
  `;

  const variantClasses = {
    default: 'hover:shadow-xl hover:border-blue-500/30 hover:-translate-y-1',
    hover: 'hover:shadow-2xl hover:border-purple-500/40 hover:-translate-y-2 hover:scale-[1.02]',
    glow: 'hover:shadow-[0_0_40px_-10px_rgba(59,130,246,0.5)] hover:border-blue-400/50',
    gradient: 'before:absolute before:inset-0 before:p-[1px] before:rounded-2xl before:bg-gradient-to-r before:from-blue-500 before:via-purple-500 before:to-pink-500 before:-z-10',
  };

  const animationClass = animate ? 'animate-fade-in-up opacity-0' : '';
  const delayStyle = delay ? { animationDelay: `${delay}ms`, animationFillMode: 'forwards' } : {};

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${animationClass} ${className}`}
      style={delayStyle}
      onClick={onClick}
    >
      {/* Top shine line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

interface GlassCardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function GlassCardHeader({ children, className = '' }: GlassCardHeaderProps) {
  return (
    <div className={`pb-4 mb-4 border-b border-slate-200/50 dark:border-white/10 ${className}`}>
      {children}
    </div>
  );
}

interface GlassCardTitleProps {
  children: ReactNode;
  className?: string;
  gradient?: boolean;
}

export function GlassCardTitle({ children, className = '', gradient = false }: GlassCardTitleProps) {
  const textClass = gradient
    ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent'
    : 'text-slate-900 dark:text-white';

  return (
    <h3 className={`text-xl font-bold ${textClass} ${className}`}>
      {children}
    </h3>
  );
}

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  color?: 'blue' | 'purple' | 'pink' | 'cyan' | 'emerald' | 'orange';
  animate?: boolean;
  delay?: number;
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    glow: 'group-hover:shadow-blue-500/20',
  },
  purple: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    text: 'text-purple-600 dark:text-purple-400',
    glow: 'group-hover:shadow-purple-500/20',
  },
  pink: {
    bg: 'bg-pink-500/10 dark:bg-pink-500/20',
    text: 'text-pink-600 dark:text-pink-400',
    glow: 'group-hover:shadow-pink-500/20',
  },
  cyan: {
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    text: 'text-cyan-600 dark:text-cyan-400',
    glow: 'group-hover:shadow-cyan-500/20',
  },
  emerald: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    glow: 'group-hover:shadow-emerald-500/20',
  },
  orange: {
    bg: 'bg-orange-500/10 dark:bg-orange-500/20',
    text: 'text-orange-600 dark:text-orange-400',
    glow: 'group-hover:shadow-orange-500/20',
  },
};

export function StatCard({
  icon,
  label,
  value,
  change,
  changeType = 'neutral',
  color = 'blue',
  animate = false,
  delay = 0,
}: StatCardProps) {
  const changeColors = {
    positive: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    negative: 'text-red-500 dark:text-red-400 bg-red-500/10',
    neutral: 'text-slate-500 dark:text-slate-400 bg-slate-500/10',
  };

  const animationClass = animate ? 'animate-fade-in-up opacity-0' : '';
  const delayStyle = delay ? { animationDelay: `${delay}ms`, animationFillMode: 'forwards' } : {};

  return (
    <div
      className={`
        group relative overflow-hidden rounded-2xl p-6
        backdrop-blur-xl border transition-all duration-300
        bg-white/70 dark:bg-slate-800/70
        border-white/50 dark:border-white/10
        shadow-lg shadow-black/5 dark:shadow-black/20
        hover:shadow-xl hover:-translate-y-1
        ${colorClasses[color].glow}
        ${animationClass}
      `}
      style={delayStyle}
    >
      {/* Top shine */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      {/* Bottom accent line */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${
        color === 'blue' ? 'from-blue-500 to-cyan-500' :
        color === 'purple' ? 'from-purple-500 to-pink-500' :
        color === 'pink' ? 'from-pink-500 to-rose-500' :
        color === 'cyan' ? 'from-cyan-500 to-blue-500' :
        color === 'emerald' ? 'from-emerald-500 to-green-500' :
        'from-orange-500 to-amber-500'
      } opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-xl ${colorClasses[color].bg} ${colorClasses[color].text}`}>
          {icon}
        </div>
        {change && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${changeColors[changeType]}`}>
            {change}
          </span>
        )}
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1 tracking-tight">
          {value}
        </p>
      </div>
    </div>
  );
}
