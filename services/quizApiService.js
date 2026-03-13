import axios from "axios";
import { QUIZ_API_BASE_URL, QUIZ_API_AUTH_HEADER } from "../config/env.js";

const QUIZ_API_MAX_RETRIES = 3;
const QUIZ_API_RETRY_DELAY_MS = 2000;

function getClient() {
  const baseURL = QUIZ_API_BASE_URL ? QUIZ_API_BASE_URL.replace(/\/quizzes\/?$/, "") : "";
  if (!baseURL || !QUIZ_API_AUTH_HEADER) {
    return null;
  }
  return axios.create({
    baseURL: baseURL || undefined,
    headers: {
      Authorization: QUIZ_API_AUTH_HEADER,
      "Content-Type": "application/json",
    },
  });
}

async function requestWithRetry(fn) {
  let lastError;
  for (let attempt = 1; attempt <= QUIZ_API_MAX_RETRIES; attempt++) {
    try {
      const res = await fn();
      return res;
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      if (status === 429 && attempt < QUIZ_API_MAX_RETRIES) {
        const delay = QUIZ_API_RETRY_DELAY_MS * attempt;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * List quizzes.
 * @param {Object} params - { category, difficulty, tags, limit, offset }
 * @returns {{ success: boolean, data?: any[], meta?: any, error?: string }}
 */
export async function listQuizzes(params = {}) {
  const client = getClient();
  if (!client) {
    return { success: false, error: "Quiz API not configured" };
  }
  try {
    const res = await requestWithRetry(() =>
      client.get("/quizzes", {
        params: {
          category: params.category,
          difficulty: params.difficulty,
          tags: params.tags,
          limit: Math.min(Number(params.limit) || 20, 100),
          offset: Number(params.offset) || 0,
        },
      })
    );
    const body = res.data;
    return {
      success: body?.success === true,
      data: body?.data ?? [],
      meta: body?.meta,
      error: body?.success === false ? "Invalid response" : undefined,
    };
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message;
    const error =
      status === 401
        ? "Quiz API authentication failed (check QUIZ_API_TOKEN and QUIZ_API_BASE_URL in .env)"
        : status === 429
          ? "Rate limit exceeded; try again shortly."
          : message;
    return {
      success: false,
      error,
      status,
    };
  }
}

/**
 * Get a single quiz by id.
 * @param {string} quizId
 * @returns {{ success: boolean, data?: object, meta?: any, error?: string }}
 */
export async function getQuiz(quizId) {
  const client = getClient();
  if (!client) {
    return { success: false, error: "Quiz API not configured" };
  }
  if (!quizId) {
    return { success: false, error: "Quiz ID required" };
  }
  try {
    const res = await requestWithRetry(() => client.get(`/quizzes/${encodeURIComponent(quizId)}`));
    const body = res.data;
    return {
      success: body?.success === true,
      data: body?.data,
      meta: body?.meta,
      error: body?.success === false ? "Invalid response" : undefined,
    };
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message;
    return {
      success: false,
      error: status === 429 ? "Rate limit exceeded; try again shortly." : message,
      status,
    };
  }
}

/**
 * Get questions for a quiz (with optional answers).
 * @param {string} quizId
 * @param {{ include_answers?: boolean }} options
 * @returns {{ success: boolean, data?: any[], meta?: any, error?: string }}
 */
export async function getQuizQuestions(quizId, options = {}) {
  const client = getClient();
  if (!client) {
    return { success: false, error: "Quiz API not configured" };
  }
  if (!quizId) {
    return { success: false, error: "Quiz ID required" };
  }
  try {
    const res = await requestWithRetry(() =>
      client.get("/questions", {
        params: {
          quiz_id: quizId,
          include_answers: options.include_answers === true ? "true" : undefined,
        },
      })
    );
    const body = res.data;
    return {
      success: body?.success === true,
      data: body?.data ?? [],
      meta: body?.meta,
      error: body?.success === false ? "Invalid response" : undefined,
    };
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message;
    return {
      success: false,
      error: status === 429 ? "Rate limit exceeded; try again shortly." : message,
      status,
    };
  }
}
