Shader "BUKLOD/Review/WorldSurface" {
    Properties {
        _BaseColor("Original tint",Color)=(1,1,1,1)
        _Detail("Albedo and smoothness",2D)="white"{}
        [Normal] _NormalDetail("Authored surface normal",2D)="bump"{}
        _NormalStrength("Normal strength",Range(0,1))=0
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
            TEXTURE2D(_NormalDetail);SAMPLER(sampler_NormalDetail);
            CBUFFER_START(UnityPerMaterial)
            half4 _BaseColor;
            float _Tile;
            half _Metallic;
            half _NormalStrength;
            CBUFFER_END
            struct Attributes {float4 positionOS:POSITION;float3 normalOS:NORMAL;};
            struct Varyings {float4 positionCS:SV_POSITION;float3 positionWS:TEXCOORD0;half3 normalWS:TEXCOORD1;half fog:TEXCOORD2;};
            Varyings Vert(Attributes i){
                Varyings o;VertexPositionInputs p=GetVertexPositionInputs(i.positionOS.xyz);
                o.positionCS=p.positionCS;o.positionWS=p.positionWS;
                o.normalWS=TransformObjectToWorldNormal(i.normalOS);o.fog=ComputeFogFactor(p.positionCS.z);return o;
            }
            // Low-frequency world variation breaks uniform color without changing map geometry.
            float Hash2(float2 p){return frac(sin(dot(p,float2(127.1,311.7)))*43758.5453);}
            float FieldNoise(float2 p){
                float2 c=floor(p), f=frac(p);f=f*f*(3.0-2.0*f);
                return lerp(lerp(Hash2(c),Hash2(c+float2(1,0)),f.x),
                            lerp(Hash2(c+float2(0,1)),Hash2(c+float2(1,1)),f.x),f.y);
            }
            half4 Frag(Varyings i):SV_Target{
                half3 n=normalize(i.normalWS);
                float3 w=pow(abs(n),4.0);w/=max(.0001,w.x+w.y+w.z);
                float3 p=i.positionWS*_Tile;
                half4 detail=SAMPLE_TEXTURE2D(_Detail,sampler_Detail,p.zy)*w.x+
                             SAMPLE_TEXTURE2D(_Detail,sampler_Detail,p.xz)*w.y+
                             SAMPLE_TEXTURE2D(_Detail,sampler_Detail,p.xy)*w.z;
                // World-projected slope perturbation: no mesh UV or tangent dependency.
                if(_NormalStrength>.001h){
                    half3 nx=UnpackNormal(SAMPLE_TEXTURE2D(_NormalDetail,sampler_NormalDetail,p.zy));
                    half3 ny=UnpackNormal(SAMPLE_TEXTURE2D(_NormalDetail,sampler_NormalDetail,p.xz));
                    half3 nz=UnpackNormal(SAMPLE_TEXTURE2D(_NormalDetail,sampler_NormalDetail,p.xy));
                    half3 slope=half3(0,nx.y,nx.x)*w.x+half3(ny.x,0,ny.y)*w.y+half3(nz.x,nz.y,0)*w.z;
                    n=normalize(n+_NormalStrength*(slope-n*dot(n,slope)));
                }
                half3 baseColor=_BaseColor.rgb*detail.rgb;
                float patch=FieldNoise(i.positionWS.xz*.11);
                float grain=FieldNoise(i.positionWS.xz*.57);
                half ground=saturate(abs(n.y))* (1-_Metallic);
                baseColor*=lerp(1.0,lerp(.74,1.12,patch)*lerp(.90,1.06,grain),ground*.8);
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
