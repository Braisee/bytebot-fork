'use client';

import React from 'react';
import { TaskEvent } from '@/hooks/useWebSocket';
import { cn } from '@/utils/cn';

interface LogsViewProps {
  events: TaskEvent[];
  className?: string;
}

export function LogsView({ events, className }: LogsViewProps) {
  const getEventStyles = (type: TaskEvent['type']) => {
    switch (type) {
      case 'error':
      case 'task_failed':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          icon: '❌',
        };
      case 'task_completed':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-800',
          icon: '✅',
        };
      case 'action_executed':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-800',
          icon: '⚡',
        };
      case 'orchestrator_thinking':
        return {
          bg: 'bg-purple-50',
          border: 'border-purple-200',
          text: 'text-purple-800',
          icon: '🤔',
        };
      case 'position_detected':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-800',
          icon: '📍',
        };
      case 'position_request':
        return {
          bg: 'bg-cyan-50',
          border: 'border-cyan-200',
          text: 'text-cyan-800',
          icon: '🔍',
        };
      case 'screenshot_taken':
        return {
          bg: 'bg-indigo-50',
          border: 'border-indigo-200',
          text: 'text-indigo-800',
          icon: '📸',
        };
      case 'task_started':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          text: 'text-emerald-800',
          icon: '🚀',
        };
      default:
        return {
          bg: 'bg-bytebot-bronze-light-2',
          border: 'border-bytebot-bronze-light-7',
          text: 'text-bytebot-bronze-light-11',
          icon: '📋',
        };
    }
  };

  const formatEvent = (event: TaskEvent): { title: string; details?: string } => {
    switch (event.type) {
      case 'orchestrator_thinking':
        return {
          title: 'Orchestrateur réfléchit',
          details: event.data.thinking || 'Réflexion en cours...',
        };
      case 'position_request':
        return {
          title: 'Recherche d\'élément',
          details: event.data.description,
        };
      case 'position_detected':
        return {
          title: 'Position détectée',
          details: `(${event.data.position.x}, ${event.data.position.y}) - "${event.data.description}"`,
        };
      case 'action_executed':
        return {
          title: `Action: ${event.data.action}`,
          details: event.data.details
            ? JSON.stringify(event.data.details, null, 2)
            : undefined,
        };
      case 'screenshot_taken':
        return {
          title: 'Screenshot capturé',
        };
      case 'error':
        return {
          title: 'Erreur',
          details: event.data.error + (event.data.details ? `\n${JSON.stringify(event.data.details, null, 2)}` : ''),
        };
      case 'task_started':
        return {
          title: 'Tâche démarrée',
        };
      case 'task_completed':
        return {
          title: 'Tâche terminée avec succès',
        };
      case 'task_failed':
        return {
          title: 'Tâche échouée',
          details: event.data.error,
        };
      default:
        return {
          title: event.type,
          details: JSON.stringify(event.data, null, 2),
        };
    }
  };

  return (
    <div className={cn('flex h-full flex-col overflow-hidden', className)}>
      <div className="border-b border-bytebot-bronze-light-7 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-bytebot-bronze-light-12">
              Logs d'activité
            </h3>
            <p className="mt-0.5 text-xs text-bytebot-bronze-light-10">
              {events.length} événement{events.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>
      <div className="hide-scrollbar flex-1 overflow-y-auto bg-bytebot-bronze-light-1 p-4">
        {events.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="rounded-full bg-bytebot-bronze-light-3 p-4">
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="mt-4 text-sm font-medium text-bytebot-bronze-light-11">
              Aucun événement
            </p>
            <p className="mt-1 text-xs text-bytebot-bronze-light-9">
              Les événements apparaîtront ici lors de l'exécution d'une tâche
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {events.map((event, index) => {
              const styles = getEventStyles(event.type);
              const formatted = formatEvent(event);
              return (
                <div
                  key={index}
                  className={cn(
                    'group rounded-lg border p-3.5 text-sm shadow-sm transition-all',
                    styles.bg,
                    styles.border,
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0 text-base">{styles.icon}</div>
                    <div className="min-w-0 flex-1">
                      <p className={cn('font-medium', styles.text)}>
                        {formatted.title}
                      </p>
                      {event.type === 'screenshot_taken' && event.data.screenshot ? (
                        <div className="mt-2 -mx-3.5 -mb-1.5">
                          <img
                            src={`data:image/png;base64,${event.data.screenshot}`}
                            alt="Screenshot"
                            className="w-full h-auto max-h-96 object-contain block"
                            loading="lazy"
                            style={{ display: 'block', margin: 0, padding: 0 }}
                          />
                        </div>
                      ) : formatted.details ? (
                        <p
                          className={cn(
                            'mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed',
                            styles.text,
                            'opacity-80',
                          )}
                        >
                          {formatted.details}
                        </p>
                      ) : null}
                      <time className="mt-2 block text-xs opacity-60">
                        {new Date(event.timestamp).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </time>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

