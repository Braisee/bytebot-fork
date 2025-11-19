'use client';

import React, { useState } from 'react';
import { createTask } from '@/utils/api';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';

interface TaskInputProps {
  onTaskCreated?: (taskId: string) => void;
  disabled?: boolean;
}

export function TaskInput({ onTaskCreated, disabled }: TaskInputProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || disabled || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const task = await createTask({ description: input.trim() });
      setInput('');
      onTaskCreated?.(task.id);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création de la tâche');
      console.error('Error creating task:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Décrivez la tâche à accomplir..."
              disabled={disabled || isLoading}
              className={cn(
                'w-full rounded-lg border border-bytebot-bronze-light-7 bg-white px-4 py-3',
                'text-sm text-bytebot-bronze-light-12 placeholder:text-bytebot-bronze-light-9',
                'transition-all',
                'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                'disabled:bg-bytebot-bronze-light-2 disabled:cursor-not-allowed',
              )}
            />
          </div>
          <Button
            type="submit"
            disabled={disabled || isLoading || !input.trim()}
            className="shrink-0"
          >
            {isLoading ? (
              <>
                <svg
                  className="mr-2 h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Envoi...
              </>
            ) : (
              'Envoyer'
            )}
          </Button>
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <div className="flex items-start gap-2">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

