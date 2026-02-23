import * as leetcode from "../services/leetcodeService.js";

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
