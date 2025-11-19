import { Injectable, Logger } from '@nestjs/common';
import { TasksGateway } from './gateway';

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
  timestamp: Date;
}

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  constructor(private readonly tasksGateway: TasksGateway) {}

  emitOrchestratorThinking(taskId: string, thinking: string) {
    this.emitEvent(taskId, {
      type: 'orchestrator_thinking',
      taskId,
      data: { thinking },
      timestamp: new Date(),
    });
  }

  emitPositionRequest(taskId: string, description: string) {
    this.emitEvent(taskId, {
      type: 'position_request',
      taskId,
      data: { description },
      timestamp: new Date(),
    });
  }

  emitPositionDetected(taskId: string, position: { x: number; y: number }, description: string) {
    this.emitEvent(taskId, {
      type: 'position_detected',
      taskId,
      data: { position, description },
      timestamp: new Date(),
    });
  }

  emitActionExecuted(taskId: string, action: string, details?: any) {
    this.emitEvent(taskId, {
      type: 'action_executed',
      taskId,
      data: { action, details },
      timestamp: new Date(),
    });
  }

  emitScreenshotTaken(taskId: string, screenshot: string) {
    this.emitEvent(taskId, {
      type: 'screenshot_taken',
      taskId,
      data: { screenshot },
      timestamp: new Date(),
    });
  }

  emitError(taskId: string, error: string, details?: any) {
    this.logger.error(`Task ${taskId} error: ${error}`, details);
    this.emitEvent(taskId, {
      type: 'error',
      taskId,
      data: { error, details },
      timestamp: new Date(),
    });
  }

  emitTaskStarted(taskId: string, task: any) {
    this.emitEvent(taskId, {
      type: 'task_started',
      taskId,
      data: { task },
      timestamp: new Date(),
    });
  }

  emitTaskCompleted(taskId: string, result?: any) {
    this.emitEvent(taskId, {
      type: 'task_completed',
      taskId,
      data: { result },
      timestamp: new Date(),
    });
  }

  emitTaskFailed(taskId: string, error: string) {
    this.emitEvent(taskId, {
      type: 'task_failed',
      taskId,
      data: { error },
      timestamp: new Date(),
    });
  }

  private emitEvent(taskId: string, event: TaskEvent) {
    this.tasksGateway.server.to(`task_${taskId}`).emit('task_event', event);
    this.logger.debug(`Emitted ${event.type} for task ${taskId}`);
  }
}

