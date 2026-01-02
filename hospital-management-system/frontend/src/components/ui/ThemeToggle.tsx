import { useThemeContext } from '../../contexts/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ThemeToggle({ className = '', size = 'md' }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useThemeContext();

  const sizeClasses = {
    sm: 'w-12 h-6',
    md: 'w-14 h-7',
    lg: 'w-16 h-8',
  };

  const toggleSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7',
  };

  const translateClasses = {
    sm: isDark ? 'translate-x-6' : 'translate-x-0.5',
    md: isDark ? 'translate-x-7' : 'translate-x-0.5',
    lg: isDark ? 'translate-x-8' : 'translate-x-0.5',
  };

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative inline-flex items-center rounded-full p-0.5
        transition-all duration-500 ease-in-out
        ${isDark
          ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600'
          : 'bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400'
        }
        shadow-lg hover:shadow-xl
        focus:outline-none focus:ring-2 focus:ring-offset-2
        ${isDark ? 'focus:ring-purple-500' : 'focus:ring-amber-500'}
        ${sizeClasses[size]}
        ${className}
      `}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Background glow effect */}
      <div className={`
        absolute inset-0 rounded-full opacity-50 blur-md
        ${isDark
          ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
          : 'bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-300'
        }
      `} />

      {/* Toggle circle */}
      <span
        className={`
          relative inline-flex items-center justify-center
          ${toggleSizes[size]} rounded-full
          bg-white shadow-md
          transform transition-all duration-500 ease-in-out
          ${translateClasses[size]}
        `}
      >
        {/* Sun icon */}
        <svg
          className={`
            w-4 h-4 text-amber-500
            transition-all duration-300
            ${isDark ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}
          `}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
            clipRule="evenodd"
          />
        </svg>

        {/* Moon icon */}
        <svg
          className={`
            absolute w-4 h-4 text-indigo-600
            transition-all duration-300
            ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}
          `}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      </span>

      {/* Stars (visible in dark mode) */}
      <div className={`
        absolute inset-0 overflow-hidden rounded-full
        transition-opacity duration-500
        ${isDark ? 'opacity-100' : 'opacity-0'}
      `}>
        <span className="absolute w-1 h-1 bg-white rounded-full top-1 left-2 animate-pulse" style={{ animationDelay: '0s' }} />
        <span className="absolute w-0.5 h-0.5 bg-white rounded-full top-2 left-4 animate-pulse" style={{ animationDelay: '0.5s' }} />
        <span className="absolute w-1 h-1 bg-white rounded-full top-3 left-3 animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
    </button>
  );
}

// Icon button variant
export function ThemeToggleIcon({ className = '' }: { className?: string }) {
  const { isDark, toggleTheme } = useThemeContext();

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative p-2.5 rounded-xl
        backdrop-blur-xl border transition-all duration-300
        bg-white/70 dark:bg-slate-800/70
        border-white/50 dark:border-white/10
        shadow-md hover:shadow-lg
        hover:-translate-y-0.5
        group
        ${className}
      `}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Sun icon */}
      <svg
        className={`
          w-5 h-5 text-amber-500
          transition-all duration-500 ease-in-out
          ${isDark ? 'opacity-0 rotate-90 scale-0 absolute' : 'opacity-100 rotate-0 scale-100'}
        `}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
          clipRule="evenodd"
        />
      </svg>

      {/* Moon icon */}
      <svg
        className={`
          w-5 h-5 text-indigo-400
          transition-all duration-500 ease-in-out
          ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0 absolute'}
        `}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
      </svg>

      {/* Glow effect on hover */}
      <div className={`
        absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100
        transition-opacity duration-300
        ${isDark
          ? 'shadow-[0_0_20px_rgba(99,102,241,0.3)]'
          : 'shadow-[0_0_20px_rgba(251,191,36,0.3)]'
        }
      `} />
    </button>
  );
}
