shader_type spatial;
render_mode cull_back;
uniform vec4 ground_color : source_color = vec4(0.30,0.48,0.23,1.0);
uniform vec4 trail_color : source_color = vec4(0.62,0.48,0.31,1.0);
uniform float realm_seed = 0.0;
varying vec3 world_pos;
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),u.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),u.x),u.y);}
void vertex(){world_pos=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;}
void fragment(){
 vec2 p=world_pos.xz;
 float broad=noise2(p*0.15+realm_seed), detail=noise2(p*3.8+realm_seed);
 float path=1.0-smoothstep(0.8,2.25,abs(p.x+sin(p.y*0.22+realm_seed)*1.6));
 float stone=noise2(p*7.0);
 float fine=noise2(p*18.0+realm_seed*0.4);
 float worn=smoothstep(0.45,0.72,noise2(p*0.8+realm_seed));
 vec2 brick=p*2.65; brick.x+=floor(brick.y)*0.5;
 vec2 seam=abs(fract(brick)-0.5);
 float joint=smoothstep(0.42,0.48,max(seam.x,seam.y));
 float stone_tile=hash21(floor(brick)+realm_seed);
 vec3 soil=ground_color.rgb*(0.64+0.43*broad+0.19*detail+0.10*fine);
 vec3 trail=trail_color.rgb*(0.68+0.22*stone+0.15*stone_tile);
 float paved=step(1.5,realm_seed)* (1.0-step(3.5,realm_seed))+step(9.5,realm_seed)*(1.0-step(10.5,realm_seed));
 trail=mix(trail,trail*(1.0-joint*0.42),clamp(paved,0.0,1.0));
 ALBEDO=mix(soil,trail,path*(0.78+0.15*worn));
 ROUGHNESS=mix(0.96,0.78,path*clamp(paved,0.0,1.0));
 NORMAL_MAP=vec3(0.5+(detail-0.5)*0.13+(fine-0.5)*0.07,0.5+(stone-0.5)*0.12,1.0); NORMAL_MAP_DEPTH=0.52;
}
