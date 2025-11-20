import { Injectable, Logger } from '@nestjs/common';
import { DesktopService } from '../desktop/desktop.service';
import { LlmService } from '../llm/llm.service';
import { GatewayService } from '../gateway/gateway.service';

export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
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
   * Cancel a task
   */
  cancel(taskId: string): Task {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status !== 'running' && task.status !== 'pending') {
      throw new Error(
        `Cannot cancel task ${taskId}: task is already ${task.status}`,
      );
    }

    task.status = 'failed';
    task.error = 'Task cancelled by user';
    task.completedAt = new Date();

    // If this is the current task, clear it
    if (this.currentTaskId === taskId) {
      this.currentTaskId = null;
    }

    this.logger.log(`Task ${taskId} cancelled`);
    this.gatewayService.emitTaskFailed(taskId, 'Task cancelled by user');

    return task;
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
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 5;

        while (
          task.status === 'running' &&
          iterationCount < maxIterations &&
          this.currentTaskId === taskId
        ) {
          iterationCount++;

          this.logger.log(
            `Task ${taskId} - Iteration ${iterationCount}/${maxIterations}`,
          );

          try {
            // Take screenshot
            this.logger.debug(`Taking screenshot...`);
            const screenshot = await this.desktopService.screenshot();
            this.gatewayService.emitScreenshotTaken(taskId, screenshot);
            this.logger.debug(`Screenshot taken (${screenshot.length} chars)`);

            // Get next action from orchestrator
            this.logger.debug(`Getting next action from orchestrator...`);
            const orchestratorResponse = await this.llmService.getNextAction(
              screenshot,
              task.description,
              actionHistory,
            );

            if (orchestratorResponse.thinking) {
              this.logger.debug(
                `Orchestrator thinking: ${orchestratorResponse.thinking.substring(0, 100)}...`,
              );
              this.gatewayService.emitOrchestratorThinking(
                taskId,
                orchestratorResponse.thinking,
              );
            }

            this.logger.log(
              `Orchestrator decided: action=${orchestratorResponse.action}${
                orchestratorResponse.description
                  ? `, description="${orchestratorResponse.description}"`
                  : ''
              }${orchestratorResponse.text ? `, text="${orchestratorResponse.text.substring(0, 50)}..."` : ''}`,
            );

            // Reset error counter on successful action
            consecutiveErrors = 0;

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

                // Detect if it's a desktop element (icon on desktop)
                // Desktop icons are typically:
                // - Described with words like "desktop", "bureau", "icon", "icône"
                // - Located in the top part of the screen (Y < 200 pixels)
                const description = orchestratorResponse.description.toLowerCase();
                const isDesktopElement =
                  description.includes('desktop') ||
                  description.includes('bureau') ||
                  description.includes('icon') ||
                  description.includes('icône') ||
                  description.includes('on the desktop') ||
                  description.includes('sur le bureau') ||
                  (pixelCoords.y < 200 && // Icons are usually in top area
                   (description.includes('firefox') ||
                    description.includes('thunderbird') ||
                    description.includes('code') ||
                    description.includes('terminal') ||
                    description.includes('file') ||
                    description.includes('fichier')));

                // Use double click for desktop elements, single click otherwise
                const clickCount = isDesktopElement ? 2 : 1;
                const clickType = clickCount === 2 ? 'double' : 'single';

                this.logger.debug(
                  `Detected ${isDesktopElement ? 'desktop' : 'application'} element, using ${clickType} click`,
                );

                // Execute click
                await this.desktopService.clickMouse(pixelCoords, 'left', clickCount);
                this.gatewayService.emitActionExecuted(taskId, 'click_mouse', {
                  coordinates: pixelCoords,
                  description: orchestratorResponse.description,
                  clickCount,
                  clickType,
                });

                actionHistory.push({
                  action: `${clickType} click on ${orchestratorResponse.description}`,
                  result: `${clickType} clicked at (${pixelCoords.x}, ${pixelCoords.y})`,
                });

                // Wait a bit after click (longer for double click)
                await this.delay(clickCount === 2 ? 1500 : 1000);
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
                this.logger.warn(`Unknown action: ${orchestratorResponse.action}`);
                // Treat unknown action as wait to avoid crash
                await this.delay(1000);
                break;
            }
          } catch (actionError: any) {
            consecutiveErrors++;
            this.logger.error(
              `Error in action execution (attempt ${consecutiveErrors}/${maxConsecutiveErrors}): ${actionError.message}`,
              actionError.stack,
            );

            this.gatewayService.emitError(taskId, actionError.message, {
              stack: actionError.stack,
              iteration: iterationCount,
            });

            // If too many consecutive errors, fail the task
            if (consecutiveErrors >= maxConsecutiveErrors) {
              throw new Error(
                `Too many consecutive errors (${consecutiveErrors}). Last error: ${actionError.message}`,
              );
            }

            // Wait longer after errors before retrying
            await this.delay(2000 * consecutiveErrors);
          }
        }

        if (iterationCount >= maxIterations) {
          throw new Error(
            `Task exceeded maximum iterations (${maxIterations}). This might indicate an infinite loop or the task is too complex.`,
          );
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

