import { type ComponentType, type ReactNode, useEffect, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

export function useMediaQuery(query: string, defaultValue = false) {
  const [matches, setMatches] = useState(defaultValue);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia(query);
    const update = () => setMatches(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, [query]);

  return matches;
}

export function useIsMobile() {
  return useMediaQuery('(max-width: 767px)');
}

interface MobilePageHeaderProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: ReactNode;
  meta?: ReactNode;
}

export function MobilePageHeader({
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  meta,
}: MobilePageHeaderProps) {
  return (
    <div className="md:hidden space-y-3 border-b border-slate-200 pb-4">
      {meta}
      <div className="space-y-1">
        <h1 className="text-[28px] font-display font-black leading-[1.05] tracking-normal text-[#002C5F]">
          {title}
        </h1>
        {description && <p className="text-sm font-medium leading-5 text-slate-500">{description}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#002C5F] px-4 py-3 text-xs font-black uppercase tracking-wide text-white shadow-sm transition-all active:scale-[0.99]"
        >
          {actionIcon}
          {actionLabel}
        </button>
      )}
    </div>
  );
}

interface MobileEntityCardProps {
  children: ReactNode;
  tone?: 'default' | 'blue' | 'amber' | 'red' | 'green';
  onClick?: () => void;
  className?: string;
}

const cardTones: Record<NonNullable<MobileEntityCardProps['tone']>, string> = {
  default: 'border-slate-200 bg-white',
  blue: 'border-blue-100 bg-blue-50/35',
  amber: 'border-amber-100 bg-amber-50/35',
  red: 'border-red-100 bg-red-50/35',
  green: 'border-emerald-100 bg-emerald-50/35',
};

export function MobileEntityCard({ children, tone = 'default', onClick, className = '' }: MobileEntityCardProps) {
  const classes = `rounded-xl border p-3.5 shadow-sm ${cardTones[tone]} ${className}`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${classes} w-full text-left transition-all active:scale-[0.99]`}>
        {children}
      </button>
    );
  }
  return <div className={classes}>{children}</div>;
}

interface MobileActionBarProps {
  children: ReactNode;
  summary?: ReactNode;
}

export function MobileActionBar({ children, summary }: MobileActionBarProps) {
  return (
    <div className="md:hidden sticky bottom-0 z-20 -mx-3 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-14px_32px_rgba(15,23,42,0.08)] backdrop-blur">
      {summary && <div className="mb-2">{summary}</div>}
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

interface MobileFilterSheetProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function MobileFilterSheet({ title, open, onClose, children }: MobileFilterSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] md:hidden">
      <button
        type="button"
        aria-label="Fechar filtros"
        className="absolute inset-0 bg-slate-950/45"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-black uppercase tracking-wide text-[#002C5F]">{title}</div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(82vh-57px)] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

interface MobileNavItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface MobileBottomNavProps {
  items: MobileNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  moreOpen: boolean;
  onToggleMore: () => void;
  moreItems: Array<MobileNavItem & { danger?: boolean }>;
}

export function MobileBottomNav({ items, activeId, onSelect, moreOpen, onToggleMore, moreItems }: MobileBottomNavProps) {
  return (
    <div className="md:hidden">
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/35" onClick={onToggleMore}>
          <div
            className="absolute inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {moreItems.map((item) => {
              const Icon = item.icon;
              const active = activeId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect(item.id);
                    onToggleMore();
                  }}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold ${
                    item.danger
                      ? 'text-red-700 hover:bg-red-50'
                      : active
                        ? 'bg-blue-50 text-[#002C5F]'
                        : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/96 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.10)] backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = activeId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-black ${
                  active ? 'bg-[#002C5F] text-white' : 'text-slate-500 active:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="leading-none">{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onToggleMore}
            className={`flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-black ${
              moreOpen ? 'bg-[#002C5F] text-white' : 'text-slate-500 active:bg-slate-100'
            }`}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            <span className="leading-none">Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
