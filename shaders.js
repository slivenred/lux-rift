'use strict';

window.LuxRiftShaders = {
  vertexSource: `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `,
  fragmentSource: `
    precision highp float;
    varying vec2 vUv;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uExposure;
    uniform float uSpectrum;
    uniform float uMaterial;
    uniform vec4 uRift0;
    uniform vec4 uRift1;
    uniform vec4 uMeta0;
    uniform vec4 uMeta1;

    #define PI 3.14159265359

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash21(i), hash21(i + vec2(1.0,0.0)), f.x),
                 mix(hash21(i + vec2(0.0,1.0)), hash21(i + vec2(1.0,1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float value = 0.0;
      float amp = 0.5;
      mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
      for (int i=0; i<4; i++) {
        value += noise(p) * amp;
        p = rot * p * 2.03 + 7.17;
        amp *= 0.5;
      }
      return value;
    }
    vec2 rotate2(vec2 p, float a) {
      float c = cos(a), s = sin(a);
      return mat2(c,-s,s,c) * p;
    }
    vec3 aces(vec3 x) {
      const float a = 2.51;
      const float b = 0.03;
      const float c = 2.43;
      const float d = 0.59;
      const float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    // x: transparent opening, y: soft penumbra, z: physical edge, w: signed fold field
    vec4 riftField(vec2 p, vec4 data, vec4 meta) {
      float life = meta.z;
      if (life < 0.001 || data.z < 2.0) return vec4(0.0);
      vec2 q = rotate2(p - data.xy, -meta.x);
      float halfLen = max(2.0, data.z * 0.5);
      float xn = q.x / halfLen;
      float cap = max(0.0, 1.0 - xn * xn);
      float profile = pow(cap, 0.42);

      float coarse = noise(vec2(q.x * 0.012 + meta.y * 0.071, meta.x * 2.37 + 3.21));
      float fine = noise(vec2(q.x * 0.043 - meta.y * 0.109, meta.x * 4.91 + 8.73));
      float centre = sin(xn * PI * 1.62 + meta.y) * data.w * 0.095 * profile;
      centre += (coarse - 0.5) * data.w * 0.19 * profile * meta.w;
      centre += sin(q.x * 0.061 - meta.y * 1.7) * data.w * 0.026 * profile;

      float widthNoise = (fine - 0.5) * data.w * 0.13;
      float halfWidth = max(0.4, data.w * 0.5 * profile * (0.91 + 0.08 * sin(q.x * 0.034 + meta.y * 1.3)) + widthNoise * profile);
      float signedY = q.y - centre;
      float edgeY = abs(signedY) - halfWidth;
      float endX = abs(q.x) - halfLen;
      float endpointDistance = length(vec2(max(endX, 0.0), signedY));
      float sdf = mix(edgeY, endpointDistance, step(0.0, endX));

      float opening = (1.0 - smoothstep(-1.5, 2.2, sdf)) * life;
      float feather = data.w * 0.34 + 14.0;
      float haloDistance = max(sdf, 0.0) / feather;
      float soft = (1.0 / (1.0 + haloDistance * haloDistance * 8.5)) * smoothstep(0.0, 0.16, cap) * life;
      float edge = (1.0 - smoothstep(0.0, 3.2 + data.w * 0.035, abs(sdf))) * smoothstep(0.015, 0.18, profile) * life;
      float foldDistance = max(sdf, 0.0) / (data.w * 0.46 + 22.0);
      float fold = 1.0 / (1.0 + foldDistance * foldDistance * 5.8);
      fold *= smoothstep(0.0, 0.22, profile) * sign(signedY) * life;
      return vec4(opening, soft, edge, fold);
    }

    void main() {
      vec2 p = vec2(vUv.x * uResolution.x, (1.0 - vUv.y) * uResolution.y);
      vec4 a = riftField(p, uRift0, uMeta0);
      vec4 b = riftField(p, uRift1, uMeta1);

      float opening = 1.0 - (1.0-a.x) * (1.0-b.x);
      float soft = max(a.y, b.y);
      float edge = clamp(a.z + b.z, 0.0, 1.45);
      float fold = clamp(a.w + b.w, -1.0, 1.0);
      float reveal = clamp(opening + soft * 0.62, 0.0, 1.0);

      vec3 graphite = vec3(0.010, 0.013, 0.017);
      vec3 indigo = vec3(0.008, 0.008, 0.027);
      vec3 oxide = vec3(0.024, 0.009, 0.007);
      float m1 = smoothstep(0.25, 0.75, uMaterial);
      float m2 = smoothstep(1.25, 1.75, uMaterial);
      vec3 membrane = mix(graphite, indigo, m1);
      membrane = mix(membrane, oxide, m2);

      vec3 daylight = vec3(1.00, 0.79, 0.56);
      vec3 polar = vec3(0.54, 0.78, 1.00);
      vec3 aurora = vec3(0.52, 1.00, 0.82);
      float s1 = smoothstep(0.25, 0.75, uSpectrum);
      float s2 = smoothstep(1.25, 1.75, uSpectrum);
      vec3 lightColor = mix(daylight, polar, s1);
      lightColor = mix(lightColor, aurora, s2);

      float paperNoise = noise(p * 0.0045 + vec2(uTime * 0.009, -uTime * 0.006));
      float micro = hash21(floor(p * 0.72) + floor(uTime * 0.5));
      membrane *= 0.82 + paperNoise * 0.20 + (micro - 0.5) * 0.035;

      // Folds around the slit: one edge catches light, the opposite edge sinks into shadow.
      float foldHighlight = max(fold, 0.0);
      float foldShadow = max(-fold, 0.0);
      membrane += lightColor * foldHighlight * 0.095 * uExposure;
      membrane *= 1.0 - foldShadow * 0.23;

      // The membrane becomes optically thinner throughout the long penumbra.
      float alphaOutside = 0.978;
      float alphaInside = 0.018;
      float alpha = mix(alphaOutside, alphaInside, reveal);
      alpha += foldShadow * 0.075;
      alpha -= foldHighlight * 0.035;

      // Edge thickness and a restrained diffraction fringe.
      float fringePhase = 0.5 + 0.5 * sin((p.x + p.y) * 0.028 + uTime * 0.35);
      vec3 fringeA = mix(vec3(1.0,0.38,0.18), vec3(0.26,0.62,1.0), fringePhase);
      vec3 rimColor = mix(lightColor, fringeA, 0.24 + 0.10 * uSpectrum);
      vec3 color = membrane;
      float litEdge = edge * (0.48 + foldHighlight * 0.52);
      float darkEdge = edge * foldShadow;
      color = mix(color, rimColor * (0.68 + 0.34 * uExposure), litEdge * 0.82);
      color *= 1.0 - darkEdge * 0.19;

      // A small amount of near-white transmission lifts the underlying native DOM.
      float transmission = opening * (0.032 + 0.040 * uExposure);
      color = mix(color, lightColor * (1.15 + 0.30 * uExposure), transmission);
      alpha = clamp(alpha + edge * 0.075 + darkEdge * 0.12 - opening * 0.018, 0.0, 0.985);

      // Broad subsurface halo just outside the opening.
      float halo = max(0.0, soft - opening) * 0.22 * uExposure;
      color += lightColor * halo * 0.12;
      alpha -= halo * 0.16;

      // Very subtle edge vignette keeps the membrane dimensional without looking like a spotlight.
      vec2 uv = p / uResolution;
      float vignette = smoothstep(0.48, 0.86, distance(uv, vec2(0.5)));
      color *= 1.0 - vignette * 0.12;
      alpha += vignette * 0.02;

      color = aces(max(color, vec3(0.0)) * 1.08);
      color = pow(color, vec3(1.0 / 2.2));
      alpha = clamp(alpha, 0.0, 1.0);
      gl_FragColor = vec4(color * alpha, alpha);
    }
  `
};
