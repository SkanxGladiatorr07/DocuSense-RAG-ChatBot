/**
 * @file services/llmService.js
 * @description LLM text generation service using Google's Gemini Developer API.
 *
 *   Converts a structured prompt into a generated text response. Designed
 *   around a provider adapter pattern so the underlying model/vendor can be
 *   swapped without changing any caller.
 *
 *   Architecture
 *   ────────────
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  Caller (e.g. ragService)                                   │
 *   │    └─ llmService.generate(prompt, options)                  │
 *   │         └─ activeProvider.generate(prompt, options)         │
 *   │               └─ geminiProvider  ← current active provider  │
 *   └─────────────────────────────────────────────────────────────┘
 *   To switch providers, add a new provider object and set it as
 *   `activeProvider`. No callers need to change.
 *
 *   Public API
 *   ──────────
 *   generate(prompt, [options]) → Promise<GenerationResult>
 *
 *   GenerationResult shape
 *   ──────────────────────
 *   {
 *     text          : string,   // the generated response text
 *     model         : string,   // the model that produced the response
 *     promptTokens  : number,   // tokens consumed by the prompt (if reported)
 *     outputTokens  : number,   // tokens consumed by the response (if reported)
 *     finishReason  : string,   // e.g. 'STOP', 'MAX_TOKENS'
 *   }
 */

const env    = require('../config/env');
const AppError = require('../utils/AppError');
const logger   = require('../utils/logger');

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default Gemini generation model. */
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * Maximum output tokens for a single generation call.
 * Keeps responses focused for RAG use-cases; callers can override via options.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;

/** Temperature for generation (0 = deterministic, 1 = creative). */
const DEFAULT_TEMPERATURE = 0.2;

// ── Gemini Provider ───────────────────────────────────────────────────────────
//
//   Self-contained adapter. All Gemini-specific logic lives here.
//   Implementing a new provider means creating a similar object with
//   the same `generate(prompt, options)` signature.

const geminiProvider = {
  name: 'gemini',

  /**
   * Call the Gemini generateContent REST endpoint.
   *
   * @param {string} prompt         - The fully-assembled prompt string.
   * @param {object} [options={}]
   * @param {string} [options.model]            - Override the default model.
   * @param {number} [options.maxOutputTokens]  - Override token ceiling.
   * @param {number} [options.temperature]      - Override temperature.
   *
   * @returns {Promise<{
   *   text        : string,
   *   model       : string,
   *   promptTokens: number,
   *   outputTokens: number,
   *   finishReason: string,
   * }>}
   *
   * @throws {AppError} 400 – missing/invalid API key
   * @throws {AppError} 502 – Gemini API HTTP error or network failure
   * @throws {AppError} 500 – unexpected response shape
   */
  async generate(prompt, options = {}) {
    const model          = options.model          || DEFAULT_GEMINI_MODEL;
    const maxOutputTokens = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
    const temperature    = options.temperature    ?? DEFAULT_TEMPERATURE;

    const apiKey = env.geminiApiKey;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      logger.warn('[llmService] GEMINI_API_KEY is missing or set to placeholder. Running in MOCK mode.');
      
      let responseText = "This is a mock response from DocuSense RAG Assistant.\n\nTo see real, grounded answers, please set a valid GEMINI_API_KEY in your backend .env file.";
      if (prompt.includes('CONTEXT') || prompt.includes('document')) {
        responseText = `[Offline Mock Mode] I've analyzed your document corpus. Here is a simulated response based on your question. To get actual grounded AI answers, please configure a valid GEMINI_API_KEY in your backend .env file.`;
      }
      
      return {
        text: responseText,
        model: 'mock-gemini-2.0-flash',
        promptTokens: 12,
        outputTokens: 42,
        finishReason: 'STOP',
      };
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    logger.info(`[llmService] Generating response via Gemini model: ${model}`);

    // ── HTTP request ──────────────────────────────────────────────────────────
    let response;
    try {
      response = await fetch(url, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens,
            temperature,
          },
        }),
      });
    } catch (networkErr) {
      logger.error(`[llmService] Network failure: ${networkErr.message}`);
      throw new AppError(
        502,
        `Failed to reach Gemini API: ${networkErr.message}`
      );
    }

    // ── HTTP error handling ───────────────────────────────────────────────────
    if (!response.ok) {
      let errorBody = '';
      try   { errorBody = await response.text(); }
      catch { errorBody = 'Unable to read response body.'; }

      logger.error(
        `[llmService] Gemini API returned ${response.status}: ${errorBody}`
      );

      let parsedMsg = `Gemini API returned status ${response.status}`;
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed.error?.message) parsedMsg = parsed.error.message;
      } catch { /* keep default */ }

      throw new AppError(502, `Gemini Generation API Failure: ${parsedMsg}`);
    }

    // ── Parse response ────────────────────────────────────────────────────────
    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      logger.error(`[llmService] Failed to parse Gemini JSON response: ${parseErr.message}`);
      throw AppError.internal('Gemini API returned a non-JSON response.');
    }

    // ── Validate response shape ───────────────────────────────────────────────
    const candidate = data.candidates?.[0];
    if (!candidate) {
      logger.error(`[llmService] Unexpected Gemini response shape: ${JSON.stringify(data)}`);
      throw AppError.internal('Gemini API response did not contain any candidates.');
    }

    const text = candidate.content?.parts?.[0]?.text ?? '';
    if (!text) {
      logger.warn('[llmService] Gemini returned an empty text in the candidate part.');
    }

    const usageMeta  = data.usageMetadata   ?? {};
    const finishReason = candidate.finishReason ?? 'UNKNOWN';

    logger.info(
      `[llmService] Generation complete. ` +
      `Finish: ${finishReason} | ` +
      `Prompt tokens: ${usageMeta.promptTokenCount ?? 'N/A'} | ` +
      `Output tokens: ${usageMeta.candidatesTokenCount ?? 'N/A'}`
    );

    return {
      text,
      model,
      promptTokens : usageMeta.promptTokenCount      ?? 0,
      outputTokens : usageMeta.candidatesTokenCount   ?? 0,
      finishReason,
    };
  },
};

const groqProvider = {
  name: 'groq',

  async generate(prompt, options = {}) {
    const model          = options.model          || 'llama-3.3-70b-versatile';
    const maxOutputTokens = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
    const temperature    = options.temperature    ?? DEFAULT_TEMPERATURE;

    const apiKey = env.groqApiKey;
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
      logger.warn('[llmService] GROQ_API_KEY is missing or set to placeholder. Running in MOCK mode.');
      
      let responseText = "This is a mock response from DocuSense RAG Assistant.\n\nTo see real, grounded answers, please set a valid GROQ_API_KEY in your backend .env file.";
      if (prompt.includes('CONTEXT') || prompt.includes('document')) {
        responseText = `[Offline Mock Mode] I've analyzed your document corpus. Here is a simulated response based on your question. To get actual grounded AI answers, please configure a valid GROQ_API_KEY in your backend .env file.`;
      }
      
      return {
        text: responseText,
        model: `mock-${model}`,
        promptTokens: 12,
        outputTokens: 42,
        finishReason: 'STOP',
      };
    }

    logger.info(`[llmService] Generating response via Groq model: ${model}`);

    // ── HTTP request ──────────────────────────────────────────────────────────
    let response;
    try {
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body   : JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxOutputTokens
        }),
      });
    } catch (networkErr) {
      logger.error(`[llmService] Groq API network failure: ${networkErr.message}`);
      throw new AppError(
        502,
        `Failed to reach Groq API: ${networkErr.message}`
      );
    }

    // ── HTTP error handling ───────────────────────────────────────────────────
    if (!response.ok) {
      let errorBody = '';
      try   { errorBody = await response.text(); }
      catch { errorBody = 'Unable to read response body.'; }

      logger.error(
        `[llmService] Groq API returned ${response.status}: ${errorBody}`
      );

      let parsedMsg = `Groq API returned status ${response.status}`;
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed.error?.message) parsedMsg = parsed.error.message;
      } catch { /* keep default */ }

      throw new AppError(502, `Groq Generation API Failure: ${parsedMsg}`);
    }

    // ── Parse response ────────────────────────────────────────────────────────
    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      logger.error(`[llmService] Failed to parse Groq JSON response: ${parseErr.message}`);
      throw AppError.internal('Groq API returned a non-JSON response.');
    }

    // ── Validate response shape ───────────────────────────────────────────────
    const text = data.choices?.[0]?.message?.content ?? '';
    const usage = data.usage || {};

    logger.info(
      `[llmService] Groq generation complete. ` +
      `Prompt tokens: ${usage.prompt_tokens ?? 'N/A'} | ` +
      `Output tokens: ${usage.completion_tokens ?? 'N/A'}`
    );

    return {
      text,
      model,
      promptTokens : usage.prompt_tokens      ?? 0,
      outputTokens : usage.completion_tokens   ?? 0,
      finishReason : data.choices?.[0]?.finish_reason || 'STOP',
    };
  },
};

// ── Active Provider Selection ──────────────────────────────────────────────────
// Automatically select Groq if GROQ_API_KEY is configured and is not placeholder.
// Otherwise, fall back to Gemini.
let activeProvider = geminiProvider;
if (env.groqApiKey && env.groqApiKey !== 'your_groq_api_key_here' && env.groqApiKey.trim() !== '') {
  activeProvider = groqProvider;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a text response for the given prompt using the active LLM provider.
 *
 * @param {string} prompt             - The fully-assembled prompt string.
 * @param {object} [options={}]
 * @param {string} [options.model]            - Override the default model.
 * @param {number} [options.maxOutputTokens]  - Override the output token limit.
 * @param {number} [options.temperature]      - Override generation temperature.
 *
 * @returns {Promise<{
 *   text        : string,
 *   model       : string,
 *   promptTokens: number,
 *   outputTokens: number,
 *   finishReason: string,
 * }>}
 *
 * @throws {AppError} 400 – missing/invalid API key
 * @throws {AppError} 502 – provider HTTP or network error
 * @throws {AppError} 500 – unexpected response shape
 */
const generate = async (prompt, options = {}) => {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw AppError.badRequest('llmService.generate: prompt must be a non-empty string.');
  }

  return activeProvider.generate(prompt.trim(), options);
};

/**
 * Swap the active LLM provider at runtime (useful for testing or multi-tenant setups).
 *
 * @param {{ name: string, generate: Function }} provider
 */
const setProvider = (provider) => {
  if (typeof provider?.generate !== 'function') {
    throw new Error('llmService.setProvider: provider must have a generate() method.');
  }
  logger.info(`[llmService] Switching provider: ${activeProvider.name} → ${provider.name}`);
  activeProvider = provider;
};

/** Returns the name of the currently active provider. */
const getProviderName = () => activeProvider.name;

module.exports = {
  generate,
  setProvider,
  getProviderName,
  // Exposed for testing and future extension:
  _geminiProvider: geminiProvider,
  _groqProvider: groqProvider,
};
