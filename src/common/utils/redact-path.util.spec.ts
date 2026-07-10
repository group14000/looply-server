import { redactSensitivePath } from './redact-path.util';

describe('redactSensitivePath', () => {
  it('redacts the token segment on the public feedback view route', () => {
    expect(redactSensitivePath('/public/feedback/abcdef0123456789')).toBe(
      '/public/feedback/[redacted]',
    );
  });

  it('redacts the token segment while preserving a trailing sub-path', () => {
    expect(
      redactSensitivePath('/public/feedback/abcdef0123456789/submit'),
    ).toBe('/public/feedback/[redacted]/submit');
  });

  it('leaves unrelated paths untouched', () => {
    expect(redactSensitivePath('/products/abc123')).toBe('/products/abc123');
    expect(redactSensitivePath('/feedback/requests')).toBe(
      '/feedback/requests',
    );
  });
});
