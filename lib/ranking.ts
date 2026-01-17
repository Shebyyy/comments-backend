/**
 * Calculates the Wilson Score and maps it to a Level (0-100).
 * Factoring in total comments ensures that participation also drives rank.
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
 * 2. Maps quality (Wilson Score) and quantity (Comment Count) to a Level (0-100).
 */
export function calculateUserLevel(upvotes: number, downvotes: number, commentCount: number): number {
  const qualityScore = calculateWilsonScore(upvotes, downvotes);
  
  if (qualityScore <= 0 || commentCount <= 0) return 0;

  /**
   * Participation Factor:
   * We use a logarithmic scale for comments so that going from 1 to 100 comments 
   * helps a lot, but going from 10,000 to 10,100 doesn't break the level system.
   */
  const participationFactor = Math.log10(commentCount + 1) / 3; // Scales roughly 0 to 1 for ~1000 comments
  
  // Combine Quality and Participation
  // Exponent (3.0) ensures Level 100 is very hard to reach.
  const rawLevel = Math.pow(qualityScore, 3.0) * participationFactor * 100;

  // Clamp the result between 0 and 100
  return Math.min(Math.max(Math.floor(rawLevel), 0), 100);
}
