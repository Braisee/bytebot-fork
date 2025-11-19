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

    try {
      const response = await fetch(`${this.baseUrl}/computer-use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'screenshot',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to take screenshot: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.image) {
        throw new Error('Failed to take screenshot: No image data received');
      }

      this.logger.debug('Screenshot taken successfully');
      return data.image; // Base64 encoded image
    } catch (error: any) {
      this.logger.error(`Error taking screenshot: ${error.message}`, error.stack);
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

    try {
      const action: ClickMouseAction = {
        action: 'click_mouse',
        coordinates,
        button,
        clickCount: 1,
      };

      const response = await fetch(`${this.baseUrl}/computer-use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });

      if (!response.ok) {
        throw new Error(`Failed to click mouse: ${response.statusText}`);
      }

      this.logger.debug('Mouse clicked successfully');
    } catch (error: any) {
      this.logger.error(`Error clicking mouse: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Type text at the current cursor position
   * @param text - The text to type
   * @param delay - Optional delay between keystrokes in milliseconds
   */
  async typeText(text: string, delay?: number): Promise<void> {
    this.logger.debug(`Typing text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

    try {
      const action: TypeTextAction = {
        action: 'type_text',
        text,
        delay,
      };

      const response = await fetch(`${this.baseUrl}/computer-use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });

      if (!response.ok) {
        throw new Error(`Failed to type text: ${response.statusText}`);
      }

      this.logger.debug('Text typed successfully');
    } catch (error: any) {
      this.logger.error(`Error typing text: ${error.message}`, error.stack);
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

