Shader "BUKLOD/Review/RiftWater" {
    Properties {
        _Deep("Deep water",Color)=(.018,.14,.21,1)
        _Shallow("Shallow water",Color)=(.035,.40,.44,1)
        _Sky("Sky tint",Color)=(.32,.55,.70,1)
        _WaveStrength("Wave strength",Range(.02,.25))=.12
        _ReviewSkyCube("Original environment reflection",Cube)="" {}
        _ReflectionStrength("Environment reflection",Range(0,1))=.38
        _ShoreFoam("Shore foam",Range(0,1))=.55
        _RiverCenter("River center X",Float)=160
        _RiverHalfWidth("River half width",Float)=5.3
    }
    SubShader {
        Tags {"RenderPipeline"="UniversalPipeline" "Queue"="Geometry" "RenderType"="Opaque"}
        Pass {
            Name "RiftWater"
            Tags {"LightMode"="UniversalForward"}
            ZWrite On
            Cull Back
            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile_fog
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            TEXTURECUBE(_ReviewSkyCube); SAMPLER(sampler_ReviewSkyCube);
            CBUFFER_START(UnityPerMaterial)
            half4 _Deep,_Shallow,_Sky;
            float _WaveStrength,_ReflectionStrength,_ShoreFoam,_RiverCenter,_RiverHalfWidth;
            CBUFFER_END
            struct Attributes {float4 positionOS:POSITION;float3 normalOS:NORMAL;};
            struct Varyings {float4 positionCS:SV_POSITION;float3 positionWS:TEXCOORD0;half3 normalWS:TEXCOORD1;half fog:TEXCOORD2;};
            Varyings Vert(Attributes v){
                Varyings o;
                VertexPositionInputs p=GetVertexPositionInputs(v.positionOS.xyz);
                o.positionCS=p.positionCS;o.positionWS=p.positionWS;o.normalWS=TransformObjectToWorldNormal(v.normalOS);
                o.fog=ComputeFogFactor(p.positionCS.z);return o;
            }
            half4 Frag(Varyings i):SV_Target {
                float2 p=i.positionWS.xz;
                float t=_Time.y;
                // Advect multiple scales along the river, with crossing capillary waves.
                float2 q=p+float2(0,-t*.46);
                float a=dot(q,float2(.81,.36))+t*.38;
                float b=dot(q,float2(-.41,1.12))-t*.27;
                float c=dot(q,float2(1.42,-.83))+t*.19;
                float2 slope=float2(cos(a)*.81-cos(b)*.41,cos(a)*.36+cos(b)*1.12)*_WaveStrength;
                slope+=cos(c)*float2(1.42,-.83)*_WaveStrength*.24;
                float fine=dot(q,float2(3.8,-2.6))+t*.63;
                slope+=float2(cos(fine),sin(fine*.73))*.028;
                half3 normal=normalize(half3(-slope.x,1,-slope.y));
                half3 view=GetWorldSpaceNormalizeViewDir(i.positionWS);
                #if defined(_MAIN_LIGHT_SHADOWS_SCREEN)
                    float4 shadowCoord=ComputeScreenPos(TransformWorldToHClip(i.positionWS));
                #else
                    float4 shadowCoord=TransformWorldToShadowCoord(i.positionWS);
                #endif
                Light sun=GetMainLight(shadowCoord);
                half3 halfway=SafeNormalize(sun.direction+view);
                half nv=saturate(dot(normal,view));
                half fresnel=.02h+.98h*pow(1-nv,5);
                half spec=saturate(dot(normal,halfway));
                half gleam=(pow(spec,80)*.85h+pow(spec,18)*.14h)*sun.shadowAttenuation;
                float bankDistance=max(0,_RiverHalfWidth-abs(p.x-_RiverCenter));
                float edge=1-smoothstep(.15,2.0,bankDistance);
                half ripples=saturate((sin(a)+sin(b)+sin(c))*.1667+.5);
                half3 color=lerp(_Deep.rgb,_Shallow.rgb,saturate(edge*.80+ripples*.15));
                // Fine crossing caustic-like patterns suggest clear shallows without
                // pretending to sample terrain depth or live reflected actors.
                half caustic=pow(saturate(.5+.5*sin(a*2.2+sin(c)*.9)),7)*pow(saturate(.5+.5*sin(b*2.8+sin(fine)*.4)),3);
                color+=half3(.10,.23,.19)*caustic*edge*.65;
                color*=lerp(.76,1.05,sun.shadowAttenuation);
                half3 reflected=SAMPLE_TEXTURECUBE_LOD(_ReviewSkyCube,sampler_ReviewSkyCube,reflect(-view,normal),1.4).rgb;
                half3 sky=lerp(_Sky.rgb,reflected,_ReflectionStrength);
                color=lerp(color,sky,saturate(fresnel*.85+.08*_ReflectionStrength));
                color+=sun.color*gleam;
                float broken=.5+.5*sin(q.y*3.1+sin(q.y*.86)*2.2+sin(a)*.5);
                float shore=1-smoothstep(.12,.62,abs(bankDistance-.28-.13*sin(b)));
                half foam=saturate(shore*smoothstep(.38,.82,broken)*_ShoreFoam);
                color=lerp(color,half3(.59,.78,.75),foam);
                color*=lerp(.62,1,saturate(i.normalWS.y));
                return half4(MixFog(color,i.fog),1);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
