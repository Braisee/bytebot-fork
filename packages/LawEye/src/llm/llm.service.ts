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
              text: `Task: ${taskDescription}\n\nPrevious actions:\n${history.map(h => `- ${h.action}${h.result ? ` -> ${h.result}` : ''}`).join('\n') || 'None'}\n\nWhat should I do next?`,
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

      const response = await this.openai.chat.completions.create({
        model: this.orchestratorModel,
        messages,
        max_tokens: 1000,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from orchestrator LLM');
      }

      this.logger.debug(`Orchestrator response: ${content.substring(0, 200)}...`);

      // Parse the response - expecting JSON or structured text
      return this.parseOrchestratorResponse(content);
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
À partir de l'image fournie et de la description qui suit, identifie avec précision la position centrale de l'élément sur l'image. Renvoie uniquement un objet JSON au format suivant :

{
  "x": valeur_entre_0_et_1,  // position horizontal normalisée (0 = gauche, 1 = droite)
  "y": valeur_entre_0_et_1   // position vertical normalisée (0 = haut, 1 = bas)
}

Description précise de l'élément : "${description}"

Renvoie uniquement le JSON, rien d'autre.`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.logger.debug(`Position detection attempt ${attempt}/${retries}`);

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

        const response = await this.openai.chat.completions.create({
          model: this.positionModel,
          messages,
          max_tokens: 200,
          temperature: 0.3, // Lower temperature for more precise results
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response from position LLM');
        }

        this.logger.debug(`Position LLM response: ${content}`);

        const position = this.parsePositionResponse(content);
        
        // Validate coordinates are within bounds
        if (position.x < 0 || position.x > 1 || position.y < 0 || position.y > 1) {
          throw new Error(`Invalid coordinates: x=${position.x}, y=${position.y} (must be between 0 and 1)`);
        }

        this.logger.debug(`Position found: x=${position.x}, y=${position.y}`);
        return position;
      } catch (error: any) {
        lastError = error;
        this.logger.warn(
          `Position detection attempt ${attempt} failed: ${error.message}`,
        );

        if (attempt < retries) {
          // Wait a bit before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // All retries failed
    this.logger.error(
      `Failed to find position after ${retries} attempts: ${lastError?.message}`,
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
    // Try to parse as JSON first
    try {
      const json = JSON.parse(content);
      if (json.action) {
        return json as OrchestratorResponse;
      }
    } catch {
      // Not JSON, try to extract from text
    }

    // Parse from text response
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('done') || lowerContent.includes('complete')) {
      return { action: 'done' };
    }

    if (lowerContent.includes('click') || lowerContent.includes('cliquer')) {
      // Extract description
      const descMatch = content.match(/click\s+(?:on\s+)?(.+?)(?:\.|$)/i);
      const description = descMatch ? descMatch[1].trim() : 'element';
      return { action: 'click', description };
    }

    if (lowerContent.includes('type') || lowerContent.includes('taper')) {
      // Extract text to type
      const textMatch = content.match(/type\s+(?:the\s+)?["']?([^"']+)["']?/i);
      const text = textMatch ? textMatch[1].trim() : '';
      return { action: 'type', text };
    }

    if (lowerContent.includes('wait') || lowerContent.includes('attendre')) {
      return { action: 'wait' };
    }

    if (lowerContent.includes('screenshot') || lowerContent.includes('capture')) {
      return { action: 'screenshot' };
    }

    // Default: try to click on something described in the text
    return { action: 'click', description: content.trim() };
  }

  private parsePositionResponse(content: string): PositionResult {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*"x"[\s\S]*"y"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return { x: parsed.x, y: parsed.y };
        }
      } catch {
        // Continue to try other parsing methods
      }
    }

    // Try to extract numbers directly
    const numberMatch = content.match(/x[:\s=]+([0-9.]+).*y[:\s=]+([0-9.]+)/i);
    if (numberMatch) {
      const x = parseFloat(numberMatch[1]);
      const y = parseFloat(numberMatch[2]);
      if (!isNaN(x) && !isNaN(y)) {
        return { x, y };
      }
    }

    throw new Error(`Could not parse position from response: ${content}`);
  }

  private getOrchestratorSystemPrompt(): string {
    return `You are LawEye, an AI assistant that controls a desktop computer to accomplish tasks.

Your role:
1. Analyze screenshots of the desktop
2. Determine the next action needed to complete the task
3. Provide clear descriptions of elements to click on
4. Provide text to type when needed

Available actions:
- "click": Click on an element (provide description of what to find)
- "type": Type text (provide the text to type)
- "screenshot": Take a new screenshot to see current state
- "wait": Wait a moment
- "done": Task is complete

When you want to click on something, provide a clear description of the element (e.g., "Firefox icon", "search bar", "Submit button").

When responding, use this JSON format:
{
  "action": "click" | "type" | "wait" | "screenshot" | "done",
  "description": "clear description of what to find (for click actions)",
  "text": "text to type (for type actions)",
  "thinking": "your reasoning (optional)"
}

Be precise and clear. Always analyze the screenshot before deciding the next action.`;
  }
}

