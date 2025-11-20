'use client';

import React, { useState } from 'react';
import { TaskInput } from '@/components/TaskInput';
import { DesktopView } from '@/components/DesktopView';
import { LogsView } from '@/components/LogsView';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useWebSocket } from '@/hooks/useWebSocket';
import { getTask, cancelTask } from '@/utils/api';
import { Task } from '@/utils/api';
import { cn } from '@/utils/cn';

export default function Home() {
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);

  const { events, isConnected, clearEvents } = useWebSocket({
    taskId: currentTaskId,
    onTaskEvent: async (event) => {
      // Refresh task status when events occur
      if (currentTaskId) {
        try {
          const task = await getTask(currentTaskId);
          setCurrentTask(task);

          // If task is completed, failed, or cancelled, reset immediately
          // But also check the event type directly for immediate response
          if (
            event.type === 'task_completed' ||
            event.type === 'task_failed' ||
            task.status === 'completed' ||
            task.status === 'failed' ||
            task.status === 'cancelled'
          ) {
            // Reset immediately when task is finished
            setTimeout(() => {
              setCurrentTaskId(null);
              setCurrentTask(null);
              clearEvents(); // Clear events to start fresh for next task
            }, 2000); // Reduced delay to 2 seconds
          }
        } catch (error) {
          console.error('Error fetching task:', error);
        }
      }
    },
  });

  // Function to manually reset task state
  const handleResetTask = () => {
    setCurrentTaskId(null);
    setCurrentTask(null);
    clearEvents();
  };

  const handleTaskCreated = (taskId: string) => {
    setCurrentTaskId(taskId);
    clearEvents();
    // Fetch task details
    getTask(taskId)
      .then(setCurrentTask)
      .catch((error) => console.error('Error fetching task:', error));
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'pending':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-bytebot-bronze-light-3 text-bytebot-bronze-light-11 border-bytebot-bronze-light-7';
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bytebot-bronze-light-2">
      {/* Header */}
      <header className="border-b border-bytebot-bronze-light-7 bg-white shadow-sm">
        <div className="mx-auto max-w-[1920px] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-bytebot-bronze-light-12">
                LawEye
              </h1>
              <p className="mt-0.5 text-sm text-bytebot-bronze-light-10">
                Contrôle desktop intelligent avec LLM locaux
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'h-2.5 w-2.5 animate-pulse rounded-full',
                    isConnected ? 'bg-green-500' : 'bg-red-500',
                  )}
                />
                <span className="text-sm font-medium text-bytebot-bronze-light-11">
                  {isConnected ? 'Connecté' : 'Déconnecté'}
                </span>
              </div>
              {currentTask && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-bytebot-bronze-light-10">
                    Statut:
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold capitalize',
                      getStatusColor(currentTask.status),
                    )}
                  >
                    {currentTask.status === 'running' && 'En cours'}
                    {currentTask.status === 'completed' && 'Terminé'}
                    {currentTask.status === 'failed' && 'Échoué'}
                    {currentTask.status === 'pending' && 'En attente'}
                    {currentTask.status === 'cancelled' && 'Annulé'}
                  </span>
                  {currentTask.status === 'running' && (
                    <button
                      onClick={async () => {
                        if (
                          currentTaskId &&
                          confirm(
                            'Êtes-vous sûr de vouloir annuler cette tâche ?',
                          )
                        ) {
                          try {
                            await cancelTask(currentTaskId);
                            setCurrentTask(null);
                            setCurrentTaskId(null);
                          } catch (error: any) {
                            console.error('Error cancelling task:', error);
                            alert(
                              error.message ||
                                'Erreur lors de l\'annulation de la tâche',
                            );
                          }
                        }
                      }}
                      className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                      title="Annuler la tâche en cours"
                    >
                      <svg
                        className="mr-1.5 inline-block h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Annuler
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col gap-6 overflow-hidden p-6">
        {/* Task Input Card */}
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle tâche</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskInput
              onTaskCreated={handleTaskCreated}
              disabled={currentTask?.status === 'running' || currentTask?.status === 'pending'}
            />
            {currentTask && (
              <div className="mt-4 rounded-lg border border-bytebot-bronze-light-7 bg-bytebot-bronze-light-1 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    <svg
                      className="h-5 w-5 text-bytebot-bronze-light-9"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-bytebot-bronze-light-12">
                        Tâche actuelle
                      </p>
                      <div className="flex items-center gap-2">
                        {currentTask.status === 'running' && (
                          <button
                            onClick={async () => {
                              if (
                                currentTaskId &&
                                confirm(
                                  'Êtes-vous sûr de vouloir annuler cette tâche ?',
                                )
                              ) {
                                try {
                                  await cancelTask(currentTaskId);
                                  handleResetTask();
                                } catch (error: any) {
                                  console.error('Error cancelling task:', error);
                                  alert(
                                    error.message ||
                                      'Erreur lors de l\'annulation de la tâche',
                                  );
                                }
                              }
                            }}
                            className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                          >
                            Annuler
                          </button>
                        )}
                        {(currentTask.status === 'completed' ||
                          currentTask.status === 'failed' ||
                          currentTask.status === 'cancelled') && (
                          <button
                            onClick={handleResetTask}
                            className="rounded-md border border-bytebot-bronze-light-7 bg-bytebot-bronze-light-3 px-3 py-1.5 text-xs font-medium text-bytebot-bronze-light-11 hover:bg-bytebot-bronze-light-4 focus:outline-none focus:ring-2 focus:ring-bytebot-bronze-light-7 focus:ring-offset-2"
                            title="Nouvelle tâche"
                          >
                            Nouvelle tâche
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-bytebot-bronze-light-11">
                      {currentTask.description}
                    </p>
                    {currentTask.error && (
                      <p className="mt-2 text-xs text-red-600">
                        {currentTask.error}
                      </p>
                    )}
                    {currentTask.status === 'completed' && (
                      <p className="mt-2 text-xs text-green-600 font-medium">
                        ✓ Tâche terminée avec succès
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Desktop and Logs Grid */}
        <div className="grid flex-1 grid-cols-2 gap-6 overflow-hidden">
          {/* Desktop View Card */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="shrink-0 pb-4">
              <CardTitle>Vue Desktop</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <div className="h-full p-4">
                <DesktopView />
              </div>
            </CardContent>
          </Card>

          {/* Logs View Card */}
          <Card className="flex flex-col overflow-hidden">
            <LogsView events={events} />
          </Card>
        </div>
      </main>
    </div>
  );
}

