# Developer Guide

This document provides guidance for developers contributing to the CEPC project.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies: pnpm install
4. Create a branch for your work: git checkout -b feature/your-feature-name
5. Make your changes
6. Run tests: pnpm test
7. Commit your changes: git commit -m 'Add some feature'
8. Push to your fork: git push origin feature/your-feature-name
9. Open a pull request

## Coding Standards

### TypeScript
- Follow the existing code style
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Handle errors appropriately

### C++
- Follow the Google C++ Style Guide
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Handle errors appropriately

## Testing

### Unit Tests
- Write unit tests for new functionality
- Aim for high test coverage
- Test edge cases and error conditions
- Keep tests focused and independent

### Behavioral Tests
- Add test cases for new MFM v3 mechanisms
- Validate against both TypeScript and C++ implementations
- Include golden trajectory tests
- Test deterministic replay functionality

## Build System

### TypeScript Projects
- Uses Vitest for testing
- Uses ESLint and Prettier for linting
- Uses TypeScript compiler for building

### C++ Projects
- Uses CMake for building
- Uses GoogleTest for testing
- Uses clang-format for linting

## Documentation

- Keep documentation up-to-date with code changes
- Add JSDoc comments for TypeScript APIs
- Add comments for complex C++ logic
- Update README files when adding new features
- Follow the existing documentation style

## Git Workflow

- Make small, focused commits
- Write clear commit messages
- Keep your branch up-to-date with main
- Address review comments promptly
- Squash commits before merging if requested

