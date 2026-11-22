/**
 * Ranked match selection is server-only. Level 1–20 and rating must originate
 * from the verified character / Diamond ledgers, never a client queue packet.
 * No long-wait bypass crosses a level band or opens unfairly powered matches.
 */
export const RANKED_LEVEL_BANDS = Object.freeze([
  Object.freeze([1, 4]), Object.freeze([5, 8]),
  Object.freeze([9, 12]), Object.freeze([13, 16]),
  Object.freeze([17, 20]),
]);
export const MAX_RATING_SPREAD = 300;

export function verifiedArenaBracket(session) {
  const level=session?.snapshot?.characterLevel;
  const rating=session?.profile?.rating;
  if(!Number.isInteger(level)||level<1||level>20||
     !Number.isSafeInteger(rating)||rating<0||rating>10_000_000)
    throw Error('ranked_bracket_not_verified');
  return Math.floor((level-1)/4);
}

/** Stable oldest-compatible cohort, never mix rating ranges above the cap. */
export function selectFairArenaGroup(bucket,count){
  if(!Number.isInteger(count)||count<2||count>10||bucket.length<count)return null;
  for(let i=0;i<bucket.length;i++){
    const anchor=bucket[i];
    const bracket=verifiedArenaBracket(anchor.session);
    const candidates=[anchor];
    const rating=anchor.session.profile.rating;
    let lo=rating,hi=rating;
    for(let j=i+1;j<bucket.length;j++){
      const item=bucket[j],r=item.session.profile.rating;
      if(verifiedArenaBracket(item.session)!==bracket)continue;
      const nextLo=Math.min(lo,r),nextHi=Math.max(hi,r);
      if(nextHi-nextLo>MAX_RATING_SPREAD)continue;
      candidates.push(item);lo=nextLo;hi=nextHi;
      if(candidates.length===count)return candidates;
    }
  }
  return null;
}
