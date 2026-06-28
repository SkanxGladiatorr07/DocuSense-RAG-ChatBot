/**
 * @file services/ragService.js
 * @description RAG (Retrieval-Augmented Generation) orchestration service.
 *
 *   This is the top-level pipeline that wires every RAG stage together.
 *   Controllers call this single function; they never import individual
 *   sub-services directly.
 *
 *   Pipeline
 *   ────────
 *   question
 *     │
 *     ▼ retrievalService.retrieve()
 *   ranked chunks + document metadata
 *     │
 *     ▼ promptBuilderService.buildRagPrompt()
 *   structured LLM prompt
 *     │
 *     ▼ llmService.generate()
 *   generated answer
 *     │
 *     ▼ shape & return
 *   RagResult
 *
 *   Public API
 *   ──────────
 *   ask(question, [options]) → Promise<RagResult>
 *
 *   RagResult shape
 *   ───────────────
 *   {
 *     answer       : string,          // LLM-generated response
 *     question     : string,          // normalised question echoed back
 *     model        : string,          // LLM model that produced the answer
 *     promptTokens : number,
 *     outputTokens : number,
 *     finishReason : string,
 *     chunks       : Array<{          // top-K retrieved chunks (with scores)
 *       chunkId    : string,
 *       chunkIndex : number,
 *       content    : string,
 *       score      : number,
 *       wordCount  : number,
 *       metadata   : object,
 *       document   : object,
 *     }>,
 *     sources      : Array<{          // de-duplicated document references
 *       documentId  : string,
 *       originalName: string,
 *       fileType    : string,
 *       uploadDate  : Date,
 *       status      : string,
 *     }>,
 *   }
 */

const { retrieve }         = require('./retrievalService');
const { buildRagPrompt }   = require('./promptBuilderService');
const { generate }         = require('./llmService');
const AppError             = require('../utils/AppError');
const logger               = require('../utils/logger');

// ── ask ───────────────────────────────────────────────────────────────────────

/**
 * Run the full RAG pipeline for a user question.
 *
 * @param {string} question          - Raw natural language question from the user.
 * @param {object} [options={}]
 * @param {number} [options.topK=5]         - Max chunks to retrieve.
 * @param {string} [options.documentId]     - Restrict retrieval to one document.
 * @param {number} [options.minScore=0]     - Minimum chunk similarity threshold.
 * @param {string} [options.template]       - Prompt template ('standard'|'concise'|'detailed').
 * @param {string} [options.model]          - Override the LLM model.
 * @param {number} [options.maxOutputTokens]- Override the LLM token ceiling.
 * @param {number} [options.temperature]    - Override the LLM temperature.
 *
 * @returns {Promise<RagResult>}
 *
 * @throws {AppError} 400 – invalid question
 * @throws {AppError} 404 – no embedded chunks found
 * @throws {AppError} 502 – Gemini API failure (embedding or generation)
 */
const ask = async (question, options = {}) => {
  // ── 1. Input guard ─────────────────────────────────────────────────────────
  if (typeof question !== 'string' || !question.trim()) {
    throw AppError.badRequest('ragService.ask: question must be a non-empty string.');
  }

  const normalisedQuestion = question.trim();

  logger.info(
    `[ragService] Pipeline started for question: ` +
    `"${normalisedQuestion.slice(0, 80)}${normalisedQuestion.length > 80 ? '…' : ''}"`
  );

  // ── 2. Retrieval ───────────────────────────────────────────────────────────
  logger.info('[ragService] Stage 1/3 — Retrieval');

  const { results: chunks } = await retrieve(normalisedQuestion, {
    topK      : options.topK       ?? 5,
    documentId: options.documentId ?? undefined,
    minScore  : options.minScore   ?? 0,
  });

  logger.info(`[ragService] Retrieved ${chunks.length} chunk(s).`);

  // ── 3. Prompt construction ─────────────────────────────────────────────────
  logger.info('[ragService] Stage 2/3 — Prompt construction');

  const prompt = buildRagPrompt(normalisedQuestion, chunks, {
    template: options.template ?? 'standard',
  });

  // ── 4. LLM generation ──────────────────────────────────────────────────────
  logger.info('[ragService] Stage 3/3 — LLM generation');

  const generation = await generate(prompt, {
    model          : options.model           ?? undefined,
    maxOutputTokens: options.maxOutputTokens ?? undefined,
    temperature    : options.temperature     ?? undefined,
  });

  // ── 5. Build de-duplicated sources list ────────────────────────────────────
  // One entry per unique parent document, preserving first-occurrence order.
  const seenDocIds = new Set();
  const sources = chunks.reduce((acc, chunk) => {
    const docId = chunk.document?.documentId;
    if (docId && !seenDocIds.has(docId)) {
      seenDocIds.add(docId);
      acc.push(chunk.document);
    }
    return acc;
  }, []);

  logger.info(
    `[ragService] Pipeline complete. ` +
    `Answer length: ${generation.text.length} chars | ` +
    `Sources: ${sources.length} document(s) | ` +
    `Finish: ${generation.finishReason}`
  );

  // ── 6. Return shaped result ────────────────────────────────────────────────
  return {
    answer      : generation.text,
    question    : normalisedQuestion,
    model       : generation.model,
    promptTokens: generation.promptTokens,
    outputTokens: generation.outputTokens,
    finishReason: generation.finishReason,
    chunks,
    sources,
  };
};

module.exports = { ask };
