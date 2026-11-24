Shader "BUKLOD/Review/WorldFragments" {
    SubShader {
        Tags {"RenderPipeline"="UniversalPipeline" "Queue"="Geometry" "RenderType"="Opaque"}
        Pass {
            Name "WorldFragments"
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
            struct Attributes {float4 positionOS:POSITION;float3 normalOS:NORMAL;half4 color:COLOR;};
            struct Varyings {float4 positionCS:SV_POSITION;half3 normalWS:TEXCOORD0;half4 color:COLOR;half fog:TEXCOORD1;};
            Varyings Vert(Attributes i){
                Varyings o;VertexPositionInputs p=GetVertexPositionInputs(i.positionOS.xyz);
                o.positionCS=p.positionCS;o.normalWS=TransformObjectToWorldNormal(i.normalOS);
                o.color=i.color;o.fog=ComputeFogFactor(p.positionCS.z);return o;
            }
            half4 Frag(Varyings i):SV_Target{
                Light sun=GetMainLight();
                half lit=.38h+.62h*saturate(dot(normalize(i.normalWS),sun.direction));
                return half4(MixFog(i.color.rgb*(.22h+lit*sun.color),i.fog),1);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
