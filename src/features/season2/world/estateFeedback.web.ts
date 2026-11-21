/** Web does not try to start Android native audio, vibrate or interrupt page media. */
import {useCallback,useState} from 'react';
import type {EstateMoment} from './estateFeedback.native';
export type {EstateMoment} from './estateFeedback.native';
export function useEstateFeedback(){
 const [voiceEnabled,setVoiceEnabled]=useState(false);
 const emit=useCallback((_cue:EstateMoment)=>{},[]);
 const toggleVoice=useCallback(()=>setVoiceEnabled(value=>!value),[]);
 return {emit,voiceEnabled,toggleVoice,voiceAvailable:false};
}
