'use client';

interface CollapseButtonProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function CollapseButton({
  isCollapsed,
  onToggle,
}: CollapseButtonProps) {
  return (
    <button
      onClick={onToggle}
      className='hidden lg:flex group relative items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br from-blue-500/90 via-sky-500/80 to-cyan-500/70 hover:from-blue-500 hover:via-sky-500/95 hover:to-cyan-500/90 backdrop-blur-md border border-blue-400/60 shadow-[0_2px_8px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_4px_12px_rgba(59,130,246,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden'
      title={isCollapsed ? '显示选集面板' : '隐藏选集面板'}
    >
      <div className='absolute inset-0 bg-gradient-to-r from-transparent via-white/0 to-transparent group-hover:via-white/30 transition-all duration-500'></div>
      <svg
        className={`relative z-10 w-4 h-4 text-white transition-transform duration-200 ${
          isCollapsed ? 'rotate-180' : 'rotate-0'
        }`}
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth='2'
          d='M9 5l7 7-7 7'
        />
      </svg>
      <span className='relative z-10 text-xs font-medium text-white'>
        {isCollapsed ? '显示' : '隐藏'}
      </span>

      <div className='absolute -top-0.5 -right-0.5 z-20'>
        <div className='relative'>
          <div
            className={`absolute inset-0 rounded-full blur-sm opacity-75 ${
              isCollapsed ? 'bg-orange-400 animate-pulse' : 'bg-green-400'
            }`}
          ></div>
          <div
            className={`relative w-2 h-2 rounded-full shadow-lg ${
              isCollapsed
                ? 'bg-gradient-to-br from-orange-400 to-orange-500'
                : 'bg-gradient-to-br from-green-400 to-green-500'
            }`}
          ></div>
        </div>
      </div>
    </button>
  );
}
