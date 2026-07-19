const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Treat .dat as a binary asset (not a module)
config.resolver.assetExts.push('dat');

module.exports = config;
