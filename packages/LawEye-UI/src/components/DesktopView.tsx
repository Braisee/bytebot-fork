'use client';

import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/utils/cn';

interface DesktopViewProps {
  className?: string;
}

export function DesktopView({ className }: DesktopViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [VncComponent, setVncComponent] = useState<any>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  useEffect(() => {
    // Dynamically import the VncScreen component only on the client side
    import('react-vnc').then(({ VncScreen }) => {
      setVncComponent(() => VncScreen);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return; // SSR safety

    // LawEye connects directly to bytebot-desktop VNC
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const vncHost = process.env.NEXT_PUBLIC_VNC_HOST || window.location.hostname;
    const vncPort = process.env.NEXT_PUBLIC_VNC_PORT || '9990';
    
    // VNC WebSocket is at /websockify endpoint
    // Using same protocol as current page
    setWsUrl(`${proto}://${vncHost}:${vncPort}/websockify`);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden rounded-lg', className)}
    >
      {VncComponent && wsUrl ? (
        <VncComponent
          rfbOptions={{
            secure: false,
            shared: true,
            wsProtocols: ['binary'],
          }}
          url={wsUrl}
          scaleViewport
          viewOnly={true}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-bytebot-bronze-light-2 to-bytebot-bronze-light-3">
          <div className="mb-4 animate-pulse rounded-full bg-bytebot-bronze-light-5 p-4">
            <svg
              className="h-8 w-8 text-bytebot-bronze-light-9"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-bytebot-bronze-light-11">
            Connexion au desktop...
          </p>
          <p className="mt-1 text-xs text-bytebot-bronze-light-9">
            Chargement de la session VNC
          </p>
        </div>
      )}
    </div>
  );
}

