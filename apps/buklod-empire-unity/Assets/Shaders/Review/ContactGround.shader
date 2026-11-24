Shader "BUKLOD/Review/ContactGround" {
    Properties { _Tint("Contact tint",Color)=(.045,.06,.075,1) }
    SubShader {
        Tags {"RenderPipeline"="UniversalPipeline" "Queue"="Transparent-40" "RenderType"="Transparent"}
        Pass {
            Name "ContactGround"
            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite Off ZTest LEqual Cull Off
            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex Vert
            #pragma fragment Frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            CBUFFER_START(UnityPerMaterial)
            half4 _Tint;
            CBUFFER_END
            struct Attributes {float4 positionOS:POSITION;float2 uv:TEXCOORD0;half4 color:COLOR;};
            struct Varyings {float4 positionCS:SV_POSITION;float2 uv:TEXCOORD0;half4 color:COLOR;};
            Varyings Vert(Attributes i){Varyings o;o.positionCS=TransformObjectToHClip(i.positionOS.xyz);o.uv=i.uv;o.color=i.color;return o;}
            half4 Frag(Varyings i):SV_Target {
                float2 p=i.uv*2-1;
                half a=1-smoothstep(.08,1,dot(p,p));
                return half4(_Tint.rgb,a*a*i.color.a*_Tint.a);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
