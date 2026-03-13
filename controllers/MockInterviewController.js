import * as leetcode from "../services/leetcodeService.js";
import * as quizApi from "../services/quizApiService.js";
import McqQuestion from "../models/McqQuestion.js";

/**
 * GET /api/mock-interview/problems
 * Query: difficulty, categorySlug, limit, offset
 */
export async function getProblems(req, res) {
  try {
    const { difficulty, categorySlug, limit, offset } = req.query;
    const result = await leetcode.getProblems({
      difficulty: difficulty || undefined,
      categorySlug: categorySlug || undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error || "Failed to fetch problems" });
    }
    res.json({ success: true, problems: result.problems });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to fetch problems" });
  }
}

/**
 * GET /api/mock-interview/problems/:titleSlug
 */
export async function getProblem(req, res) {
  try {
    const { titleSlug } = req.params;
    const result = await leetcode.getProblem(titleSlug);
    if (!result.success) {
      return res.status(result.error === "titleSlug required" ? 400 : 500).json({
        success: false,
        message: result.error || "Failed to fetch problem",
      });
    }
    if (!result.problem) {
      return res.status(404).json({ success: false, message: "Problem not found" });
    }
    res.json({ success: true, problem: result.problem });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to fetch problem" });
  }
}

/**
 * GET /api/mock-interview/daily
 */
export async function getDaily(req, res) {
  try {
    const result = await leetcode.getDailyChallenge();
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error || "Failed to fetch daily" });
    }
    res.json({ success: true, daily: result.daily });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to fetch daily challenge" });
  }
}

/**
 * GET /api/mock-interview/set?easy=1&medium=2&hard=1
 */
export async function getMockSet(req, res) {
  try {
    const easy = parseInt(req.query.easy, 10) || 1;
    const medium = parseInt(req.query.medium, 10) || 2;
    const hard = parseInt(req.query.hard, 10) || 1;
    const result = await leetcode.getMockInterviewSet({ easy, medium, hard });
    res.json({ success: result.success, problems: result.problems, errors: result.errors || [] });
  } catch (err) {
    res.status(500).json({ success: false, problems: [], message: err.message || "Failed to build mock set" });
  }
}

const PASSING_PERCENT = 60;

/**
 * Preferred language enum: must match AuthPage (JavaScript, Python, Java, C++, React, Node.js, Other)
 * and UpdateProfile (javascript, python, java, cpp, react, nodejs, other). Normalized to lowercase
 * with "C++" -> "cpp", "Node.js" -> "nodejs".
 */
const PREFERRED_LANGUAGE_NORMALIZED = {
  javascript: "javascript",
  python: "python",
  java: "java",
  "c++": "cpp",
  cpp: "cpp",
  react: "react",
  "node.js": "nodejs",
  nodejs: "nodejs",
  other: null,
};

const PREFERRED_LANGUAGE_TO_QUIZ_TAG = {
  javascript: "javascript",
  python: "python",
  java: "java",
  cpp: "cpp",
  react: "react",
  nodejs: "nodejs",
};

function preferredLanguageToTag(preferredLanguage) {
  if (!preferredLanguage || !Array.isArray(preferredLanguage) || preferredLanguage.length === 0) return null;
  const raw = String(preferredLanguage[0]).trim().toLowerCase();
  const normalized = PREFERRED_LANGUAGE_NORMALIZED[raw];
  if (normalized == null) return null;
  return PREFERRED_LANGUAGE_TO_QUIZ_TAG[normalized] ?? null;
}

const CATEGORY_TAGS = {
  Programming: ["react", "interview", "frontend", "javascript", "python", "beginner"],
  Database: ["database", "sql", "mongodb", "nosql"],
};

export async function getMcqQuestions(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const categoryOverride = req.query.category;
    const difficulty = req.query.difficulty;

    const category = categoryOverride === "Database" ? "Database" : "Programming";
    const tagsForCategory = CATEGORY_TAGS[category] || CATEGORY_TAGS.Programming;
    const tagFromLanguage = preferredLanguageToTag(req.user?.preferredLanguage);
    const tags = tagFromLanguage
      ? [...new Set([...tagsForCategory, tagFromLanguage])]
      : tagsForCategory;

    const listResult = await quizApi.listQuizzes({
      category,
      difficulty: difficulty || undefined,
      tags: tags.length > 0 ? tags : undefined,
      limit: 20,
      offset: 0,
    });

    if (listResult.success && Array.isArray(listResult.data) && listResult.data.length > 0) {
      const quizzes = listResult.data;
      const quizIndex = quizzes.length > 1 ? Math.floor(Math.random() * quizzes.length) : 0;
      const quiz = quizzes[quizIndex];
      const quizId = quiz.id;
      const questionsResult = await quizApi.getQuizQuestions(quizId, {
        include_answers: true,
      });

      if (questionsResult.success && Array.isArray(questionsResult.data)) {
        const all = (questionsResult.data || []).slice();
        for (let i = all.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [all[i], all[j]] = [all[j], all[i]];
        }
        const rawQuestions = all.slice(0, limit);
        const data = rawQuestions.map((q, idx) => ({
          id: q.id,
          questionText: q.text,
          options: (q.answers || []).map((a) => ({ id: a.id, text: a.text })),
          difficulty: q.difficulty || "EASY",
          category: q.category || category,
          order: idx + 1,
        }));
        return res.json({ data, quizId });
      }
    }

    if (listResult.status === 401) {
      console.log("[getMcqQuestions] Quiz API returned 401 (invalid or missing token). Using local MCQ questions.");
    }

    const filter = { visible: true };
    if (categoryOverride) filter.category = categoryOverride;
    if (difficulty) filter.difficulty = difficulty.toUpperCase();
    const localQuestions = await McqQuestion.aggregate([
      { $match: filter },
      { $sample: { size: Math.min(limit, 50) } },
    ]);

    const data = localQuestions.map((q, idx) => ({
      id: String(q._id),
      questionText: q.questionText,
      options: (q.options || []).map((o) => ({ id: String(o.id), text: o.text })),
      difficulty: (q.difficulty || "EASY").toUpperCase(),
      category: q.category || "general",
      order: q.order ?? idx + 1,
    }));

    res.json({ data, quizId: data.length > 0 ? "local" : null });
  } catch (err) {
    console.error("[getMcqQuestions]", err);
    res.status(500).json({ message: err.message || "Failed to fetch MCQ questions" });
  }
}

/**
 * POST /api/mock-interview/mcq/submit
 * Body: { attemptId?: string, quizId?: string, answers: [{ questionId, selectedOptionId }] }
 * quizId optional when using local questions (GET returns quizId: "local").
 */
export async function submitMcqAttempt(req, res) {
  try {
    const { attemptId: clientAttemptId, quizId, answers } = req.body || {};

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: "answers array is required and must not be empty" });
    }

    const attemptId = clientAttemptId || `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    let results = [];
    let correctCount = 0;

    if (quizId === "local" || !quizId) {
      const questionIds = [...new Set(answers.map((a) => a.questionId))];
      const localQuestions = await McqQuestion.find({
        _id: { $in: questionIds },
        visible: true,
      }).lean();
      const questionMap = new Map(localQuestions.map((q) => [String(q._id), q]));

      for (const a of answers) {
        const q = questionMap.get(a.questionId);
        const correctOption = q?.options?.find((o) => o.isCorrect);
        const correctOptionId = correctOption ? String(correctOption.id) : null;
        const isCorrect = correctOptionId !== null && String(a.selectedOptionId) === correctOptionId;
        if (isCorrect) correctCount++;
        results.push({
          questionId: a.questionId,
          selectedOptionId: a.selectedOptionId ?? null,
          correctOptionId,
          isCorrect,
        });
      }
    } else {
      if (!quizId || typeof quizId !== "string") {
        return res.status(400).json({ message: "quizId is required (from GET mcq/questions)" });
      }
      const questionsResult = await quizApi.getQuizQuestions(quizId, {
        include_answers: true,
      });
      if (!questionsResult.success) {
        const status = questionsResult.status === 429 ? 429 : 500;
        return res
          .status(status)
          .json({ message: questionsResult.error || "Failed to fetch questions for grading" });
      }
      const questions = questionsResult.data || [];
      const questionMap = new Map(questions.map((q) => [q.id, q]));

      for (const a of answers) {
        const q = questionMap.get(a.questionId);
        const correctOption = q?.answers?.find((o) => o.isCorrect);
        const correctOptionId = correctOption?.id ?? null;
        const isCorrect = correctOptionId !== null && a.selectedOptionId === correctOptionId;
        if (isCorrect) correctCount++;
        results.push({
          questionId: a.questionId,
          selectedOptionId: a.selectedOptionId ?? null,
          correctOptionId,
          isCorrect,
        });
      }
    }

    const totalQuestions = results.length;
    const scorePercent = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = scorePercent >= PASSING_PERCENT;

    res.json({
      data: {
        attemptId,
        totalQuestions,
        correctCount,
        scorePercent,
        passed,
        results,
      },
    });
  } catch (err) {
    console.error("[submitMcqAttempt]", err);
    res.status(500).json({ message: err.message || "Failed to submit MCQ attempt" });
  }
}
