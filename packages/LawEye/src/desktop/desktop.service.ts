import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Coordinates, ClickMouseAction, TypeTextAction } from '@bytebot/shared';

@Injectable()
export class DesktopService {
  private readonly logger = new Logger(DesktopService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('BYTEBOT_DESKTOP_BASE_URL') ||
      'http://bytebot-desktop:9990';

    if (!this.baseUrl) {
      this.logger.warn('BYTEBOT_DESKTOP_BASE_URL is not set');
    }

    this.logger.log(`Desktop service initialized with base URL: ${this.baseUrl}`);
  }

  /**
   * Take a screenshot of the desktop
   * @returns Base64 encoded screenshot image
   */
  async screenshot(): Promise<string> {
    this.logger.debug('Taking screenshot');
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${this.baseUrl}/computer-use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'screenshot',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to take screenshot: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.image) {
        throw new Error('Failed to take screenshot: No image data received');
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Screenshot taken successfully in ${duration}ms (${data.image.length} chars)`);
      return data.image; // Base64 encoded image
    } catch (error: any) {
      const duration = Date.now() - startTime;
      if (error.name === 'AbortError') {
        this.logger.error(`Screenshot request timed out after ${duration}ms`);
        throw new Error('Screenshot request timed out after 30s');
      }
      if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch')) {
        this.logger.error(
          `Failed to connect to bytebot-desktop at ${this.baseUrl}. Make sure it's running.`,
        );
        throw new Error(
          `Failed to connect to bytebot-desktop: ${error.message}. Make sure bytebot-desktop is running on ${this.baseUrl}.`,
        );
      }
      this.logger.error(`Error taking screenshot after ${duration}ms: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Click the mouse at specified coordinates
   * @param coordinates - The x, y coordinates to click at
   * @param button - Mouse button to use (default: 'left')
   */
  async clickMouse(
    coordinates: Coordinates,
    button: 'left' | 'right' | 'middle' = 'left',
  ): Promise<void> {
    this.logger.debug(
      `Clicking mouse at (${coordinates.x}, ${coordinates.y}) with ${button} button`,
    );
    const startTime = Date.now();

    try {
      const action: ClickMouseAction = {
        action: 'click_mouse',
        coordinates,
        button,
        clickCount: 1,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseUrl}/computer-use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to click mouse: ${response.statusText}`);
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Mouse clicked successfully in ${duration}ms`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      if (error.name === 'AbortError') {
        this.logger.error(`Click request timed out after ${duration}ms`);
        throw new Error('Click request timed out after 10s');
      }
      if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch')) {
        this.logger.error(`Failed to connect to bytebot-desktop at ${this.baseUrl}`);
        throw new Error(
          `Failed to connect to bytebot-desktop: ${error.message}. Make sure bytebot-desktop is running.`,
        );
      }
      this.logger.error(`Error clicking mouse after ${duration}ms: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Type text at the current cursor position
   * @param text - The text to type
   * @param delay - Optional delay between keystrokes in milliseconds
   */
  async typeText(text: string, delay?: number): Promise<void> {
    this.logger.debug(
      `Typing text (${text.length} chars): "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
    );
    const startTime = Date.now();

    try {
      const action: TypeTextAction = {
        action: 'type_text',
        text,
        delay,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${this.baseUrl}/computer-use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to type text: ${response.statusText}`);
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Text typed successfully in ${duration}ms`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      if (error.name === 'AbortError') {
        this.logger.error(`Type text request timed out after ${duration}ms`);
        throw new Error('Type text request timed out after 15s');
      }
      if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch')) {
        this.logger.error(`Failed to connect to bytebot-desktop at ${this.baseUrl}`);
        throw new Error(
          `Failed to connect to bytebot-desktop: ${error.message}. Make sure bytebot-desktop is running.`,
        );
      }
      this.logger.error(`Error typing text after ${duration}ms: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get the current cursor position
   * @returns Current cursor coordinates
   */
  async getCursorPosition(): Promise<Coordinates> {
    this.logger.debug('Getting cursor position');

    try {
      const response = await fetch(`${this.baseUrl}/computer-use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cursor_position',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get cursor position: ${response.statusText}`);
      }

      const data = await response.json();
      return { x: data.x, y: data.y };
    } catch (error: any) {
      this.logger.error(
        `Error getting cursor position: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

