// BUKLOD Genesis 2.5D mobile impact shader. Additive, bounded, no screen grab.
shader_type canvas_item;
render_mode blend_add, unshaded;

uniform vec4 energy_color : source_color = vec4(0.44, 0.98, 0.80, 1.0);
uniform float phase : hint_range(0.0, 1.0) = 0.0;
uniform float variation : hint_range(0.0, 6.3) = 0.0;

void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float radius = length(p);
	float angle = atan(p.y, p.x);
	float ring_radius = mix(0.16, 0.87, phase);
	float ring = exp(-pow((radius - ring_radius) * 23.0, 2.0));
	float rays = pow(max(0.0, cos(angle * 6.0 + variation + phase * 2.0)), 24.0)
		* (1.0 - smoothstep(0.12, 0.95, radius));
	float core = exp(-radius * radius * 38.0) * (1.0 - phase);
	float alpha = clamp(ring * 0.85 + rays * 0.27 + core * 0.66, 0.0, 1.0)
		* (1.0 - phase);
	COLOR = vec4(energy_color.rgb * (1.15 + core * 1.6), energy_color.a * alpha);
}
