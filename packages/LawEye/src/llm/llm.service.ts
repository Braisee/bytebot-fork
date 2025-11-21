import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface PositionResult {
  x: number; // normalized 0-1
  y: number; // normalized 0-1
}

export interface OrchestratorResponse {
  action: 'click' | 'type' | 'press_key' | 'wait' | 'screenshot' | 'done';
  description?: string; // For position LLM: what to find
  text?: string; // For type action
  key?: string; // For press_key action (e.g., "Enter", "Tab", "Escape")
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
  "action": "click" | "type" | "press_key" | "wait" | "screenshot" | "done",
  "description": "description of element to click (if action is click)",
  "text": "text to type (if action is type)",
  "key": "key to press (if action is press_key, e.g., 'Enter', 'Tab', 'Escape')",
  "thinking": "brief explanation of your reasoning"
}

Be specific in your descriptions and ALWAYS include location context for click actions. 
- Instead of "button", say "Submit button at bottom of login form" or "Login button in top-right corner"
- Instead of "icon", say "Firefox icon on desktop, top-left area" or "Folder icon in file manager, left sidebar"
- Include location details: area (top-left, center, bottom-right, etc.), container (desktop, browser window, dialog, menu, etc.), or relative position

⚠️ **CRITICAL FOR ELEMENTS WITH TEXT**: If the element has visible text on it (button, link, menu item, etc.), you MUST include the EXACT text as it appears on screen in your description, and put the text between double quotes "". DO NOT translate, paraphrase, or modify the text - use it exactly as it appears. The quotes make it crystal clear to the Position LLM which exact text to search for using OCR.

Examples of good descriptions with location and exact text (with quotes):
- "Firefox browser icon on desktop, top-left area" (icon without text)
- "button with text \"Submit\" at bottom of login form, right side" (if button text is "Submit")
- "button with text \"OK\" in dialog, bottom-right" (if button text is "OK")
- "link with text \"Login\" in top menu, right side" (if link text is "Login")
- "menu item with text \"File\" in application menu bar, top-left" (if menu text is "File")
- "button with text \"Cancel\" in dialog, bottom-left" (if button text is "Cancel")
- "Search bar in browser window, top center, below address bar" (field without text)
- "Close button (X) in top-right corner of dialog window" (icon button)

Alternative format (also acceptable):
- "\"Submit\" button at bottom of login form, right side"
- "\"OK\" button in dialog, bottom-right"
- "\"Login\" link in top menu, right side"

Examples of BAD descriptions (DO NOT DO THIS):
- "Submit button at bottom of form" when button shows "Submit" ❌ (text not in quotes - too ambiguous)
- "Soumettre button" when button shows "Submit" ❌ (don't translate)
- "Connexion link" when link shows "Login" ❌ (don't translate)
- "Fichier menu" when menu shows "File" ❌ (don't translate)
- "button" ❌ (too vague, no location, no text)

Available keys for press_key: Enter, Tab, Escape, Space, Backspace, Delete, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Home, End, PageUp, PageDown, F1-F12, etc.`;

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
            // LM Studio doesn't support 'json_object', use 'text' and parse JSON from response
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

      if (parsed.action === 'press_key' && !parsed.key) {
        throw new Error('Press key action requires key field');
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

    const positionPrompt = `You are a vision and language model that analyzes a UI screenshot and must locate an element described in text.

CRITICAL REQUIREMENTS (READ CAREFULLY):
- The coordinates ("x" and "y") MUST be strictly normalized, between 0.0 and 1.0 (inclusive).
- (0, 0) is the top-left of the image; (1, 1) the bottom-right.
- UNDER NO CIRCUMSTANCES should you output pixel, percentage, or any value outside the [0.0, 1.0] range.
- If you output values outside [0.0, 1.0], your answer will be considered incorrect and discarded.
- DOUBLE CHECK your answer: any coordinate outside [0.0, 1.0] is an ERROR.

TASK:
Given the screenshot and this description: "${description}", return the CENTER of the element as a JSON object with values strictly between 0 and 1 (e.g.: {"x": 0.50, "y": 0.25}) and NOTHING ELSE.

⚠️ LOCATION HINTS: The description may include location hints (e.g., "top-left area", "center", "bottom-right", "on desktop", "in browser window", etc.). USE THESE HINTS to narrow down your search area and locate the element more accurately.
- If description says "top-left" or "top-left area", focus on coordinates around x < 0.3, y < 0.3
- If description says "top-right" or "top-right area", focus on coordinates around x > 0.7, y < 0.3
- If description says "center" or "middle", focus on coordinates around x ≈ 0.5, y ≈ 0.5
- If description says "bottom" or "bottom area", focus on coordinates around y > 0.7
- If description mentions "on desktop", look in the desktop area (usually top portion)
- If description mentions "in browser window" or "in application", look inside the application window boundaries

EXAMPLES OF VALID RESPONSE:
{"x": 0.12, "y": 0.82}

EXAMPLES OF INVALID RESPONSES (DO NOT DO THIS):
NO {"x": 983, "y": 20}         // Wrong: pixel values
NO {"x": 50, "y": 50}          // Wrong: integer values
NO {"x": 1.08, "y": -0.02}     // Wrong: outside [0.0, 1.0]
NO {"x": 0.5%, "y": 0.5%}      // Wrong: percentage symbol
NO {"x": 0.5, "y": 0.5}\nExplanation: ...  // Wrong: any extra text

MANDATORY: Only output a single, valid JSON object. Do not include any other output (reasoning, text, markdown, explanation, etc.)

REMEMBER: IF EITHER COORDINATE IS OUTSIDE [0.0, 1.0], CANCEL YOUR ANSWER AND TRY AGAIN.`;

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
          this.logger.debug(
            `Calling Position LLM with model: ${this.positionModel} for: "${description}"`,
          );
          response = await Promise.race([
            this.openai.chat.completions.create({
              model: this.positionModel,
              messages,
              max_tokens: 20000,
              temperature: 0.1, // Very low temperature for precise results
              // LM Studio doesn't support 'json_object', use 'text' and parse JSON from response
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

        this.logger.debug(
          `Position LLM response (${content.length} chars): ${content.substring(0, 500)}${content.length > 500 ? '...' : ''}`,
        );
        this.logger.debug(`Full Position LLM response: ${content}`);

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

    if (lowerContent.includes('press') || lowerContent.includes('appuyer')) {
      // Extract key name (Enter, Tab, Escape, etc.)
      const keyMatch = content.match(/(?:press|appuyer)\s+(?:on\s+)?(?:the\s+)?(enter|tab|escape|space|backspace|delete|left|right|up|down|entrée|tabulation|échappement|échap|espace|retour|supprimer|suppr|f[0-9]{1,2})/i);
      if (keyMatch) {
        return { action: 'press_key', key: keyMatch[1] };
      }
    }

    if (lowerContent.includes('type') || lowerContent.includes('taper') || lowerContent.includes('écrire')) {
      // Check if it's "press key" first (e.g., "press Enter" vs "type text")
      const pressKeyMatch = content.match(/(?:press|appuyer)\s+(?:the\s+)?(enter|tab|escape|space|backspace|delete|left|right|up|down|entrée|tabulation|échappement|échap|espace|retour|supprimer|suppr|f[0-9]{1,2})/i);
      if (pressKeyMatch) {
        return { action: 'press_key', key: pressKeyMatch[1] };
      }

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

    // Remove common prefixes like [THINK], [REASONING], etc.
    let cleanedContent = content.trim();
    
    // Remove thinking tags like [THINK], [REASONING], [THOUGHT], etc. (case insensitive)
    // Handle both [THINK]text and [THINK]\ntext formats
    cleanedContent = cleanedContent.replace(/^\[THINK\]\s*/i, '');
    cleanedContent = cleanedContent.replace(/^\[REASONING\]\s*/i, '');
    cleanedContent = cleanedContent.replace(/^\[THOUGHT\]\s*/i, '');
    cleanedContent = cleanedContent.replace(/^\[ANALYSIS\]\s*/i, '');
    
    // Remove everything before the first { (including any remaining text from thinking blocks)
    const firstBrace = cleanedContent.indexOf('{');
    if (firstBrace > 0) {
      const textBefore = cleanedContent.substring(0, firstBrace);
      this.logger.debug(`Removing text before JSON: "${textBefore.substring(0, 100)}..."`);
      cleanedContent = cleanedContent.substring(firstBrace);
    }
    
    // Find the last } to ensure we have complete JSON
    const lastBrace = cleanedContent.lastIndexOf('}');
    if (lastBrace > 0 && lastBrace < cleanedContent.length - 1) {
      // There might be text after the JSON, remove it
      cleanedContent = cleanedContent.substring(0, lastBrace + 1);
    }
    
    this.logger.debug(`Cleaned content for parsing (${cleanedContent.length} chars): ${cleanedContent.substring(0, 300)}${cleanedContent.length > 300 ? '...' : ''}`);

    // Try to extract JSON from markdown code blocks first
    const jsonCodeBlockMatch = cleanedContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
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

    // Try to find JSON object with x and y (more flexible regex)
    const jsonMatch = cleanedContent.match(/\{\s*["']?x["']?\s*:\s*([0-9.]+)\s*,\s*["']?y["']?\s*:\s*([0-9.]+)\s*\}/);
    if (jsonMatch) {
      try {
        const x = parseFloat(jsonMatch[1]);
        const y = parseFloat(jsonMatch[2]);
        if (!isNaN(x) && !isNaN(y)) {
          this.logger.debug(`Parsed JSON directly from regex: x=${x}, y=${y}`);
          return { x, y };
        }
      } catch (error) {
        this.logger.warn('Failed to parse JSON from regex match', error);
      }
    }

    // Try to find JSON object with x and y (broader match)
    const jsonObjectMatch = cleanedContent.match(/\{[\s\S]*?"x"[\s\S]*?"y"[\s\S]*?\}/);
    if (jsonObjectMatch) {
      try {
        const parsed = JSON.parse(jsonObjectMatch[0]);
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

    // Try to parse entire cleaned content as JSON
    try {
      const parsed = JSON.parse(cleanedContent.trim());
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

    // Try to extract numbers directly with various patterns (improved)
    const patterns = [
      /"x"\s*:\s*([0-9.]+)[\s\S]*?"y"\s*:\s*([0-9.]+)/i,
      /'x'\s*:\s*([0-9.]+)[\s\S]*?'y'\s*:\s*([0-9.]+)/i,
      /x\s*[:=]\s*([0-9.]+)[\s\S]*y\s*[:=]\s*([0-9.]+)/i,
      /x[:\s=]+([0-9.]+)[\s\S]*y[:\s=]+([0-9.]+)/i,
      /\(([0-9.]+),\s*([0-9.]+)\)/,
      /\[([0-9.]+),\s*([0-9.]+)\]/,
    ];

    for (const pattern of patterns) {
      const match = cleanedContent.match(pattern);
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
    this.logger.error(`Cleaned content: ${cleanedContent.substring(0, 300)}`);
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

3. **Click Before Typing** - ⚠️ **CRITICAL**: Before typing text into any field (search bar, input field, text area, etc.), you MUST first click on that field to focus it. Never use "type" action without first clicking on the target field. The system cannot type into unfocused fields.

4. **Verify Every Step** - After each action, take another screenshot and confirm the expected state before continuing.

5. **Efficiency** - Combine related actions when possible. Minimize unnecessary waits.

6. **Stay Within Scope** - Do nothing the user didn't request. Don't suggest unrelated tasks.

────────────────────────
AVAILABLE ACTIONS
────────────────────────

You can perform these actions:

1. **click** - Click on an element
   - Requires: "description" (clear description with location context)
   - ⚠️ **CRITICAL**: Include location details in your description (e.g., "Firefox icon on desktop, top-left area", "search bar in browser window, top center", "Submit button at bottom of form")
   - Location hints: mention the area (top-left, top-right, center, bottom, etc.), the container (desktop, browser window, dialog, etc.), or relative position
   - ⚠️ **TEXT EXTRACTION FOR OCR**: If you need to click on a button, link, menu item, or any element that has visible text written on it, you MUST include the exact text as it appears on screen in your description, and put the text between double quotes "". DO NOT translate or paraphrase the text - use the exact text visible on the element. The quotes help the Position LLM use OCR to find the element precisely by matching the exact text.
   - Examples:
     - Button with text "Submit" → description: "button with text \"Submit\" at bottom of form" or "\"Submit\" button at bottom of form"
     - Button with text "OK" → description: "button with text \"OK\" in dialog, bottom-right" or "\"OK\" button in dialog"
     - Link with text "Login" → description: "link with text \"Login\" in top menu, right side" or "\"Login\" link in top menu"
     - Menu item with text "File" → description: "menu item with text \"File\" in menu bar, top-left" or "\"File\" menu item"
     - Button with text "Cancel" → description: "button with text \"Cancel\" in dialog, bottom-left"
     - Icon without text (e.g., Firefox icon) → description: "Firefox browser icon on desktop, top-left area"
   - Example: {"action": "click", "description": "button with text \"Submit\" at bottom of login form, right side"}

        2. **type** - Type text at the current cursor position
           - ⚠️ **IMPORTANT**: You MUST click on the target field FIRST before using this action. Text can only be typed into focused fields.
           - Workflow: First use "click" action on the field, then use "type" action.
           - Requires: "text" (the text to type)
           - Example workflow: 
             - Step 1: {"action": "click", "description": "search bar"}
             - Step 2: {"action": "type", "text": "Hello World"}

        3. **press_key** - Press a key or key combination (e.g., Enter, Tab, Escape)
           - Requires: "key" (the key name, e.g., "Enter", "Tab", "Escape")
           - Example: {"action": "press_key", "key": "Enter"}
           - Common keys: Enter, Tab, Escape, Space, Backspace, Delete, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Home, End, PageUp, PageDown, F1-F12

        4. **screenshot** - Take a new screenshot to see current state
           - Example: {"action": "screenshot"}

        5. **wait** - Wait a moment (useful after actions that take time)
           - Example: {"action": "wait"}

        6. **done** - Task is complete (only when user's goal is fully met)
           - Example: {"action": "done"}

────────────────────────
RESPONSE FORMAT
────────────────────────

        You MUST respond with valid JSON in this format:
        {
          "action": "click" | "type" | "press_key" | "wait" | "screenshot" | "done",
          "description": "clear description of what to find (required for click actions)",
          "text": "text to type (required for type actions)",
          "key": "key to press (required for press_key actions, e.g., 'Enter', 'Tab', 'Escape')",
          "thinking": "your reasoning about what you see and what to do next (optional)"
        }

        **IMPORTANT**: 
        - Always provide "description" when action is "click"
        - ⚠️ **CRITICAL FOR CLICK DESCRIPTIONS**: 
          * Always include location context (area, container, position). Example: "Firefox icon on desktop, top-left" not just "Firefox icon"
          * **FOR ELEMENTS WITH VISIBLE TEXT**: If the element has text written on it (button, link, menu item, label, etc.), you MUST include the exact text as it appears on screen and put it between double quotes "". DO NOT translate or paraphrase - use the exact text. The quotes are essential for OCR-based detection. Examples:
            - Button showing "Submit" → use "button with text \"Submit\" at bottom of form" or "\"Submit\" button at bottom of form" (NOT "Submit button" or "Soumettre button")
            - Link showing "Login" → use "link with text \"Login\" in top menu" or "\"Login\" link in top menu" (NOT "Login link" or "Connexion link")  
            - Menu item showing "File" → use "menu item with text \"File\"" or "\"File\" menu item" (NOT "File menu item" or "Fichier menu")
            - The quotes around the text make it unambiguous for the Position LLM to find the exact text via OCR
        - Always provide "text" when action is "type"
        - ⚠️ **CRITICAL FOR TYPING**: Before using "type" action, you MUST first use "click" action on the target field to focus it. Never skip this step.
        - Always provide "key" when action is "press_key" (e.g., "Enter" for search bars, "Tab" to navigate, "Escape" to cancel)
        - Only use "done" when the task is COMPLETELY finished
        - Be very specific in descriptions with location context (e.g., "Firefox browser icon on desktop, top-left area" not just "icon" or "Firefox icon")

Remember: **accuracy over speed, clarity over cleverness**. Think before each move, analyze the screenshot carefully, and always verify the result before continuing.`;
  }
}

