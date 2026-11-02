// Longest increasing subsequence, ported from js-parsons lib/lis.js. The grader
// uses it to find which lines are out of place: the lines left out of the
// longest in-order run are the ones to move.

// Splits a list into decks by patience sorting.
function patienceSort(values: number[]): number[][] {
  if (values.length === 0) return [];
  const decks: number[][] = [[values[0]]];
  let deckPos = 0;
  for (let i = 1; i < values.length; i++) {
    const x = values[i];
    const current = decks[deckPos];
    if (x < current[current.length - 1]) {
      current.push(x);
    } else {
      decks.push([x]);
      deckPos++;
    }
  }
  return decks;
}

// Every longest increasing subsequence that the decks allow.
function findLises(decks: number[][]): number[][] {
  let lises: number[][] = [];
  for (const deck of decks) {
    const next: number[][] = [];
    for (const partial of lises) {
      for (const x of deck) {
        if (x > partial[partial.length - 1]) next.push([...partial, x]);
      }
      next.push(partial);
    }
    for (const x of deck) next.push([x]);
    lises = next;
  }

  const longest = lises.reduce((max, item) => Math.max(max, item.length), 0);
  return lises.filter((item) => item.length >= longest);
}

// The subsequence with the most runs of consecutive values (2 then 3, ...).
// On a tie the last one wins, as the library's underscore 1.1.7 _.max does.
function bestLise(lises: number[][]): number[] {
  let best = lises[0];
  let bestScore = -1;
  for (const item of lises) {
    let score = 0;
    if (item.length > 1) {
      for (let i = 1; i < item.length; i++) {
        if (item[i - 1] === item[i] - 1) score++;
      }
    }
    if (score >= bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

// Indexes of the input that are not part of the best increasing subsequence.
export function outOfOrderIndexes(input: number[]): number[] {
  if (input.length === 0) return [];
  const best = bestLise(findLises(patienceSort(input)));

  const inverse: number[] = [];
  let j = 0;
  for (const value of best) {
    for (; j < input.length; j++) {
      if (input[j] === value) {
        j++;
        break;
      }
      inverse.push(j);
    }
  }
  for (; j < input.length; j++) inverse.push(j);
  return inverse;
}
