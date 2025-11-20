import { Controller, Post, Body, Get, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { DesktopService } from '../desktop/desktop.service';

@Controller('test-llm')
export class TestLlmController {
  private readonly logger = new Logger(TestLlmController.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly desktopService: DesktopService,
  ) {}

  /**
   * Test: Appeler l'Orchestrateur LLM
   * POST /test-llm/orchestrator
   * Body: { taskDescription: string, screenshot?: string, history?: Array<{action: string, result?: string}> }
   * 
   * Si screenshot n'est pas fourni, on prend un screenshot automatiquement
   */
  @Post('orchestrator')
  async testOrchestrator(
    @Body()
    body: {
      taskDescription: string;
      screenshot?: string;
      history?: Array<{ action: string; result?: string }>;
    },
  ) {
    this.logger.log(
      `Testing orchestrator LLM with task: "${body.taskDescription}"`,
    );

    if (!body.taskDescription || typeof body.taskDescription !== 'string') {
      return {
        success: false,
        error: 'Invalid taskDescription. Must be a non-empty string.',
      };
    }

    try {
      // Take screenshot if not provided
      let screenshot = body.screenshot;
      if (!screenshot) {
        this.logger.debug('Taking screenshot automatically...');
        screenshot = await this.desktopService.screenshot();
        this.logger.debug(`Screenshot taken (${screenshot.length} chars)`);
      }

      const startTime = Date.now();
      const response = await this.llmService.getNextAction(
        screenshot,
        body.taskDescription,
        body.history || [],
      );
      const duration = Date.now() - startTime;

      return {
        success: true,
        message: 'Orchestrator LLM responded successfully',
        data: {
          response,
          duration: `${duration}ms`,
          screenshotUsed: body.screenshot ? 'provided' : 'taken',
          screenshotLength: screenshot.length,
        },
      };
    } catch (error: any) {
      this.logger.error(
        `Orchestrator LLM test failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * Test: Appeler le Position LLM
   * POST /test-llm/position
   * Body: { description: string, screenshot?: string, retries?: number }
   * 
   * Si screenshot n'est pas fourni, on prend un screenshot automatiquement
   */
  @Post('position')
  async testPosition(
    @Body()
    body: {
      description: string;
      screenshot?: string;
      retries?: number;
    },
  ) {
    this.logger.log(`Testing position LLM with description: "${body.description}"`);

    if (!body.description || typeof body.description !== 'string') {
      return {
        success: false,
        error: 'Invalid description. Must be a non-empty string.',
      };
    }

    try {
      // Take screenshot if not provided
      let screenshot = body.screenshot;
      if (!screenshot) {
        this.logger.debug('Taking screenshot automatically...');
        screenshot = await this.desktopService.screenshot();
        this.logger.debug(`Screenshot taken (${screenshot.length} chars)`);
      }

      const startTime = Date.now();
      const position = await this.llmService.findPosition(
        screenshot,
        body.description,
        body.retries || 3,
      );
      const duration = Date.now() - startTime;

      // Convert to pixels
      const pixelCoords = this.llmService.normalizeToPixels(position);

      return {
        success: true,
        message: 'Position LLM found position successfully',
        data: {
          position: {
            normalized: position,
            pixels: pixelCoords,
          },
          description: body.description,
          duration: `${duration}ms`,
          screenshotUsed: body.screenshot ? 'provided' : 'taken',
          screenshotLength: screenshot.length,
        },
      };
    } catch (error: any) {
      this.logger.error(`Position LLM test failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * Test complet : Orchestrateur + Position
   * POST /test-llm/full-test
   * Body: { taskDescription: string, screenshot?: string }
   * 
   * 1. Appelle l'orchestrateur
   * 2. Si action = "click", appelle le Position LLM avec la description
   */
  @Post('full-test')
  async fullTest(
    @Body()
    body: {
      taskDescription: string;
      screenshot?: string;
    },
  ) {
    this.logger.log(`Running full LLM test with task: "${body.taskDescription}"`);

    if (!body.taskDescription || typeof body.taskDescription !== 'string') {
      return {
        success: false,
        error: 'Invalid taskDescription. Must be a non-empty string.',
      };
    }

    const results: any[] = [];

    try {
      // Take screenshot if not provided
      let screenshot = body.screenshot;
      if (!screenshot) {
        results.push({ step: 'screenshot', status: 'running' });
        screenshot = await this.desktopService.screenshot();
        results.push({
          step: 'screenshot',
          status: 'success',
          data: { imageLength: screenshot.length },
        });
      }

      // Test orchestrator
      results.push({ step: 'orchestrator', status: 'running' });
      const orchestratorStart = Date.now();
      const orchestratorResponse = await this.llmService.getNextAction(
        screenshot,
        body.taskDescription,
        [],
      );
      const orchestratorDuration = Date.now() - orchestratorStart;
      results.push({
        step: 'orchestrator',
        status: 'success',
        data: {
          response: orchestratorResponse,
          duration: `${orchestratorDuration}ms`,
        },
      });

      // If orchestrator says "click", test position LLM
      if (orchestratorResponse.action === 'click' && orchestratorResponse.description) {
        results.push({ step: 'position', status: 'running' });
        const positionStart = Date.now();
        const position = await this.llmService.findPosition(
          screenshot,
          orchestratorResponse.description,
          3,
        );
        const positionDuration = Date.now() - positionStart;
        const pixelCoords = this.llmService.normalizeToPixels(position);

        results.push({
          step: 'position',
          status: 'success',
          data: {
            position: {
              normalized: position,
              pixels: pixelCoords,
            },
            description: orchestratorResponse.description,
            duration: `${positionDuration}ms`,
          },
        });
      }

      return {
        success: true,
        message: 'Full LLM test completed successfully',
        results,
      };
    } catch (error: any) {
      results.push({
        step: 'error',
        status: 'failed',
        error: error.message,
      });
      this.logger.error(`Full LLM test failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        results,
        stack: error.stack,
      };
    }
  }

  /**
   * Endpoint d'aide pour voir les endpoints disponibles
   * GET /test-llm/help
   */
  @Get('help')
  getHelp() {
    return {
      message: 'LLM Service Test Endpoints',
      endpoints: [
        {
          method: 'POST',
          path: '/test-llm/orchestrator',
          description:
            'Test the orchestrator LLM (vision + decision making). Takes a screenshot automatically if not provided.',
          body: {
            taskDescription: 'string (required) - The task to accomplish',
            screenshot: 'string (optional) - Base64 screenshot. If not provided, one will be taken automatically',
            history: 'array (optional) - Previous actions [{action: string, result?: string}]',
          },
          example: {
            taskDescription: 'Cliquer sur l\'icône Firefox',
            history: [],
          },
          response: {
            success: 'boolean',
            data: {
              response: 'OrchestratorResponse {action, description?, text?, thinking?}',
              duration: 'string',
            },
          },
        },
        {
          method: 'POST',
          path: '/test-llm/position',
          description:
            'Test the position LLM (vision + precise coordinates). Takes a screenshot automatically if not provided.',
          body: {
            description: 'string (required) - Description of element to find (e.g., "Firefox icon")',
            screenshot: 'string (optional) - Base64 screenshot. If not provided, one will be taken automatically',
            retries: 'number (optional) - Number of retry attempts (default: 3)',
          },
          example: {
            description: 'Firefox browser icon on desktop',
          },
          response: {
            success: 'boolean',
            data: {
              position: {
                normalized: '{x: 0-1, y: 0-1}',
                pixels: '{x: number, y: number}',
              },
              duration: 'string',
            },
          },
        },
        {
          method: 'POST',
          path: '/test-llm/full-test',
          description:
            'Test complete flow: orchestrator + position (if click action). Takes a screenshot automatically if not provided.',
          body: {
            taskDescription: 'string (required) - The task to accomplish',
            screenshot: 'string (optional) - Base64 screenshot',
          },
          example: {
            taskDescription: 'Cliquer sur l\'icône Firefox',
          },
          response: {
            success: 'boolean',
            results: 'array - Steps executed with results',
          },
        },
        {
          method: 'GET',
          path: '/test-llm/help',
          description: 'Show this help message',
        },
      ],
      notes: [
        'If screenshot is not provided, it will be taken automatically from the desktop',
        'The orchestrator LLM decides the next action based on the screenshot and task',
        'The position LLM finds precise coordinates (normalized 0-1, then converted to pixels)',
        'All endpoints use the configured models from environment variables',
      ],
    };
  }
}

