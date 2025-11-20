import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { DesktopService } from '../desktop/desktop.service';
import { Coordinates } from '@bytebot/shared';

@Controller('test-desktop')
export class TestDesktopController {
  private readonly logger = new Logger(TestDesktopController.name);

  constructor(private readonly desktopService: DesktopService) {}

  /**
   * Test: Prendre un screenshot
   * GET /test-desktop/screenshot
   */
  @Get('screenshot')
  async testScreenshot() {
    this.logger.log('Testing screenshot...');
    try {
      const screenshot = await this.desktopService.screenshot();
      return {
        success: true,
        message: 'Screenshot taken successfully',
        data: {
          imageLength: screenshot.length,
          imagePreview: screenshot.substring(0, 100) + '...',
          fullImage: screenshot, // Base64 encoded image
        },
      };
    } catch (error: any) {
      this.logger.error(`Screenshot test failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * Test: Cliquer à des coordonnées
   * POST /test-desktop/click
   * Body: { x: number, y: number, button?: 'left' | 'right' | 'middle', clickCount?: number }
   */
  @Post('click')
  async testClick(
    @Body()
    body: {
      x: number;
      y: number;
      button?: 'left' | 'right' | 'middle';
      clickCount?: number;
    },
  ) {
    const clickCount = body.clickCount || 1;
    const clickType =
      clickCount === 1 ? 'single' : clickCount === 2 ? 'double' : `${clickCount}x`;
    this.logger.log(
      `Testing ${clickType} click at (${body.x}, ${body.y}) with ${body.button || 'left'} button`,
    );

    if (typeof body.x !== 'number' || typeof body.y !== 'number') {
      return {
        success: false,
        error: 'Invalid coordinates. x and y must be numbers.',
      };
    }

    if (clickCount < 1 || clickCount > 10) {
      return {
        success: false,
        error: 'Invalid clickCount. Must be between 1 and 10.',
      };
    }

    try {
      const coordinates: Coordinates = { x: body.x, y: body.y };
      await this.desktopService.clickMouse(
        coordinates,
        body.button || 'left',
        clickCount,
      );
      return {
        success: true,
        message: `${clickType} clicked successfully at (${body.x}, ${body.y})`,
        data: {
          coordinates: { x: body.x, y: body.y },
          button: body.button || 'left',
          clickCount,
          clickType,
        },
      };
    } catch (error: any) {
      this.logger.error(`Click test failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * Test: Taper du texte
   * POST /test-desktop/type
   * Body: { text: string, delay?: number }
   */
  @Post('type')
  async testType(@Body() body: { text: string; delay?: number }) {
    this.logger.log(`Testing type text: "${body.text}"`);
    
    if (!body.text || typeof body.text !== 'string') {
      return {
        success: false,
        error: 'Invalid text. text must be a non-empty string.',
      };
    }

    try {
      await this.desktopService.typeText(body.text, body.delay);
      return {
        success: true,
        message: `Text typed successfully`,
        data: {
          text: body.text,
          textLength: body.text.length,
          delay: body.delay || 'default',
        },
      };
    } catch (error: any) {
      this.logger.error(`Type text test failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * Test: Obtenir la position du curseur
   * GET /test-desktop/cursor-position
   */
  @Get('cursor-position')
  async testCursorPosition() {
    this.logger.log('Testing cursor position...');
    try {
      const position = await this.desktopService.getCursorPosition();
      return {
        success: true,
        message: 'Cursor position retrieved successfully',
        data: {
          coordinates: position,
        },
      };
    } catch (error: any) {
      this.logger.error(`Cursor position test failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * Test complet : Screenshot + Click au centre + Type
   * POST /test-desktop/full-test
   * Body: { text?: string }
   */
  @Post('full-test')
  async fullTest(@Body() body: { text?: string }) {
    this.logger.log('Running full desktop test...');
    const results: any[] = [];

    try {
      // 1. Screenshot
      results.push({ step: 'screenshot', status: 'running' });
      const screenshot = await this.desktopService.screenshot();
      results.push({
        step: 'screenshot',
        status: 'success',
        data: { imageLength: screenshot.length },
      });

      // 2. Cursor position
      results.push({ step: 'cursor_position', status: 'running' });
      const cursorPos = await this.desktopService.getCursorPosition();
      results.push({
        step: 'cursor_position',
        status: 'success',
        data: { coordinates: cursorPos },
      });

      // 3. Click au centre de l'écran (640, 480 pour 1280x960)
      results.push({ step: 'click_center', status: 'running' });
      await this.desktopService.clickMouse({ x: 640, y: 480 });
      results.push({
        step: 'click_center',
        status: 'success',
        data: { coordinates: { x: 640, y: 480 } },
      });

      // 4. Type text si fourni
      if (body.text) {
        results.push({ step: 'type_text', status: 'running' });
        await this.desktopService.typeText(body.text);
        results.push({
          step: 'type_text',
          status: 'success',
          data: { text: body.text },
        });
      }

      return {
        success: true,
        message: 'Full test completed successfully',
        results,
      };
    } catch (error: any) {
      results.push({
        step: 'error',
        status: 'failed',
        error: error.message,
      });
      this.logger.error(`Full test failed: ${error.message}`, error.stack);
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
   * GET /test-desktop/help
   */
  @Get('help')
  getHelp() {
    return {
      message: 'Desktop Service Test Endpoints',
      endpoints: [
        {
          method: 'GET',
          path: '/test-desktop/screenshot',
          description: 'Take a screenshot and return base64 image',
          response: '{ success: boolean, data: { imageLength, fullImage } }',
        },
        {
          method: 'POST',
          path: '/test-desktop/click',
          description: 'Click at specified coordinates (single or double click)',
          body: '{ x: number, y: number, button?: "left" | "right" | "middle", clickCount?: number }',
          example: { x: 640, y: 480, button: 'left', clickCount: 2 },
          note: 'clickCount: 1 = single click, 2 = double click, 3+ = multiple clicks',
        },
        {
          method: 'POST',
          path: '/test-desktop/type',
          description: 'Type text at current cursor position',
          body: '{ text: string, delay?: number }',
          example: { text: 'Hello World', delay: 50 },
        },
        {
          method: 'GET',
          path: '/test-desktop/cursor-position',
          description: 'Get current cursor position',
          response: '{ success: boolean, data: { coordinates: { x, y } } }',
        },
        {
          method: 'POST',
          path: '/test-desktop/full-test',
          description: 'Run a complete test: screenshot + click center + type (optional)',
          body: '{ text?: string }',
          example: { text: 'Test' },
        },
        {
          method: 'GET',
          path: '/test-desktop/help',
          description: 'Show this help message',
        },
      ],
    };
  }
}

