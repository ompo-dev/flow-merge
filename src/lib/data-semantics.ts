function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function isSemanticRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const CONTAINER_KEYS = ["payload", "data", "body", "result", "properties"] as const;

export function expandSemanticRecord(record: Record<string, unknown>) {
  const expanded = deepClone(record);
  const queue: Record<string, unknown>[] = [record];
  const visited = new Set<Record<string, unknown>>();

  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    CONTAINER_KEYS.forEach((key) => {
      const nested = current[key];
      if (!isSemanticRecord(nested)) return;

      Object.entries(nested).forEach(([nestedKey, nestedValue]) => {
        if (expanded[nestedKey] === undefined) {
          expanded[nestedKey] = deepClone(nestedValue);
        }
      });

      queue.push(nested);
    });
  }

  return expanded;
}

export function expandSemanticPreview(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => (isSemanticRecord(entry) ? expandSemanticRecord(entry) : entry));
  }

  return isSemanticRecord(value) ? expandSemanticRecord(value) : value;
}
