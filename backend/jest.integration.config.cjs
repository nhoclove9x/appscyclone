const baseConfig = require("./jest.config.cjs");

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  collectCoverageFrom: [],
  testMatch: ["<rootDir>/test/**/*.integration.spec.ts"],
};
