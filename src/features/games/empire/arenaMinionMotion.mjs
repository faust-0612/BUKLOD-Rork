/** Pure frame-time presentation of source-owned minion positions and actions.
 * No combat, HP, or inventory authority is created here.
 */
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
const clamp=(value,minimum,maximum)=>Math.max(minimum,Math.min(maximum,value));
export function minionMotion(minion,elapsed,index=0){
  const now=finite(elapsed,0),lastMove=finite(minion.lastMoveAt,-1e9),lastPose=finite(minion.poseAt,-1e9);
  const dead=minion.alive===false||minion.hp<=0;
  const actionAge=Math.max(0,now-lastPose),moving=!dead&&minion.pose==='walk'&&now-lastMove<670;
  const step=clamp((now-lastMove)/500,0,1);
  const x=moving?finite(minion.prevX,minion.x)+(minion.x-finite(minion.prevX,minion.x))*step:minion.x;
  const pathY=moving?finite(minion.prevY,minion.y)+(minion.y-finite(minion.prevY,minion.y))*step:minion.y;
  const rhythm=(now+finite(minion.strideOffset,index)*45)/118;
  const stride=moving?Math.sin(rhythm)*23:0;
  const walkingBounce=moving?Math.abs(Math.cos(rhythm))*.25:Math.sin(now/730+index)*.055;
  const attack=!dead&&minion.pose==='attack'&&actionAge<490;
  const heal=!dead&&minion.pose==='heal'&&actionAge<560;
  const hit=!dead&&minion.pose==='hit'&&actionAge<340;
  const lean=dead?Math.min(73,(now-finite(minion.deathAt,now))/800*73):
    hit?Math.sin(actionAge/340*Math.PI)*-10:attack?Math.sin(actionAge/490*Math.PI)*11:moving?3:0;
  const swing=attack?Math.sin(actionAge/490*Math.PI)*-52:moving?Math.sin(rhythm)*10:0;
  const fade=dead?clamp(1-(now-finite(minion.deathAt,now))/900,0,1):1;
  const facing=minion.facing===-1?-1:1;
  return {x,y:pathY-walkingBounce,pose:dead?'death':attack?'attack':heal?'heal':hit?'hit':moving?'walk':'idle',
    moving,attack,heal,hit,dead,lean,swing,stride,facing,fade};
}
