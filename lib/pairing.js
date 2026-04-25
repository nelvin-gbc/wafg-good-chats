// pairing algorithm: greedy random with no-repeats memory.
// inputs: list of participant ids, set of past-pair keys ("a:b" sorted), optional anchor (host id stays in main room when odd).
// outputs: { pairs: [[id1,id2], ...], unpaired: [id] (at most one) }

function pairKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// returns { pairs, unpaired }
export function buildPairs(ids, pastPairs = new Set(), maxAttempts = 50) {
  if (!ids || ids.length < 2) return { pairs: [], unpaired: [...(ids || [])] };

  let best = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const pool = shuffle(ids);
    const pairs = [];
    const used = new Set();
    let conflicts = 0;

    for (let i = 0; i < pool.length; i++) {
      if (used.has(pool[i])) continue;
      let partner = null;
      // find first unused person we haven't paired with
      for (let j = i + 1; j < pool.length; j++) {
        if (used.has(pool[j])) continue;
        if (!pastPairs.has(pairKey(pool[i], pool[j]))) {
          partner = pool[j];
          break;
        }
      }
      // if everyone left has been paired with us, just take the next available
      if (!partner) {
        for (let j = i + 1; j < pool.length; j++) {
          if (!used.has(pool[j])) { partner = pool[j]; conflicts++; break; }
        }
      }
      if (partner) {
        pairs.push([pool[i], partner]);
        used.add(pool[i]);
        used.add(partner);
      }
    }

    const unpaired = pool.filter((id) => !used.has(id));
    const score = conflicts * 10 + unpaired.length;

    if (!best || score < best.score) best = { pairs, unpaired, score };
    if (score === 0) break; // perfect
  }

  return { pairs: best.pairs, unpaired: best.unpaired };
}

// returns who in the unpaired list should rotate (least recently sat out)
export function pickUnpairedPerson(unpaired, sitOutHistory = {}) {
  if (unpaired.length === 0) return null;
  if (unpaired.length === 1) return unpaired[0];
  // person with fewest sit-outs goes last (i.e. pick someone who's already sat out before)
  return unpaired.sort((a, b) => (sitOutHistory[b] || 0) - (sitOutHistory[a] || 0))[0];
}

// for a round, given participant list and history, return a complete plan
export function planRound({ participants, pastPairs, sitOutHistory }) {
  const { pairs, unpaired } = buildPairs(participants, pastPairs);
  const sitOut = pickUnpairedPerson(unpaired, sitOutHistory);
  return { pairs, sitOut };
}
