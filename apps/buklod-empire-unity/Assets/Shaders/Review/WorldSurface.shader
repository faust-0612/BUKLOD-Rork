Shader "BUKLOD/Review/WorldSurface" {
    Properties {
        _BaseColor("Original tint",Color)=(1,1,1,1)
        _Detail("Albedo and smoothness",2D)="white"{}
        _Tile("Tiles per world unit",Float)=.45
        _Metallic("Metallic",Range(0,1))=0
        _BaseMap("Shadow pass compatibility",2D)="white"{}
        _Cutoff("Cutoff",Range(0,1))=.5
    }
    SubShader {
        Tags {"RenderPipeline"="UniversalPipeline" "Queue"="Geometry" "RenderType"="Opaque"}
        Pass {
            Name "WorldSurface"
            Tags {"LightMode"="UniversalForward"}
            Cull Back
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
            TEXTURE2D(_Detail);SAMPLER(sampler_Detail);
            CBUFFER_START(UnityPerMaterial)
            half4 _BaseColor;
            float _Tile;
            half _Metallic;
            CBUFFER_END
            struct Attributes {float4 positionOS:POSITION;float3 normalOS:NORMAL;};
            struct Varyings {float4 positionCS:SV_POSITION;float3 positionWS:TEXCOORD0;half3 normalWS:TEXCOORD1;half fog:TEXCOORD2;};
            Varyings Vert(Attributes i){
                Varyings o;VertexPositionInputs p=GetVertexPositionInputs(i.positionOS.xyz);
                o.positionCS=p.positionCS;o.positionWS=p.positionWS;
                o.normalWS=TransformObjectToWorldNormal(i.normalOS);o.fog=ComputeFogFactor(p.positionCS.z);return o;
            }
            half4 Frag(Varyings i):SV_Target{
                half3 n=normalize(i.normalWS);
                float3 w=pow(abs(n),4.0);w/=max(.0001,w.x+w.y+w.z);
                float3 p=i.positionWS*_Tile;
                half4 detail=SAMPLE_TEXTURE2D(_Detail,sampler_Detail,p.zy)*w.x+
                             SAMPLE_TEXTURE2D(_Detail,sampler_Detail,p.xz)*w.y+
                             SAMPLE_TEXTURE2D(_Detail,sampler_Detail,p.xy)*w.z;
                half3 baseColor=_BaseColor.rgb*detail.rgb;
                #if defined(_MAIN_LIGHT_SHADOWS_SCREEN)
                    float4 shadowCoord=ComputeScreenPos(TransformWorldToHClip(i.positionWS));
                #else
                    float4 shadowCoord=TransformWorldToShadowCoord(i.positionWS);
                #endif
                Light sun=GetMainLight(shadowCoord);
                half3 view=GetWorldSpaceNormalizeViewDir(i.positionWS);
                half diffuse=saturate(dot(n,sun.direction));
                half spec=pow(saturate(dot(n,SafeNormalize(view+sun.direction))),lerp(8,90,detail.a));
                half3 ambient=max(SampleSH(n),half3(.12,.12,.12));
                half3 color=baseColor*(ambient+sun.color*diffuse*sun.shadowAttenuation*(1-_Metallic*.48h));
                color+=lerp(half3(.04,.04,.04),baseColor,_Metallic)*sun.color*spec*detail.a*sun.shadowAttenuation;
                return half4(MixFog(color,i.fog),1);
            }
            ENDHLSL
        }
        UsePass "Universal Render Pipeline/Lit/ShadowCaster"
    }
    FallBack Off
}
