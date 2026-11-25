shader_type spatial;
render_mode cull_disabled;
uniform vec4 water_color : source_color = vec4(0.08,0.39,0.48,1.0);
uniform vec4 foam_color : source_color = vec4(0.69,0.91,0.93,1.0);
void fragment(){
 vec2 uv=UV;
 float wave=sin(uv.x*34.0+TIME*2.5+sin(uv.y*10.0-TIME*1.7));
 float streak=sin(uv.y*66.0-TIME*8.0+sin(uv.x*18.0)*2.4);
 float ripple=0.5+0.5*wave*streak;
 float foam=smoothstep(0.68,0.94,ripple)*0.46;
 ALBEDO=mix(water_color.rgb,foam_color.rgb,foam);
 METALLIC=0.13; ROUGHNESS=mix(0.23,0.62,foam);
 NORMAL_MAP=vec3(0.5+wave*0.10,0.5+streak*0.08,1.0);
 NORMAL_MAP_DEPTH=0.75; EMISSION=foam_color.rgb*foam*0.075;
}
