Shader "BUKLOD/Review/WindLeaf" {
    Properties {
        _BaseColor("Leaf color",Color)=(.18,.39,.14,1)
        _Wind("Wind strength",Range(0,.2))=.07
    }
    SubShader {
        Tags {"RenderPipeline"="UniversalPipeline" "Queue"="Geometry" "RenderType"="Opaque"}
        Pass {
            Name "WindLeaf"
            Tags {"LightMode"="UniversalForward"}
            Cull Off
            ZWrite On
            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile_fog
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            CBUFFER_START(UnityPerMaterial)
            half4 _BaseColor;
            float _Wind;
            CBUFFER_END
            struct Attributes {float4 positionOS:POSITION;float3 normalOS:NORMAL;};
            struct Varyings {float4 positionCS:SV_POSITION;half3 normalWS:TEXCOORD0;half height:TEXCOORD1;half fog:TEXCOORD2;float3 positionWS:TEXCOORD3;};
            Varyings Vert(Attributes v){
                Varyings o;
                float3 p=TransformObjectToWorld(v.positionOS.xyz);
                float h=clamp(p.y,0,2.4);
                float gust=.68+.32*sin(p.x*.071-p.z*.063+_Time.y*.48);
                float wave=(sin(p.x*.35+p.z*.19+_Time.y*1.6)*.78+sin(p.x*.91-p.z*.61+_Time.y*2.3)*.22)*gust;
                p.x+=wave*_Wind*h*h;p.z+=cos(p.x*.21+_Time.y)*_Wind*h*.4;
                o.positionCS=TransformWorldToHClip(p);o.positionWS=p;
                o.normalWS=TransformObjectToWorldNormal(v.normalOS);
                o.height=saturate(h/1.7);
                o.fog=ComputeFogFactor(o.positionCS.z);return o;
            }
            half4 Frag(Varyings i):SV_Target {
                #if defined(_MAIN_LIGHT_SHADOWS_SCREEN)
                    float4 shadowCoord=ComputeScreenPos(TransformWorldToHClip(i.positionWS));
                #else
                    float4 shadowCoord=TransformWorldToShadowCoord(i.positionWS);
                #endif
                Light sun=GetMainLight(shadowCoord);
                half3 n=normalize(i.normalWS);
                half diff=abs(dot(n,sun.direction));
                half back=saturate(dot(-n,sun.direction));
                half patch=.5+.5*sin(i.positionWS.x*.73+sin(i.positionWS.z*.53)*1.7);
                half3 baseColor=_BaseColor.rgb*lerp(.78,1.14,patch)*lerp(.8,1.18,i.height);
                half3 color=baseColor*(max(SampleSH(n),half3(.19,.20,.16))+diff*.66*sun.color*sun.shadowAttenuation);
                color+=baseColor*half3(.42,.48,.12)*back*sun.shadowAttenuation*.52;
                return half4(MixFog(color,i.fog),1);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
