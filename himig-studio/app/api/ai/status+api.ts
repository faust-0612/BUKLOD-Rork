import {configured,json,MODEL} from '../../../src/server/audioAi';
export function GET():Response {
 const ready=configured();
 return json({service:'Himig Studio audio stages',engine:'external-vendor-adapter-v1',provider:MODEL,ready,
  model:'SAM Audio voice/instrument separation',supportedAudio:['audio/wav','audio/mpeg','audio/flac'],
  stages:{
    upload:ready?'AVAILABLE_OWNER_ONLY':'DISABLED',
    stemSeparation:ready?'AVAILABLE_OWNER_ONLY':'NOT_CONFIGURED',
    vocalPitchCorrection:'NOT_IMPLEMENTED',lockedMelodyValidation:'NOT_IMPLEMENTED',
    whisperWordMatch:'NOT_IMPLEMENTED',generativeArranging:'NOT_IMPLEMENTED',
    ownerListening:'REQUIRED'
  },
  privacy:'Selected audio leaves this browser only after explicit consent, and may be retrievable via vendor media URLs; do not upload sensitive songs without reviewing provider retention.',
  billing:'Every external model call can incur paid provider charges; usage must be owner-authorized.',
  done:false
 });
}
