/**
 * @file services/promptBuilderService.js
 * @description Structured prompt construction for the RAG generation pipeline.
 *
 *   Accepts a user question and a list of retrieved document chunks, then
 *   assembles a well-structured prompt string that instructs the LLM to:
 *     • Answer exclusively from the provided context.
 *     • Cite which document each piece of information came from.
 *     • Explicitly say the information is unavailable when the context
 *       does not contain an answer — never hallucinate.
 *
 *   Architecture — Template Registry
 *   ──────────────────────────────────
 *   Prompts are built via named template functions stored in TEMPLATES.
 *   Adding a new style (e.g. 'concise', 'multi-turn') means:
 *     1. Write a new template function with the same signature.
 *     2. Register it in TEMPLATES.
 *     3. Pass `template: 'concise'` in options — no callers change.
 *
 *   Public API
 *   ──────────
 *   buildRagPrompt(question, chunks, [options]) → string
 *   listTemplates()                             → string[]
 */

const AppError = require('../utils/AppError');
const logger   = require('../utils/logger');

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum number of chunks to include in a single prompt. */
const MAX_CONTEXT_CHUNKS = 12;

/** Default template name. */
const DEFAULT_TEMPLATE = 'standard';

// ── Context Formatter ─────────────────────────────────────────────────────────

/**
 * Format a single retrieved chunk into a labelled context block.
 *
 * Each block carries:
 *   • A 1-based human-readable index for citation.
 *   • The source document name and file type.
 *   • The raw chunk text.
 *
 * @param {object} chunk      - A result object from retrievalService.
 * @param {number} index      - 1-based position in the context list.
 * @returns {string}
 */
const formatChunkBlock = (chunk, index) => {
  const docName  = chunk.document?.originalName ?? 'Unknown Document';
  const fileType = chunk.document?.fileType     ?? '';
  const typeTag  = fileType ? ` (${fileType.split('/').pop().toUpperCase()})` : '';

  return [
    `Document: ${docName}${typeTag}`,
    `Content: ${chunk.content.trim()}`,
  ].join('\n');
};

/**
 * Build the full context block from an array of retrieved chunks.
 *
 * @param {object[]} chunks   - Array of enriched chunk results.
 * @returns {string}          - Multi-block context string, or a sentinel if empty.
 */
const buildContextBlock = (chunks) => {
  if (!chunks || chunks.length === 0) {
    return '[No relevant context was retrieved from the document store.]';
  }

  return chunks
    .slice(0, MAX_CONTEXT_CHUNKS)
    .map((chunk, i) => formatChunkBlock(chunk, i + 1))
    .join('\n\n---\n\n');
};

// ── Templates ─────────────────────────────────────────────────────────────────
//
//   Each template function receives:
//     question : string   — normalised user question
//     context  : string   — formatted context block (from buildContextBlock)
//   And returns:
//     string              — the complete prompt to pass to the LLM

const TEMPLATES = {

  /**
   * Standard RAG prompt — balanced detail and clarity.
   * Suitable for most question-answering tasks.
   */
  standard: (question, context) => `\
You are DocuSense, an intelligent document assistant. Your role is to answer \
questions accurately and only using the information provided in the CONTEXT \
section below.

STRICT RULES:
1. Base your answer ONLY on the provided context. Do not use any outside \
knowledge or assumptions.
2. If the context does not contain enough information to answer the question, \
respond with exactly: "The information requested is not available in the \
provided documents."
3. When referencing information, cite the source by using the specific document name (e.g. "According to TSLA-Q4-2023-Update.pdf..." or "[TSLA-Q4-2023-Update.pdf]"). Do NOT use generic placeholders like "Source 1" or "Source 2"; refer to the document directly by its filename.
4. Be clear, concise, and factual. Do not fabricate details.
5. If the question is ambiguous, answer for the most likely interpretation \
based on the context.
6. FORMAT your response using clean Markdown:
   - Use **bold** for key terms, names, or important values.
   - Use bullet points or numbered lists where information is listed or enumerated.
   - Use headings (## or ###) only if the answer has multiple distinct sections.
   - Keep prose flowing and readable — do not over-structure short answers.

CONTEXT:
${context}

USER QUESTION:
${question}

ANSWER:`,

  /**
   * Concise prompt — instructs the LLM to keep answers short.
   * Useful for FAQ-style or keyword-lookup queries.
   */
  concise: (question, context) => `\
You are DocuSense, a document assistant. Answer the question below using ONLY \
the provided context. Keep your answer to 2–3 sentences maximum. If the \
context does not contain the answer, say: "This information is not available \
in the provided documents."

CONTEXT:
${context}

QUESTION: ${question}

SHORT ANSWER:`,

  /**
   * Detailed prompt — encourages a structured, comprehensive response.
   * Suitable for complex or multi-part questions.
   */
  detailed: (question, context) => `\
You are DocuSense, an expert document analyst. Provide a thorough, \
well-structured answer to the question below, drawing EXCLUSIVELY from the \
context provided.

Rules:
- Only use information from the CONTEXT section.
- Cite sources using their specific document name (e.g. "[TSLA-Q4-2023-Update.pdf]"). Do NOT use generic placeholders like "[Source 1]".
- If the context is insufficient, state clearly: "The provided documents do \
not contain enough information to answer this question fully."
- Do not speculate or add information from outside the context.
- FORMAT your response in clean Markdown:
  * Use **bold** for key terms, values, dates, and names.
  * Use bullet points (- item) or numbered lists (1. item) wherever information is enumerated.
  * Use ## or ### headings to break up multi-section answers.
  * Keep tables (| col | col |) when comparing multiple items side by side.

CONTEXT:
${context}

QUESTION:
${question}

DETAILED ANSWER:`,

};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a structured LLM prompt from a question and retrieved chunks.
 *
 * @param {string}   question          - The user's natural language question.
 * @param {object[]} chunks            - Enriched chunk results from retrievalService.
 *   Each chunk is expected to have:
 *     { content: string, document: { originalName, fileType } }
 * @param {object}  [options={}]
 * @param {string}  [options.template='standard'] - Template name to use.
 *
 * @returns {string} The complete prompt string ready to pass to llmService.generate().
 *
 * @throws {AppError} 400 – invalid inputs or unknown template name
 */
const buildRagPrompt = (question, chunks, options = {}) => {
  const templateName = options.template || DEFAULT_TEMPLATE;

  // ── 1. Input validation ────────────────────────────────────────────────────
  if (typeof question !== 'string' || !question.trim()) {
    throw AppError.badRequest(
      'promptBuilderService.buildRagPrompt: question must be a non-empty string.'
    );
  }

  if (!Array.isArray(chunks)) {
    throw AppError.badRequest(
      'promptBuilderService.buildRagPrompt: chunks must be an array.'
    );
  }

  if (!TEMPLATES[templateName]) {
    throw AppError.badRequest(
      `promptBuilderService.buildRagPrompt: unknown template "${templateName}". ` +
      `Available templates: ${Object.keys(TEMPLATES).join(', ')}.`
    );
  }

  // ── 2. Build context block ─────────────────────────────────────────────────
  const context = buildContextBlock(chunks);

  logger.info(
    `[promptBuilder] Building "${templateName}" prompt | ` +
    `${chunks.length} chunk(s) | question: "${question.slice(0, 60)}${question.length > 60 ? '…' : ''}"`
  );

  // ── 3. Assemble and return prompt ─────────────────────────────────────────
  const prompt = TEMPLATES[templateName](question.trim(), context);

  logger.info(
    `[promptBuilder] Prompt assembled. Length: ${prompt.length} chars`
  );

  return prompt;
};

/**
 * Returns the list of available template names.
 * Useful for validation in controllers or API documentation.
 *
 * @returns {string[]}
 */
const listTemplates = () => Object.keys(TEMPLATES);

module.exports = {
  buildRagPrompt,
  listTemplates,
  // Exposed for testing:
  _formatChunkBlock: formatChunkBlock,
  _buildContextBlock: buildContextBlock,
};
