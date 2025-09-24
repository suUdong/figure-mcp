/** @type {import('jest').Config} */
module.exports = {
  // 테스트 환경 설정
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // TypeScript 설정
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  
  // 테스트 파일 패턴
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.ts'
  ],
  
  // 모듈 경로 매핑
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // 커버리지 설정
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // 테스트 파일에서 제외할 경로
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/tests/fixtures/',
    '<rootDir>/tests/integration/'
  ],
  
  // 커버리지에서 제외할 파일
  coveragePathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/tests/',
    '<rootDir>/src/types/',
    '<rootDir>/dist/'
  ],
  
  // 테스트 설정 파일
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.ts'
  ],
  
  // 테스트 타임아웃 (30초)
  testTimeout: 30000,
  
  // 병렬 실행 최적화
  maxWorkers: '50%',
  
  // 모킹 자동 지우기
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true
};
