import { Injectable, Logger } from '@nestjs/common';
import { DesktopService } from '../desktop/desktop.service';
import { LlmService } from '../llm/llm.service';
import { GatewayService } from '../gateway/gateway.service';

export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface CreateTaskDto {
  description: string;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  private tasks: Map<string, Task> = new Map();
  private currentTaskId: string | null = null;

  constructor(
    private readonly desktopService: DesktopService,
    private readonly llmService: LlmService,
    private readonly gatewayService: GatewayService,
  ) {}

  /**
   * Create a new task
   */
  create(createTaskDto: CreateTaskDto): Task {
    const task: Task = {
      id: this.generateTaskId(),
      description: createTaskDto.description,
      status: 'pending',
      createdAt: new Date(),
    };

    this.tasks.set(task.id, task);
    this.logger.log(`Task created: ${task.id} - ${task.description}`);

    // Start execution immediately
    this.executeTask(task.id).catch((error) => {
      this.logger.error(`Task ${task.id} execution failed: ${error.message}`, error.stack);
    });

    return task;
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get current running task
   */
  getCurrentTask(): Task | null {
    if (!this.currentTaskId) return null;
    return this.tasks.get(this.currentTaskId) || null;
  }

  /**
   * Execute a task
   */
  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Only one task at a time
    if (this.currentTaskId && this.currentTaskId !== taskId) {
      throw new Error(`Another task (${this.currentTaskId}) is already running`);
    }

    this.currentTaskId = taskId;
    task.status = 'running';

    this.logger.log(`Starting task ${taskId}: ${task.description}`);
    this.gatewayService.emitTaskStarted(taskId, task);

    try {
      const actionHistory: Array<{ action: string; result?: string }> = [];
      let iterationCount = 0;
      const maxIterations = 100; // Safety limit

      while (task.status === 'running' && iterationCount < maxIterations) {
        iterationCount++;

        this.logger.debug(`Task ${taskId} iteration ${iterationCount}`);

        // Take screenshot
        const screenshot = await this.desktopService.screenshot();
        this.gatewayService.emitScreenshotTaken(taskId, screenshot);

        // Get next action from orchestrator
        const orchestratorResponse = await this.llmService.getNextAction(
          screenshot,
          task.description,
          actionHistory,
        );

        if (orchestratorResponse.thinking) {
          this.gatewayService.emitOrchestratorThinking(
            taskId,
            orchestratorResponse.thinking,
          );
        }

        this.logger.debug(
          `Orchestrator action: ${orchestratorResponse.action}`,
        );

        // Handle different actions
        switch (orchestratorResponse.action) {
          case 'done':
            task.status = 'completed';
            task.completedAt = new Date();
            this.logger.log(`Task ${taskId} completed`);
            this.gatewayService.emitTaskCompleted(taskId);
            this.currentTaskId = null;
            return;

          case 'click':
            if (!orchestratorResponse.description) {
              throw new Error('Click action requires a description');
            }

            // Find position using Position LLM
            this.gatewayService.emitPositionRequest(
              taskId,
              orchestratorResponse.description,
            );

            const position = await this.llmService.findPosition(
              screenshot,
              orchestratorResponse.description,
              3, // 3 retries
            );

            // Convert normalized coordinates to pixels
            const pixelCoords = this.llmService.normalizeToPixels(position);
            this.gatewayService.emitPositionDetected(
              taskId,
              pixelCoords,
              orchestratorResponse.description,
            );

            // Execute click
            await this.desktopService.clickMouse(pixelCoords, 'left');
            this.gatewayService.emitActionExecuted(taskId, 'click_mouse', {
              coordinates: pixelCoords,
              description: orchestratorResponse.description,
            });

            actionHistory.push({
              action: `Click on ${orchestratorResponse.description}`,
              result: `Clicked at (${pixelCoords.x}, ${pixelCoords.y})`,
            });

            // Wait a bit after click
            await this.delay(1000);
            break;

          case 'type':
            if (!orchestratorResponse.text) {
              throw new Error('Type action requires text');
            }

            await this.desktopService.typeText(orchestratorResponse.text);
            this.gatewayService.emitActionExecuted(taskId, 'type_text', {
              text: orchestratorResponse.text,
            });

            actionHistory.push({
              action: `Type text`,
              result: `Typed: ${orchestratorResponse.text}`,
            });

            await this.delay(500);
            break;

          case 'wait':
            await this.delay(2000);
            actionHistory.push({
              action: 'Wait',
            });
            break;

          case 'screenshot':
            // Already took screenshot, just continue
            break;

          default:
            this.logger.warn(
              `Unknown action: ${orchestratorResponse.action}`,
            );
        }
      }

      if (iterationCount >= maxIterations) {
        throw new Error('Task exceeded maximum iterations');
      }
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      task.completedAt = new Date();
      this.logger.error(`Task ${taskId} failed: ${error.message}`, error.stack);
      this.gatewayService.emitError(taskId, error.message, {
        stack: error.stack,
      });
      this.gatewayService.emitTaskFailed(taskId, error.message);
      this.currentTaskId = null;
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

