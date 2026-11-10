import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

type Language = 'fil' | 'en';
type Section = null | 'consult' | 'professional' | 'case' | 'review';
type Service = 'HEALTH_ADVICE' | 'PHYSICIAN_CONSULT';
type Kind = 'CLIENT_QUESTION' | 'PROFESSIONAL_ADVICE' | 'CARE_PLAN' | 'FOLLOW_UP' | 'REFERRAL';
type ReviewKind = 'IDENTITY' | 'PROFESSIONAL';
type Identity = {status:string;legal_name:string} | null;
type Professional = {status:string;profession:string;expires_on:string;days_to_expire:number;license_number:string} | null;
type CaseItem = {
  id:string; service:Service; status:string;concern:string;
  professional_name:string|null; professional_role:string|null;
  license_current:boolean;license_number:string|null;client_name:string|null;referral_note:string|null;
};
type QueueItem = {id:string;service:Service;created_at:string};
type ReviewItem = {id:string;name:string;profession?:string;license_number?:string;expires_on?:string};
type Dashboard = {
  identity:Identity;professional:Professional;consultations:CaseItem[];queue:QueueItem[];
  pending_identities:ReviewItem[];pending_professionals:ReviewItem[];admin:boolean;
};
type CaseNote = {id:string;kind:Kind;message:string;mine:boolean;created_at:string};

const GUIDE = {
  redFlags: {
    en: 'Severe chest pain, trouble breathing, signs of stroke, heavy bleeding, loss of consciousness or immediate risk of self-harm?',
    fil: 'May matinding sakit sa dibdib, hirap sa paghinga, palatandaan ng stroke, malakas na pagdurugo, pagkawala ng malay, o agarang panganib sa sarili?',
  },
};
const LIMIT_ERROR = 'Please check your connection and try again. No message was confirmed as saved.';


type HealthButtonProps={label:string;onPress:()=>void;outline?:boolean;disabled?:boolean};
function Button({label,onPress,outline=false,disabled=false}:HealthButtonProps) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({pressed})=>[styles.action,outline&&styles.outline,(pressed||disabled)&&styles.dim]}>
    <Text style={[styles.actionText,outline&&styles.outlineText]}>{label}</Text>
  </Pressable>;
}
function Info({children}:{children:React.ReactNode}) {
  return <Text style={styles.info}>{children}</Text>;
}
type HealthFieldProps={value:string;onChange:(value:string)=>void;placeholder:string;multiline?:boolean};
function Field({value,onChange,placeholder,multiline=false}:HealthFieldProps) {
  return <TextInput style={[styles.input,multiline&&styles.multiline]} value={value}
    onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#718478"
    multiline={multiline} maxLength={multiline?1500:150} autoCorrect={!multiline}/>;
}

export default function BuklodMainHealthCard({
  openStandalone,tileId,externalError=false,
}: {openStandalone:()=>void;tileId:string;externalError?:boolean}) {
  const {user} = useAuth();
  const [language,setLanguage] = useState<Language>('fil');
  const [section,setSection] = useState<Section>(null);
  const [service,setService] = useState<Service>('HEALTH_ADVICE');
  const [storedDash,setDash] = useState<Dashboard|null>(null);
  const [dashUserId,setDashUserId] = useState<string|null>(null);
  // Never show another user's health data on sign-out/account switch.
  const dash = dashUserId===user?.id ? storedDash : null;
  const [loading,setLoading] = useState(false);
  const [busy,setBusy] = useState(false);
  const [backendError,setBackendError] = useState('');
  const [legalName,setLegalName] = useState('');
  const [profession,setProfession] = useState('NURSE');
  const [prcNumber,setPrcNumber] = useState('');
  const [expiresOn,setExpiresOn] = useState('');
  const [concern,setConcern] = useState('');
  const [duration,setDuration] = useState('');
  const [city,setCity] = useState('');
  const [redFlags,setRedFlags] = useState<'unanswered'|'yes'|'no'>('unanswered');
  const [consent,setConsent] = useState(false);
  const [selectedCase,setSelectedCase] = useState<string|null>(null);
  const [caseNotes,setCaseNotes] = useState<CaseNote[]>([]);
  const [notesError,setNotesError] = useState('');
  const [message,setMessage] = useState('');
  const [messageKind,setMessageKind] = useState<Kind>('CLIENT_QUESTION');
  const [reviewMethod,setReviewMethod] = useState('VERIFIED_IN_PERSON');
  const [reviewRef,setReviewRef] = useState('');
  const busyRef=useRef(false);
  // Reuse this identifier when a network timeout leaves server commit uncertain.
  const requestKey=useRef('hc-'+Date.now().toString(36)+'-'+
    Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2));
  const dataGeneration=useRef(0);
  const notesGeneration=useRef(0);
  const caseIdRef=useRef<string|null>(null);
  const t=(en:string,fil:string)=>language==='fil'?fil:en;
  const active=section!==null;
  const caseItem=dash?.consultations?.find(item=>item.id===selectedCase);
  const isProfessional=!!caseItem?.client_name;
  const expiryDays=dash?.professional?.days_to_expire;
  const licenseCurrent=dash?.professional?.status==='VERIFIED' && typeof expiryDays==='number' && expiryDays>=0;

  const load=useCallback(async()=>{
    if(!user?.id){setDash(null);setDashUserId(null);return;}
    const generation=++dataGeneration.current;
    setLoading(true);
    try{
      const {data,error}=await (supabase as any).rpc('buklod_health_card_dashboard_v1');
      if(error)throw error;
      if(generation===dataGeneration.current){
        setDashUserId(user.id);setDash(data as Dashboard);setBackendError('');
      }
    }catch{
      if(generation===dataGeneration.current){
        setDash(null);setDashUserId(null);
        setBackendError(t('Private human consultation is not activated yet.','Hindi pa aktibo ang pribadong konsultasyon sa health professional.'));
      }
    }finally{if(generation===dataGeneration.current)setLoading(false);}
  },[user?.id,language]);
  const openSection=(next:Exclude<Section,null>)=>{
    setSection(next);setSelectedCase(null);caseIdRef.current=null;notesGeneration.current+=1;
    setCaseNotes([]);setNotesError('');setMessage('');setBackendError('');
    if(user?.id)void load();
  };
  useEffect(()=>()=>{dataGeneration.current+=1;notesGeneration.current+=1;},[]);
  useEffect(()=>{setCaseNotes([]);setSelectedCase(null);caseIdRef.current=null;
    notesGeneration.current+=1;},[user?.id]);
  const run=async(action:()=>Promise<void>)=>{
    if(busyRef.current)return;
    busyRef.current=true;setBusy(true);
    try{await action();}
    catch(e:any){Alert.alert(t('Could not complete','Hindi nakumpleto'),String(e?.message||LIMIT_ERROR));}
    finally{busyRef.current=false;setBusy(false);}
  };
  const rpc=async(name:string,args?:Record<string,unknown>)=>{
    const result=await (supabase as any).rpc(name,args);
    if(result.error)throw result.error;
    return result.data;
  };

  const registerIdentity=()=>void run(async()=>{
    if(legalName.trim().length<5){Alert.alert(t('Legal name required','Kailangan ang buong legal na pangalan'));return;}
    await rpc('buklod_health_card_register_identity_v1',{p_legal_name:legalName.trim()});
    setLegalName('');await load();
    Alert.alert(t('Verification requested','Naipadala para sa beripikasyon'),
      t('A qualified reviewer must verify your legal identity independently. Do not send ID images or OTPs in a chat.',
        'Kailangang i-verify nang hiwalay ang tunay na pagkakakilanlan. Huwag magsend ng ID photo o OTP sa chat.'));
  });
  const registerProfessional=()=>void run(async()=>{
    if(!/^[A-Z0-9 -]{5,28}$/i.test(prcNumber.trim())||!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)){
      Alert.alert(t('Check PRC details','Tingnan ang PRC details'),
        t('Enter a valid license number and expiry date (YYYY-MM-DD).','Ilagay ang license number at expiration (YYYY-MM-DD).'));return;
    }
    await rpc('buklod_health_card_register_professional_v1',{
      p_profession:profession,p_prc_license_number:prcNumber.trim(),
      p_license_expires_on:expiresOn,
    });
    setPrcNumber('');setExpiresOn('');await load();
    Alert.alert(t('Application pending','Naghihintay ng pagsusuri'),
      t('PRC verification is independent. You cannot provide professional advice until approved.',
        'Dadaan muna sa hiwalay na PRC verification. Hindi pa puwedeng magbigay ng propesyonal na payo hangga’t hindi aprubado.'));
  });
  const openConsult=()=>void run(async()=>{
    if(!dash||dash.identity?.status!=='VERIFIED')return;
    if(redFlags!=='no')return;
    if(!consent||concern.trim().length<20){
      Alert.alert(t('Complete the intake','Kumpletuhin ang intake'),
        t('Enter your concern (at least 20 characters) and give informed consent.','Ilagay ang detalye ng nararamdaman (20+ characters) at pahintulot.'));return;
    }
    const id=await rpc('buklod_health_card_open_consult_v1',{
      p_service:service,p_concern:concern.trim(),p_symptom_duration:duration.trim()||null,
      p_location_city:city.trim()||null,p_red_flags:false,p_informed_consent:true,
      p_request_key:requestKey.current,
    });
    requestKey.current='hc-'+Date.now().toString(36)+'-'+
      Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
    setConcern('');setDuration('');setCity('');setRedFlags('unanswered');setConsent(false);
    await load();
    setSelectedCase(id as string);caseIdRef.current=id as string;setSection('case');
    Alert.alert(t('Consultation submitted','Naipadala ang konsultasyon'),
      t('Your case is pending acceptance by a verified volunteer. Do not treat this as emergency care.',
        'Nasa pila ang kaso para sa verified volunteer. Hindi ito emergency service.'));
  });
  const openCase=(id:string)=>{setSelectedCase(id);caseIdRef.current=id;setSection('case');void loadNotes(id);};
  const loadNotes=async(id:string)=>{
    const generation=++notesGeneration.current;
    try{
      const data=await rpc('buklod_health_card_get_notes_v1',{p_consult_id:id});
      if(generation===notesGeneration.current&&caseIdRef.current===id){
        setCaseNotes(Array.isArray(data)?data:[]);setNotesError('');
      }
    }catch{
      if(generation===notesGeneration.current&&caseIdRef.current===id)
        setNotesError(t('Unable to refresh notes. Existing records are retained.','Hindi na-refresh ang notes; nananatili ang dating records.'));
    }
  };
  const claim=(id:string)=>void run(async()=>{
    await rpc('buklod_health_card_claim_consult_v1',{p_consult_id:id});
    await load();openCase(id);
  });
  const postNote=()=>void run(async()=>{
    if(!selectedCase||message.trim().length<2)return;
    await rpc('buklod_health_card_post_note_v1',{
      p_consult_id:selectedCase,p_kind:isProfessional?messageKind:'CLIENT_QUESTION',
      p_message:message.trim(),
    });
    setMessage('');await loadNotes(selectedCase);await load();
  });
  const closeCase=()=>void run(async()=>{
    if(!selectedCase)return;
    await rpc('buklod_health_card_close_consult_v1',{p_consult_id:selectedCase});
    await load();setSelectedCase(null);caseIdRef.current=null;notesGeneration.current+=1;setSection('consult');
  });
  const review=(record:ReviewItem,kind:ReviewKind,approve:boolean)=>void run(async()=>{
    if(reviewRef.trim().length<20){
      Alert.alert(t('Verification record required','Kailangan ang verification reference'),
        t('Record an independent verification ticket of at least 20 characters.','Ilagay ang independent verification ticket (20+ characters).'));return;
    }
    await rpc('buklod_health_card_admin_review_v1',{
      p_user_id:record.id,p_kind:kind,p_approve:approve,
      p_method:kind==='PROFESSIONAL'?'PRC_OFFICIAL_VERIFICATION':reviewMethod,
      p_reference:reviewRef.trim(),
    });
    setReviewRef('');await load();
  });
  return <View style={[styles.card,active&&styles.cardExpanded]} accessibilityLabel={tileId==='health'?'Health Center':tileId}>
    <View style={styles.header}>
      <MaterialCommunityIcons name="heart-pulse" size={24} color="#136348"/>
      <Text style={styles.heading}>{t('Health Center','Sentro ng Kalusugan')}</Text>
      {active?<Pressable accessibilityRole="button" accessibilityLabel="Close Health Center panel"
          onPress={()=>{setSection(null);setSelectedCase(null);caseIdRef.current=null;
            notesGeneration.current+=1;setCaseNotes([]);}}
          style={styles.close}><MaterialCommunityIcons name="close" size={21} color="#265E45"/></Pressable>:null}
    </View>
    <View style={styles.languages}>
      <Pressable accessibilityRole="button" accessibilityState={{selected:language==='fil'}}
        onPress={()=>setLanguage('fil')} style={[styles.lang,language==='fil'&&styles.langSelected]}>
        <Text style={[styles.langText,language==='fil'&&styles.langSelectedText]}>Filipino</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{selected:language==='en'}}
        onPress={()=>setLanguage('en')} style={[styles.lang,language==='en'&&styles.langSelected]}>
        <Text style={[styles.langText,language==='en'&&styles.langSelectedText]}>English</Text>
      </Pressable>
    </View>
    {externalError?<Text style={styles.warning}>{t('Full Health Center could not open. Please retry from this card.',
      'Hindi nabuksan ang buong Health Center. Subukan muli dito sa card.')}</Text>:null}
    {!active?<View style={styles.buttons}>
      <Info>{t('Free professional advice, with verified identities.','Libreng payong pangkalusugan mula sa verified professionals.')}</Info>
      <Button label={t('FREE ONLINE CONSULTATION','LIBRENG KONSULTASYON')} onPress={()=>openSection('consult')}/>
      <Button label={t('PROFESSIONAL REGISTRATION','REHISTRO NG PROPESYONAL')} outline onPress={()=>openSection('professional')}/>
      <Pressable accessibilityRole="button" onPress={openStandalone} style={styles.fullDoor}>
        <Text style={styles.fullDoorText}>{t('Full Health Center','Buong Health Center')}</Text>
        <MaterialCommunityIcons name="open-in-new" size={15} color="#155743"/>
      </Pressable>
    </View>:<>
      <View style={styles.nav}>
        {(['consult','professional'] as const).map(item=><Pressable key={item}
          accessibilityRole="button" onPress={()=>openSection(item)} style={[styles.tab,section===item&&styles.tabOn]}>
          <Text style={[styles.tabText,section===item&&styles.tabTextOn]}>
            {item==='consult'?t('Consultation','Konsultasyon'):t('Professional','Propesyonal')}
          </Text>
        </Pressable>)}
        {dash?.admin?<Pressable onPress={()=>openSection('review')} style={[styles.tab,section==='review'&&styles.tabOn]}>
          <Text style={[styles.tabText,section==='review'&&styles.tabTextOn]}>{t('Verify','Beripikasyon')}</Text></Pressable>:null}
      </View>
      {!user?<Info>{t('Sign in to access private services.','Mag-sign in para sa pribadong serbisyo.')}</Info>:null}
      {loading?<ActivityIndicator color="#176B4A" accessibilityLabel="Loading Health Center"/>:null}
      {backendError?<Text style={styles.warning}>{backendError}</Text>:null}
      {user&&!backendError&&!dash&&!loading?<Button label={t('Retry connection','Subukan muli')} outline onPress={()=>void load()}/>:null}
      {dash&&section==='consult'?<View style={styles.body}>
        <Text style={styles.title}>{t('Professional advice, free','Libreng payo ng health professional')}</Text>
        <Info>{t('Identity is verified privately. Only your assigned professional and you see case notes. No public Wall posts, unsolicited messages, or guaranteed response time.',
          'Pribadong beripikasyon ng pagkakakilanlan. Ikaw at ang assigned professional lamang ang makakakita ng case notes. Hindi ito Wall post o ordinary chat; walang garantisadong oras ng sagot.')}</Info>
        {dash.identity?.status!=='VERIFIED'?<View style={styles.section}>
          <Text style={styles.label}>{t('Verify your real identity','I-verify ang tunay na pagkakakilanlan')}</Text>
          <Info>{dash.identity?.status==='PENDING'
            ? t('Identity review pending. A reviewer must independently verify your legal name and identity.','Naghihintay sa independent identity review.')
            : t('Your legal identity must be verified before a private consultation. Do not put ID photos in chat.',
              'Kailangang ma-verify ang legal identity bago magpakonsulta. Huwag magpadala ng ID photo sa chat.')}</Info>
          {dash.identity?.status!=='PENDING'?<>
            <Field value={legalName} onChange={setLegalName} placeholder={t('Complete legal name','Buong legal na pangalan')}/>
            <Button label={t('REQUEST IDENTITY VERIFICATION','HILINGIN ANG IDENTITY VERIFICATION')} onPress={registerIdentity} disabled={busy}/>
          </>:null}
        </View>:<View style={styles.section}>
          <Text style={styles.good}>{t('Identity independently verified','Beripikado ang pagkakakilanlan')}</Text>
          <Text style={styles.label}>{t('Choose a service','Piliin ang serbisyo')}</Text>
          <View style={styles.chips}>
            {(['HEALTH_ADVICE','PHYSICIAN_CONSULT'] as const).map(v=><Pressable key={v}
              onPress={()=>setService(v)} style={[styles.chip,service===v&&styles.chipOn]}>
              <Text style={service===v?styles.chipOnText:styles.chipText}>{v==='HEALTH_ADVICE'
                ? t('Health advice','Payong pangkalusugan'):t('Doctor consultation','Konsultasyon sa doktor')}</Text>
            </Pressable>)}
          </View>
          <Text style={styles.label}>{t('Urgent warning-sign check','Suriin ang emergency warning signs')}</Text>
          <Info>{language==='fil'?GUIDE.redFlags.fil:GUIDE.redFlags.en}</Info>
          <View style={styles.chips}>
            <Pressable style={[styles.chip,redFlags==='yes'&&styles.urgent]} onPress={()=>setRedFlags('yes')}>
              <Text style={redFlags==='yes'?styles.urgentText:styles.chipText}>{t('Yes / unsure','Oo / di sigurado')}</Text></Pressable>
            <Pressable style={[styles.chip,redFlags==='no'&&styles.chipOn]} onPress={()=>setRedFlags('no')}>
              <Text style={redFlags==='no'?styles.chipOnText:styles.chipText}>{t('None','Wala')}</Text></Pressable>
          </View>
          {redFlags==='yes'?<View style={styles.emergency}>
            <Text style={styles.warning}>{t('Do not wait for online consultation. Go to an emergency room or call 911 in the Philippines.',
              'Huwag maghintay ng online na sagot. Pumunta sa ER o tumawag sa 911 sa Pilipinas.')}</Text>
            <Button label={t('CALL 911','TUMAWAG SA 911')} onPress={()=>void Linking.openURL('tel:911').catch(()=>Alert.alert('911'))}/>
          </View>:null}
          {redFlags==='no'?<>
            <Text style={styles.label}>{t('Describe your health concern (minimum 20 characters)','Ilarawan ang nararamdaman (20+ characters)')}</Text>
            <Field value={concern} onChange={setConcern} placeholder={t('Symptoms, history, medicines, allergies, concerns','Sintomas, kasaysayan, gamot, allergy at mga tanong')} multiline/>
            <Text style={styles.label}>{t('Duration (optional)','Gaano na katagal (opsyonal)')}</Text>
            <Field value={duration} onChange={setDuration} placeholder={t('e.g. 2 days','Hal. 2 araw')}/>
            <Text style={styles.label}>{t('City / municipality (optional)','Lungsod / munisipyo (opsyonal)')}</Text>
            <Field value={city} onChange={setCity} placeholder={t('City only, no home address','Lungsod lamang, hindi buong address')}/>
            <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent}}
              onPress={()=>setConsent(v=>!v)} style={styles.consentRow}>
              <MaterialCommunityIcons name={consent?'checkbox-marked':'checkbox-blank-outline'} size={22} color="#126946"/>
              <Text style={styles.consentText}>{t(
                'I agree to a private telehealth consultation and clinical record. I understand the limits of text-only advice, confidentiality risks, referral options and my right to stop. This is not emergency care.',
                'Pumapayag ako sa pribadong konsultasyon at clinical record. Nauunawaan ko ang limitasyon ng text advice, privacy risks, referral at karapatang tumigil. Hindi ito emergency service.'
              )}</Text></Pressable>
            <Button label={t('SUBMIT FREE CONSULTATION','ISUMITE ANG LIBRENG KONSULTASYON')}
              onPress={openConsult} disabled={busy||!consent||concern.trim().length<20}/>
          </>:null}
        </View>}
        <Text style={styles.title}>{t('My consultations','Aking mga konsultasyon')}</Text>
        {(dash.consultations||[]).filter(c=>!!c.id).length===0?<Info>{t('No consultations yet.','Wala pang konsultasyon.')}</Info>:null}
        {(dash.consultations||[]).map(c=><Pressable key={c.id} style={styles.caseRow} onPress={()=>openCase(c.id)}>
          <Text style={styles.caseText}>{c.service==='HEALTH_ADVICE'?t('Health advice','Payong pangkalusugan'):t('Doctor consultation','Konsultasyon sa doktor')} · {c.status}</Text>
          <Text numberOfLines={2} style={styles.info}>{c.professional_name
            ? c.professional_name+' · '+(c.professional_role||'')
            : t('Waiting for a verified volunteer','Naghihintay sa verified volunteer')}</Text>
        </Pressable>)}
      </View>:null}
      {dash&&section==='professional'?<View style={styles.body}>
        <Text style={styles.title}>{t('Volunteer health professionals','Mga boluntaryong health professional')}</Text>
        <Info>{t('Verified professionals give free advice only within their license and professional scope. A PRC number alone does not grant access. Verification is reviewed independently.',
          'Libreng serbisyo lamang ayon sa saklaw ng lisensiya. Hindi sapat ang PRC number lang; may hiwalay na beripikasyon.')}</Info>
        {dash.professional?<View style={styles.section}>
          <Text style={styles.label}>{t('Registration status','Estado ng rehistrasyon')}: {dash.professional.status}</Text>
          <Info>{dash.professional.profession} · PRC {dash.professional.license_number}</Info>
          <Info>{t('License expiry','Expiration ng lisensiya')}: {dash.professional.expires_on}</Info>
          {typeof expiryDays==='number'&&expiryDays<0?<Text style={styles.warning}>{t(
            'License expired. Clinical access is blocked. Renew and undergo verification again.',
            'Expired na ang lisensiya. Bawal muna ang konsultasyon. Mag-renew at magpa-verify muli.')}</Text>
          :typeof expiryDays==='number'&&expiryDays<=7?<Text style={styles.warning}>{t('URGENT: License expires within 7 days. Renew now.',
            'AGARAN: Mag-e-expire ang lisensiya sa loob ng 7 araw.')}</Text>
          :typeof expiryDays==='number'&&expiryDays<=30?<Text style={styles.warning}>{t('License expires within 30 days. Prepare for renewal.',
            'Mag-e-expire ang lisensiya sa loob ng 30 araw. Ihanda ang renewal.')}</Text>:null}
        </View>:null}
        {dash.identity?.status!=='VERIFIED'?<View style={styles.section}>
          <Info>{t('Independent identity verification is required before professional registration.',
            'Kailangan muna ang independent identity verification para sa professional registration.')}</Info>
          {dash.identity?.status!=='PENDING'?<>
            <Field value={legalName} onChange={setLegalName} placeholder={t('Complete legal name','Buong legal na pangalan')}/>
            <Button label={t('REQUEST IDENTITY VERIFICATION','MAGPA-VERIFY NG IDENTITY')} onPress={registerIdentity} disabled={busy}/>
          </>:<Info>{t('Identity review pending.','Naghihintay pa ng identity verification.')}</Info>}
        </View>:<>
          {dash.professional?.status==='PENDING'?<Info>{t('Your PRC application is pending independent review.',
            'Naghihintay pa ng independent PRC verification ang iyong application.')}</Info>:null}
          {dash.professional?.status!=='PENDING'&&(!licenseCurrent || (expiryDays??999)<=30)?<View style={styles.section}>
            <Text style={styles.label}>{t('Profession','Propesyon')}</Text>
            <View style={styles.chips}>{['PHYSICIAN','NURSE','PHARMACIST','MIDWIFE','OTHER'].map(p=><Pressable key={p}
              onPress={()=>setProfession(p)} style={[styles.chip,profession===p&&styles.chipOn]}>
                <Text style={profession===p?styles.chipOnText:styles.chipText}>{p}</Text></Pressable>)}</View>
            <Text style={styles.label}>{t('PRC license number','PRC license number')}</Text>
            <Field value={prcNumber} onChange={setPrcNumber} placeholder={t('Official PRC license number','Opisyal na PRC license number')}/>
            <Text style={styles.label}>{t('License expiration (YYYY-MM-DD)','Expiration (YYYY-MM-DD)')}</Text>
            <Field value={expiresOn} onChange={setExpiresOn} placeholder="YYYY-MM-DD"/>
            <Info>{t('An admin checks your PRC record independently. Do not upload ID photos to this chat.',
              'Manu-manong titingnan sa PRC ang lisensiya. Huwag mag-upload ng ID photo sa chat.')}</Info>
            <Button label={t('SUBMIT LICENSE FOR VERIFICATION','ISUMITE ANG LISENSIYA PARA I-VERIFY')}
              onPress={registerProfessional} disabled={busy}/>
          </View>:null}
          {licenseCurrent?<View style={styles.section}>
            <Text style={styles.good}>{t('Verified professional','Verified health professional')}</Text>
            <Text style={styles.title}>{t('Unassigned consultations','Mga konsultasyong walang assigned professional')}</Text>
            {dash.queue?.length===0?<Info>{t('No requests in your scope.','Wala pang request.')}</Info>:null}
            {(dash.queue||[]).map(q=><View key={q.id} style={styles.caseRow}>
              <Text style={styles.label}>{q.service==='PHYSICIAN_CONSULT'?t('Physician consult','Konsultasyon sa doktor'):t('Health advice','Payong pangkalusugan')}</Text>
              <Button label={t('ACCEPT CASE','TANGGAPIN ANG KASO')} onPress={()=>claim(q.id)} disabled={busy}/>
            </View>)}
          </View>:null}
        </>}
      </View>:null}
      {dash&&section==='case'&&caseItem?<View style={styles.body}>
        <Text style={styles.title}>{t('Private clinical consultation','Pribadong clinical consultation')}</Text>
        <Info>{caseItem.service} · {caseItem.status}</Info>
        {caseItem.professional_name?<Info>{t('Assigned','Naka-assign')}: {caseItem.professional_name} · {caseItem.professional_role||''}
          {caseItem.license_current?t(' · verified PRC',' · verified PRC')+
            (caseItem.license_number?' #'+caseItem.license_number:'')
            :t(' · license not current',' · hindi current ang lisensiya')}</Info>:null}
        {caseItem.client_name?<Info>{t('Verified client','Beripikadong pasyente')}: {caseItem.client_name}</Info>:null}
        <Text style={styles.label}>{t('Case summary','Buod ng kaso')}</Text>
        <Info>{caseItem.concern}</Info>
        {caseItem.referral_note?<Text style={styles.warning}>{t('Referral','Referral')}: {caseItem.referral_note}</Text>:null}
        {caseItem.status==='OPEN'?<Button label={t('CANCEL PENDING REQUEST','KANSELAHIN ANG NAKAPILANG REQUEST')}
          onPress={closeCase} outline disabled={busy}/>:null}
        {caseItem.status==='IN_PROGRESS'?<>
          <View style={styles.section}>
            <Text style={styles.title}>{t('Clinical record','Clinical record')}</Text>
            <Button label={t('REFRESH CLINICAL UPDATES','I-REFRESH ANG CLINICAL NOTES')} outline
              onPress={()=>{if(selectedCase)void loadNotes(selectedCase);}}/>
            {notesError?<Text style={styles.warning}>{notesError}</Text>:null}
            {caseNotes.length===0&&!notesError?<Info>{t('No notes yet.','Wala pang notes.')}</Info>:null}
            {caseNotes.map(n=><View key={n.id} style={styles.note}>
              <Text style={styles.label}>{n.kind.replace('_',' ')} · {n.mine?t('You','Ikaw'):t('Participant','Kasama')}</Text>
              <Text style={styles.caseText}>{n.message}</Text>
            </View>)}
            {isProfessional?<View style={styles.chips}>
              {(['PROFESSIONAL_ADVICE','CARE_PLAN','FOLLOW_UP','REFERRAL'] as const).map(k=><Pressable key={k}
                onPress={()=>setMessageKind(k)} style={[styles.chip,messageKind===k&&styles.chipOn]}>
                <Text style={messageKind===k?styles.chipOnText:styles.chipText}>{k.replace('_',' ')}</Text></Pressable>)}
            </View>:null}
            <Field value={message} onChange={setMessage} placeholder={t('Add a clinical note or question','Magdagdag ng clinical note o tanong')} multiline/>
            <Button label={t('SAVE TO CLINICAL RECORD','I-SAVE SA CLINICAL RECORD')} onPress={postNote}
              disabled={busy||message.trim().length<2||(!caseItem.license_current&&isProfessional)}/>
            <Button label={t('CLOSE CONSULTATION','ISARA ANG KONSULTASYON')} onPress={closeCase} outline disabled={busy}/>
          </View>
        </>:<Info>{t('This case is not currently in an active consultation.','Hindi aktibo ang kasong ito para sa consultation notes.')}</Info>}
        <Button label={t('BACK TO CONSULTATIONS','BUMALIK SA MGA KONSULTASYON')} outline onPress={()=>{setSection('consult');setSelectedCase(null);caseIdRef.current=null;notesGeneration.current+=1;}}/>
      </View>:null}
      {dash&&section==='review'&&dash.admin?<View style={styles.body}>
        <Text style={styles.title}>{t('Independent verification queue','Independent verification queue')}</Text>
        <Info>{t('Only the system administrator can approve after independently checking legal identity and PRC records. Do not record ID scans in the consultation.',
          'System admin lamang ang puwedeng mag-approve matapos ang hiwalay na beripikasyon. Huwag ilagay ang ID scan sa consultation.')}</Info>
        <Text style={styles.label}>{t('Identity verification method','Paraan ng identity verification')}</Text>
        <View style={styles.chips}>{(['VERIFIED_IN_PERSON','AUTHORIZED_KYC','SECURE_ID_VIDEO_REVIEW'] as const).map(method=>
          <Pressable key={method} style={[styles.chip,reviewMethod===method&&styles.chipOn]} onPress={()=>setReviewMethod(method)}>
            <Text style={reviewMethod===method?styles.chipOnText:styles.chipText}>{method.replaceAll('_',' ')}</Text>
          </Pressable>)}</View>
        <Text style={styles.label}>{t('Independent verification ticket/reference','Independent verification ticket/reference')}</Text>
        <Field value={reviewRef} onChange={setReviewRef} placeholder={t('Non-sensitive audit reference (20+ characters)','Non-sensitive audit reference (20+ characters)')}/>
        {(['IDENTITY','PROFESSIONAL'] as const).map(kind=><View key={kind} style={styles.section}>
          <Text style={styles.title}>{kind==='IDENTITY'?t('Pending identities','Pending identities'):t('Pending professional licenses','Pending PRC licenses')}</Text>
          {(kind==='IDENTITY'?dash.pending_identities:dash.pending_professionals)?.length===0?<Info>{t('No pending requests.','Walang pending.')}</Info>:null}
          {(kind==='IDENTITY'?dash.pending_identities:dash.pending_professionals||[]).map(p=><View key={p.id} style={styles.caseRow}>
            <Text style={styles.caseText}>{p.name} {p.profession?' · '+p.profession:''}</Text>
            {p.license_number?<Info>PRC: {p.license_number} · {p.expires_on}</Info>:null}
            <View style={styles.chips}>
              <Button label={t('APPROVE','APRUBAHAN')} disabled={busy} onPress={()=>review(p,kind,true)}/>
              <Button label={t('REJECT','TANGGIHAN')} disabled={busy} outline onPress={()=>review(p,kind,false)}/>
            </View>
          </View>)}
        </View>)}
        <Pressable onPress={()=>void Linking.openURL('https://online.prc.gov.ph/')}
          accessibilityRole="link" style={styles.fullDoor}>
          <Text style={styles.fullDoorText}>{t('Official PRC verification website','Opisyal na PRC verification website')}</Text>
          <MaterialCommunityIcons name="open-in-new" size={15} color="#155743"/>
        </Pressable>
      </View>:null}
      <Pressable accessibilityRole="button" onPress={openStandalone} style={styles.fullDoor}>
        <Text style={styles.fullDoorText}>{t('Open full Health Center (separate)','Buksan ang buong Health Center (hiwalay)')}</Text>
        <MaterialCommunityIcons name="open-in-new" size={15} color="#155743"/>
      </Pressable>
      <Info>{t('Protected consultation records, not a social chat. No ads inside private clinical records. Verification is required before real cases can start.',
        'Protektadong clinical records, hindi social chat. Walang ads sa private consultation. Kailangan ang verification bago magbigay ng tunay na serbisyo.')}</Info>
    </>}
  </View>;
}

const styles=StyleSheet.create({
  card:{width:'48.5%',aspectRatio:1,minHeight:216,flexGrow:1,borderRadius:12,borderWidth:2,
    borderColor:'#F14AE0',backgroundColor:'#FFF0FD',padding:10,gap:6,justifyContent:'space-between',
    shadowColor:'#DD2AD2',shadowOffset:{width:0,height:0},shadowOpacity:0.17,shadowRadius:7,elevation:3},
  cardExpanded:{width:'100%',aspectRatio:undefined,minHeight:280,flexGrow:0,padding:13,gap:12},
  header:{flexDirection:'row',gap:7,alignItems:'center'},
  heading:{color:'#153F36',fontSize:15,fontWeight:'900',flex:1},
  close:{width:31,height:31,alignItems:'center',justifyContent:'center'},
  languages:{flexDirection:'row',gap:5,alignSelf:'flex-start',flexWrap:'wrap'},
  lang:{borderRadius:8,paddingHorizontal:7,paddingVertical:5,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DBABD2'},
  langSelected:{backgroundColor:'#176B4A',borderColor:'#176B4A'},
  langText:{color:'#27543D',fontWeight:'800',fontSize:11},
  langSelectedText:{color:'#FFFFFF'},
  buttons:{gap:5},
  action:{backgroundColor:'#126946',minHeight:36,paddingHorizontal:8,paddingVertical:8,
    borderRadius:9,justifyContent:'center',alignItems:'center',flexGrow:0},
  actionText:{color:'#FFFFFF',fontSize:11,fontWeight:'900',textAlign:'center'},
  outline:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#91CEB4'},
  outlineText:{color:'#155743'},
  dim:{opacity:0.55},
  fullDoor:{minHeight:30,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
  fullDoorText:{color:'#155743',fontSize:11,fontWeight:'800'},
  info:{color:'#526A60',fontSize:12,lineHeight:17},
  nav:{flexDirection:'row',gap:6,flexWrap:'wrap'},
  tab:{borderRadius:9,borderWidth:1,borderColor:'#BBD6C6',paddingHorizontal:10,paddingVertical:8},
  tabOn:{backgroundColor:'#176B4A',borderColor:'#176B4A'},
  tabText:{color:'#256449',fontWeight:'800',fontSize:12},
  tabTextOn:{color:'#FFFFFF'},
  body:{gap:11},
  title:{color:'#154C35',fontSize:16,fontWeight:'900'},
  label:{color:'#295A45',fontSize:12,fontWeight:'900'},
  section:{gap:9,borderRadius:11,borderWidth:1,borderColor:'#D9E7DF',padding:11,backgroundColor:'#FFFFFF'},
  input:{fontSize:15,color:'#173F31',borderWidth:1,borderColor:'#9AC3AE',
    borderRadius:8,minHeight:43,backgroundColor:'#FFF',paddingHorizontal:10,paddingVertical:8},
  multiline:{minHeight:90,textAlignVertical:'top'},
  chips:{flexDirection:'row',gap:7,flexWrap:'wrap',alignItems:'center'},
  chip:{borderRadius:9,borderWidth:1,borderColor:'#99C0AA',paddingHorizontal:9,paddingVertical:8,backgroundColor:'#FFFFFF'},
  chipOn:{backgroundColor:'#176B4A',borderColor:'#176B4A'},
  chipText:{color:'#265C42',fontSize:12,fontWeight:'800'},
  chipOnText:{color:'#FFFFFF',fontSize:12,fontWeight:'800'},
  urgent:{backgroundColor:'#963F3F',borderColor:'#963F3F'},
  urgentText:{color:'#FFFFFF',fontSize:12,fontWeight:'900'},
  warning:{color:'#9B342E',fontSize:12,lineHeight:19,fontWeight:'700'},
  emergency:{gap:8,padding:10,borderWidth:1,borderColor:'#E6BEBE',borderRadius:9,backgroundColor:'#FFF0F0'},
  good:{color:'#116C46',fontSize:13,fontWeight:'900'},
  consentRow:{flexDirection:'row',gap:7,alignItems:'flex-start'},
  consentText:{color:'#3A5B4A',fontSize:12,flex:1,lineHeight:19},
  caseRow:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DDE7E0',padding:10,borderRadius:10,gap:6},
  caseText:{color:'#173F31',fontSize:13,lineHeight:19,fontWeight:'700'},
  note:{padding:9,backgroundColor:'#EDF6F0',borderRadius:8,gap:4},
});
