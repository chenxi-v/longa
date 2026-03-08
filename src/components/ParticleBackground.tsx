'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    particlesJS: (id: string, config: any) => void;
    pJSDom: any[];
  }
}

const ParticleBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initParticles = () => {
      if (!window.particlesJS || !containerRef.current || initializedRef.current) return;

      const uniqueId = `particles-global-${Date.now()}`;
      containerRef.current.id = uniqueId;

      window.particlesJS(uniqueId, {
        particles: {
          number: { value: 80, density: { enable: true, value_area: 800 } },
          color: { value: '#ffffff' },
          shape: { type: 'circle' },
          opacity: { value: 0.5, random: false },
          size: { value: 1.5, random: true },
          line_linked: {
            enable: true,
            distance: 150,
            color: '#ffffff',
            opacity: 0.3,
            width: 1
          },
          move: {
            enable: true,
            speed: 2,
            direction: 'none',
            random: true,
            straight: false,
            out_mode: 'out',
            bounce: false
          }
        },
        interactivity: {
          detect_on: 'canvas',
          events: {
            onhover: { enable: false, mode: 'repulse' },
            onclick: { enable: false, mode: 'push' },
            resize: true
          }
        },
        retina_detect: true
      });

      initializedRef.current = true;
    };

    const loadParticles = () => {
      if (window.particlesJS === undefined) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js';
        script.async = true;
        script.onload = initParticles;
        document.body.appendChild(script);
      } else {
        initParticles();
      }
    };

    loadParticles();

    const handleResize = () => {
      if (window.pJSDom && window.pJSDom.length > 0) {
        const pjs = window.pJSDom[0];
        if (pjs?.canvas?.setSize) {
          pjs.canvas.setSize();
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
    />
  );
};

export default ParticleBackground;
