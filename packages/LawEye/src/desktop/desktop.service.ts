import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Coordinates,
  ClickMouseAction,
  TypeTextAction,
  TypeKeysAction,
  PasteTextAction,
} from '@bytebot/shared';

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
   * @param clickCount - Number of clicks (1 = single, 2 = double, etc.) (default: 1)
   */
  async clickMouse(
    coordinates: Coordinates,
    button: 'left' | 'right' | 'middle' = 'left',
    clickCount: number = 1,
  ): Promise<void> {
    const clickType = clickCount === 1 ? 'single' : clickCount === 2 ? 'double' : `${clickCount}x`;
    this.logger.debug(
      `${clickType} clicking mouse at (${coordinates.x}, ${coordinates.y}) with ${button} button`,
    );
    const startTime = Date.now();

    try {
      const action: ClickMouseAction = {
        action: 'click_mouse',
        coordinates,
        button,
        clickCount,
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
      this.logger.debug(
        `Mouse ${clickType} clicked successfully in ${duration}ms`,
      );
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
   * Check if text contains accented characters
   * @param text - The text to check
   * @returns True if text contains accented characters
   */
  private hasAccents(text: string): boolean {
    // Normalize to NFD and check if any combining diacritical marks remain
    const normalized = text.normalize('NFD');
    return /[\u0300-\u036f]/.test(normalized);
  }

  /**
   * Type text at the current cursor position
   * If text contains accented characters, uses paste_text (copy-paste) instead of type_text
   * because type_text doesn't support accented characters in keyboard mapping.
   * paste_text uses xclip + Ctrl+V which preserves accents correctly.
   * @param text - The text to type
   * @param delay - Optional delay between keystrokes in milliseconds (only used for type_text)
   */
  async typeText(text: string, delay?: number): Promise<void> {
    const hasAccentedChars = this.hasAccents(text);
    const method = hasAccentedChars ? 'paste_text' : 'type_text';
    
    if (hasAccentedChars) {
      this.logger.debug(
        `Text contains accents, using paste_text instead of type_text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
      );
    } else {
      this.logger.debug(
        `Typing text (${text.length} chars): "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
      );
    }

    const startTime = Date.now();

    try {
      let action: TypeTextAction | PasteTextAction;
      
      if (hasAccentedChars) {
        // Use paste_text for accented characters
        action = {
          action: 'paste_text',
          text,
        };
      } else {
        // Use type_text for non-accented characters
        action = {
          action: 'type_text',
          text,
          delay,
        };
      }

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
        // Try to read error message from response body
        let errorMessage = `Failed to ${method}: ${response.statusText}`;
        try {
          const errorBody = await response.text();
          if (errorBody) {
            try {
              const errorJson = JSON.parse(errorBody);
              errorMessage = errorJson.message || errorJson.error || errorMessage;
            } catch {
              // If not JSON, use the text as error message
              errorMessage = errorBody.length > 200 
                ? `${errorBody.substring(0, 200)}...` 
                : errorBody;
            }
          }
        } catch (readError) {
          // If we can't read the body, use the status text
          this.logger.warn(`Could not read error response body: ${readError}`);
        }
        
        this.logger.error(
          `${method} failed: ${errorMessage}. Text was: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}" (${text.length} chars)`,
        );
        throw new Error(errorMessage);
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Text ${hasAccentedChars ? 'pasted' : 'typed'} successfully in ${duration}ms`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      if (error.name === 'AbortError') {
        this.logger.error(`${method} request timed out after ${duration}ms`);
        throw new Error(`${method} request timed out after 15s`);
      }
      if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch')) {
        this.logger.error(`Failed to connect to bytebot-desktop at ${this.baseUrl}`);
        throw new Error(
          `Failed to connect to bytebot-desktop: ${error.message}. Make sure bytebot-desktop is running.`,
        );
      }
      this.logger.error(`Error ${hasAccentedChars ? 'pasting' : 'typing'} text after ${duration}ms: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Press a key or combination of keys (e.g., "Enter", "Tab", "Escape")
   * @param keys - Array of key names to press (e.g., ["Enter"], ["Ctrl", "C"])
   * @param delay - Optional delay between key presses in milliseconds
   */
  async pressKey(keys: string[], delay?: number): Promise<void> {
    this.logger.debug(`Pressing keys: [${keys.join(', ')}]`);
    const startTime = Date.now();

    try {
      const action: TypeKeysAction = {
        action: 'type_keys',
        keys,
        delay,
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
        throw new Error(`Failed to press keys: ${response.statusText}`);
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Keys pressed successfully in ${duration}ms`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      if (error.name === 'AbortError') {
        this.logger.error(`Press key request timed out after ${duration}ms`);
        throw new Error('Press key request timed out after 10s');
      }
      if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch')) {
        this.logger.error(`Failed to connect to bytebot-desktop at ${this.baseUrl}`);
        throw new Error(
          `Failed to connect to bytebot-desktop: ${error.message}. Make sure bytebot-desktop is running.`,
        );
      }
      this.logger.error(
        `Error pressing keys after ${duration}ms: ${error.message}`,
        error.stack,
      );
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

