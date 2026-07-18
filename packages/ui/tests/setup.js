/**
 * Shared Vitest setup — runs before every test file.
 * FRONTEND_ARCHITECTURE.md §35: extends expect() with jest-dom matchers
 * so no individual test file needs to import them itself.
 */
import '@testing-library/jest-dom/vitest';
