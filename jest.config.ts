import type { Config } from 'jest';

const config = {
  preset: 'ts-jest/presets/default-esm',
  collectCoverageFrom: ['packages/*/src/**/*.(js|jsx|ts|tsx)'],
  coveragePathIgnorePatterns: ['/node_modules/', 'packages/example'],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testEnvironmentOptions: {
    url: 'http://localhost/',
  },
  passWithNoTests: true,
} satisfies Config;

export default config;
