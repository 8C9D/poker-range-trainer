import { buildRangeShareLink } from '../lib/shareLink';

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
