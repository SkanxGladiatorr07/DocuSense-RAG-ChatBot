/**
 * @file services/citationBuilderService.js
 * @description Structured citation and reference generation from retrieved chunks.
 *
 *   Pure transformation service — no database calls, no external APIs.
 *   Converts the array of enriched chunks returned by retrievalService into
 *   two complementary citation structures:
 *
 *   1. citations[]  — one entry per retrieved chunk, in retrieval order.
 *      Each carries a 1-based `citationNumber` for inline `[N]` references
 *      inside the generated answer.
 *
 *   2. references[] — one entry per unique source document, de-duplicated.
 *      Aggregates all chunk-level citation numbers and page numbers that
 *      came from that document, providing a bibliography-style reference list.
 *
 *   CitationResult shape
 *   ────────────────────
 *   {
 *     citations: Array<{
 *       citationNumber : number,        // 1-based (matches [N] in the answer)
 *       chunkId        : string,
 *       chunkIndex     : number,        // 0-based position within source doc
 *       documentId     : string,
 *       documentName   : string,        // sourceDocumentName or fallback
 *       pageNumber     : number|null,   // null when not extractable
 *       score          : number,        // cosine similarity score
 *     }>,
 *     references: Array<{
 *       referenceNumber : number,        // 1-based, order of first appearance
 *       documentId      : string,
 *       documentName    : string,
 *       fileType        : string|null,
 *       uploadedAt      : Date|null,
 *       citedChunks     : Array<{        // all chunks from this doc that were cited
 *         citationNumber : number,
 *         chunkIndex     : number,
 *         pageNumber     : number|null,
 *       }>,
 *       pageNumbers     : number[],      // unique sorted page numbers (omits nulls)
 *     }>,
 *   }
 *
 *   Public API
 *   ──────────
 *   buildCitations(chunks, [options]) → CitationResult
 *   formatInlineCitation(citationNumber) → string          // e.g. "[1]"
 *   formatCitationLabel(citation)       → string          // e.g. "HR_Policy.pdf, p.4"
 */

const AppError = require('../utils/AppError');
const logger   = require('../utils/logger');

// ── Constants ─────────────────────────────────────────────────────────────────

/** Fallback document name when no provenance data exists on a chunk. */
const UNKNOWN_DOCUMENT = 'Unknown Document';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve the best available document name for a retrieved chunk.
 * Priority: chunk snapshot > live document metadata > fallback.
 *
 * @param {object} chunk - Enriched chunk from retrievalService.
 * @returns {string}
 */
const resolveDocumentName = (chunk) =>
  chunk.sourceDocumentName                  ||
  chunk.document?.originalName              ||
  UNKNOWN_DOCUMENT;

/**
 * Resolve the document ID from the chunk or its nested document object.
 *
 * @param {object} chunk
 * @returns {string}
 */
const resolveDocumentId = (chunk) =>
  (chunk.document?.documentId ?? chunk.documentId ?? '').toString();

// ── buildCitations ────────────────────────────────────────────────────────────

/**
 * Build a structured citation list from retrieved chunks.
 *
 * @param {object[]} chunks   - Enriched chunks from retrievalService.retrieve().
 *   Each chunk is expected to have (at minimum):
 *     { chunkId, chunkIndex, score, sourceDocumentName?, pageNumber?,
 *       uploadedAt?, document?: { documentId, originalName, fileType, uploadDate } }
 *
 * @param {object} [options={}]
 * @param {boolean} [options.deduplicateChunks=false]
 *   When true, suppress citations for the same chunkId appearing more than once
 *   (should not happen in normal operation, but defensive for edge cases).
 *
 * @returns {{
 *   citations  : object[],
 *   references : object[],
 * }}
 *
 * @throws {AppError} 400 – chunks is not an array
 */
const buildCitations = (chunks, options = {}) => {
  // ── 1. Input guard ─────────────────────────────────────────────────────────
  if (!Array.isArray(chunks)) {
    throw AppError.badRequest(
      'citationBuilderService.buildCitations: chunks must be an array.'
    );
  }

  const { deduplicateChunks = false } = options;

  if (chunks.length === 0) {
    logger.info('[citationBuilder] No chunks provided — returning empty citation result.');
    return { citations: [], references: [] };
  }

  // ── 2. Build per-chunk citations ──────────────────────────────────────────
  const seenChunkIds  = new Set();
  const citations     = [];
  let   citationNum   = 1;

  for (const chunk of chunks) {
    const chunkId = (chunk.chunkId ?? chunk._id ?? '').toString();

    // Optional de-duplication by chunkId
    if (deduplicateChunks && chunkId && seenChunkIds.has(chunkId)) {
      logger.warn(`[citationBuilder] Duplicate chunkId skipped: ${chunkId}`);
      continue;
    }
    if (chunkId) seenChunkIds.add(chunkId);

    citations.push({
      citationNumber: citationNum++,
      chunkId       : chunkId,
      chunkIndex    : chunk.chunkIndex  ?? null,
      documentId    : resolveDocumentId(chunk),
      documentName  : resolveDocumentName(chunk),
      pageNumber    : chunk.pageNumber  ?? null,
      score         : typeof chunk.score === 'number'
        ? parseFloat(chunk.score.toFixed(6))
        : null,
    });
  }

  // ── 3. Build de-duplicated document references ────────────────────────────
  //
  //   Iterate citations (already ordered by retrieval rank) and group them
  //   by documentId, recording the first-appearance order for referenceNumber.
  //
  const docMap    = new Map();    // documentId → reference object
  let   refNumber = 1;

  for (const citation of citations) {
    const docId = citation.documentId;

    if (!docMap.has(docId)) {
      // First time we see this document — create a reference entry
      const chunk    = chunks[citation.citationNumber - 1] ?? {};
      const docMeta  = chunk.document ?? {};

      docMap.set(docId, {
        referenceNumber: refNumber++,
        documentId     : docId,
        documentName   : citation.documentName,
        fileType       : docMeta.fileType   ?? null,
        uploadedAt     : chunk.uploadedAt   ?? docMeta.uploadDate ?? null,
        citedChunks    : [],
        // pageNumbers assembled after the loop
        _pageNumberSet : new Set(),
      });
    }

    const ref = docMap.get(docId);

    // Append this chunk's citation summary to the reference
    ref.citedChunks.push({
      citationNumber: citation.citationNumber,
      chunkIndex    : citation.chunkIndex,
      pageNumber    : citation.pageNumber,
    });

    // Collect unique non-null page numbers
    if (citation.pageNumber !== null && citation.pageNumber !== undefined) {
      ref._pageNumberSet.add(citation.pageNumber);
    }
  }

  // ── 4. Finalise references ────────────────────────────────────────────────
  const references = Array.from(docMap.values()).map((ref) => {
    const { _pageNumberSet, ...rest } = ref;
    return {
      ...rest,
      pageNumbers: [..._pageNumberSet].sort((a, b) => a - b),
    };
  });

  logger.info(
    `[citationBuilder] Built ${citations.length} citation(s) across ` +
    `${references.length} unique document(s).`
  );

  return { citations, references };
};

// ── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Format a citation number as an inline bracket reference.
 *
 * @param {number} citationNumber
 * @returns {string}  e.g. "[1]", "[3]"
 */
const formatInlineCitation = (citationNumber) => `[${citationNumber}]`;

/**
 * Format a single citation into a short human-readable label.
 * Suitable for footnotes, tooltips, or compact citation lists.
 *
 * @param {{ documentName: string, pageNumber: number|null, chunkIndex: number|null }} citation
 * @returns {string}  e.g. "HR_Policy.pdf, p.4" or "HR_Policy.pdf (chunk 2)"
 */
const formatCitationLabel = (citation) => {
  const name = citation.documentName || UNKNOWN_DOCUMENT;

  if (citation.pageNumber !== null && citation.pageNumber !== undefined) {
    return `${name}, p.${citation.pageNumber}`;
  }

  if (citation.chunkIndex !== null && citation.chunkIndex !== undefined) {
    return `${name} (chunk ${citation.chunkIndex + 1})`;
  }

  return name;
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  buildCitations,
  formatInlineCitation,
  formatCitationLabel,
  // Exposed for testing:
  _resolveDocumentName: resolveDocumentName,
  _resolveDocumentId  : resolveDocumentId,
};
