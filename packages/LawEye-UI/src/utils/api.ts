// Use /api proxy in production, direct URL in dev
const API_BASE_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? process.env.NEXT_PUBLIC_LAWEYE_API_URL || 'http://localhost:9992'
    : '/api';

export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface CreateTaskDto {
  description: string;
}

export async function createTask(dto: CreateTaskDto): Promise<Task> {
  const response = await fetch(`${API_BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create task');
  }

  return response.json();
}

export async function getTask(taskId: string): Promise<Task> {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`);

  if (!response.ok) {
    throw new Error('Failed to get task');
  }

  return response.json();
}

export async function getAllTasks(): Promise<Task[]> {
  const response = await fetch(`${API_BASE_URL}/tasks`);

  if (!response.ok) {
    throw new Error('Failed to get tasks');
  }

  return response.json();
}

export async function cancelTask(taskId: string): Promise<Task> {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: 'Failed to cancel task',
    }));
    throw new Error(error.message || 'Failed to cancel task');
  }
  return response.json();
}

