import { buildPackShareLink, buildRangeShareLink } from '../lib/shareLink';

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
