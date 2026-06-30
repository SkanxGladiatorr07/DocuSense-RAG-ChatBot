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
 *     ▼ citationBuilderService.buildCitations()
 *   citations + references
 *     │
 *     ▼ confidence computation (in-process, zero cost)
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
 *     confidence   : {                // retrieval quality indicator
 *       averageScore    : number,     // mean cosine similarity across chunks
 *       topScore        : number,     // highest individual chunk score
 *       lowestScore     : number,     // lowest individual chunk score
 *       retrievedChunks : number,     // total chunks used for context
 *     } | null,                       // null when no chunks retrieved
 *     chunks       : Array<{          // top-K retrieved chunks (with scores)
 *       chunkId            : string,
 *       chunkIndex         : number,
 *       content            : string,
 *       score              : number,
 *       wordCount          : number,
 *       metadata           : object,
 *       sourceDocumentName : string|null,
 *       pageNumber         : number|null,
 *       uploadedAt         : Date|null,
 *       document           : object,
 *     }>,
 *     sources      : Array<{          // de-duplicated document references
 *       documentId  : string,
 *       originalName: string,
 *       fileType    : string,
 *       uploadDate  : Date,
 *       status      : string,
 *     }>,
 *     citations    : Array<{          // per-chunk inline citations
 *       citationNumber : number,
 *       chunkId        : string,
 *       chunkIndex     : number,
 *       documentId     : string,
 *       documentName   : string,
 *       pageNumber     : number|null,
 *       score          : number,
 *     }>,
 *     references   : Array<{          // de-duplicated bibliography entries
 *       referenceNumber : number,
 *       documentId      : string,
 *       documentName    : string,
 *       fileType        : string|null,
 *       uploadedAt      : Date|null,
 *       citedChunks     : Array<object>,
 *       pageNumbers     : number[],
 *     }>,
 *   }
 */

const { retrieve }         = require('./retrievalService');
const { buildRagPrompt }   = require('./promptBuilderService');
const { generate }         = require('./llmService');
const { buildCitations }   = require('./citationBuilderService');
const AppError             = require('../utils/AppError');
const logger               = require('../utils/logger');

// ── ask ───────────────────────────────────────────────────────────────────────

/**
 * Run the full RAG pipeline for a user question.
 *
 * @param {string} question          - Raw natural language question from the user.
 * @param {object} [options={}]
 * @param {number} [options.topK=5]           - Max chunks to retrieve.
 * @param {string} [options.documentId]       - Restrict retrieval to one document.
 * @param {number} [options.minScore=0]       - Minimum chunk similarity threshold.
 * @param {string} [options.template]         - Prompt template ('standard'|'concise'|'detailed').
 * @param {string} [options.model]            - Override the LLM model.
 * @param {number} [options.maxOutputTokens]  - Override the LLM token ceiling.
 * @param {number} [options.temperature]      - Override the LLM temperature.
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

  // ── 5. Build citations ────────────────────────────────────────────────────
  const { citations, references } = buildCitations(chunks);

  // ── 6. Build de-duplicated sources list ───────────────────────────────────
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

  // ── 7. Compute confidence indicator ───────────────────────────────────────
  // Derived purely from retrieved chunk similarity scores — zero extra cost.
  // averageScore reflects the overall quality of context used for this answer.
  let confidence = null;
  if (chunks.length > 0) {
    const scores = chunks
      .map((c) => c.score)
      .filter((s) => typeof s === 'number' && !Number.isNaN(s));

    if (scores.length > 0) {
      const sum = scores.reduce((acc, s) => acc + s, 0);
      confidence = {
        averageScore   : parseFloat((sum / scores.length).toFixed(6)),
        topScore       : parseFloat(Math.max(...scores).toFixed(6)),
        lowestScore    : parseFloat(Math.min(...scores).toFixed(6)),
        retrievedChunks: chunks.length,
      };
    }
  }

  logger.info(
    `[ragService] Pipeline complete. ` +
    `Answer length: ${generation.text.length} chars | ` +
    `Sources: ${sources.length} document(s) | ` +
    `Citations: ${citations.length} | ` +
    `Confidence (avg): ${confidence?.averageScore ?? 'N/A'} | ` +
    `Finish: ${generation.finishReason}`
  );

  // ── 8. Return shaped result ────────────────────────────────────────────────
  return {
    answer      : generation.text,
    question    : normalisedQuestion,
    model       : generation.model,
    promptTokens: generation.promptTokens,
    outputTokens: generation.outputTokens,
    finishReason: generation.finishReason,
    confidence,
    chunks,
    sources,
    citations,
    references,
  };
};

module.exports = { ask };
