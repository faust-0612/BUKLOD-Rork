const fs = require('fs');

const target = 'src/components/classroom/ClassroomLiveView.native.tsx';
let source = fs.readFileSync(target, 'utf8');

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: anchor not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: anchor is not unique`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  'student manual media state',
  "  const [sending, setSending] = useState(false);\n  const responseSentFor = useRef<string | null>(null);\n",
  "  const [sending, setSending] = useState(false);\n  const responseSentFor = useRef<string | null>(null);\n  const [manualMedia, setManualMedia] = useState({ micOff: false, cameraOff: false });\n  const lastStudentInteraction = useRef<string | null>(null);\n\n  const studentActive =\n    access.role === 'STUDENT' &&\n    authority.activeUserIds.includes(access.user_id) &&\n    !authority.muteAll &&\n    !authority.ended;\n"
);

replaceOnce(
  'manual override participates in desired media',
  "    const desired = desiredStudentMedia(authority, access.user_id);",
  "    const desired = desiredStudentMedia(authority, access.user_id, manualMedia);"
);

replaceOnce(
  'manual override effect dependencies',
  "  }, [access.role, access.user_id, authority.version, authority.muteAll, authority.ended, call]);\n\n  useEffect(() => {\n    if (access.role !== 'STUDENT' || !authority.interactionId || !authority.activeUserIds.includes(access.user_id)) return;",
  "  }, [access.role, access.user_id, authority.version, authority.muteAll, authority.ended, call, manualMedia]);\n\n  useEffect(() => {\n    if (access.role !== 'STUDENT') return;\n    const interactionId = studentActive ? authority.interactionId : null;\n    if (!studentActive) {\n      lastStudentInteraction.current = null;\n      if (manualMedia.micOff || manualMedia.cameraOff) {\n        setManualMedia({ micOff: false, cameraOff: false });\n      }\n      return;\n    }\n    if (lastStudentInteraction.current !== interactionId) {\n      lastStudentInteraction.current = interactionId;\n      if (manualMedia.micOff || manualMedia.cameraOff) {\n        setManualMedia({ micOff: false, cameraOff: false });\n      }\n    }\n  }, [access.role, authority.interactionId, manualMedia.cameraOff, manualMedia.micOff, studentActive]);\n\n  useEffect(() => {\n    if (access.role !== 'STUDENT' || !authority.interactionId || !authority.activeUserIds.includes(access.user_id)) return;"
);

replaceOnce(
  'student safety toggle handlers',
  "  const randomStudent = () => {\n",
  "  const toggleStudentMicrophone = async () => {\n    if (!call || access.role !== 'STUDENT' || !studentActive) return;\n    const nextOff = !manualMedia.micOff;\n    try {\n      if (nextOff) await call.microphone.disable();\n      else await call.microphone.enable();\n      setManualMedia(current => ({ ...current, micOff: nextOff }));\n    } catch (error) {\n      Alert.alert('Microphone', error instanceof Error ? error.message : 'Could not change the classroom microphone.');\n    }\n  };\n\n  const toggleStudentCamera = async () => {\n    if (!call || access.role !== 'STUDENT' || !studentActive) return;\n    const nextOff = !manualMedia.cameraOff;\n    try {\n      if (nextOff) await call.camera.disable();\n      else await call.camera.enable();\n      setManualMedia(current => ({ ...current, cameraOff: nextOff }));\n    } catch (error) {\n      Alert.alert('Camera', error instanceof Error ? error.message : 'Could not change the classroom camera.');\n    }\n  };\n\n  const randomStudent = () => {\n"
);

replaceOnce(
  'hide generic student cockpit',
  "      <BuklodAcceptedCallContent />",
  "      <BuklodAcceptedCallContent hideControls={access.role === 'STUDENT'} />"
);

replaceOnce(
  'minimal student controls',
  "      {access.role === 'STUDENT' && authority.activeUserIds.includes(access.user_id) && !authority.muteAll && (\n        <View pointerEvents=\"none\" style={styles.calledCue}>\n          <Text style={styles.calledCueTitle}>YOU'RE BEING CALLED</Text>\n          <Text style={styles.calledCueText}>Your classroom mic/camera are active for this interaction. You can still mute or turn camera off immediately.</Text>\n        </View>\n      )}\n\n      {!!breakouts.length && (",
  "      {access.role === 'STUDENT' && authority.activeUserIds.includes(access.user_id) && !authority.muteAll && (\n        <View pointerEvents=\"none\" style={styles.calledCue}>\n          <Text style={styles.calledCueTitle}>YOU'RE BEING CALLED</Text>\n          <Text style={styles.calledCueText}>Your classroom mic/camera are active for this interaction. You can still mute or turn camera off immediately.</Text>\n        </View>\n      )}\n\n      {access.role === 'STUDENT' && (\n        <View style={styles.studentDock}>\n          {studentActive ? (\n            <>\n              <Pressable accessibilityRole=\"button\" accessibilityLabel={manualMedia.micOff ? 'Unmute classroom microphone' : 'Mute classroom microphone'} style={[styles.studentAction, manualMedia.micOff && styles.studentActionOff]} onPress={() => void toggleStudentMicrophone()}>\n                <MaterialCommunityIcons name={manualMedia.micOff ? 'microphone-off' : 'microphone'} size={19} color=\"#fff\" />\n                <Text style={styles.studentActionText}>{manualMedia.micOff ? 'Unmute' : 'Mute'}</Text>\n              </Pressable>\n              <Pressable accessibilityRole=\"button\" accessibilityLabel={manualMedia.cameraOff ? 'Turn classroom camera on' : 'Turn classroom camera off'} style={[styles.studentAction, manualMedia.cameraOff && styles.studentActionOff]} onPress={() => void toggleStudentCamera()}>\n                <MaterialCommunityIcons name={manualMedia.cameraOff ? 'video-off' : 'video'} size={19} color=\"#fff\" />\n                <Text style={styles.studentActionText}>{manualMedia.cameraOff ? 'Camera on' : 'Camera off'}</Text>\n              </Pressable>\n            </>\n          ) : (\n            <View pointerEvents=\"none\" style={styles.listeningPill}>\n              <MaterialCommunityIcons name=\"ear-hearing\" size={16} color=\"#dce9df\" />\n              <Text style={styles.listeningText}>Listening · mic & camera off</Text>\n            </View>\n          )}\n        </View>\n      )}\n\n      {!!breakouts.length && ("
);

replaceOnce(
  'minimal student control styles',
  "  calledCue: { position: 'absolute', top: 96, alignSelf: 'center', maxWidth: '86%', backgroundColor: 'rgba(31,122,63,0.95)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 }, calledCueTitle: { color: '#fff', fontWeight: '900', textAlign: 'center' }, calledCueText: { color: 'rgba(255,255,255,0.88)', fontSize: 10, lineHeight: 14, textAlign: 'center', marginTop: 3 }, breakoutTray: { position: 'absolute', right: 10, top: 94, gap: 6 }, breakoutButton: { backgroundColor: 'rgba(35,69,47,0.94)', borderRadius: 14, paddingHorizontal: 11, paddingVertical: 8 }, breakoutButtonText: { color: '#fff', fontSize: 10, fontWeight: '900' },\n});",
  "  calledCue: { position: 'absolute', top: 96, alignSelf: 'center', maxWidth: '86%', backgroundColor: 'rgba(31,122,63,0.95)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 }, calledCueTitle: { color: '#fff', fontWeight: '900', textAlign: 'center' }, calledCueText: { color: 'rgba(255,255,255,0.88)', fontSize: 10, lineHeight: 14, textAlign: 'center', marginTop: 3 },\n  studentDock: { position: 'absolute', left: 12, right: 12, bottom: 84, minHeight: 46, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, studentAction: { minHeight: 42, borderRadius: 21, paddingHorizontal: 14, backgroundColor: 'rgba(31,122,63,0.94)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, studentActionOff: { backgroundColor: 'rgba(156,48,48,0.94)' }, studentActionText: { color: '#fff', fontSize: 10, fontWeight: '900' }, listeningPill: { minHeight: 38, borderRadius: 19, paddingHorizontal: 13, backgroundColor: 'rgba(15,25,18,0.82)', flexDirection: 'row', alignItems: 'center', gap: 6 }, listeningText: { color: '#dce9df', fontSize: 10, fontWeight: '800' },\n  breakoutTray: { position: 'absolute', right: 10, top: 94, gap: 6 }, breakoutButton: { backgroundColor: 'rgba(35,69,47,0.94)', borderRadius: 14, paddingHorizontal: 11, paddingVertical: 8 }, breakoutButtonText: { color: '#fff', fontSize: 10, fontWeight: '900' },\n});"
);

fs.writeFileSync(target, source);
console.log(`Patched ${target}`);
