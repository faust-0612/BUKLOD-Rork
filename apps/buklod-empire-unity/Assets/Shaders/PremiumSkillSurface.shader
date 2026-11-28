Shader "BUKLOD/PremiumSkillSurface" {
    Properties { _Intensity("Emission",Range(0,4))=1.6 }
    SubShader {
        Tags {"RenderPipeline"="UniversalPipeline" "Queue"="Transparent+5" "RenderType"="Transparent"}
        Pass {
            Blend One One
            Cull Off
            ZWrite Off
            ZTest LEqual
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma target 3.0
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            CBUFFER_START(UnityPerMaterial)
            half _Intensity;
            CBUFFER_END
            struct Attributes {float4 positionOS:POSITION;float2 uv:TEXCOORD0;half4 color:COLOR;};
            struct Varyings {float4 positionCS:SV_POSITION;float2 uv:TEXCOORD0;half4 color:COLOR;};
            Varyings Vert(Attributes v){Varyings o;o.positionCS=TransformObjectToHClip(v.positionOS.xyz);o.uv=v.uv;o.color=v.color;return o;}
            half4 Frag(Varyings i):SV_Target{
                half edge=saturate(1-abs(i.uv.y*2-1));
                half core=pow(edge,7);half halo=edge*edge;
                // Multi-frequency moving filaments, with no hard flashing or depth override.
                half wave=.65+.35*sin(i.uv.x*32-_Time.y*11+i.uv.y*7);
                half filaments=.72+.28*sin(i.uv.x*81+_Time.y*7);
                half ends=smoothstep(0,.06,i.uv.x)*smoothstep(0,.06,1-i.uv.x);
                half3 rgb=i.color.rgb*halo*.42*wave*filaments+lerp(i.color.rgb,half3(1,1,1),.67)*core*.85;
                return half4(rgb*i.color.a*_Intensity*ends,0);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
