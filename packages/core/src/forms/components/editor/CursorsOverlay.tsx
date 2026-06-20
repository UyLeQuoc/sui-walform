'use client';

import { useEffect, useState } from 'react';

import { peerLabel } from '../../lib/collab-identity';

import type { RefObject } from 'react';
import type { PresencePeer } from '../../../types';

interface CursorsOverlayProps {
  peers: PresencePeer[];
  containerRef: RefObject<HTMLDivElement | null>;
}

/**
 * Remote pointer cursors over the canvas. Cursor coords are broadcast relative
 * to the form card; here we re-anchor them to the local card so they line up
 * across differently-sized viewports. The card offset is re-measured on scroll
 * and resize.
 */
export function CursorsOverlay({ peers, containerRef }: CursorsOverlayProps) {
  const [offset, setOffset] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const card = container?.querySelector('[data-form-card]') as HTMLElement | null;
      if (!container || !card) {
        setOffset(null);
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      setOffset({
        left: cardRect.left - containerRect.left,
        top: cardRect.top - containerRect.top,
        width: cardRect.width,
        height: cardRect.height,
      });
    };
    const raf = requestAnimationFrame(measure);
    const scroller = containerRef.current?.closest('[data-canvas-viewport]');
    scroller?.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      scroller?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [containerRef]);

  const withCursor = peers.filter((p) => p.cursor !== null);
  if (!offset || withCursor.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {withCursor.map((peer) => {
        const cursor = peer.cursor;
        if (!cursor) return null;
        return (
          <div
            key={peer.clientId}
            className="absolute top-0 left-0 will-change-transform"
            style={{
              transform: `translate(${offset.left + cursor.x * offset.width}px, ${offset.top + cursor.y * offset.height}px)`,
            }}
          >
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <path
                d="M1 1L1 15L4.5 11.5L7 17L9.5 16L7 10.5L12 10.5L1 1Z"
                fill={peer.user.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            <span
              className="absolute top-4 left-3 rounded-sm px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-white shadow-sm"
              style={{ backgroundColor: peer.user.color }}
            >
              {peerLabel(peer.user.address, peer.user.name)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
