import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface TaskEvent {
  type:
    | 'orchestrator_thinking'
    | 'position_request'
    | 'position_detected'
    | 'action_executed'
    | 'screenshot_taken'
    | 'error'
    | 'task_started'
    | 'task_completed'
    | 'task_failed';
  taskId: string;
  data: any;
  timestamp: string;
}

interface UseWebSocketProps {
  taskId: string | null;
  onTaskEvent?: (event: TaskEvent) => void;
}

export function useWebSocket({ taskId, onTaskEvent }: UseWebSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<TaskEvent[]>([]);

  const getWsBaseUrl = useCallback(() => {
    if (typeof window === 'undefined') return 'http://localhost:9992';
    
    if (window.location.hostname === 'localhost') {
      return process.env.NEXT_PUBLIC_LAWEYE_WS_URL || 'http://localhost:9992';
    }
    
    // In production, use same origin (will be proxied by server.ts)
    return window.location.origin;
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return socketRef.current;
    }

    const wsUrl = getWsBaseUrl();
    const socket = io(wsUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      path: typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '/api/socket.io' : '/socket.io',
    });

    socket.on('connect', () => {
      console.log('Connected to LawEye WebSocket');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from LawEye WebSocket');
      setIsConnected(false);
    });

    socket.on('task_event', (event: TaskEvent) => {
      console.log('Task event received:', event);
      setEvents((prev) => [...prev, event]);
      onTaskEvent?.(event);
    });

    socketRef.current = socket;
    return socket;
  }, [onTaskEvent, getWsBaseUrl]);

  const joinTask = useCallback(
    (id: string) => {
      const socket = socketRef.current || connect();
      socket.emit('join_task', id);
      console.log(`Joined task room: ${id}`);
    },
    [connect],
  );

  const leaveTask = useCallback(() => {
    const socket = socketRef.current;
    if (socket && taskId) {
      socket.emit('leave_task', taskId);
      console.log(`Left task room: ${taskId}`);
    }
  }, [taskId]);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        leaveTask();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect, leaveTask]);

  // Join/leave task room when taskId changes
  useEffect(() => {
    if (taskId && socketRef.current?.connected) {
      joinTask(taskId);
    } else if (!taskId) {
      leaveTask();
    }

    return () => {
      if (taskId) {
        leaveTask();
      }
    };
  }, [taskId, joinTask, leaveTask]);

  return {
    socket: socketRef.current,
    isConnected,
    events,
    clearEvents: () => setEvents([]),
  };
}

