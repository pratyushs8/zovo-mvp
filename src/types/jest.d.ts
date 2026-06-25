// Extends Jest's expect() with @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
// so tsc --noEmit does not error on DOM matcher calls in __tests__ files.
import "@testing-library/jest-dom";
