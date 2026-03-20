/**
 * Duplicate Issue Detection Utilities
 *
 * Provides strong title normalization (synonym replacement, location-word
 * removal, lowercasing, special-char stripping) and a location-key builder
 * used by the issue-creation API to prevent duplicate reports.
 *
 * No external libraries – pure string logic only.
 */

/* ------------------------------------------------------------------ */
/*  AC synonyms – all map to "ac"                                      */
/* ------------------------------------------------------------------ */
const AC_SYNONYMS: string[] = [
  "air conditioner",
  "air conditioning",
  "a.c.",
  "ac unit",
  "a/c",
];

/* ------------------------------------------------------------------ */
/*  Problem synonyms – all map to "not working"                        */
/* ------------------------------------------------------------------ */
const PROBLEM_SYNONYMS: string[] = [
  "not cooling",
  "cooling issue",
  "not functioning",
  "broken",
  "out of order",
  "doesnt work",
  "doesn't work",
  "does not work",
  "stopped working",
  "malfunctioning",
];

/* ------------------------------------------------------------------ */
/*  Location words to strip from the title                             */
/* ------------------------------------------------------------------ */
const LOCATION_WORDS: string[] = [
  "class",
  "classroom",
  "room",
  "lab",
  "laboratory",
  "hall",
  "building",
  "block",
  "floor",
  "wing",
];

/* ------------------------------------------------------------------ */
/*  Title normalisation                                                */
/* ------------------------------------------------------------------ */

/**
 * Normalise an issue title so that semantically-identical titles
 * produce the exact same string.
 *
 * Steps:
 *  1. Lowercase
 *  2. Replace AC synonyms → "ac"
 *  3. Replace problem synonyms → "not working"
 *  4. Remove location words and any trailing numbers attached to them
 *  5. Strip special characters (keep letters, digits, spaces)
 *  6. Collapse whitespace & trim
 *
 * Examples:
 *   "AC not working"                          → "ac not working"
 *   "Air conditioner not cooling in classroom 223" → "ac not working"
 *   "A.C. broken in lab 304"                  → "ac not working"
 */
export function normalizeTitle(title: string): string {
  let t = title.toLowerCase();

  // 1. Replace AC synonyms (longest-first to avoid partial matches)
  const sortedAC = [...AC_SYNONYMS].sort((a, b) => b.length - a.length);
  for (const syn of sortedAC) {
    const escaped = syn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(escaped, "g"), "ac");
  }

  // 2. Replace problem synonyms (longest-first)
  const sortedProblems = [...PROBLEM_SYNONYMS].sort((a, b) => b.length - a.length);
  for (const syn of sortedProblems) {
    const escaped = syn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(escaped, "g"), "not working");
  }

  // 3. Remove location words (and any number that directly follows, e.g. "room 223")
  for (const word of LOCATION_WORDS) {
    t = t.replace(new RegExp(`\\b${word}\\s*\\d*\\b`, "g"), "");
  }

  // 4. Remove standalone numbers (room numbers, etc.) that remain
  t = t.replace(/\b\d+\b/g, "");

  // 5. Remove filler / noise / profanity words that add no meaning
  const STOP_WORDS = [
    // articles & prepositions
    "in", "the", "of", "at", "on", "is", "a", "an", "my", "our", "its",
    "this", "that", "and", "or", "to", "for", "with", "from", "are", "was",
    "were", "be", "been", "being", "has", "have", "had", "do", "does", "did",
    "but", "if", "so", "very", "just", "about", "also", "still", "please",
    "some", "any", "every", "here", "there", "where", "when", "how", "why",
    "which", "who", "whom", "what", "since", "again", "too", "only",
    // profanity & slang noise
    "fuck", "fucking", "fucked", "shit", "shitty", "damn", "damned",
    "hell", "bloody", "crap", "crappy", "ass", "wtf", "omg", "lol",
    "stupid", "idiot", "dumb", "useless", "terrible", "horrible",
  ];
  const stopPattern = new RegExp(`\\b(${STOP_WORDS.join("|")})\\b`, "g");
  t = t.replace(stopPattern, "");

  // 6. Strip special characters, keep letters digits and spaces
  t = t.replace(/[^a-z0-9 ]/g, "");

  // 7. Collapse whitespace
  t = t.replace(/\s+/g, " ").trim();

  // 8. Sort words alphabetically so word order doesn't matter
  //    "fan not working" and "not working fan" both become "fan not working"
  t = t.split(" ").sort().join(" ");

  return t;
}

/* ------------------------------------------------------------------ */
/*  Word-set similarity (Jaccard index)                                */
/* ------------------------------------------------------------------ */

/**
 * Computes Jaccard similarity between two normalised title strings.
 * Splits each into a word set and returns |intersection| / |union|.
 *
 * Returns 1 when both are identical, 0 when they share no words.
 *
 * Examples:
 *   ("fan not working", "fan not working")       → 1.0
 *   ("fan not working", "fan fucking not working") → 0.75  (after stop-word removal both match)
 *   ("fan not working", "projector not working") → 0.5
 */
export function wordSetSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

/* ------------------------------------------------------------------ */
/*  Location key                                                       */
/* ------------------------------------------------------------------ */

/**
 * The front-end stores location as:
 *   "Building · Room · Area"   (joined by " · ")
 *
 * Build a normalised location key: "<building>_<room>"
 * If room is empty the key is just "<building>_".
 *
 * Examples:
 *   "DEPSTAR CSE · 223 · Ground Floor"  →  "depstar cse_223"
 *   "DEPSTAR CSE"                        →  "depstar cse_"
 */
export function buildLocationKey(location: string): string {
  const parts = location.split("·").map((p) => p.trim().toLowerCase());
  const building = parts[0] || "";
  const room = parts[1] || "";
  return `${building}_${room}`;
}
