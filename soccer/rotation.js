// Pure rotation logic (no DOM) so it can be tested in node.
//
// Rules:
//  - Each half has 4 segments (start Q, mid Q, start Q, mid Q).
//  - Players are pooled by position per half; `field[pos]` of them are on the field.
//  - At each swap every benched player comes in (or, if the bench is bigger than the
//    field spots, the longest-benched ones do) and the same number go out.
//  - Players going out are those on the field longest; ties go to whoever has sat least.
//  - `carry` = bench segments already accrued earlier in the game, so kids who sat more
//    in half 1 start on the field in half 2.

function rotateHalf(positions, fieldSpots, assign, playerIds, carry, segments) {
  segments = segments || 4;
  const tot = Object.assign({}, carry);
  const segs = Array.from({ length: segments }, () => ({ field: {}, bench: {}, in: {}, out: {} }));
  for (const pos of positions) {
    const pool = playerIds.filter(p => assign[p] === pos);
    const F = Math.min(fieldSpots[pos] || 0, pool.length);
    pool.forEach(p => { if (tot[p] == null) tot[p] = 0; });
    const order = pool.slice().sort((a, b) => tot[a] - tot[b]); // stable
    let field = order.slice(0, F), bench = order.slice(F);
    const fs = {}, bs = {};
    pool.forEach(p => { fs[p] = 0; bs[p] = 0; });
    const accumulate = () => {
      field.forEach(p => { fs[p]++; bs[p] = 0; });
      bench.forEach(p => { tot[p]++; bs[p]++; fs[p] = 0; });
    };
    for (let s = 0; s < segments; s++) {
      let ins = [], outs = [];
      if (s > 0 && F > 0 && bench.length > 0) {
        ins = bench.slice().sort((a, b) => bs[b] - bs[a] || tot[b] - tot[a]).slice(0, F);
        outs = field.slice().sort((a, b) => fs[b] - fs[a] || tot[a] - tot[b]).slice(0, ins.length);
        field = field.filter(p => !outs.includes(p)).concat(ins);
        bench = bench.filter(p => !ins.includes(p)).concat(outs);
      }
      segs[s].field[pos] = field.slice();
      segs[s].bench[pos] = bench.slice();
      segs[s].in[pos] = ins;
      segs[s].out[pos] = outs;
      accumulate();
    }
  }
  return { segs, tot };
}

function rotateGame(positions, fieldSpots, h1, h2, playerIds) {
  const a = rotateHalf(positions, fieldSpots, h1, playerIds, {});
  const b = rotateHalf(positions, fieldSpots, h2, playerIds, a.tot);
  return { h1: a.segs, h2: b.segs, benchTotal: b.tot };
}

if (typeof module !== 'undefined') module.exports = { rotateHalf, rotateGame };
