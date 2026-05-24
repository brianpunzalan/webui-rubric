import { describe, it, expect } from 'vitest';
import {
  redactHarHeaders,
  redactDomSnapshot,
  redactEvidenceString,
  isRedactionEnabled,
  REDACTED_PLACEHOLDER,
} from '../../src/redaction/index.js';

describe('redaction engine', () => {
  // =========================================================================
  // redactHarHeaders
  // =========================================================================
  describe('redactHarHeaders', () => {
    function makeHar(entries: unknown[]) {
      return { log: { entries } };
    }

    function makeEntry(
      reqHeaders: Array<{ name: string; value: string }>,
      resHeaders: Array<{ name: string; value: string }>,
      method = 'GET',
      postDataText?: string,
    ) {
      const req: Record<string, unknown> = { method, headers: reqHeaders };
      if (postDataText !== undefined) {
        req.postData = { text: postDataText };
      }
      return { request: req, response: { headers: resHeaders } };
    }

    it('redacts Set-Cookie response header values', () => {
      const har = makeHar([
        makeEntry([], [{ name: 'Set-Cookie', value: 'session=abc123; path=/' }]),
      ]);
      redactHarHeaders(har);
      const headers = (har.log.entries[0] as any).response.headers;
      expect(headers[0].value).toBe(REDACTED_PLACEHOLDER);
    });

    it('redacts Cookie request header values', () => {
      const har = makeHar([makeEntry([{ name: 'Cookie', value: 'sid=xyz' }], [])]);
      redactHarHeaders(har);
      const headers = (har.log.entries[0] as any).request.headers;
      expect(headers[0].value).toBe(REDACTED_PLACEHOLDER);
    });

    it('redacts Authorization request header values', () => {
      const har = makeHar([
        makeEntry([{ name: 'Authorization', value: 'Bearer secret-token' }], []),
      ]);
      redactHarHeaders(har);
      const headers = (har.log.entries[0] as any).request.headers;
      expect(headers[0].value).toBe(REDACTED_PLACEHOLDER);
    });

    it('redacts POST request body', () => {
      const har = makeHar([makeEntry([], [], 'POST', '{"username":"admin","password":"s3cret"}')]);
      redactHarHeaders(har);
      const postData = (har.log.entries[0] as any).request.postData;
      expect(postData.text).toBe(REDACTED_PLACEHOLDER);
    });

    it('redacts PUT request body', () => {
      const har = makeHar([makeEntry([], [], 'PUT', 'body-content')]);
      redactHarHeaders(har);
      const postData = (har.log.entries[0] as any).request.postData;
      expect(postData.text).toBe(REDACTED_PLACEHOLDER);
    });

    it('redacts PATCH request body', () => {
      const har = makeHar([makeEntry([], [], 'PATCH', 'body-content')]);
      redactHarHeaders(har);
      const postData = (har.log.entries[0] as any).request.postData;
      expect(postData.text).toBe(REDACTED_PLACEHOLDER);
    });

    it('preserves non-sensitive headers', () => {
      const har = makeHar([
        makeEntry(
          [{ name: 'Content-Type', value: 'application/json' }],
          [{ name: 'X-Request-Id', value: '12345' }],
        ),
      ]);
      redactHarHeaders(har);
      const reqHeaders = (har.log.entries[0] as any).request.headers;
      const resHeaders = (har.log.entries[0] as any).response.headers;
      expect(reqHeaders[0].value).toBe('application/json');
      expect(resHeaders[0].value).toBe('12345');
    });

    it('does not redact GET request body (no postData)', () => {
      const har = makeHar([makeEntry([], [], 'GET')]);
      redactHarHeaders(har);
      const req = (har.log.entries[0] as any).request;
      expect(req.postData).toBeUndefined();
    });

    it('returns non-HAR input as-is', () => {
      const input = { something: 'else' };
      const result = redactHarHeaders(input);
      expect(result).toBe(input);
    });
  });

  // =========================================================================
  // redactDomSnapshot
  // =========================================================================
  describe('redactDomSnapshot', () => {
    it('redacts password input values', () => {
      const html = '<input type="password" value="s3cret" />';
      const result = redactDomSnapshot(html);
      expect(result).toContain(`value="${REDACTED_PLACEHOLDER}"`);
      expect(result).not.toContain('s3cret');
    });

    it('redacts email input values', () => {
      const html = '<input type="email" value="user@example.com" />';
      const result = redactDomSnapshot(html);
      expect(result).toContain(`value="${REDACTED_PLACEHOLDER}"`);
      expect(result).not.toContain('user@example.com');
    });

    it('redacts tel input values', () => {
      const html = '<input type="tel" value="+1-555-0123" />';
      const result = redactDomSnapshot(html);
      expect(result).toContain(`value="${REDACTED_PLACEHOLDER}"`);
      expect(result).not.toContain('+1-555-0123');
    });

    it('redacts autocomplete=cc-* values', () => {
      const html = '<input autocomplete="cc-number" value="4111111111111111" />';
      const result = redactDomSnapshot(html);
      expect(result).toContain(`value="${REDACTED_PLACEHOLDER}"`);
      expect(result).not.toContain('4111111111111111');
    });

    it('preserves non-sensitive input values', () => {
      const html = '<input type="text" value="hello" />';
      const result = redactDomSnapshot(html);
      expect(result).toContain('value="hello"');
    });

    it('preserves inputs without sensitive type or autocomplete', () => {
      const html = '<input type="number" value="42" />';
      const result = redactDomSnapshot(html);
      expect(result).toContain('value="42"');
    });

    it('handles multiple sensitive inputs in one string', () => {
      const html = '<input type="password" value="pw1" /><input type="email" value="a@b.c" />';
      const result = redactDomSnapshot(html);
      expect(result).not.toContain('pw1');
      expect(result).not.toContain('a@b.c');
    });
  });

  // =========================================================================
  // redactEvidenceString
  // =========================================================================
  describe('redactEvidenceString', () => {
    it('redacts Bearer token values', () => {
      const evidence = 'Token: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig';
      const result = redactEvidenceString(evidence);
      expect(result).toContain(`Bearer ${REDACTED_PLACEHOLDER}`);
      expect(result).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    });

    it('redacts Cookie values', () => {
      const evidence = 'Cookie: session=abc123; path=/';
      const result = redactEvidenceString(evidence);
      expect(result).toContain(`Cookie: ${REDACTED_PLACEHOLDER}`);
      expect(result).not.toContain('session=abc123');
    });

    it('redacts Set-Cookie values', () => {
      const evidence = 'Set-Cookie: id=xyz; HttpOnly';
      const result = redactEvidenceString(evidence);
      expect(result).toContain(`Set-Cookie: ${REDACTED_PLACEHOLDER}`);
      expect(result).not.toContain('id=xyz');
    });

    it('redacts Authorization values', () => {
      const evidence = 'Authorization: Basic dXNlcjpwYXNz';
      const result = redactEvidenceString(evidence);
      expect(result).toContain(`Authorization: ${REDACTED_PLACEHOLDER}`);
      expect(result).not.toContain('dXNlcjpwYXNz');
    });

    it('leaves non-sensitive evidence unchanged', () => {
      const evidence = 'The page loaded in 200ms with 3 errors.';
      const result = redactEvidenceString(evidence);
      expect(result).toBe(evidence);
    });
  });

  // =========================================================================
  // isRedactionEnabled
  // =========================================================================
  describe('isRedactionEnabled', () => {
    it('returns true by default (empty config)', () => {
      expect(isRedactionEnabled({})).toBe(true);
    });

    it('returns true when redaction is explicitly true', () => {
      expect(isRedactionEnabled({ redaction: true })).toBe(true);
    });

    it('returns false when redaction is explicitly false', () => {
      expect(isRedactionEnabled({ redaction: false })).toBe(false);
    });

    it('returns true when redaction is undefined', () => {
      expect(isRedactionEnabled({ redaction: undefined })).toBe(true);
    });
  });
});
