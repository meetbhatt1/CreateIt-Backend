/**
 * Mock interview / LeetCode integration using leetcode-query.
 * No auth required for: problem list, problem detail, daily challenge.
 */

let LeetCodeClass = null;

async function getClient() {
  if (LeetCodeClass) return new LeetCodeClass();
  try {
    const mod = await import("leetcode-query");
    LeetCodeClass = mod.LeetCode ?? mod.default?.LeetCode ?? mod.default;
    if (!LeetCodeClass || typeof LeetCodeClass !== "function") {
      throw new Error("leetcode-query did not export LeetCode");
    }
    return new LeetCodeClass();
  } catch (e) {
    const msg = e.code === "ERR_MODULE_NOT_FOUND" || e.message?.includes("Cannot find package")
      ? "leetcode-query is not installed. Run: npm install leetcode-query"
      : e.message;
    throw new Error(msg);
  }
}

/**
 * Get problem list. Filters: difficulty ('EASY'|'MEDIUM'|'HARD'), category (slug), limit, offset.
 */
export async function getProblems(opts = {}) {
  const { difficulty, categorySlug, limit = 50, offset = 0 } = opts;
  try {
    const lc = await getClient();
    const result = await lc.problems({
      category: categorySlug || "",
      offset: Number(offset) || 0,
      limit: Math.min(Number(limit) || 50, 100),
      filters: difficulty ? { difficulty } : {},
    });
    const list = result?.problemsetQuestionList ?? result;
    const questions = list?.questions ?? (Array.isArray(list) ? list : []);
    const arr = Array.isArray(questions) ? questions : [];
    return { success: true, problems: arr };
  } catch (err) {
    console.error("[leetcode] getProblems error:", err.message);
    return { success: false, problems: [], error: err.message };
  }
}

/**
 * Get a single problem by title slug (e.g. "two-sum").
 */
export async function getProblem(titleSlug) {
  if (!titleSlug || !String(titleSlug).trim()) {
    return { success: false, problem: null, error: "titleSlug required" };
  }
  try {
    const lc = await getClient();
    const slug = String(titleSlug).toLowerCase().replace(/\s+/g, "-");
    const problem = await lc.problem(slug);
    return { success: true, problem: problem ?? null };
  } catch (err) {
    console.error("[leetcode] getProblem error:", err.message);
    return { success: false, problem: null, error: err.message };
  }
}

/**
 * Get today's daily challenge (good for mock interview).
 */
export async function getDailyChallenge() {
  try {
    const lc = await getClient();
    const daily = await lc.daily();
    return { success: true, daily: daily ?? null };
  } catch (err) {
    console.error("[leetcode] getDailyChallenge error:", err.message);
    return { success: false, daily: null, error: err.message };
  }
}

/**
 * Get a random set of problems for a mock interview (e.g. 1 easy, 2 medium, 1 hard).
 */
export async function getMockInterviewSet(options = {}) {
  const { easy = 1, medium = 2, hard = 1 } = options;
  const out = { success: true, problems: [], errors: [] };
  try {
    const fetchSome = async (difficulty, count) => {
      const res = await getProblems({ difficulty, limit: Math.max(count, 50), offset: 0 });
      const list = res.problems ?? [];
      const shuffled = [...list].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    };
    if (easy > 0) {
      const list = await fetchSome("EASY", easy);
      out.problems.push(...list);
    }
    if (medium > 0) {
      const list = await fetchSome("MEDIUM", medium);
      out.problems.push(...list);
    }
    if (hard > 0) {
      const list = await fetchSome("HARD", hard);
      out.problems.push(...list);
    }
    return out;
  } catch (err) {
    console.error("[leetcode] getMockInterviewSet error:", err.message);
    out.success = false;
    out.errors.push(err.message);
    return out;
  }
}
