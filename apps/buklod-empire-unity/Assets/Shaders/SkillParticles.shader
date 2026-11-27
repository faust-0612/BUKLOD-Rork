Shader "BUKLOD/SkillParticles" {
    Properties {
        _Energy("HDR energy",Range(0,8))=3.2
        _AuthoredLight("Authored light",2D)="white" {}
        _AuthoredMagic("Authored magic",2D)="white" {}
        _UseAuthored("Use authored mask",Float)=0
    }
    SubShader {
        Tags {"RenderPipeline"="UniversalPipeline" "Queue"="Transparent+10" "RenderType"="Transparent"}
        Pass {
            Blend One One
            ZWrite Off
            ZTest LEqual
            Cull Off
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma target 3.0
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            CBUFFER_START(UnityPerMaterial)
            half _Energy;
            half _UseAuthored;
            CBUFFER_END
            TEXTURE2D(_AuthoredLight); SAMPLER(sampler_AuthoredLight);
            TEXTURE2D(_AuthoredMagic); SAMPLER(sampler_AuthoredMagic);
            struct Attributes {float4 positionOS:POSITION;float2 uv:TEXCOORD0;half4 color:COLOR;};
            struct Varyings {float4 positionCS:SV_POSITION;float2 uv:TEXCOORD0;half4 color:COLOR;};
            Varyings Vert(Attributes v){Varyings o;o.positionCS=TransformObjectToHClip(v.positionOS.xyz);o.uv=v.uv;o.color=v.color;return o;}
            half4 Frag(Varyings i):SV_Target {
                float2 p=i.uv*2-1;float d=dot(p,p);
                half halo=saturate(1-d);halo=halo*halo;
                half core=saturate(1-d*7);core=core*core;
                half3 light=i.color.rgb*halo*.60+lerp(i.color.rgb,half3(1,1,1),.65)*core;
                if(_UseAuthored>.5){
                    half4 a=SAMPLE_TEXTURE2D(_AuthoredLight,sampler_AuthoredLight,i.uv);
                    half4 b=SAMPLE_TEXTURE2D(_AuthoredMagic,sampler_AuthoredMagic,i.uv);
                    half glow=max(a.r,max(a.g,a.b))*a.a;
                    half magic=max(b.r,max(b.g,b.b))*b.a;
                    light=i.color.rgb*glow*.55+lerp(i.color.rgb,half3(1,1,1),.4)*magic*.65;
                }
                return half4(light*i.color.a*_Energy,0);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
