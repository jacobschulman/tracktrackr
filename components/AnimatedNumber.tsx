'use client';

import { useEffect, useRef, useState } from 'react';

export function AnimatedNumber({ value, suffix = '' }: { value: string; suffix?: string }) {
  const [display, setDisplay] = useState('0');
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;

    // Parse numeric value (handle commas)
    const raw = value.replace(/,/g, '').replace(/%/, '');
    const target = parseFloat(raw);
    if (isNaN(target)) {
      setDisplay(value);
      return;
    }

    const isPercent = value.includes('%');
    const hasCommas = value.includes(',');
    const duration = 1200;
    const steps = 30;
    const stepTime = duration / steps;
    let step = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          observer.disconnect();

          const interval = setInterval(() => {
            step++;
            // Ease-out curve
            const progress = 1 - Math.pow(1 - step / steps, 3);
            const current = Math.round(target * progress);
            let formatted: string;
            if (hasCommas) {
              formatted = current.toLocaleString();
            } else {
              formatted = String(current);
            }
            if (isPercent) formatted += '%';
            setDisplay(formatted + suffix);

            if (step >= steps) {
              clearInterval(interval);
              setDisplay(value);
            }
          }, stepTime);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, suffix]);

  return <span ref={ref}>{display}</span>;
}
