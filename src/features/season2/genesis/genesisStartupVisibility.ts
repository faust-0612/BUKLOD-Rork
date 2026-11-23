/** One-way visual-to-audio handoff. The map must never begin audio under startup. */
let openingVisible=true;
const listeners=new Set<()=>void>();
export function isGenesisOpeningVisible(){return openingVisible;}
export function subscribeGenesisOpeningVisible(listener:()=>void){
  listeners.add(listener);
  return()=>{listeners.delete(listener);};
}
export function setGenesisOpeningVisible(visible:boolean){
  if(openingVisible===visible)return;
  openingVisible=visible;
  for(const listener of [...listeners]){
    try{listener();}catch{/* isolate subscribers from launch */}
  }
}
