// Metro config for the Expo app. The shared TypeScript core lives in ../src,
// outside this Expo project root. Expo scopes Metro's file map to the project
// dir, so a plain watchFolders entry for ../src isn't reliably indexed. Instead
// we reach the core through an in-project symlink (mobile/coresrc -> ../src):
// because the symlink lives under the project root, Metro crawls and indexes its
// target as part of the project. The @core/* alias resolves to that symlink path.
const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
// Resolve @core through the in-project symlink (mobile/coresrc -> ../src) so the
// files stay under the project root and Metro indexes them.
const coreRoot = path.resolve(projectRoot, 'coresrc');

const config = getDefaultConfig(projectRoot);

// Monorepo-style setup so Metro can bundle the shared core in ../src: watch the
// repo root, and resolve modules from mobile/node_modules first, then the repo
// root's node_modules.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// watchman is not installed in every environment; force Metro's node filesystem
// crawler so files under the extra watchFolder (../src) are reliably indexed.
config.resolver.useWatchman = false;

// Resolve the `@core/*` alias to ../src/* for the bundler. Expo's Metro does not
// read tsconfig `paths` for targets outside the project root, so map it to a
// concrete source file here. (tsc reads the alias from tsconfig `paths` and Jest
// from `moduleNameMapper`; all three are kept in sync so the same import works
// everywhere.)
const RESOLVE_EXTS = ['ts', 'tsx', 'js', 'jsx', 'json'];

function resolveCoreFile(subpath) {
  const base = path.resolve(coreRoot, subpath);
  const candidates = [
    base,
    ...RESOLVE_EXTS.map((ext) => `${base}.${ext}`),
    ...RESOLVE_EXTS.map((ext) => path.join(base, `index.${ext}`)),
  ];
  return candidates.find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
}

const expoResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@core/')) {
    const filePath = resolveCoreFile(moduleName.slice('@core/'.length));
    if (filePath) {
      return { type: 'sourceFile', filePath };
    }
  }
  return expoResolveRequest
    ? expoResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
