import * as THREE from 'three';

/**
 * MaterialManager - Centralized PBR Material & Texture Management System.
 * 
 * Features:
 * - High performance texture loading with deduplication and caching.
 * - Strict PBR compliance: diffuse maps in THREE.SRGBColorSpace, normal/roughness/metalness in THREE.NoColorSpace (linear).
 * - Texture RepeatWrapping configuration with custom anisotropy.
 * - Reusable shared MeshStandardMaterial instances for buildings, roads, sidewalks, terrain, vegetation, and industrial props.
 * - Instant fallback and zero lag with GPU memory optimization.
 */
class MaterialManagerSingleton {
  constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.textureCache = new Map();
    this.materialCache = new Map();
    this.basePath = '/materials/textures/';
    this.maxAnisotropy = 8;
  }

  /**
   * Set maximum anisotropy based on renderer capabilities
   */
  initRendererCapabilities(renderer) {
    if (renderer && renderer.capabilities) {
      this.maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
  }

  /**
   * Loads or retrieves cached texture with proper color space and repeat wrapping
   */
  loadTexture(filename, isColor = false, repeatX = 1, repeatY = 1) {
    const key = `${filename}:${isColor ? 'srgb' : 'linear'}:${repeatX}x${repeatY}`;
    if (this.textureCache.has(key)) {
      return this.textureCache.get(key);
    }

    const url = `${this.basePath}${filename}`;
    const texture = this.textureLoader.load(
      url,
      (tex) => {
        tex.needsUpdate = true;
      },
      undefined,
      (err) => {
        console.warn(`[MaterialManager] Warning: failed to load texture "${url}".`, err);
      }
    );

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = this.maxAnisotropy;

    this.textureCache.set(key, texture);
    return texture;
  }

  loadColorTexture(filename, repeatX = 1, repeatY = 1) {
    return this.loadTexture(filename, true, repeatX, repeatY);
  }

  loadNormalTexture(filename, repeatX = 1, repeatY = 1) {
    return this.loadTexture(filename, false, repeatX, repeatY);
  }

  loadRoughnessTexture(filename, repeatX = 1, repeatY = 1) {
    return this.loadTexture(filename, false, repeatX, repeatY);
  }

  loadMetalnessTexture(filename, repeatX = 1, repeatY = 1) {
    return this.loadTexture(filename, false, repeatX, repeatY);
  }

  // =========================================================================
  // 1. ROAD & HIGHWAY MATERIALS
  // =========================================================================

  /**
   * PBR Asphalt Road material with 1K normal and roughness maps
   */
  getAsphaltRoadMaterial(options = {}) {
    const rx = options.repeatX || 2;
    const ry = options.repeatY || 8;
    const key = `mat_asphalt_road_${rx}_${ry}_${options.polygonOffset ? 'po' : 'nopo'}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const normalMap = this.loadNormalTexture('asphalt_01_nor_gl_1k.png', rx, ry);
    const roughnessMap = this.loadRoughnessTexture('asphalt_01_rough_1k.png', rx, ry);

    const mat = new THREE.MeshStandardMaterial({
      map: options.map || this.loadColorTexture('asphalt_01_diff_1k.jpg', rx, ry),
      normalMap: normalMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughnessMap: roughnessMap,
      roughness: options.roughness !== undefined ? options.roughness : 0.88,
      metalness: options.metalness !== undefined ? options.metalness : 0.08,
      polygonOffset: !!options.polygonOffset,
      polygonOffsetFactor: options.polygonOffsetFactor || -1.0,
      polygonOffsetUnits: options.polygonOffsetUnits || -1.0
    });

    this.materialCache.set(key, mat);
    return mat;
  }

  // =========================================================================
  // 2. SIDEWALKS, CURBS, PAVING MATERIALS
  // =========================================================================

  /**
   * PBR Concrete Sidewalk material (Trim 01 architectural stone paving)
   */
  getSidewalkMaterial(options = {}) {
    const rx = options.repeatX || 1;
    const ry = options.repeatY || 10;
    const key = `mat_sidewalk_${rx}_${ry}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const mat = new THREE.MeshStandardMaterial({
      map: this.loadColorTexture('modular_urban_apartments_facade_trim_01_diff_1k.png', rx, ry),
      normalMap: this.loadNormalTexture('modular_urban_apartments_facade_trim_01_nor_gl_1k.png', rx, ry),
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap: this.loadRoughnessTexture('modular_urban_apartments_facade_trim_01_rough_1k.png', rx, ry),
      roughness: 0.85,
      metalness: 0.05
    });

    this.materialCache.set(key, mat);
    return mat;
  }

  /**
   * PBR Concrete Curb material (Trim 02 stone bevels)
   */
  getCurbMaterial(options = {}) {
    const rx = options.repeatX || 1;
    const ry = options.repeatY || 12;
    const key = `mat_curb_${rx}_${ry}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const mat = new THREE.MeshStandardMaterial({
      map: this.loadColorTexture('modular_urban_apartments_facade_trim_02_diff_1k.png', rx, ry),
      normalMap: this.loadNormalTexture('modular_urban_apartments_facade_trim_02_nor_gl_1k.png', rx, ry),
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughnessMap: this.loadRoughnessTexture('modular_urban_apartments_facade_trim_02_rough_1k.png', rx, ry),
      roughness: 0.82,
      metalness: 0.06
    });

    this.materialCache.set(key, mat);
    return mat;
  }

  // =========================================================================
  // 3. ARCHITECTURAL & BUILDING MATERIALS
  // =========================================================================

  /**
   * PBR Stacked Brick Wall (1K/2K diffuse, normal, roughness)
   */
  getBrickMaterial(options = {}) {
    const rx = options.repeatX || 3;
    const ry = options.repeatY || 3;
    const use2K = !!options.highRes;
    const key = `mat_brick_${rx}_${ry}_${use2K ? '2k' : '1k'}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const diffFile = use2K ? 'stacked_brick_wall_diff_2k.jpg' : 'stacked_brick_wall_diff_1k.jpg';
    const norFile = use2K ? 'stacked_brick_wall_nor_gl_2k.png' : 'stacked_brick_wall_nor_gl_1k.png';
    const roughFile = use2K ? 'stacked_brick_wall_rough_2k.png' : 'stacked_brick_wall_rough_1k.png';

    const mat = new THREE.MeshStandardMaterial({
      map: this.loadColorTexture(diffFile, rx, ry),
      normalMap: this.loadNormalTexture(norFile, rx, ry),
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: this.loadRoughnessTexture(roughFile, rx, ry),
      roughness: 0.85,
      metalness: 0.04
    });

    if (options.color) {
      mat.color = new THREE.Color(options.color);
    }

    this.materialCache.set(key, mat);
    return mat;
  }

  /**
   * PBR Plaster Facade material (Modular Urban Apartments Plaster)
   */
  getPlasterFacadeMaterial(options = {}) {
    const rx = options.repeatX || 2;
    const ry = options.repeatY || 3;
    const key = `mat_plaster_${rx}_${ry}_${options.color ? options.color.toString(16) : 'orig'}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const mat = new THREE.MeshStandardMaterial({
      map: this.loadColorTexture('modular_urban_apartments_facade_plaster_diff_1k.png', rx, ry),
      normalMap: this.loadNormalTexture('modular_urban_apartments_facade_plaster_nor_gl_1k.png', rx, ry),
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: this.loadRoughnessTexture('modular_urban_apartments_facade_plaster_rough_1k.png', rx, ry),
      roughness: 0.78,
      metalness: 0.04
    });

    if (options.color) {
      mat.color = new THREE.Color(options.color);
    }

    this.materialCache.set(key, mat);
    return mat;
  }

  /**
   * PBR Apartment Facade with Window Objects & Metal Trims
   */
  getApartmentFacadeMaterial(options = {}) {
    const rx = options.repeatX || 2;
    const ry = options.repeatY || 2;
    const key = `mat_apt_facade_${rx}_${ry}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const mat = new THREE.MeshStandardMaterial({
      map: this.loadColorTexture('modular_urban_apartments_facade_objects_diff_1k.png', rx, ry),
      normalMap: this.loadNormalTexture('modular_urban_apartments_facade_objects_nor_gl_1k.png', rx, ry),
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: this.loadRoughnessTexture('modular_urban_apartments_facade_objects_rough_1k.png', rx, ry),
      roughness: 0.65,
      metalnessMap: this.loadMetalnessTexture('modular_urban_apartments_facade_objects_metal_1k.png', rx, ry),
      metalness: 0.4
    });

    this.materialCache.set(key, mat);
    return mat;
  }

  /**
   * Architectural Cornice and Moldings (Trim 01 & 02)
   */
  getArchitecturalTrimMaterial(options = {}) {
    const rx = options.repeatX || 2;
    const ry = options.repeatY || 2;
    const variant = options.variant || 1;
    const key = `mat_trim_${variant}_${rx}_${ry}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const diff = variant === 2 ? 'modular_urban_apartments_facade_trim_02_diff_1k.png' : 'modular_urban_apartments_facade_trim_01_diff_1k.png';
    const nor = variant === 2 ? 'modular_urban_apartments_facade_trim_02_nor_gl_1k.png' : 'modular_urban_apartments_facade_trim_01_nor_gl_1k.png';
    const rough = variant === 2 ? 'modular_urban_apartments_facade_trim_02_rough_1k.png' : 'modular_urban_apartments_facade_trim_01_rough_1k.png';

    const mat = new THREE.MeshStandardMaterial({
      map: this.loadColorTexture(diff, rx, ry),
      normalMap: this.loadNormalTexture(nor, rx, ry),
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap: this.loadRoughnessTexture(rough, rx, ry),
      roughness: 0.8,
      metalness: 0.08
    });

    this.materialCache.set(key, mat);
    return mat;
  }

  /**
   * Realistic Aggregate Concrete Material with PBR surface relief
   */
  getConcreteMaterial(options = {}) {
    const rx = options.repeatX || 2;
    const ry = options.repeatY || 2;
    const colorHex = options.color !== undefined ? options.color : 0xa5a8ad;
    const key = `mat_concrete_${rx}_${ry}_${colorHex}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const mat = new THREE.MeshStandardMaterial({
      map: this.loadColorTexture('modular_urban_apartments_facade_plaster_diff_1k.png', rx, ry),
      color: new THREE.Color(colorHex),
      normalMap: this.loadNormalTexture('modular_urban_apartments_facade_plaster_nor_gl_1k.png', rx, ry),
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughnessMap: this.loadRoughnessTexture('modular_urban_apartments_facade_plaster_rough_1k.png', rx, ry),
      roughness: 0.85,
      metalness: 0.08
    });

    this.materialCache.set(key, mat);
    return mat;
  }

  /**
   * PBR Flat Roof Asphalt / Tar Gravel
   */
  getRoofAsphaltMaterial(options = {}) {
    const rx = options.repeatX || 4;
    const ry = options.repeatY || 4;
    const key = `mat_roof_asphalt_${rx}_${ry}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const mat = new THREE.MeshStandardMaterial({
      map: this.loadColorTexture('asphalt_01_diff_1k.jpg', rx, ry),
      normalMap: this.loadNormalTexture('asphalt_01_nor_gl_1k.png', rx, ry),
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap: this.loadRoughnessTexture('asphalt_01_rough_1k.png', rx, ry),
      roughness: 0.92,
      metalness: 0.06
    });

    this.materialCache.set(key, mat);
    return mat;
  }

  // =========================================================================
  // 4. INDUSTRIAL & METAL MATERIALS
  // =========================================================================

  /**
   * Industrial Corrugated Metal & Steel Siding
   */
  getIndustrialMetalMaterial(options = {}) {
    const rx = options.repeatX || 2;
    const ry = options.repeatY || 2;
    const key = `mat_industrial_metal_${rx}_${ry}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const mat = new THREE.MeshStandardMaterial({
      map: this.loadColorTexture('modular_urban_apartments_facade_objects_diff_1k.png', rx, ry),
      normalMap: this.loadNormalTexture('modular_urban_apartments_facade_objects_nor_gl_1k.png', rx, ry),
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughnessMap: this.loadRoughnessTexture('modular_urban_apartments_facade_objects_rough_1k.png', rx, ry),
      roughness: 0.45,
      metalnessMap: this.loadMetalnessTexture('modular_urban_apartments_facade_objects_metal_1k.png', rx, ry),
      metalness: 0.72
    });

    this.materialCache.set(key, mat);
    return mat;
  }

  // =========================================================================
  // 5. VEGETATION & NATURE MATERIALS
  // =========================================================================

  /**
   * PBR Pine & Tree Bark material
   */
  getPineBarkMaterial(options = {}) {
    const rx = options.repeatX || 1;
    const ry = options.repeatY || 3;
    const key = `mat_pine_bark_${rx}_${ry}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const mat = new THREE.MeshStandardMaterial({
      map: this.loadColorTexture('pine_bark_diff_1k.jpg', rx, ry),
      normalMap: this.loadNormalTexture('pine_bark_nor_gl_1k.png', rx, ry),
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughnessMap: this.loadRoughnessTexture('pine_bark_rough_1k.png', rx, ry),
      roughness: 0.88,
      metalness: 0.04
    });

    this.materialCache.set(key, mat);
    return mat;
  }

  // =========================================================================
  // 6. TERRAIN & LANDSCAPE MATERIALS
  // =========================================================================

  /**
   * PBR Leafy Grass Material with vertex coloring support
   */
  getTerrainGrassMaterial(options = {}) {
    const rx = options.repeatX || 16;
    const ry = options.repeatY || 16;
    const key = `mat_terrain_grass_${rx}_${ry}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const mat = new THREE.MeshStandardMaterial({
      map: this.loadColorTexture('leafy_grass_diff_1k.jpg', rx, ry),
      normalMap: this.loadNormalTexture('leafy_grass_nor_gl_1k.png', rx, ry),
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: this.loadRoughnessTexture('leafy_grass_rough_1k.png', rx, ry),
      roughness: 0.88,
      metalness: 0.03,
      vertexColors: true
    });

    this.materialCache.set(key, mat);
    return mat;
  }

  /**
   * PBR Rocky Terrain Material
   */
  getTerrainRockMaterial(options = {}) {
    const rx = options.repeatX || 12;
    const ry = options.repeatY || 12;
    const key = `mat_terrain_rock_${rx}_${ry}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const mat = new THREE.MeshStandardMaterial({
      map: this.loadColorTexture('rocky_terrain_02_diff_1k.jpg', rx, ry),
      normalMap: this.loadNormalTexture('rocky_terrain_02_nor_gl_1k.png', rx, ry),
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: this.loadRoughnessTexture('rocky_terrain_02_rough_1k.png', rx, ry),
      roughness: 0.86,
      metalness: 0.06
    });

    this.materialCache.set(key, mat);
    return mat;
  }

  /**
   * PBR Mud Cracked Dry Riverbed Material
   */
  getTerrainMudMaterial(options = {}) {
    const rx = options.repeatX || 8;
    const ry = options.repeatY || 8;
    const key = `mat_terrain_mud_${rx}_${ry}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const mat = new THREE.MeshStandardMaterial({
      map: this.loadColorTexture('mud_cracked_dry_riverbed_002_diff_1k.jpg', rx, ry),
      normalMap: this.loadNormalTexture('mud_cracked_dry_riverbed_002_nor_gl_1k.png', rx, ry),
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughnessMap: this.loadRoughnessTexture('mud_cracked_dry_riverbed_002_rough_1k.png', rx, ry),
      roughness: 0.9,
      metalness: 0.03
    });

    this.materialCache.set(key, mat);
    return mat;
  }

  /**
   * PBR Beach Sand Shoreline Material
   */
  getTerrainBeachMaterial(options = {}) {
    const rx = options.repeatX || 10;
    const ry = options.repeatY || 10;
    const key = `mat_terrain_beach_${rx}_${ry}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const mat = new THREE.MeshStandardMaterial({
      map: this.loadColorTexture('aerial_beach_01_diff_1k.jpg', rx, ry),
      normalMap: this.loadNormalTexture('aerial_beach_01_nor_gl_1k.png', rx, ry),
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap: this.loadRoughnessTexture('aerial_beach_01_rough_1k.jpg', rx, ry),
      roughness: 0.9,
      metalness: 0.02
    });

    this.materialCache.set(key, mat);
    return mat;
  }
}

export const MaterialManager = new MaterialManagerSingleton();
