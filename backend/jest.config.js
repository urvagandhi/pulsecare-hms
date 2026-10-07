/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "./tsconfig.test.json" }],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  testTimeout: 30000,
  maxWorkers: 2,
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 70,
    }
  }
};
