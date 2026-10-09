'use client';

import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

type Props = {
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: CSSProperties;
  id?: string;
  threshold?: number;
  children: ReactNode;
  [aria: `aria-${string}`]: string | undefined;
};

/**
 * Adds the `in` class once the block scrolls into view.
 * Children opt in to motion with .rise / .from-l / .from-r / .stg / .ray (see globals.css).
 */
export function Reveal({ as = 'div', className = '', threshold = 0.18, children, ...rest }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return createElement(as, { ref, className: `${className}${seen ? ' in' : ''}`.trim() || undefined, ...rest }, children);
}
