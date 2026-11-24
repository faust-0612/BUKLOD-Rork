Shader "BUKLOD/Review/RiftCascade" {
    Properties {
        _WaterTint("Water tint", Color)=(.16,.53,.64,1)
        _FoamTint("Foam tint", Color)=(.78,.91,.95,1)
        _FlowSpeed("Flow speed", Range(.1,5))=1.65
    }
    SubShader {
        Tags {"RenderPipeline"="UniversalPipeline" "Queue"="Geometry" "RenderType"="Opaque"}
        Pass {
            Name "Cascade"
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
            half4 _WaterTint, _FoamTint;
            float _FlowSpeed;
            CBUFFER_END
            struct Attributes {float4 positionOS:POSITION;float3 normalOS:NORMAL;};
            struct Varyings {float4 positionCS:SV_POSITION;float3 positionWS:TEXCOORD0;half3 normalWS:TEXCOORD1;half fog:TEXCOORD2;};
            Varyings Vert(Attributes v) {
                Varyings o;
                VertexPositionInputs p=GetVertexPositionInputs(v.positionOS.xyz);
                o.positionCS=p.positionCS;o.positionWS=p.positionWS;
                o.normalWS=TransformObjectToWorldNormal(v.normalOS);
                o.fog=ComputeFogFactor(p.positionCS.z);return o;
            }
            half4 Frag(Varyings i):SV_Target {
                float x=i.positionWS.x,y=i.positionWS.y,t=_Time.y*_FlowSpeed;
                // Constant phase travels downward as time advances. No scene/depth texture dependency.
                float flow=y*5.5+t*5.5;
                half streak=smoothstep(.52,.90,.5+.5*sin(x*8.2+.40*sin(flow)));
                half splash=smoothstep(.4,.95,.5+.5*sin(flow+x*2.6));
                half foam=saturate(streak*.64+splash*.23+(1-smoothstep(.10,.95,y))*.55);
                half3 n=normalize(i.normalWS);
                half3 view=GetWorldSpaceNormalizeViewDir(i.positionWS);
                half fresnel=pow(1-saturate(abs(dot(n,view))),3);
                Light sun=GetMainLight();
                half3 tint=lerp(_WaterTint.rgb,_FoamTint.rgb,saturate(foam+fresnel*.15));
                tint*=lerp(.8,1.12,saturate(abs(dot(n,sun.direction))));
                return half4(MixFog(tint,i.fog),1);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
