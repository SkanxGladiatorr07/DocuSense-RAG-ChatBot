/**
 * @file services/insightsService.js
 * @description Document Insights service that uses Gemini to analyze text and generate structured insights.
 */

const { Document } = require('../models');
const llmService = require('./llmService');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

/** Maximum character length of text to send to Gemini for insights. */
const MAX_TEXT_LENGTH = 4000;

/**
 * Truncate/select representative text from a large document.
 * Grabs the first half and the last half of the limit to capture intro + outro.
 *
 * @param {string} text - Full document text
 * @returns {string} Representative text
 */
const getRepresentativeText = (text) => {
  if (!text) return '';
  if (text.length <= MAX_TEXT_LENGTH) return text;
  
  const halfLimit = Math.floor(MAX_TEXT_LENGTH / 2);
  const prefix = text.slice(0, halfLimit);
  const suffix = text.slice(-halfLimit);
  return `${prefix}\n\n[... TEXT TRUNCATED FOR INSIGHTS GENERATION ...]\n\n${suffix}`;
};

/**
 * Clean and parse LLM's response into a valid JSON object.
 * Handles potential markdown JSON fences (```json ... ```).
 *
 * @param {string} rawText - Raw generation response
 * @returns {object} Parsed insights object
 */
const parseInsightsJSON = (rawText) => {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
  }
  
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    logger.error(`[insightsService.parseInsightsJSON] JSON parsing failed: ${err.message}. Raw output: ${rawText}`);
    throw AppError.internal('Failed to parse AI-generated document insights.');
  }
};

/**
 * Automatically generate summaries, key topics, dates, keywords, and suggested questions
 * using Gemini, then persist them to the Document model.
 *
 * @param {string} documentId - MongoDB ObjectId of the target document
 * @param {string} userId - MongoDB ObjectId of the document owner
 * @returns {Promise<object>} The updated document's insights
 */
const generateInsights = async (documentId, userId) => {
  logger.info(`[insightsService.generateInsights] Starting insights generation for document: ${documentId}`);

  // 1. Retrieve the document text
  const query = userId ? { _id: documentId, uploadedBy: userId } : { _id: documentId };
  const doc = await Document.findOne(query);
  if (!doc) {
    throw AppError.notFound('Document not found for insights generation.');
  }

  const textToAnalyze = getRepresentativeText(doc.extractedText || '');
  if (!textToAnalyze.trim()) {
    logger.warn(`[insightsService.generateInsights] Document ${documentId} has no text. Saving empty insights.`);
    const emptyInsights = {
      summary: 'This document contains no readable text.',
      detailedSummary: 'No readable text content was found in this document to generate detailed insights.',
      keyTopics: [],
      importantPoints: [],
      importantDates: [],
      keywords: [],
      suggestedQuestions: [],
      insightsGeneratedAt: new Date()
    };
    await Document.updateOne({ _id: documentId }, { $set: emptyInsights });
    return emptyInsights;
  }

  // 2. Build the structured prompt instructing Gemini to return JSON
  const prompt = `You are a professional document analysis assistant. Analyze the document text provided below and extract structured insights.

Your response MUST be a single, valid JSON object with EXACTLY the following keys (do not include any other markdown decoration or text outside the JSON):
{
  "summary": "A concise 3-4 sentence summary of the document.",
  "detailedSummary": "A comprehensive 1-2 paragraph summary of the document, highlighting main points.",
  "keyTopics": ["Topic 1", "Topic 2", ...],
  "importantPoints": ["Key policy, rule, or point 1", "Key policy, rule, or point 2", ...],
  "importantDates": ["Date 1 - Description", ...],
  "keywords": ["Keyword 1", "Keyword 2", ...],
  "suggestedQuestions": ["Suggested question 1", "Suggested question 2", ...]
}

For suggested questions, generate 5 to 8 natural language questions that a user is likely to ask about the uploaded document based on its contents.

Document Text:
"""
${textToAnalyze}
"""

JSON Response:`;

  // 3. Request insights via the Gemini Provider (ensuring we bypass Groq even if it is set as active)
  let responseText;
  try {
    const generation = await llmService._geminiProvider.generate(prompt, {
      model: 'gemini-flash-latest',
      maxOutputTokens: 8192,
      temperature: 0.2,
      responseMimeType: 'application/json',
      thinkingConfig: {
        thinkingBudget: 0
      }
    });
    responseText = generation.text;
  } catch (err) {
    logger.error(`[insightsService.generateInsights] LLM generation failed: ${err.message}`);
    throw new AppError(502, `Insights generation failed: ${err.message}`);
  }

  // 4. Parse the generated JSON
  const insights = parseInsightsJSON(responseText);

  // 5. Build update payload and persist to MongoDB
  const updatePayload = {
    summary: insights.summary || 'Summary unavailable.',
    detailedSummary: insights.detailedSummary || 'Detailed summary unavailable.',
    keyTopics: Array.isArray(insights.keyTopics) ? insights.keyTopics : [],
    importantPoints: Array.isArray(insights.importantPoints) ? insights.importantPoints : [],
    importantDates: Array.isArray(insights.importantDates) ? insights.importantDates : [],
    keywords: Array.isArray(insights.keywords) ? insights.keywords : [],
    suggestedQuestions: Array.isArray(insights.suggestedQuestions) ? insights.suggestedQuestions : [],
    insightsGeneratedAt: new Date()
  };

  await Document.updateOne({ _id: documentId }, { $set: updatePayload });
  logger.info(`[insightsService.generateInsights] Insights successfully saved for document: ${documentId}`);

  return updatePayload;
};

module.exports = {
  generateInsights
};
