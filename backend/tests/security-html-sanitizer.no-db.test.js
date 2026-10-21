const { sanitizeHtml } = require('../utils/security');

describe('HTML sanitizer', () => {
  test('encodes text and attribute metacharacters without changing safe text', () => {
    expect(sanitizeHtml('safe text')).toBe('safe text');
    expect(sanitizeHtml('<img src=x onerror=alert(1)> & "quoted" \'single\''))
      .toBe('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quoted&quot; &#39;single&#39;');
  });

  test('preserves encoded URL data while making ampersands safe for HTML attributes', () => {
    const encodedUrl = '/verify?token=%3Cscript%3E&mode=reset';
    expect(sanitizeHtml(encodedUrl)).toBe('/verify?token=%3Cscript%3E&amp;mode=reset');
  });
});
