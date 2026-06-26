// Sanitization and content validation for model-generated explanation text.
//
// Sanitization removes formatting artifacts that should never reach the UI.
// Validation rejects text that violates factual or tonal constraints.
//
// These are intentionally separate steps: sanitize first (length-neutral), then
// validate the clean string. This avoids rejecting text whose only problem was
// a stray asterisk that strips away cleanly.
//
// Both functions are pure and have no I/O — straightforward to unit-test.

// ─── Result type ──────────────────────────────────────────────────────────────

export type TextValidationResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

export interface TextValidationOptions {
  // Hard character limit applied after sanitization. Exceeding it is a reject,
  // not a truncate — a model that returns 600-character sentences isn't
  // following instructions and the whole card should fall back.
  maxLength: number;

  // When true, apply overconfidence checks in addition to the standard set.
  // Low-confidence cards must use hedged language ("may suit", "could work").
  lowConfidence: boolean;
}

// ─── Sanitization ─────────────────────────────────────────────────────────────
//
// Strips formatting artifacts the model may emit despite instructions.
// Returns clean plain text. Never truncates — length is the caller's concern.

export function sanitize(raw: string): string {
  return (
    raw
      // Markdown links: [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Markdown bold: **text** → text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      // Markdown italic: *text* → text  (after bold to avoid partial matches)
      .replace(/\*([^*\n]+)\*/g, "$1")
      // Fenced code blocks: ```lang\ncontent\n``` → content  ([\s\S] avoids s-flag)
      .replace(/```[^\n]*\n?([\s\S]*?)```/g, "$1")
      // Inline code: `text` → text
      .replace(/`([^`\n]+)`/g, "$1")
      // Heading markers: # Title → Title
      .replace(/^#{1,6}\s+/gm, "")
      // Blockquote markers: > text → text
      .replace(/^>\s*/gm, "")
      // Horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // HTML tags
      .replace(/<[^>]+>/g, "")
      // HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Curly/smart quotes → straight
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      // Collapse all whitespace (including newlines left by heading/rule removal)
      .replace(/\s+/g, " ")
      .trim()
  );
}

// ─── Content validation ───────────────────────────────────────────────────────
//
// Validates the sanitized string. Returns ok:false with a reason string when
// the text violates any constraint. The reason is used only for dev logging.

// Facts that were never provided to the model. Any mention is an invention.
const UNSUPPORTED_FACT_PATTERNS: Array<[RegExp, string]> = [
  // Specific prices
  [/₹\s*\d+/, "price figure (₹)"],
  [/\b\d+\s*(INR|Rs\.?)\b/i, "price figure (INR/Rs)"],
  [/\bpriced at\b/i, "invented price claim"],
  [/\b\d+\s*(per night|\/night)\b/i, "nightly price figure"],
  // Availability status
  [/\b(sold out|fully booked|limited availability)\b/i, "availability claim"],
  [/\bfills?\s+up\s+fast\b/i, "availability claim"],
  [/\bbook\s+(early|now|quickly|fast)\b/i, "booking urgency claim"],
  [/\balways\s+(full|booked|sold)\b/i, "always-booked claim"],
  // Ratings and reviews
  [/\b\d(\.\d)?\s*(out of|\/)\s*\d\b/, "numeric rating"],
  [/\b\d[\d,]*\s*(reviews?|ratings?)\b/i, "review count"],
  [/\b(highly|top|well)[- ]rated\b/i, "rating claim"],
  [/\b(great|positive|excellent|amazing)\s+reviews?\b/i, "review claim"],
  // Popularity — not a fact in our data model
  [/\b(popular|well-known|famous|trending)\b/i, "popularity claim"],
  // Soft budget language — implies a price assessment we were never given
  [/\b(affordable|budget-friendly|inexpensive|cheap|great value|value for money|reasonably priced|good deal)\b/i, "implied price claim"],
];

// Overconfidence markers blocked unconditionally — no card should claim certainty
// about things we can only infer from dimension scores.
const ALWAYS_OVERCONFIDENT_PATTERNS: Array<[RegExp, string]> = [
  [/\b(perfect|perfectly)\b/i, "overconfident: perfect"],
  [/\bguaranteed\b/i, "overconfident: guaranteed"],
  // Comparative claims require knowledge we were never given
  [/\bbetter than (most|average|others?|the rest)\b/i, "comparative: better than"],
  [/\bone of the (quieter|calmer|more\s+\w+|best|top)\b/i, "comparative: one of the"],
  [/\bstands?\s+out\b/i, "comparative: stands out"],
  [/\b(your|the)\s+(top|best|strongest|number[\s-]?one)\s+(match|pick|choice|option)\b/i, "comparative: top match claim"],
];

// Overconfidence markers — only checked when lowConfidence is true.
// Low-confidence cards must hedge: "may suit", "could work", "tends toward".
const LOW_CONFIDENCE_OVERCONFIDENT_PATTERNS: Array<[RegExp, string]> = [
  [/\b(ideal|ideally)\b/i, "overconfident: ideal"],
  [/\b(definitely|certainly|absolutely)\b/i, "overconfident: certainty adverb"],
  [/\bwill\s+(suit|match|work|be\s+perfect|be\s+ideal)\b/i, "overconfident: future certainty"],
  [/\bexactly\s+(what|matches|the)\b/i, "overconfident: exact-match claim"],
  [/\b(is|are|'s)\s+(perfect|ideal)\s+(for|match)\b/i, "overconfident: is-perfect"],
];

export function validateText(text: string, opts: TextValidationOptions): TextValidationResult {
  if (text.length > opts.maxLength) {
    return { ok: false, reason: `too long (${text.length} > ${opts.maxLength})` };
  }

  if (text.trim().length === 0) {
    return { ok: false, reason: "empty after sanitization" };
  }

  for (const [pattern, reason] of UNSUPPORTED_FACT_PATTERNS) {
    if (pattern.test(text)) {
      return { ok: false, reason: `unsupported fact — ${reason}` };
    }
  }

  for (const [pattern, reason] of ALWAYS_OVERCONFIDENT_PATTERNS) {
    if (pattern.test(text)) {
      return { ok: false, reason };
    }
  }

  if (opts.lowConfidence) {
    for (const [pattern, reason] of LOW_CONFIDENCE_OVERCONFIDENT_PATTERNS) {
      if (pattern.test(text)) {
        return { ok: false, reason };
      }
    }
  }

  return { ok: true, text };
}

// ─── Combined entry point ─────────────────────────────────────────────────────
//
// Sanitize then validate. This is what the explanation service calls per field.

export function sanitizeAndValidate(raw: string, opts: TextValidationOptions): TextValidationResult {
  const clean = sanitize(raw);
  return validateText(clean, opts);
}
