const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

// Monorepo root — pnpm stores all packages here
const monorepoRoot = path.resolve(__dirname, '../..');

const config = {
  // Watch the entire monorepo so Metro can follow pnpm symlinks
  watchFolders: [monorepoRoot],

  resolver: {
    // Tell Metro where to find node_modules in a pnpm monorepo
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    // Disable package exports resolution which can conflict with pnpm symlinks
    unstable_enablePackageExports: false,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
