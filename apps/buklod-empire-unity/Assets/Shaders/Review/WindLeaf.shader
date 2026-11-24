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
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            CBUFFER_START(UnityPerMaterial)
            half4 _BaseColor;
            float _Wind;
            CBUFFER_END
            struct Attributes {float4 positionOS:POSITION;float3 normalOS:NORMAL;};
            struct Varyings {float4 positionCS:SV_POSITION;half3 normalWS:TEXCOORD0;half height:TEXCOORD1;half fog:TEXCOORD2;};
            Varyings Vert(Attributes v){
                Varyings o;
                float3 p=TransformObjectToWorld(v.positionOS.xyz);
                float h=max(0,p.y);
                float wave=sin(p.x*.35+p.z*.19+_Time.y*1.6);
                p.x+=wave*_Wind*h*h;p.z+=cos(p.x*.21+_Time.y)*_Wind*h*.4;
                o.positionCS=TransformWorldToHClip(p);
                o.normalWS=TransformObjectToWorldNormal(v.normalOS);
                o.height=saturate(h/1.7);
                o.fog=ComputeFogFactor(o.positionCS.z);return o;
            }
            half4 Frag(Varyings i):SV_Target {
                Light sun=GetMainLight();
                half3 n=normalize(i.normalWS);
                half diff=abs(dot(n,sun.direction));
                half3 color=_BaseColor.rgb*(.48+.42*i.height+diff*.48*sun.color);
                color+=_BaseColor.rgb*SampleSH(half3(0,1,0))*.35;
                return half4(MixFog(color,i.fog),1);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
