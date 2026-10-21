const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('Semgrep JSON security gate', () => {
  const script = path.join(__dirname, '..', 'scripts', 'check-semgrep-result.py');
  const python = spawnSync('python', ['--version'], { encoding: 'utf8' }).status === 0 ? 'python' : 'python3';

  function runGate(payload, options = {}) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beautycare-semgrep-gate-'));
    const jsonPath = path.join(tempDir, 'result.json');
    const summaryPath = path.join(tempDir, 'summary.json');
    const scanned = payload && payload.paths && Array.isArray(payload.paths.scanned)
      ? payload.paths.scanned
      : ['backend/app.js'];
    const expectedTargets = options.expectedTargets || scanned;
    const scopePath = path.join(tempDir, 'expected-targets.txt');
    const configPath = path.join(tempDir, 'invocation.json');
    fs.writeFileSync(scopePath, expectedTargets.join('\n') + (expectedTargets.length ? '\n' : ''), 'utf8');
    fs.writeFileSync(configPath, JSON.stringify({
      ruleset: options.configRuleset || 'p/owasp-top-ten',
      scope_file: 'expected-targets.txt',
      scope_root: 'backend',
      source_extension: '.js',
      excluded_directories: ['backend/tests']
    }), 'utf8');
    if (options.rawText !== undefined) fs.writeFileSync(jsonPath, options.rawText, 'utf8');
    else if (payload !== undefined) fs.writeFileSync(jsonPath, JSON.stringify(payload), 'utf8');
    const result = spawnSync(python, [
      script,
      jsonPath,
      '--expected-scope-file', scopePath,
      '--configuration-file', configPath,
      '--expected-ruleset', 'p/owasp-top-ten',
      '--summary-output', summaryPath
    ], { encoding: 'utf8' });
    const summary = fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, 'utf8')) : null;
    fs.rmSync(tempDir, { recursive: true, force: true });
    return { result, summary };
  }

  function base(overrides = {}) {
    return {
      version: '1.182.0',
      results: [],
      errors: [],
      skipped_rules: [],
      paths: { scanned: ['backend/app.js', 'backend/routes/auth.js'] },
      time: { fixpoint_timeouts: [] },
      ...overrides
    };
  }

  test('valid complete scan passes with exact expected scope', () => {
    const { result, summary } = runGate(base());
    expect(result.status).toBe(0);
    expect(summary).toMatchObject({
      status: 'PASS', gate_passed: true, findings: 0, scanner_errors: 0,
      skipped_rules: 0, fixpoint_timeouts: 0, scanned_targets: 2, expected_targets: 2
    });
  });

  test.each([
    ['findings', base({ results: [{ check_id: 'x', extra: { severity: 'WARNING' } }] }), 'FAIL'],
    ['scanner errors', base({ errors: [{ type: 'parse_error' }] }), 'FAIL'],
    ['fixpoint timeouts', base({ time: { fixpoint_timeouts: [{ error_type: 'Fixpoint timeout' }] } }), 'INCOMPLETE_ANALYSIS']
  ])('fails security policy for %s', (_label, payload, expectedStatus) => {
    const { result, summary } = runGate(payload);
    expect(result.status).toBe(1);
    expect(summary).toMatchObject({ status: expectedStatus, gate_passed: false });
    if (expectedStatus === 'FAIL' && payload.results.length) {
      expect(summary.findings_by_severity).toEqual({ WARNING: 1 });
    }
  });

  test('rejects an empty scan even when the JSON is otherwise valid', () => {
    const { result, summary } = runGate(base({ paths: { scanned: [] } }), { expectedTargets: ['backend/app.js'] });
    expect(result.status).toBe(1);
    expect(summary).toMatchObject({ status: 'EMPTY_SCAN', gate_passed: false, scanned_targets: 0 });
  });

  test('rejects a scan missing an expected target', () => {
    const { result, summary } = runGate(base(), { expectedTargets: ['backend/app.js', 'backend/routes/auth.js', 'backend/routes/payments.js'] });
    expect(result.status).toBe(1);
    expect(summary.status).toBe('INCOMPLETE_SCOPE');
    expect(summary.missing_targets).toEqual(['backend/routes/payments.js']);
  });

  test('accepts legitimate exclusions when the generated expected scope matches', () => {
    const { result, summary } = runGate(base(), { expectedTargets: ['backend/app.js', 'backend/routes/auth.js'] });
    expect(result.status).toBe(0);
    expect(summary.status).toBe('PASS');
  });

  test('accepts an additional JavaScript source when expected scope is regenerated', () => {
    const payload = base({ paths: { scanned: ['backend/app.js', 'backend/routes/auth.js', 'backend/routes/new.js'] } });
    const { result, summary } = runGate(payload, { expectedTargets: ['backend/app.js', 'backend/routes/auth.js', 'backend/routes/new.js'] });
    expect(result.status).toBe(0);
    expect(summary).toMatchObject({ status: 'PASS', scanned_targets: 3, expected_targets: 3 });
  });

  test('rejects invalid field types and skipped-rule metadata', () => {
    const invalid = runGate(base({ results: 'not-an-array' }));
    expect(invalid.result.status).toBe(1);
    expect(invalid.summary.status).toBe('INVALID_EVIDENCE');
    const skipped = runGate(base({ skipped_rules: [{ rule_id: 'broken-rule' }] }));
    expect(skipped.result.status).toBe(1);
    expect(skipped.summary.status).toBe('FAIL');
  });

  test.each([
    ['missing JSON', undefined, undefined, 'INCONCLUSIVE'],
    ['malformed JSON', undefined, '{"results":', 'INCONCLUSIVE'],
    ['missing timeout metadata', base({ time: {} }), undefined, 'INVALID_EVIDENCE'],
    ['invalid timeout metadata', base({ time: { fixpoint_timeouts: null } }), undefined, 'INVALID_EVIDENCE']
  ])('fails closed for %s', (_label, payload, rawText, expectedStatus) => {
    const { result, summary } = runGate(payload, { rawText });
    expect(result.status).toBe(1);
    expect(summary).toMatchObject({ status: expectedStatus, gate_passed: false });
  });

  test('rejects a ruleset configuration mismatch', () => {
    const { result, summary } = runGate(base(), { configRuleset: 'p/security-audit' });
    expect(result.status).toBe(1);
    expect(summary.status).toBe('INCONCLUSIVE');
    expect(summary.issues.join(' ')).toContain('ruleset mismatch');
  });
});
