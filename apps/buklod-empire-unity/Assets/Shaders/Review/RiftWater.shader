Shader "BUKLOD/Review/RiftWater" {
    Properties {
        _Deep("Deep water",Color)=(.018,.14,.21,1)
        _Shallow("Shallow water",Color)=(.035,.40,.44,1)
        _Sky("Sky tint",Color)=(.32,.55,.70,1)
        _WaveStrength("Wave strength",Range(.02,.25))=.12
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
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            CBUFFER_START(UnityPerMaterial)
            half4 _Deep,_Shallow,_Sky;
            float _WaveStrength;
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
                float a=dot(p,float2(.81,.36))+t*.8;
                float b=dot(p,float2(-.41,1.12))-t*.57;
                float c=dot(p,float2(1.42,-.83))+t*.38;
                float2 slope=float2(cos(a)*.81+cos(b)*-.41,cos(a)*.36+cos(b)*1.12)*_WaveStrength;
                half3 normal=normalize(half3(-slope.x,1,-slope.y));
                half3 view=GetWorldSpaceNormalizeViewDir(i.positionWS);
                Light sun=GetMainLight();
                half3 halfway=SafeNormalize(sun.direction+view);
                half fresnel=pow(1-saturate(dot(normal,view)),4);
                half gleam=pow(saturate(dot(normal,halfway)),32)*.55;
                float edge=smoothstep(3.5,5.3,abs(p.x-160));
                half ripples=saturate((sin(a)+sin(b)+sin(c))*.1667+.5);
                half3 color=lerp(_Deep.rgb,_Shallow.rgb,saturate(edge*.7+ripples*.35));
                color=lerp(color,_Sky.rgb,fresnel*.6);
                color+=sun.color*gleam+half3(.07,.16,.16)*edge*smoothstep(.65,.95,ripples);
                // Side faces remain dark; the original geometry and navigation stay fixed.
                color*=lerp(.62,1,saturate(i.normalWS.y));
                return half4(MixFog(color,i.fog),1);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
