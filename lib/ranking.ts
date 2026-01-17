/**
 * Calculates the Wilson Score and maps it to a Level (0-100).
 */

/**
 * 1. Calculates the Wilson Score Lower Bound.
 * Result is a value between 0 and 1.
 */
export function calculateWilsonScore(upvotes: number, downvotes: number): number {
  const n = upvotes + downvotes;
  if (n === 0) return 0;

  const z = 1.96; // 95% confidence interval
  const phat = upvotes / n;
  
  const score = (phat + z * z / (2 * n) - z * Math.sqrt((phat * (1 - phat) + z * z / (4 * n)) / n)) / (1 + z * z / n);
  return score;
}

/**
 * 2. Maps the Wilson Score to a Level (0-100).
 * Uses a power curve to make higher levels significantly harder to reach.
 * Level 0 = No rank shown.
 */
export function calculateUserLevel(upvotes: number, downvotes: number): number {
  const score = calculateWilsonScore(upvotes, downvotes);
  
  if (score <= 0) return 0;

  // The exponent (3.5) determines the "hardness". 
  // A higher exponent makes reaching Level 100 much harder.
  // We use Math.pow(score, 3.5) * 100 to scale the 0-1 score to 0-100.
  const level = Math.floor(Math.pow(score, 3.5) * 100);

  // Clamp the result between 0 and 100
  return Math.min(Math.max(level, 0), 100);
}

/**
 * Example of how this scales:
 * Wilson Score 0.1  => Level 0
 * Wilson Score 0.5  => Level 8
 * Wilson Score 0.7  => Level 28
 * Wilson Score 0.85 => Level 56
 * Wilson Score 0.95 => Level 83
 * Wilson Score 0.99 => Level 96
 */
