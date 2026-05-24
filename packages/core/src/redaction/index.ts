/**
 * @module redaction
 *
 * FR-039 redaction engine — sanitizes sensitive data from HAR logs, DOM
 * snapshots, and evidence strings before they flow into the emitted JSON
 * artifact or the debug directory.
 *
 * Design constraint: redaction replaces VALUES only, preserving the
 * structural shape of every object so that downstream JSON parsing is
 * unaffected.
 *
 * The CLI defaults to redaction ON; the operator may opt out with
 * `--no-redact`, in which case `meta.redaction = "disabled"` is recorded
 * in the output so the Evaluator agent can detect that sensitive bytes
 * may be present.
 *
 * @see docs/api/core.md
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fixed placeholder that replaces every redacted value. */
export const REDACTED_PLACEHOLDER = '<redacted>';

/**
 * Header-name patterns considered sensitive.
 *
 * Matching is case-insensitive (each regex carries the `i` flag).
 * The patterns cover the header families called out in FR-039:
 *   - Set-Cookie / Cookie
 *   - Authorization
 *   - Any header containing "-csrf-" (e.g. X-CSRF-Token)
 *   - x-api-key
 *   - Any header starting with "x-auth-" (e.g. X-Auth-Token)
 */
export const SENSITIVE_HEADER_PATTERNS: RegExp[] = [
  /^set-cookie$/i,
  /^cookie$/i,
  /^authorization$/i,
  /-csrf-/i,
  /^x-api-key$/i,
  /^x-auth-/i,
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when a header name matches any pattern in
 * {@link SENSITIVE_HEADER_PATTERNS}.
 */
function isSensitiveHeader(name: string): boolean {
  return SENSITIVE_HEADER_PATTERNS.some((pattern) => pattern.test(name));
}

/** HTTP methods whose request bodies are redacted in HAR entries. */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH']);

// ---------------------------------------------------------------------------
// redactHarHeaders
// ---------------------------------------------------------------------------

/**
 * Redacts sensitive header values and write-method request bodies from a
 * HAR 1.2 log object.
 *
 * Specifically:
 * - Replaces the `value` of any request or response header whose name
 *   matches {@link SENSITIVE_HEADER_PATTERNS} with
 *   {@link REDACTED_PLACEHOLDER}.
 * - Replaces `request.postData.text` of entries whose method is POST,
 *   PUT, or PATCH with {@link REDACTED_PLACEHOLDER}.
 *
 * The object is mutated in place and also returned for convenience.
 *
 * @param har - A HAR 1.2 JSON object (`{ log: { entries: [...] } }`).
 *              Typed as `unknown` because callers may pass raw parsed JSON.
 * @returns The same object with sensitive values replaced.
 *
 * @example
 * ```ts
 * const har = JSON.parse(fs.readFileSync('network.har', 'utf-8'));
 * redactHarHeaders(har);
 * // har is now safe to persist or embed in evidence
 * ```
 */
export function redactHarHeaders(har: unknown): unknown {
  // Defensive: if the shape does not match HAR 1.2, return as-is.
  if (!isHarLike(har)) {
    return har;
  }

  const entries: unknown[] = (har as HarLike).log.entries;

  for (const entry of entries) {
    if (!isObject(entry)) continue;

    const req = (entry as Record<string, unknown>).request;
    const res = (entry as Record<string, unknown>).response;

    // --- Request headers ---
    if (isObject(req)) {
      redactHeaders((req as Record<string, unknown>).headers);

      // Redact request body for write methods (POST / PUT / PATCH).
      const method = (req as Record<string, unknown>).method;
      if (typeof method === 'string' && WRITE_METHODS.has(method.toUpperCase())) {
        const postData = (req as Record<string, unknown>).postData;
        if (isObject(postData) && typeof (postData as Record<string, unknown>).text === 'string') {
          (postData as Record<string, unknown>).text = REDACTED_PLACEHOLDER;
        }
      }
    }

    // --- Response headers ---
    if (isObject(res)) {
      redactHeaders((res as Record<string, unknown>).headers);
    }
  }

  return har;
}

// ---------------------------------------------------------------------------
// redactDomSnapshot
// ---------------------------------------------------------------------------

/**
 * Redacts the `value` attribute of sensitive form elements in a DOM
 * snapshot HTML string.
 *
 * Targeted elements (per FR-039):
 * - `<input type="password" …>`
 * - `<input type="email" …>`
 * - `<input type="tel" …>`
 * - Any element with `autocomplete` starting with `"cc-"`
 *
 * Uses regex replacement — the DOM is NOT parsed into a tree. Only the
 * `value="…"` (or `value='…'`) attribute is rewritten; the rest of the
 * tag is left intact so structural shape is preserved.
 *
 * @param html - Raw HTML string of the DOM snapshot.
 * @returns The HTML string with sensitive `value` attributes redacted.
 *
 * @example
 * ```ts
 * const clean = redactDomSnapshot(
 *   '<input type="password" value="s3cret" />'
 * );
 * // '<input type="password" value="<redacted>" />'
 * ```
 */
export function redactDomSnapshot(html: string): string {
  // Match opening tags that contain a sensitive type or autocomplete
  // attribute, then replace their value attribute content.
  //
  // Strategy: find tags that qualify, then within each matched tag
  // replace the value attribute's content.

  // Pattern for input types to redact.
  const sensitiveTypePattern = /type\s*=\s*(?:"(?:password|email|tel)"|'(?:password|email|tel)')/i;
  // Pattern for autocomplete starting with "cc-".
  const ccAutocompletePattern = /autocomplete\s*=\s*(?:"cc-[^"]*"|'cc-[^']*')/i;

  // Match self-closing or regular opening tags. We capture the full tag
  // so we can inspect and rewrite only qualifying ones.
  // This regex matches <input …>, <input … />, or any tag with the
  // qualifying attributes.
  const tagPattern = /<[a-z][a-z0-9]*\b[^>]*>/gi;

  return html.replace(tagPattern, (tag) => {
    const isSensitiveType = sensitiveTypePattern.test(tag);
    const isCcAutocomplete = ccAutocompletePattern.test(tag);

    if (!isSensitiveType && !isCcAutocomplete) {
      return tag;
    }

    // Replace value="…" or value='…' within the matched tag.
    return tag.replace(
      /(\bvalue\s*=\s*)(["'])(.*?)\2/gi,
      `$1$2${REDACTED_PLACEHOLDER}$2`,
    );
  });
}

// ---------------------------------------------------------------------------
// redactEvidenceString
// ---------------------------------------------------------------------------

/**
 * Scans an evidence string for sensitive inline values and replaces them
 * with {@link REDACTED_PLACEHOLDER}.
 *
 * Detected patterns:
 * - Cookie values following `"Cookie:"` or `"Set-Cookie:"`
 * - Authorization header values following `"Authorization:"`
 * - Bearer tokens following `"Bearer "`
 *
 * @param evidence - Raw evidence string from a deterministic check.
 * @returns The evidence string with sensitive values redacted.
 *
 * @example
 * ```ts
 * redactEvidenceString('Cookie: session=abc123; path=/')
 * // 'Cookie: <redacted>'
 * ```
 */
export function redactEvidenceString(evidence: string): string {
  let result = evidence;

  // Redact values following "Cookie:" or "Set-Cookie:" (case-insensitive).
  // The value runs to end-of-line or end-of-string.
  result = result.replace(
    /((?:Set-)?Cookie\s*:\s*).+/gi,
    `$1${REDACTED_PLACEHOLDER}`,
  );

  // Redact values following "Authorization:" (case-insensitive).
  // This also covers "Authorization: Bearer …" in one pass.
  result = result.replace(
    /(Authorization\s*:\s*).+/gi,
    `$1${REDACTED_PLACEHOLDER}`,
  );

  // Redact standalone "Bearer <token>" that may appear without the
  // "Authorization:" prefix (e.g. in logged evidence snippets).
  result = result.replace(
    /(Bearer\s+)\S+/gi,
    `$1${REDACTED_PLACEHOLDER}`,
  );

  return result;
}

// ---------------------------------------------------------------------------
// isRedactionEnabled
// ---------------------------------------------------------------------------

/**
 * Determines whether redaction is enabled for the current run.
 *
 * Redaction is ON by default. It is only disabled when the operator
 * explicitly passes `--no-redact`, which sets `config.redaction` to
 * `false`.
 *
 * @param config - Configuration object; only the `redaction` field is
 *                 inspected.
 * @returns `true` unless `config.redaction` is explicitly `false`.
 *
 * @example
 * ```ts
 * isRedactionEnabled({});               // true
 * isRedactionEnabled({ redaction: true }); // true
 * isRedactionEnabled({ redaction: false }); // false
 * ```
 */
export function isRedactionEnabled(config: { redaction?: boolean }): boolean {
  return config.redaction !== false;
}

// ---------------------------------------------------------------------------
// Private type guards / helpers
// ---------------------------------------------------------------------------

/** Minimal structural type for a HAR 1.2 log. */
interface HarLike {
  log: {
    entries: unknown[];
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isHarLike(value: unknown): value is HarLike {
  if (!isObject(value)) return false;
  const log = (value as Record<string, unknown>).log;
  if (!isObject(log)) return false;
  return Array.isArray((log as Record<string, unknown>).entries);
}

/**
 * Walks an array of `{ name, value }` header objects and redacts values
 * of headers whose name matches {@link SENSITIVE_HEADER_PATTERNS}.
 */
function redactHeaders(headers: unknown): void {
  if (!Array.isArray(headers)) return;

  for (const header of headers) {
    if (
      isObject(header) &&
      typeof (header as Record<string, unknown>).name === 'string' &&
      typeof (header as Record<string, unknown>).value === 'string'
    ) {
      if (isSensitiveHeader((header as Record<string, unknown>).name as string)) {
        (header as Record<string, unknown>).value = REDACTED_PLACEHOLDER;
      }
    }
  }
}
