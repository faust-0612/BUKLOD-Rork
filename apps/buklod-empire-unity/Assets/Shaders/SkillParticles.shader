Shader "BUKLOD/SkillParticles" {
    Properties { _Energy("HDR energy",Range(0,8))=3.2 }
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
            CBUFFER_END
            struct Attributes {float4 positionOS:POSITION;float2 uv:TEXCOORD0;half4 color:COLOR;};
            struct Varyings {float4 positionCS:SV_POSITION;float2 uv:TEXCOORD0;half4 color:COLOR;};
            Varyings Vert(Attributes v){Varyings o;o.positionCS=TransformObjectToHClip(v.positionOS.xyz);o.uv=v.uv;o.color=v.color;return o;}
            half4 Frag(Varyings i):SV_Target {
                float2 p=i.uv*2-1;float d=dot(p,p);
                half halo=saturate(1-d);halo=halo*halo;
                half core=saturate(1-d*7);core=core*core;
                half3 light=i.color.rgb*halo*.60+lerp(i.color.rgb,half3(1,1,1),.65)*core;
                return half4(light*i.color.a*_Energy,0);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
