// Jest setup file
// This file runs before each test file

import "@testing-library/jest-dom";

// Mock Next.js modules that might not be available in test environment
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
  headers: jest.fn(),
}));

// Mock mongoose to avoid database connections in tests
jest.mock('@/lib/db', () => ({
  dbConnect: jest.fn().mockResolvedValue(true),
}));

// Global test timeout
jest.setTimeout(10000);
