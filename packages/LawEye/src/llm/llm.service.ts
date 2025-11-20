import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface PositionResult {
  x: number; // normalized 0-1
  y: number; // normalized 0-1
}

export interface OrchestratorResponse {
  action: 'click' | 'type' | 'wait' | 'screenshot' | 'done';
  description?: string; // For position LLM: what to find
  text?: string; // For type action
  thinking?: string; // If model supports thinking
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly openai: OpenAI;
  private readonly orchestratorModel: string;
  private readonly positionModel: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    // LM Studio uses OpenAI-compatible API
    const lmStudioUrl = this.configService.get<string>('LM_STUDIO_BASE_URL') || 'http://localhost:1234/v1';
    this.orchestratorModel = this.configService.get<string>('MODEL_ORCHESTRATOR') || 'magistral-small-2509';
    this.positionModel = this.configService.get<string>('MODEL_POSITION') || 'qwen2.5-vl:32b';

    this.openai = new OpenAI({
      apiKey: 'lm-studio', // LM Studio doesn't require a real key
      baseURL: lmStudioUrl,
    });

    this.logger.log(`LM Studio service initialized with URL: ${lmStudioUrl}`);
    this.logger.log(`Orchestrator model: ${this.orchestratorModel}`);
    this.logger.log(`Position model: ${this.positionModel}`);
  }

  /**
   * Get the next action from the orchestrator LLM
   * @param screenshot - Base64 encoded screenshot
   * @param taskDescription - The main task to accomplish
   * @param history - Previous actions and results
   */
  async getNextAction(
    screenshot: string,
    taskDescription: string,
    history: Array<{ action: string; result?: string }> = [],
  ): Promise<OrchestratorResponse> {
    this.logger.debug('Getting next action from orchestrator');

    try {
      const systemPrompt = this.getOrchestratorSystemPrompt();

      // Build history context
      const historyContext =
        history.length > 0
          ? `\n\nPrevious actions:\n${history
              .slice(-10) // Only last 10 actions to avoid context overflow
              .map((h) => `- ${h.action}${h.result ? ` -> ${h.result}` : ''}`)
              .join('\n')}`
          : '\n\nNo previous actions yet.';

      const userPrompt = `Task: ${taskDescription}${historyContext}\n\nAnalyze the screenshot carefully. What should I do next to accomplish this task?

Respond ONLY with valid JSON in this format:
{
  "action": "click" | "type" | "wait" | "screenshot" | "done",
  "description": "description of element to click (if action is click)",
  "text": "text to type (if action is type)",
  "thinking": "brief explanation of your reasoning"
}

Be specific in your descriptions. For example, instead of "button", say "Submit button" or "Login button".`;

      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userPrompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${screenshot}`,
                detail: 'high',
              },
            },
          ],
        },
      ];

      this.logger.debug(
        `Calling orchestrator LLM (model: ${this.orchestratorModel})...`,
      );

      const startTime = Date.now();
      let response;
      try {
        response = await Promise.race([
          this.openai.chat.completions.create({
            model: this.orchestratorModel,
            messages,
            max_tokens: 500,
            temperature: 0.3, // Lower temperature for more consistent JSON responses
            response_format: { type: 'json_object' }, // Force JSON response if supported
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Orchestrator LLM timeout after 60s')),
              60000,
            ),
          ),
        ]) as any;
      } catch (error: any) {
        if (error.message?.includes('timeout')) {
          this.logger.error('Orchestrator LLM request timed out');
          throw new Error('Orchestrator LLM request timed out after 60s');
        }
        if (error.code === 'ECONNREFUSED' || error.message?.includes('connect')) {
          this.logger.error('Failed to connect to LM Studio');
          throw new Error(
            'Failed to connect to LM Studio. Make sure LM Studio is running and accessible.',
          );
        }
        throw error;
      }
      const duration = Date.now() - startTime;
      this.logger.debug(`Orchestrator LLM response received in ${duration}ms`);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from orchestrator LLM');
      }

      this.logger.debug(
        `Orchestrator response (${content.length} chars): ${content.substring(0, 300)}...`,
      );

      // Parse the response
      const parsed = this.parseOrchestratorResponse(content);

      // Validate parsed response
      if (!parsed.action) {
        throw new Error('Invalid response: missing action field');
      }

      if (parsed.action === 'click' && !parsed.description) {
        this.logger.warn('Click action without description, using fallback');
        parsed.description = 'element';
      }

      if (parsed.action === 'type' && !parsed.text) {
        throw new Error('Type action requires text field');
      }

      this.logger.debug(`Parsed action: ${parsed.action}`);

      return parsed;
    } catch (error: any) {
      this.logger.error(
        `Error getting next action from orchestrator: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find the position of an element using the Position LLM
   * @param screenshot - Base64 encoded screenshot
   * @param description - Description of what to find
   * @param retries - Number of retry attempts (default: 3)
   */
  async findPosition(
    screenshot: string,
    description: string,
    retries: number = 3,
  ): Promise<PositionResult> {
    this.logger.debug(`Finding position for: "${description}"`);

    const positionPrompt = `Tu es un modèle de vision et langage capable d'analyser une image d'interface utilisateur et de localiser un élément décrit en texte. Les coordonnées que tu dois fournir sont normalisées entre 0 et 1, avec (0,0) en haut à gauche et (1,1) en bas à droite de l'image.

Tâche :
À partir de l'image fournie et de la description qui suit, identifie avec précision la position centrale de l'élément sur l'image. Renvoie UNIQUEMENT un objet JSON au format suivant :

{
  "x": valeur_entre_0_et_1,  // position horizontal normalisée (0 = gauche, 1 = droite)
  "y": valeur_entre_0_et_1   // position vertical normalisée (0 = haut, 1 = bas)
}

Description précise de l'élément : "${description}"

IMPORTANT: Renvoie UNIQUEMENT le JSON, rien d'autre. Pas de texte avant ou après.`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.logger.debug(
          `Position detection attempt ${attempt}/${retries} for: "${description}"`,
        );

        const messages: ChatCompletionMessageParam[] = [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: positionPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${screenshot}`,
                  detail: 'high',
                },
              },
            ],
          },
        ];

        const startTime = Date.now();
        let response;
        try {
          response = await Promise.race([
            this.openai.chat.completions.create({
              model: this.positionModel,
              messages,
              max_tokens: 200,
              temperature: 0.1, // Very low temperature for precise results
              response_format: { type: 'json_object' }, // Force JSON response if supported
            }),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('Position LLM timeout after 60s')),
                60000,
              ),
            ),
          ]) as any;
        } catch (error: any) {
          if (error.message?.includes('timeout')) {
            this.logger.error('Position LLM request timed out');
            throw new Error('Position LLM request timed out after 60s');
          }
          if (error.code === 'ECONNREFUSED' || error.message?.includes('connect')) {
            this.logger.error('Failed to connect to LM Studio');
            throw new Error(
              'Failed to connect to LM Studio. Make sure LM Studio is running and accessible.',
            );
          }
          throw error;
        }
        const duration = Date.now() - startTime;
        this.logger.debug(
          `Position LLM response received in ${duration}ms (attempt ${attempt})`,
        );

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response from position LLM');
        }

        this.logger.debug(`Position LLM response (${content.length} chars): ${content}`);

        const position = this.parsePositionResponse(content);

        // Validate coordinates are within bounds
        if (position.x < 0 || position.x > 1 || position.y < 0 || position.y > 1) {
          throw new Error(
            `Invalid coordinates: x=${position.x}, y=${position.y} (must be between 0 and 1)`,
          );
        }

        this.logger.debug(
          `Position found successfully: x=${position.x.toFixed(4)}, y=${position.y.toFixed(4)}`,
        );
        return position;
      } catch (error: any) {
        lastError = error;
        this.logger.warn(
          `Position detection attempt ${attempt}/${retries} failed: ${error.message}`,
          error.stack,
        );

        if (attempt < retries) {
          // Wait progressively longer before retrying
          const waitTime = 1000 * attempt;
          this.logger.debug(`Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // All retries failed
    this.logger.error(
      `Failed to find position for "${description}" after ${retries} attempts. Last error: ${lastError?.message}`,
    );
    throw new Error(
      `Failed to find position for "${description}" after ${retries} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Convert normalized coordinates (0-1) to pixel coordinates
   * @param normalized - Normalized coordinates
   * @param width - Screen width in pixels
   * @param height - Screen height in pixels
   */
  normalizeToPixels(
    normalized: PositionResult,
    width: number = 1280,
    height: number = 960,
  ): { x: number; y: number } {
    return {
      x: Math.round(normalized.x * width),
      y: Math.round(normalized.y * height),
    };
  }

  private parseOrchestratorResponse(content: string): OrchestratorResponse {
    this.logger.debug(`Parsing orchestrator response: ${content.substring(0, 200)}...`);

    // Try to extract JSON from markdown code blocks first
    const jsonCodeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonCodeBlockMatch) {
      try {
        const json = JSON.parse(jsonCodeBlockMatch[1]);
        if (json.action) {
          this.logger.debug(`Parsed JSON from code block: ${JSON.stringify(json)}`);
          return json as OrchestratorResponse;
        }
      } catch (error) {
        this.logger.warn('Failed to parse JSON from code block', error);
      }
    }

    // Try to find JSON object anywhere in the response
    const jsonMatch = content.match(/\{[\s\S]*"action"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[0]);
        if (json.action) {
          this.logger.debug(`Parsed JSON from content: ${JSON.stringify(json)}`);
          return json as OrchestratorResponse;
        }
      } catch (error) {
        this.logger.warn('Failed to parse JSON from content', error);
      }
    }

    // Try to parse entire content as JSON
    try {
      const json = JSON.parse(content.trim());
      if (json.action) {
        this.logger.debug(`Parsed entire content as JSON: ${JSON.stringify(json)}`);
        return json as OrchestratorResponse;
      }
    } catch {
      // Not JSON, try to extract from text
    }

    // Fallback: Parse from text response (less reliable)
    this.logger.warn('Falling back to text-based parsing');
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('done') || lowerContent.includes('complete') || lowerContent.includes('terminé')) {
      return { action: 'done' };
    }

    if (lowerContent.includes('click') || lowerContent.includes('cliquer')) {
      // Extract description - try multiple patterns
      let descMatch = content.match(/click\s+(?:on\s+)?["']?([^"'.]+)["']?/i);
      if (!descMatch) {
        descMatch = content.match(/cliquer\s+(?:sur\s+)?["']?([^"'.]+)["']?/i);
      }
      const description = descMatch ? descMatch[1].trim() : 'element';
      
      if (!description || description === 'element') {
        // Try to extract from sentences like "I need to click on the Firefox icon"
        const clickDescMatch = content.match(/(?:click|cliquer)[\s\w]+(?:on|sur)[\s]+["']?([^"'.]+)["']?/i);
        if (clickDescMatch) {
          return { action: 'click', description: clickDescMatch[1].trim() };
        }
      }
      
      return { action: 'click', description };
    }

    if (lowerContent.includes('type') || lowerContent.includes('taper') || lowerContent.includes('écrire')) {
      // Extract text to type - try multiple patterns
      let textMatch = content.match(/type\s+(?:the\s+)?["']([^"']+)["']/i);
      if (!textMatch) {
        textMatch = content.match(/taper\s+["']?([^"'.]+)["']?/i);
      }
      if (!textMatch) {
        textMatch = content.match(/écrire\s+["']?([^"'.]+)["']?/i);
      }
      const text = textMatch ? textMatch[1].trim() : '';
      
      if (text) {
        return { action: 'type', text };
      }
      // If no text found, extract what comes after "type"
      const typeAfterMatch = content.match(/type\s+["']?([^"'\n.]+)["']?/i);
      if (typeAfterMatch) {
        return { action: 'type', text: typeAfterMatch[1].trim() };
      }
    }

    if (lowerContent.includes('wait') || lowerContent.includes('attendre')) {
      return { action: 'wait' };
    }

    if (lowerContent.includes('screenshot') || lowerContent.includes('capture') || lowerContent.includes('capturer')) {
      return { action: 'screenshot' };
    }

    // Default: if we see description of something, try to click on it
    // Extract potential description from the text
    const potentialDesc = content.match(/(?:the|le|la)\s+["']?([^"'.!?]+(?:icon|button|bar|field|link|menu|window|application))["']?/i);
    if (potentialDesc) {
      return { action: 'click', description: potentialDesc[1].trim() };
    }

    // Last resort: return click with the trimmed content as description
    this.logger.warn(`Could not parse action from: ${content.substring(0, 100)}`);
    return { action: 'click', description: content.trim().substring(0, 100) };
  }

  private parsePositionResponse(content: string): PositionResult {
    this.logger.debug(`Parsing position response: ${content.substring(0, 200)}...`);

    // Try to extract JSON from markdown code blocks first
    const jsonCodeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonCodeBlockMatch) {
      try {
        const parsed = JSON.parse(jsonCodeBlockMatch[1]);
        if (
          typeof parsed.x === 'number' &&
          typeof parsed.y === 'number' &&
          !isNaN(parsed.x) &&
          !isNaN(parsed.y)
        ) {
          this.logger.debug(`Parsed JSON from code block: x=${parsed.x}, y=${parsed.y}`);
          return { x: parsed.x, y: parsed.y };
        }
      } catch (error) {
        this.logger.warn('Failed to parse JSON from code block', error);
      }
    }

    // Try to find JSON object with x and y
    const jsonMatch = content.match(/\{[\s\S]*?"x"[\s\S]*?"y"[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (
          typeof parsed.x === 'number' &&
          typeof parsed.y === 'number' &&
          !isNaN(parsed.x) &&
          !isNaN(parsed.y)
        ) {
          this.logger.debug(`Parsed JSON from content: x=${parsed.x}, y=${parsed.y}`);
          return { x: parsed.x, y: parsed.y };
        }
      } catch (error) {
        this.logger.warn('Failed to parse JSON from content', error);
      }
    }

    // Try to parse entire content as JSON
    try {
      const parsed = JSON.parse(content.trim());
      if (
        typeof parsed.x === 'number' &&
        typeof parsed.y === 'number' &&
        !isNaN(parsed.x) &&
        !isNaN(parsed.y)
      ) {
        this.logger.debug(`Parsed entire content as JSON: x=${parsed.x}, y=${parsed.y}`);
        return { x: parsed.x, y: parsed.y };
      }
    } catch {
      // Not JSON, try other methods
    }

    // Try to extract numbers directly with various patterns
    const patterns = [
      /"x"\s*:\s*([0-9.]+)[\s\S]*?"y"\s*:\s*([0-9.]+)/i,
      /x[:\s=]+([0-9.]+)[\s\S]*y[:\s=]+([0-9.]+)/i,
      /\(([0-9.]+),\s*([0-9.]+)\)/,
      /\[([0-9.]+),\s*([0-9.]+)\]/,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        if (!isNaN(x) && !isNaN(y)) {
          this.logger.debug(`Parsed from pattern: x=${x}, y=${y}`);
          // Normalize if values seem too large (might be in pixels)
          const normalizedX = x > 1 ? x / 1280 : x;
          const normalizedY = y > 1 ? y / 960 : y;
          return { x: normalizedX, y: normalizedY };
        }
      }
    }

    this.logger.error(`Could not parse position from response: ${content}`);
    throw new Error(`Could not parse position from response: ${content.substring(0, 200)}`);
  }

  private getOrchestratorSystemPrompt(): string {
    return `You are **LawEye**, a highly-reliable AI assistant operating a virtual computer whose display measures 1280 x 960 pixels.

The current date is ${new Date().toLocaleDateString()}. The current time is ${new Date().toLocaleTimeString()}.

────────────────────────
AVAILABLE APPLICATIONS
────────────────────────

On the computer, the following applications are available:
- Firefox Browser -- The default web browser
- Thunderbird -- The default email client
- 1Password -- The password manager
- Visual Studio Code -- The code editor
- Terminal -- The terminal
- File Manager -- The file manager
- Desktop -- The desktop environment

ALL APPLICATIONS ARE GUI BASED. ONLY ACCESS APPLICATIONS VIA THEIR DESKTOP ICONS.

────────────────────────
CORE WORKING PRINCIPLES
────────────────────────

1. **Observe First** - *Always* analyze the screenshot carefully before your first action and whenever the UI may have changed. Never act blindly.

2. **Human-Like Interaction** - Click near the visual centre of targets. Double-click desktop icons to open them.

3. **Verify Every Step** - After each action, take another screenshot and confirm the expected state before continuing.

4. **Efficiency** - Combine related actions when possible. Minimize unnecessary waits.

5. **Stay Within Scope** - Do nothing the user didn't request. Don't suggest unrelated tasks.

────────────────────────
AVAILABLE ACTIONS
────────────────────────

You can perform these actions:

1. **click** - Click on an element
   - Requires: "description" (clear description of what to find, e.g., "Firefox icon", "search bar", "Submit button")
   - Example: {"action": "click", "description": "Firefox icon"}

2. **type** - Type text at the current cursor position
   - Requires: "text" (the text to type)
   - Example: {"action": "type", "text": "Hello World"}

3. **screenshot** - Take a new screenshot to see current state
   - Example: {"action": "screenshot"}

4. **wait** - Wait a moment (useful after actions that take time)
   - Example: {"action": "wait"}

5. **done** - Task is complete (only when user's goal is fully met)
   - Example: {"action": "done"}

────────────────────────
RESPONSE FORMAT
────────────────────────

You MUST respond with valid JSON in this format:
{
  "action": "click" | "type" | "wait" | "screenshot" | "done",
  "description": "clear description of what to find (required for click actions)",
  "text": "text to type (required for type actions)",
  "thinking": "your reasoning about what you see and what to do next (optional)"
}

**IMPORTANT**: 
- Always provide "description" when action is "click"
- Always provide "text" when action is "type"
- Only use "done" when the task is COMPLETELY finished
- Be very specific in descriptions (e.g., "Firefox browser icon on desktop" not just "icon")

Remember: **accuracy over speed, clarity over cleverness**. Think before each move, analyze the screenshot carefully, and always verify the result before continuing.`;
  }
}

