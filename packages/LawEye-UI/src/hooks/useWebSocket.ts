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
    
    // In production or Docker, use same origin (will be proxied by server.ts)
    // In development on localhost, use direct URL
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return process.env.NEXT_PUBLIC_LAWEYE_WS_URL || 'http://localhost:9992';
    }
    
    // In production/Docker, use same origin with /api prefix
    return window.location.origin;
  }, []);

  const getSocketPath = useCallback(() => {
    if (typeof window === 'undefined') return '/socket.io';
    
    // If we're using the proxy (production/Docker), use /api/socket.io
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return '/api/socket.io';
    }
    
    // Direct connection in development
    return '/socket.io';
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return socketRef.current;
    }

    // Disconnect existing socket if any
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const wsUrl = getWsBaseUrl();
    const socketPath = getSocketPath();
    
    console.log(`Connecting to WebSocket: ${wsUrl}${socketPath}`);
    
    const socket = io(wsUrl, {
      transports: ['websocket', 'polling'], // Allow polling as fallback
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 3, // Reduced from 5
      reconnectionDelay: 2000, // Increased from 1000
      reconnectionDelayMax: 10000, // Increased from 5000
      timeout: 20000, // Connection timeout
      path: socketPath,
    });

    // Add error handler to prevent infinite reconnection loops
    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
      // Stop reconnecting after multiple failures
      if (socket.recovered === false) {
        console.error('WebSocket failed to connect. Stopping reconnection attempts.');
        socket.disconnect();
      }
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
  }, [onTaskEvent, getWsBaseUrl, getSocketPath]);

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

  // Connect on mount (only once)
  useEffect(() => {
    const socket = connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Join/leave task room when taskId changes
  useEffect(() => {
    if (!socketRef.current) {
      return;
    }

    const handleConnect = () => {
      if (taskId) {
        joinTask(taskId);
      }
    };

    if (socketRef.current.connected) {
      // Already connected, join immediately
      if (taskId) {
        joinTask(taskId);
      }
    } else {
      // Wait for connection
      socketRef.current.once('connect', handleConnect);
    }

    return () => {
      if (taskId && socketRef.current?.connected) {
        leaveTask();
      }
      // Remove the connect listener if it hasn't fired yet
      socketRef.current?.off('connect', handleConnect);
    };
  }, [taskId, joinTask, leaveTask]);

  return {
    socket: socketRef.current,
    isConnected,
    events,
    clearEvents: () => setEvents([]),
  };
}

