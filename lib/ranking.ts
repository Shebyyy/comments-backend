/**
 * Calculates the Wilson Score Lower Bound.
 * This ensures high-quality users with few votes are balanced against 
 * mediocre users with many votes.
 */
export function calculateWilsonScore(upvotes: number, downvotes: number): number {
  const n = upvotes + downvotes;
  if (n === 0) return 0;

  const z = 1.96; // 95% confidence interval
  const phat = upvotes / n;
  
  const score = (phat + z * z / (2 * n) - z * Math.sqrt((phat * (1 - phat) + z * z / (4 * n)) / n)) / (1 + z * z / n);
  return score;
}
