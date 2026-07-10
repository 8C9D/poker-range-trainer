import { readFileSync } from 'fs';
import { join } from 'path';

interface EasConfig {
  cli: { version: string; appVersionSource: string };
  build: {
    development: { developmentClient: boolean; distribution: string; ios: { simulator: boolean } };
    preview: { distribution: string };
    production: { autoIncrement: boolean };
  };
  submit: { production: Record<string, unknown> };
}

// Config guard for the EAS build/submit profiles. The actual `eas build` / `eas submit`
// runs are user-action steps; this just asserts the profiles are shaped correctly.
const eas = JSON.parse(readFileSync(join(__dirname, '..', 'eas.json'), 'utf8')) as EasConfig;

describe('eas.json build profiles', () => {
  it('keeps app.json as the version/build-number source', () => {
    expect(eas.cli.appVersionSource).toBe('local');
  });

  it('defines development, preview, and production build profiles', () => {
    expect(eas.build.development).toBeDefined();
    expect(eas.build.preview).toBeDefined();
    expect(eas.build.production).toBeDefined();
  });

  it('builds a simulator dev client and auto-increments the production build', () => {
    expect(eas.build.development.ios.simulator).toBe(true);
    expect(eas.build.production.autoIncrement).toBe(true);
  });

  it('has a production submit profile (Apple credentials are supplied at submit time)', () => {
    expect(eas.submit.production).toBeDefined();
  });
});
