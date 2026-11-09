import { useEffect, useRef, useState } from 'react';

/**
 * Slides its content in when it scrolls into view (once).
 * enabled=false shows the content straight away (animation turned off in admin).
 */
export default function Reveal({ enabled = true, delay = 0, className = '', children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setVisible(true);
      return undefined;
    }
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // threshold 0: tall sections reveal as soon as their top is 60px inside the screen
      { threshold: 0, rootMargin: '0px 0px -60px 0px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled]);

  return (
    <div
      ref={ref}
      className={`${enabled ? 'reveal' : ''} ${visible ? 'is-visible' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
