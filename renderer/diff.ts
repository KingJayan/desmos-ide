export type DiffLine = { op: '=' | '+' | '-'; line: string };

export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const m = a.length, n = b.length;

  // dp[i][j] is the length of the longest common subsequence of a[i…] and b[j…]
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) {
      result.push({ op: '=', line: a[i] }); i++; j++;
    } else if (j < n && (i >= m || dp[i][j + 1] >= (i < m ? dp[i + 1][j] : 0))) {
      result.push({ op: '+', line: b[j] }); j++;
    } else {
      result.push({ op: '-', line: a[i] }); i++;
    }
  }
  return result;
}
