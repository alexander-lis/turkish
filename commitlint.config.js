// Типы и scope описаны в CLAUDE.md. Лимит заголовка (100) берётся из config-conventional.
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "refactor", "perf", "test", "docs", "build", "chore"],
    ],
    "scope-enum": [
      2,
      "always",
      ["content", "loader", "words", "api", "ui", "cli", "openspec"],
    ],
    // В теле и футерах длина строк не ограничена: абзац на русском пишется одной строкой.
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};
