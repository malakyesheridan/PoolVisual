/**
 * PhotoRealisticShaders - Advanced WebGL shaders for world-class material rendering
 * Features: PBR lighting, ambient occlusion, normal mapping, scene luminance matching
 */

import * as PIXI from 'pixi.js';

// Vertex shader for photorealistic material rendering
const photorealisticVertexShader = `#version 300 es
precision highp float;

// Attributes
in vec2 aPosition;
in vec2 aUV;

// Uniforms
uniform mat3 uProjectionMatrix;
uniform mat3 uTransformMatrix;
uniform vec2 uSceneSize;

// Varyings to fragment shader
out vec2 vUV;
out vec2 vScreenPos;
out vec2 vWorldPos;
out vec3 vViewPos;

void main() {
    // Transform position to world space
    vec3 worldPos = uTransformMatrix * vec3(aPosition, 1.0);
    vWorldPos = worldPos.xy;
    
    // Transform to screen space
    vec3 screenPos = uProjectionMatrix * worldPos;
    gl_Position = vec4(screenPos.xy, 0.0, 1.0);
    
    // Pass UV coordinates with world-space scaling
    vUV = aUV;
    
    // Screen position for scene sampling (0-1 range)
    vScreenPos = (screenPos.xy + 1.0) * 0.5;
    
    // View position for lighting calculations
    vViewPos = vec3(worldPos.xy, 0.0);
}`;

// Fragment shader with physically-based rendering
const photorealisticFragmentShader = `#version 300 es
precision highp float;

// Input from vertex shader
in vec2 vUV;
in vec2 vScreenPos;
in vec2 vWorldPos;
in vec3 vViewPos;

// Output
out vec4 fragColor;

// Material textures
uniform sampler2D uDiffuseTexture;
uniform sampler2D uNormalTexture;
uniform sampler2D uRoughnessTexture;
uniform sampler2D uSceneTexture;

// Material properties
uniform float uRoughness;
uniform float uMetallic;
uniform float uSpecular;
uniform float uBumpIntensity;

// Lighting properties
uniform vec3 uLightDirection;
uniform vec3 uLightColor;
uniform float uLightIntensity;
uniform vec3 uAmbientColor;
uniform float uAmbientIntensity;

// Scene matching
uniform float uSceneLuminanceMatch;
uniform float uGamma;
uniform float uContrast;
uniform float uSaturation;

// Surface properties
uniform vec2 uRepeatScale;
uniform float uTileRotation;
uniform vec2 uTileOffset;

// Ambient occlusion
uniform float uAOIntensity;
uniform float uAORadius;
uniform float uEdgeDarkening;

// Utility functions
vec3 toLinear(vec3 color) {
    return pow(color, vec3(uGamma));
}

vec3 toSRGB(vec3 color) {
    return pow(color, vec3(1.0 / uGamma));
}

vec3 adjustContrast(vec3 color, float contrast) {
    return ((color - 0.5) * contrast) + 0.5;
}

vec3 adjustSaturation(vec3 color, float saturation) {
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(luminance), color, saturation);
}

// Normal mapping function
vec3 getNormal() {
    // Sample normal map
    vec3 normalMap = texture(uNormalTexture, vUV).xyz * 2.0 - 1.0;
    normalMap.xy *= uBumpIntensity;
    
    // Create TBN matrix for normal transformation
    vec3 normal = vec3(0.0, 0.0, 1.0);
    vec3 tangent = normalize(dFdx(vViewPos));
    vec3 bitangent = normalize(dFdy(vViewPos));
    mat3 TBN = mat3(tangent, bitangent, normal);
    
    return normalize(TBN * normalMap);
}

// Physically-based lighting calculation
vec3 calculatePBRLighting(vec3 albedo, vec3 normal, vec3 viewDir, vec3 lightDir) {
    // Half vector for specular calculation
    vec3 halfDir = normalize(lightDir + viewDir);
    
    // Dot products
    float NdotL = max(dot(normal, lightDir), 0.0);
    float NdotV = max(dot(normal, viewDir), 0.0);
    float NdotH = max(dot(normal, halfDir), 0.0);
    float VdotH = max(dot(viewDir, halfDir), 0.0);
    
    // Fresnel (Schlick approximation)
    vec3 F0 = mix(vec3(0.04), albedo, uMetallic);
    vec3 F = F0 + (1.0 - F0) * pow(1.0 - VdotH, 5.0);
    
    // Distribution (GGX/Trowbridge-Reitz)
    float alpha = uRoughness * uRoughness;
    float alpha2 = alpha * alpha;
    float denom = NdotH * NdotH * (alpha2 - 1.0) + 1.0;
    float D = alpha2 / (3.14159265 * denom * denom);
    
    // Geometry (Smith model)
    float k = (uRoughness + 1.0) * (uRoughness + 1.0) / 8.0;
    float G1L = NdotL / (NdotL * (1.0 - k) + k);
    float G1V = NdotV / (NdotV * (1.0 - k) + k);
    float G = G1L * G1V;
    
    // BRDF
    vec3 numerator = D * G * F;
    float denominator = 4.0 * NdotV * NdotL + 0.001;
    vec3 specular = numerator / denominator;
    
    // Diffuse (Lambert)
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - uMetallic;
    vec3 diffuse = kD * albedo / 3.14159265;
    
    // Combine diffuse and specular
    return (diffuse + specular * uSpecular) * uLightColor * uLightIntensity * NdotL;
}

// Ambient occlusion calculation
float calculateAO(vec2 screenPos) {
    float ao = 1.0;
    vec2 texelSize = 1.0 / textureSize(uSceneTexture, 0);
    
    // Sample surrounding pixels for occlusion
    for(int i = 0; i < 8; i++) {
        float angle = float(i) * 3.14159265 * 2.0 / 8.0;
        vec2 offset = vec2(cos(angle), sin(angle)) * uAORadius * texelSize;
        
        vec3 sampleColor = texture(uSceneTexture, screenPos + offset).rgb;
        float sampleLuminance = dot(sampleColor, vec3(0.299, 0.587, 0.114));
        
        // Darker surrounding areas contribute to occlusion
        ao -= (1.0 - sampleLuminance) * uAOIntensity * 0.125;
    }
    
    return clamp(ao, 0.0, 1.0);
}

// Edge darkening for contact shadows
float calculateEdgeDarkening() {
    vec2 dx = dFdx(vScreenPos);
    vec2 dy = dFdy(vScreenPos);
    float edgeValue = length(dx) + length(dy);
    return 1.0 - (edgeValue * uEdgeDarkening);
}

void main() {
    // Apply UV transformations
    vec2 transformedUV = vUV * uRepeatScale + uTileOffset;
    
    // Rotate UVs if needed
    if (uTileRotation != 0.0) {
        float cosTheta = cos(uTileRotation);
        float sinTheta = sin(uTileRotation);
        mat2 rotationMatrix = mat2(cosTheta, -sinTheta, sinTheta, cosTheta);
        transformedUV = rotationMatrix * (transformedUV - 0.5) + 0.5;
    }
    
    // Sample material textures
    vec4 diffuseColor = texture(uDiffuseTexture, transformedUV);
    vec3 albedo = toLinear(diffuseColor.rgb);
    
    // Sample scene for luminance matching
    vec3 sceneColor = texture(uSceneTexture, vScreenPos).rgb;
    float sceneLuminance = dot(sceneColor, vec3(0.299, 0.587, 0.114));
    
    // Calculate surface normal
    vec3 normal = getNormal();
    
    // View and light directions
    vec3 viewDir = normalize(-vViewPos);
    vec3 lightDir = normalize(uLightDirection);
    
    // Calculate PBR lighting
    vec3 litColor = calculatePBRLighting(albedo, normal, viewDir, lightDir);
    
    // Add ambient lighting
    vec3 ambient = uAmbientColor * uAmbientIntensity * albedo;
    litColor += ambient;
    
    // Apply ambient occlusion
    float ao = calculateAO(vScreenPos);
    litColor *= ao;
    
    // Apply edge darkening
    float edgeDarkening = calculateEdgeDarkening();
    litColor *= edgeDarkening;
    
    // Scene luminance matching
    float targetLuminance = sceneLuminance * uSceneLuminanceMatch;
    float currentLuminance = dot(litColor, vec3(0.299, 0.587, 0.114));
    if (currentLuminance > 0.001) {
        litColor *= targetLuminance / currentLuminance;
    }
    
    // Color grading
    litColor = adjustContrast(litColor, uContrast);
    litColor = adjustSaturation(litColor, uSaturation);
    
    // Convert back to sRGB
    litColor = toSRGB(litColor);
    
    // Output with alpha
    fragColor = vec4(litColor, diffuseColor.a);
}`;

/**
 * PhotoRealisticMaterialShader - Complete PBR shader for world-class material rendering
 */
export class PhotoRealisticMaterialShader extends PIXI.Shader {
    constructor() {
        // Create uniform groups with proper PixiJS v8 types
        const materialUniforms = new PIXI.UniformGroup({
            uDiffuseTexture: { value: PIXI.Texture.WHITE, type: 'sampler2D' },
            uNormalTexture: { value: PIXI.Texture.WHITE, type: 'sampler2D' },
            uRoughnessTexture: { value: PIXI.Texture.WHITE, type: 'sampler2D' },
            uSceneTexture: { value: PIXI.Texture.WHITE, type: 'sampler2D' },
            
            // Material properties
            uRoughness: { value: 0.5, type: 'f32' },
            uMetallic: { value: 0.0, type: 'f32' },
            uSpecular: { value: 1.0, type: 'f32' },
            uBumpIntensity: { value: 1.0, type: 'f32' },
            
            // Surface properties
            uRepeatScale: { value: [1.0, 1.0], type: 'vec2<f32>' },
            uTileRotation: { value: 0.0, type: 'f32' },
            uTileOffset: { value: [0.0, 0.0], type: 'vec2<f32>' },
        });
        
        const lightingUniforms = new PIXI.UniformGroup({
            // Lighting
            uLightDirection: { value: [-0.5, -0.7, -0.5], type: 'vec3<f32>' },
            uLightColor: { value: [1.0, 1.0, 1.0], type: 'vec3<f32>' },
            uLightIntensity: { value: 2.0, type: 'f32' },
            uAmbientColor: { value: [0.3, 0.3, 0.4], type: 'vec3<f32>' },
            uAmbientIntensity: { value: 0.5, type: 'f32' },
            
            // Scene matching
            uSceneLuminanceMatch: { value: 1.0, type: 'f32' },
            uGamma: { value: 2.2, type: 'f32' },
            uContrast: { value: 1.1, type: 'f32' },
            uSaturation: { value: 1.0, type: 'f32' },
            
            // Ambient occlusion
            uAOIntensity: { value: 0.3, type: 'f32' },
            uAORadius: { value: 2.0, type: 'f32' },
            uEdgeDarkening: { value: 0.2, type: 'f32' },
        });
        
        const transformUniforms = new PIXI.UniformGroup({
            uSceneSize: { value: [800, 600], type: 'vec2<f32>' },
        });
        
        // Initialize shader with resources
        super({
            glProgram: PIXI.GlProgram.from({
                vertex: photorealisticVertexShader,
                fragment: photorealisticFragmentShader,
                name: 'photorealistic-material'
            }),
            resources: {
                materialUniforms,
                lightingUniforms,
                transformUniforms
            }
        });
        
        console.info('[PhotoRealisticShader] Initialized with PBR lighting, AO, and scene matching');
    }
    
    /**
     * Update material textures
     */
    setTextures(diffuse: PIXI.Texture, normal?: PIXI.Texture, roughness?: PIXI.Texture, scene?: PIXI.Texture) {
        this.resources.materialUniforms.uniforms.uDiffuseTexture.value = diffuse;
        if (normal) this.resources.materialUniforms.uniforms.uNormalTexture.value = normal;
        if (roughness) this.resources.materialUniforms.uniforms.uRoughnessTexture.value = roughness;
        if (scene) this.resources.materialUniforms.uniforms.uSceneTexture.value = scene;
    }
    
    /**
     * Update material properties for photorealistic rendering
     */
    setMaterialProperties(props: {
        roughness?: number;
        metallic?: number;
        specular?: number;
        bumpIntensity?: number;
    }) {
        if (props.roughness !== undefined) this.resources.materialUniforms.uniforms.uRoughness.value = props.roughness;
        if (props.metallic !== undefined) this.resources.materialUniforms.uniforms.uMetallic.value = props.metallic;
        if (props.specular !== undefined) this.resources.materialUniforms.uniforms.uSpecular.value = props.specular;
        if (props.bumpIntensity !== undefined) this.resources.materialUniforms.uniforms.uBumpIntensity.value = props.bumpIntensity;
    }
    
    /**
     * Update lighting for scene-matched rendering
     */
    setLighting(props: {
        lightDirection?: [number, number, number];
        lightColor?: [number, number, number];
        lightIntensity?: number;
        ambientColor?: [number, number, number];
        ambientIntensity?: number;
    }) {
        if (props.lightDirection) this.resources.lightingUniforms.uniforms.uLightDirection.value = props.lightDirection;
        if (props.lightColor) this.resources.lightingUniforms.uniforms.uLightColor.value = props.lightColor;
        if (props.lightIntensity !== undefined) this.resources.lightingUniforms.uniforms.uLightIntensity.value = props.lightIntensity;
        if (props.ambientColor) this.resources.lightingUniforms.uniforms.uAmbientColor.value = props.ambientColor;
        if (props.ambientIntensity !== undefined) this.resources.lightingUniforms.uniforms.uAmbientIntensity.value = props.ambientIntensity;
    }
    
    /**
     * Update surface properties
     */
    setSurfaceProperties(props: {
        repeatScale?: [number, number];
        rotation?: number;
        offset?: [number, number];
    }) {
        if (props.repeatScale) this.resources.materialUniforms.uniforms.uRepeatScale.value = props.repeatScale;
        if (props.rotation !== undefined) this.resources.materialUniforms.uniforms.uTileRotation.value = props.rotation;
        if (props.offset) this.resources.materialUniforms.uniforms.uTileOffset.value = props.offset;
    }
    
    /**
     * Update ambient occlusion and post-processing
     */
    setPostProcessing(props: {
        aoIntensity?: number;
        aoRadius?: number;
        edgeDarkening?: number;
        sceneLuminanceMatch?: number;
        gamma?: number;
        contrast?: number;
        saturation?: number;
    }) {
        if (props.aoIntensity !== undefined) this.resources.lightingUniforms.uniforms.uAOIntensity.value = props.aoIntensity;
        if (props.aoRadius !== undefined) this.resources.lightingUniforms.uniforms.uAORadius.value = props.aoRadius;
        if (props.edgeDarkening !== undefined) this.resources.lightingUniforms.uniforms.uEdgeDarkening.value = props.edgeDarkening;
        if (props.sceneLuminanceMatch !== undefined) this.resources.lightingUniforms.uniforms.uSceneLuminanceMatch.value = props.sceneLuminanceMatch;
        if (props.gamma !== undefined) this.resources.lightingUniforms.uniforms.uGamma.value = props.gamma;
        if (props.contrast !== undefined) this.resources.lightingUniforms.uniforms.uContrast.value = props.contrast;
        if (props.saturation !== undefined) this.resources.lightingUniforms.uniforms.uSaturation.value = props.saturation;
    }
}