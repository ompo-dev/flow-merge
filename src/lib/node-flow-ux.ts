import type { JSONSchema, JSONSchemaProperty } from "@/lib/flow-types";
import { expandSemanticPreview, isSemanticRecord } from "@/lib/data-semantics";

export interface FlowFieldShortcut {
  path: string;
  label: string;
  type: string;
  sample: string;
  expression: string;
  codeReference: string;
}

export interface ProgrammingRecipe {
  id: string;
  title: string;
  description: string;
  code: string;
  outputTemplate?: string;
}

function formatSample(value: unknown) {
  if (value === null || value === undefined) return "empty";
  if (typeof value === "string") return value.length > 28 ? `${value.slice(0, 28)}...` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.length} item(s)]`;
  if (isSemanticRecord(value)) return "{...}";
  return String(value);
}

function lastSegment(path: string) {
  const segments = path.split(".").filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

function flattenSchemaFields(
  property: JSONSchemaProperty,
  prefix: string,
  fields: Array<{ path: string; type: string }>,
) {
  if (property.type === "object" && property.properties) {
    Object.entries(property.properties).forEach(([key, child]) => {
      flattenSchemaFields(child, prefix ? `${prefix}.${key}` : key, fields);
    });
    return;
  }

  if (property.type === "array" && property.items) {
    fields.push({ path: prefix, type: "array" });
    return;
  }

  if (prefix) {
    fields.push({ path: prefix, type: property.type });
  }
}

function flattenPreviewFields(
  value: unknown,
  prefix: string,
  fields: Map<string, string>,
  depth = 0,
) {
  if (depth > 3 || value === null || value === undefined) return;

  if (Array.isArray(value)) {
    if (prefix && !fields.has(prefix)) fields.set(prefix, formatSample(value));
    const firstItem = value[0];
    if (firstItem !== undefined) {
      flattenPreviewFields(firstItem, prefix ? `${prefix}.0` : "0", fields, depth + 1);
    }
    return;
  }

  if (isSemanticRecord(value)) {
    Object.entries(value).forEach(([key, child]) => {
      flattenPreviewFields(child, prefix ? `${prefix}.${key}` : key, fields, depth + 1);
    });
    return;
  }

  if (prefix && !fields.has(prefix)) {
    fields.set(prefix, formatSample(value));
  }
}

function sortByPath(a: { path: string }, b: { path: string }) {
  const segmentDiff = a.path.split(".").length - b.path.split(".").length;
  if (segmentDiff !== 0) return segmentDiff;
  return a.path.localeCompare(b.path);
}

export function getFlowFieldShortcuts(
  inputSchema?: JSONSchema,
  inputPreview?: unknown,
): FlowFieldShortcut[] {
  const expandedPreview = expandSemanticPreview(inputPreview);
  const schemaFields: Array<{ path: string; type: string }> = [];

  Object.entries(inputSchema?.properties ?? {}).forEach(([key, property]) => {
    flattenSchemaFields(property, key, schemaFields);
  });

  const previewFieldMap = new Map<string, string>();
  flattenPreviewFields(expandedPreview, "", previewFieldMap);

  const combined = new Map<string, FlowFieldShortcut>();

  schemaFields.sort(sortByPath).forEach((field) => {
    combined.set(field.path, {
      path: field.path,
      label: lastSegment(field.path),
      type: field.type,
      sample: previewFieldMap.get(field.path) ?? "sample pending",
      expression: `{{ input.first.${field.path} }}`,
      codeReference: `helpers.pick(payload, "${field.path}")`,
    });
  });

  Array.from(previewFieldMap.entries())
    .sort(([left], [right]) => sortByPath({ path: left }, { path: right }))
    .forEach(([path, sample]) => {
      if (path.endsWith(".0")) return;
      if (!combined.has(path)) {
        combined.set(path, {
          path,
          label: lastSegment(path),
          type: "unknown",
          sample,
          expression: `{{ input.first.${path} }}`,
          codeReference: `helpers.pick(payload, "${path}")`,
        });
      }
    });

  return Array.from(combined.values()).slice(0, 18);
}

function findBestField(
  fields: FlowFieldShortcut[],
  matchers: RegExp[],
  fallback?: (field: FlowFieldShortcut) => boolean,
) {
  return (
    fields.find((field) => matchers.some((matcher) => matcher.test(field.path))) ??
    fields.find((field) => (fallback ? fallback(field) : false)) ??
    null
  );
}

export function buildProgrammingRecipes(
  nodeLabel: string,
  fields: FlowFieldShortcut[],
): ProgrammingRecipe[] {
  const fallbackFields = fields.slice(0, 3);
  const numericField = findBestField(
    fields,
    [/amount/i, /total/i, /value/i, /count/i, /revenue/i, /error/i, /metric/i],
    (field) => field.type === "number",
  );
  const labelField = findBestField(
    fields,
    [/label/i, /name/i, /title/i, /event/i, /source/i, /date/i, /day/i, /nodeLabel/i],
    (field) => field.type === "string",
  );
  const booleanField = findBestField(
    fields,
    [/converted/i, /active/i, /passed/i, /success/i, /error/i, /enabled/i],
    (field) => field.type === "boolean",
  );

  const recipes: ProgrammingRecipe[] = [
    {
      id: "forward-everything",
      title: "Forward everything",
      description: "Passa tudo para frente sem transformação.",
      code: `const payload = input.first ?? {};\n\nreturn {\n  result: payload,\n  summary: \`Forwarded \${input.count} item(s)\`,\n};`,
    },
  ];

  if (fallbackFields.length) {
    recipes.push({
      id: "keep-key-fields",
      title: "Keep key fields",
      description: "Seleciona só os campos mais importantes e já limpa o payload.",
      code: `const payload = input.first ?? {};\n\nreturn {\n  result: {\n${fallbackFields
        .map((field) => `    ${field.label}: ${field.codeReference},`)
        .join("\n")}\n  },\n  summary: "Selected the main fields",\n};`,
    });
  }

  if (numericField) {
    recipes.push({
      id: "prepare-metric",
      title: "Prepare metric value",
      description: "Transforma um número recebido em valor pronto para métrica ou KPI.",
      code: `const payload = input.first ?? {};\nconst value = helpers.toNumber(${numericField.codeReference});\n\nreturn {\n  result: {\n    label: "${nodeLabel}",\n    value,\n    formattedValue: value,\n  },\n  summary: "Prepared a metric value",\n};`,
    });
  }

  if (numericField) {
    const chartLabel = labelField
      ? `String(${labelField.codeReference} ?? "${lastSegment(numericField.path)}")`
      : `"${nodeLabel}"`;
    recipes.push({
      id: "prepare-chart-point",
      title: "Prepare chart point",
      description: "Cria saída pronta para gráfico usando um campo numérico recebido.",
      code: `const payload = input.first ?? {};\nconst value = helpers.toNumber(${numericField.codeReference});\nconst label = ${chartLabel};\n\nreturn {\n  result: {\n    label,\n    value,\n  },\n  summary: "Prepared chart data",\n};`,
    });
  }

  if (booleanField) {
    recipes.push({
      id: "route-true-false",
      title: "Route true or false",
      description: "Usa um campo booleano recebido para decidir o próximo caminho.",
      code: `const payload = input.first ?? {};\nconst passed = helpers.toBoolean(${booleanField.codeReference});\n\nreturn {\n  route: passed ? "true" : "false",\n  result: {\n    ...payload,\n    passed,\n  },\n  summary: passed ? "Condition matched" : "Condition failed",\n};`,
    });
  }

  return recipes;
}

export function buildOutputStory(outputPreview: unknown) {
  const expanded = expandSemanticPreview(outputPreview);
  if (!isSemanticRecord(expanded)) {
    return {
      summary: "This node has not produced a structured output yet.",
      fields: [] as Array<{ key: string; sample: string }>,
    };
  }

  const entries = Object.entries(expanded)
    .slice(0, 6)
    .map(([key, value]) => ({
      key,
      sample: formatSample(value),
    }));

  return {
    summary: entries.length
      ? `This node is currently sending ${entries.length} visible field(s) downstream.`
      : "This node will send data forward after it runs.",
    fields: entries,
  };
}
