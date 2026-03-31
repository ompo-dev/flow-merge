const BLOCKED_RUNTIME_CODE_RULES = [
  {
    id: "browser-storage",
    pattern: /\b(?:localStorage|sessionStorage|indexedDB)\b/,
    message: "browser storage APIs",
  },
  {
    id: "browser-globals",
    pattern: /\b(?:window|document|navigator|location|history|globalThis|self)\b/,
    message: "browser globals",
  },
  {
    id: "dynamic-eval",
    pattern: /\b(?:eval|Function|constructor|__proto__)\b/,
    message: "dynamic execution escape hatches",
  },
  {
    id: "network",
    pattern: /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/,
    message: "network APIs",
  },
  {
    id: "process",
    pattern: /\b(?:process|require)\b|import\s*\(/,
    message: "process or module APIs",
  },
] as const;

export interface UnsafeUserCodeIssue {
  id: (typeof BLOCKED_RUNTIME_CODE_RULES)[number]["id"];
  message: string;
  match: string;
}

function stripStringsAndComments(code: string) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1 ")
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, "``");
}

export function getUnsafeUserCodeIssues(code: string): UnsafeUserCodeIssue[] {
  const sanitized = stripStringsAndComments(code);

  return BLOCKED_RUNTIME_CODE_RULES.flatMap((rule) => {
    const match = sanitized.match(rule.pattern);
    if (!match?.[0]) return [];

    return [
      {
        id: rule.id,
        message: rule.message,
        match: match[0],
      },
    ];
  });
}

export function assertSafeUserCode(code: string, surfaceLabel: string) {
  const issues = getUnsafeUserCodeIssues(code);
  if (!issues.length) return;

  const summary = issues.map((issue) => issue.message).join(", ");
  throw new Error(`${surfaceLabel} usa capacidades bloqueadas: ${summary}.`);
}
