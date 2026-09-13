import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function distanceKm(lat1:number,lon1:number,lat2:number,lon2:number){
  const toRad=(value:number)=>(value*Math.PI)/180;
  const dLat=toRad(lat2-lat1);
  const dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+
    Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 6371*2*Math.asin(Math.min(1,Math.sqrt(a)));
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers:corsHeaders});

  let admin:any=null;
  let claimedRequestId='';

  try{
    const supabaseUrl=Deno.env.get('SUPABASE_URL')!;
    const anonKey=Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader=req.headers.get('Authorization')??'';
    if(!authHeader)throw new Error('AUTH_REQUIRED');

    const authClient=createClient(supabaseUrl,anonKey,{
      global:{headers:{Authorization:authHeader}},
      auth:{persistSession:false},
    });
    admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});

    const {data:authData,error:authError}=await authClient.auth.getUser();
    if(authError||!authData.user)throw new Error('AUTH_REQUIRED');

    const body=await req.json().catch(()=>({}));
    const requestId=String(body?.request_id??'').trim();
    if(!requestId)throw new Error('REQUEST_ID_REQUIRED');
    claimedRequestId=requestId;

    const {data:alert,error:alertError}=await admin
      .from('buklod_help_requests')
      .select('id,creator_id,kind,category,message,status,latitude,longitude,radius_km,created_at,expires_at')
      .eq('id',requestId)
      .maybeSingle();
    if(alertError)throw alertError;
    if(!alert||alert.creator_id!==authData.user.id)throw new Error('REQUEST_NOT_OWNED');
    if(alert.kind!=='EMERGENCY'||alert.status!=='ACTIVE')throw new Error('NOT_ACTIVE_EMERGENCY');
    if(new Date(alert.expires_at).getTime()<=Date.now())throw new Error('EMERGENCY_EXPIRED');

    const {data:existingDispatch,error:existingDispatchError}=await admin
      .from('buklod_help_alert_dispatches')
      .select('request_id,radius_km,status,recipients_count,pushes_count,updated_at')
      .eq('request_id',requestId)
      .maybeSingle();
    if(existingDispatchError)throw existingDispatchError;
    if(existingDispatch?.status==='SENT'){
      return new Response(JSON.stringify({
        ok:true,duplicate:true,recipients:existingDispatch.recipients_count,
        notifications:existingDispatch.pushes_count,radius_km:existingDispatch.radius_km,
      }),{headers:{...corsHeaders,'Content-Type':'application/json'}});
    }
    if(existingDispatch?.status==='PROCESSING'){
      const age=Date.now()-new Date(existingDispatch.updated_at).getTime();
      if(age<120000){
        return new Response(JSON.stringify({ok:true,in_progress:true,radius_km:existingDispatch.radius_km}),{
          headers:{...corsHeaders,'Content-Type':'application/json'},
        });
      }
    }

    const cutoff=new Date(Date.now()-60*60*1000).toISOString();
    const {data:presences,error:presenceError}=await admin
      .from('buklod_help_presence')
      .select('user_id,latitude,longitude')
      .eq('safety_alerts_enabled',true)
      .gte('updated_at',cutoff);
    if(presenceError)throw presenceError;

    const candidates=(presences??[])
      .filter((row:any)=>row.user_id!==alert.creator_id)
      .map((row:any)=>(
        {
          user_id:String(row.user_id),
          distance_km:distanceKm(
            Number(alert.latitude),Number(alert.longitude),
            Number(row.latitude),Number(row.longitude),
          ),
        }
      ))
      .filter((row:{distance_km:number})=>row.distance_km<=Math.min(5,Number(alert.radius_km??5)))
      .sort((a:{distance_km:number},b:{distance_km:number})=>a.distance_km-b.distance_km);

    // Privacy/minimal-blast rule: use the smallest useful radius.
    // This is density-based selection, not a timed automatic escalation.
    const within1=candidates.filter((row:{distance_km:number})=>row.distance_km<=1).length;
    const within3=candidates.filter((row:{distance_km:number})=>row.distance_km<=3).length;
    const chosenRadius=within1>=3?1:within3>=3?3:5;
    const recipients=candidates.filter((row:{distance_km:number})=>row.distance_km<=chosenRadius);
    const recipientIds=[...new Set(recipients.map((row:{user_id:string})=>row.user_id))];

    if(existingDispatch){
      const {error}=await admin.from('buklod_help_alert_dispatches').update({
        radius_km:chosenRadius,status:'PROCESSING',recipients_count:0,pushes_count:0,
        last_error:null,updated_at:new Date().toISOString(),dispatched_at:null,
      }).eq('request_id',requestId).neq('status','SENT');
      if(error)throw error;
    }else{
      const {error}=await admin.from('buklod_help_alert_dispatches').insert({
        request_id:requestId,radius_km:chosenRadius,status:'PROCESSING',updated_at:new Date().toISOString(),
      });
      if(error){
        if(error.code==='23505'){
          const {data:race}=await admin.from('buklod_help_alert_dispatches')
            .select('radius_km,status,recipients_count,pushes_count').eq('request_id',requestId).maybeSingle();
          return new Response(JSON.stringify({
            ok:true,duplicate:true,in_progress:race?.status==='PROCESSING',
            recipients:race?.recipients_count??0,notifications:race?.pushes_count??0,
            radius_km:race?.radius_km??chosenRadius,
          }),{headers:{...corsHeaders,'Content-Type':'application/json'}});
        }
        throw error;
      }
    }

    if(!recipientIds.length){
      await admin.from('buklod_help_alert_dispatches').update({
        status:'SENT',recipients_count:0,pushes_count:0,last_error:null,
        updated_at:new Date().toISOString(),dispatched_at:new Date().toISOString(),
      }).eq('request_id',requestId);
      return new Response(JSON.stringify({ok:true,recipients:0,notifications:0,radius_km:chosenRadius}),{
        headers:{...corsHeaders,'Content-Type':'application/json'},
      });
    }

    const distanceByUser=new Map(recipients.map((row:{user_id:string;distance_km:number})=>[row.user_id,row.distance_km]));
    const title=`EMERGENCY NEAR YOU · ${String(alert.category).replaceAll('_',' ')}`;

    // A failed retry must not create duplicate notification rows.
    const {data:existingNotifications,error:existingNotificationError}=await admin
      .from('notifications')
      .select('user_id')
      .eq('kind','community_emergency')
      .contains('data',{help_request_id:alert.id})
      .in('user_id',recipientIds);
    if(existingNotificationError)throw existingNotificationError;
    const alreadyNotified=new Set((existingNotifications??[]).map((row:any)=>String(row.user_id)));
    const missingIds=recipientIds.filter((id:string)=>!alreadyNotified.has(id));

    const notificationRows=missingIds.map((userId:string)=>{
      const distance=Number(distanceByUser.get(userId)??0);
      const bodyText=String(alert.message??'').trim()
        ? `${distance.toFixed(1)} km away · ${String(alert.message).slice(0,160)}`
        : `A BUKLOD member approximately ${distance.toFixed(1)} km away may need immediate help.`;
      return {
        user_id:userId,
        title,
        body:bodyText,
        kind:'community_emergency',
        data:{
          kind:'community_emergency',help_request_id:alert.id,category:alert.category,
          distance_km:Number(distance.toFixed(1)),radius_km:chosenRadius,
        },
      };
    });

    if(notificationRows.length){
      const {error:notificationError}=await admin.from('notifications').insert(notificationRows);
      if(notificationError)throw notificationError;
    }

    const deliveryRows=recipients.map((row:{user_id:string;distance_km:number})=>({
      request_id:requestId,user_id:row.user_id,distance_km:Number(row.distance_km.toFixed(3)),
    }));
    if(deliveryRows.length){
      const {error:deliveryError}=await admin.from('buklod_help_alert_deliveries')
        .upsert(deliveryRows,{onConflict:'request_id,user_id',ignoreDuplicates:true});
      if(deliveryError)throw deliveryError;
    }

    // Inserts above trigger the existing canonical BUKLOD notification -> push pipeline.
    // Do not call Expo Push directly here, or a single SOS could be sent twice.
    await admin.from('buklod_help_alert_dispatches').update({
      status:'SENT',recipients_count:recipientIds.length,pushes_count:notificationRows.length,
      last_error:null,updated_at:new Date().toISOString(),dispatched_at:new Date().toISOString(),
    }).eq('request_id',requestId);

    return new Response(JSON.stringify({
      ok:true,recipients:recipientIds.length,notifications:notificationRows.length,radius_km:chosenRadius,
    }),{headers:{...corsHeaders,'Content-Type':'application/json'}});
  }catch(error){
    const message=String((error as Error)?.message??error);
    if(admin&&claimedRequestId){
      await admin.from('buklod_help_alert_dispatches').update({
        status:'FAILED',last_error:message.slice(0,1000),updated_at:new Date().toISOString(),
      }).eq('request_id',claimedRequestId).neq('status','SENT').catch(()=>undefined);
    }
    return new Response(JSON.stringify({ok:false,error:message}),{
      status:400,headers:{...corsHeaders,'Content-Type':'application/json'},
    });
  }
});
