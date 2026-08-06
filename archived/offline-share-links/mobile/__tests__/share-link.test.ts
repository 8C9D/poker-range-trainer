import {
  buildOfflineRangeLink,
  buildPackShareLink,
  buildRangeShareLink,
  extractSharedRangeHash,
} from '../lib/shareLink';

describe('buildOfflineRangeLink', () => {
  it('carries the encoded range as the range query param', () => {
    const createURL = jest.fn(() => 'link');
    const out = buildOfflineRangeLink(createURL, 'AbC-_123');
    expect(createURL).toHaveBeenCalledWith('/import', { queryParams: { range: 'AbC-_123' } });
    expect(out).toBe('link');
  });
});

describe('extractSharedRangeHash', () => {
  it('reads the payload out of a web share link', () => {
    expect(extractSharedRangeHash('https://example.com/app/#range=AbC123')).toBe('AbC123');
  });

  it('reads the payload out of a native deep link', () => {
    expect(extractSharedRangeHash('pokerrangetrainer://import?range=AbC123')).toBe('AbC123');
  });

  it('percent-decodes an encoded payload', () => {
    expect(extractSharedRangeHash('app://import?range=AbC%2D123')).toBe('AbC-123');
  });

  it('accepts a bare payload and trims surrounding whitespace', () => {
    expect(extractSharedRangeHash('  AbC-_123  ')).toBe('AbC-_123');
  });

  it('returns null for empty input or a link with no payload', () => {
    expect(extractSharedRangeHash('   ')).toBeNull();
    expect(extractSharedRangeHash('https://example.com/app/')).toBeNull();
  });
});

describe('buildRangeShareLink', () => {
  it('requests the /r/:id path with no query for a public share', () => {
    const createURL = jest.fn(() => 'link');
    const out = buildRangeShareLink(createURL, 'abc', null);
    expect(createURL).toHaveBeenCalledWith('/r/abc', undefined);
    expect(out).toBe('link');
  });

  it('passes the secret as a token query param for a private share', () => {
    const createURL = jest.fn(() => 'link');
    buildRangeShareLink(createURL, 'abc', 'secret');
    expect(createURL).toHaveBeenCalledWith('/r/abc', { queryParams: { token: 'secret' } });
  });
});

describe('buildPackShareLink', () => {
  it('requests the /p/:id path with no query for a public pack', () => {
    const createURL = jest.fn(() => 'link');
    buildPackShareLink(createURL, 'abc', null);
    expect(createURL).toHaveBeenCalledWith('/p/abc', undefined);
  });

  it('passes the secret as a token query param for a private pack', () => {
    const createURL = jest.fn(() => 'link');
    buildPackShareLink(createURL, 'abc', 'secret');
    expect(createURL).toHaveBeenCalledWith('/p/abc', { queryParams: { token: 'secret' } });
  });
});
