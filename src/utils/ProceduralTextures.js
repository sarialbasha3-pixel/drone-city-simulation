import * as THREE from 'three';

/**
 * ProceduralTextures - Generates crisp, realistic PBR textures directly in-memory.
 * Ensures zero asset load failures, instant startup, and high visual fidelity.
 */
export class ProceduralTextures {
  static _cache = new Map();

  /**
   * Helper to create canvas of given dimensions
   */
  static createCanvas(width = 512, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    return { canvas, ctx };
  }

  /**
   * Wrap canvas into configured THREE.CanvasTexture
   */
  static makeTexture(canvas, repeatX = 1, repeatY = 1, anisotropy = 8) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * 1. Road Textures (2-Lane Urban Street with realistic PBR asphalt, tire wear, embedded lines)
   */
  static getRoadTexture() {
    if (this._cache.has('road')) return this._cache.get('road');
    const { canvas, ctx } = this.createCanvas(1024, 1024);

    // 1. Realistic dark-gray weathered asphalt base with subtle color variation
    ctx.fillStyle = '#1c1d20';
    ctx.fillRect(0, 0, 1024, 1024);

    // Multi-octave aggregate stone noise and micro-texture
    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const stoneNoise = (Math.random() - 0.5) * 38;
      const warmDirt = (Math.random() - 0.5) * 12;
      data[i]     = Math.min(255, Math.max(12, data[i] + stoneNoise + warmDirt));     // R
      data[i + 1] = Math.min(255, Math.max(12, data[i + 1] + stoneNoise + warmDirt * 0.7)); // G
      data[i + 2] = Math.min(255, Math.max(14, data[i + 2] + stoneNoise));           // B
    }
    ctx.putImageData(imgData, 0, 0);

    // Subtle asphalt aging patches
    ctx.fillStyle = 'rgba(24, 25, 28, 0.4)';
    for (let p = 0; p < 8; p++) {
      const px = Math.random() * 900 + 50;
      const py = Math.random() * 900 + 50;
      const pw = Math.random() * 60 + 30;
      const ph = Math.random() * 80 + 40;
      ctx.beginPath();
      ctx.ellipse(px, py, pw, ph, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Heavy tire wear channels (wheel tracks)
    const tireGrad1 = ctx.createLinearGradient(140, 0, 370, 0);
    tireGrad1.addColorStop(0, 'rgba(12, 13, 14, 0.0)');
    tireGrad1.addColorStop(0.3, 'rgba(10, 11, 12, 0.65)');
    tireGrad1.addColorStop(0.7, 'rgba(10, 11, 12, 0.65)');
    tireGrad1.addColorStop(1, 'rgba(12, 13, 14, 0.0)');
    ctx.fillStyle = tireGrad1;
    ctx.fillRect(140, 0, 230, 1024);

    const tireGrad2 = ctx.createLinearGradient(650, 0, 880, 0);
    tireGrad2.addColorStop(0, 'rgba(12, 13, 14, 0.0)');
    tireGrad2.addColorStop(0.3, 'rgba(10, 11, 12, 0.65)');
    tireGrad2.addColorStop(0.7, 'rgba(10, 11, 12, 0.65)');
    tireGrad2.addColorStop(1, 'rgba(12, 13, 14, 0.0)');
    ctx.fillStyle = tireGrad2;
    ctx.fillRect(650, 0, 230, 1024);

    // Center oil drip track
    const oilGrad = ctx.createLinearGradient(485, 0, 539, 0);
    oilGrad.addColorStop(0, 'rgba(14, 14, 16, 0.0)');
    oilGrad.addColorStop(0.5, 'rgba(8, 8, 10, 0.45)');
    oilGrad.addColorStop(1, 'rgba(14, 14, 16, 0.0)');
    ctx.fillStyle = oilGrad;
    ctx.fillRect(485, 0, 54, 1024);

    // Helper: draw realistic embedded line with micro-eroded edges
    const drawEmbeddedLine = (x, w, color, alpha = 0.92) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(x, 0, w, 1024);

      // Micro edge erosion noise along paint edges
      const edgeData = ctx.getImageData(x - 2, 0, w + 4, 1024);
      const ed = edgeData.data;
      for (let i = 0; i < ed.length; i += 4) {
        if (Math.random() < 0.15) {
          ed[i]     = Math.max(20, ed[i] - 40);
          ed[i + 1] = Math.max(20, ed[i + 1] - 40);
          ed[i + 2] = Math.max(20, ed[i + 2] - 40);
        }
      }
      ctx.putImageData(edgeData, x - 2, 0);
      ctx.restore();
    };

    // Weathered outer solid white shoulder lines
    drawEmbeddedLine(44, 14, '#e0e4e8', 0.88);
    drawEmbeddedLine(966, 14, '#e0e4e8', 0.88);

    // Double yellow center divider line with realistic spacing
    drawEmbeddedLine(502, 8, '#f5b025', 0.92);
    drawEmbeddedLine(514, 8, '#f5b025', 0.92);

    const tex = this.makeTexture(canvas, 1, 4);
    this._cache.set('road', tex);
    return tex;
  }

  /**
   * 2. Highway Texture (4-Lane heavy-duty dark asphalt with dashed white lines, yellow shoulder)
   */
  static getHighwayTexture() {
    if (this._cache.has('highway')) return this._cache.get('highway');
    const { canvas, ctx } = this.createCanvas(1024, 1024);

    // Heavy-duty dark asphalt
    ctx.fillStyle = '#17181a';
    ctx.fillRect(0, 0, 1024, 1024);

    // Aggregate grain & wear
    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 34;
      data[i] = Math.min(255, Math.max(10, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(10, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(12, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Heavy tire wear marks along all 4 wheel lanes
    [125, 365, 645, 875].forEach((trackX) => {
      const grad = ctx.createLinearGradient(trackX - 65, 0, trackX + 65, 0);
      grad.addColorStop(0, 'rgba(8, 8, 10, 0.0)');
      grad.addColorStop(0.5, 'rgba(6, 7, 8, 0.7)');
      grad.addColorStop(1, 'rgba(8, 8, 10, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(trackX - 65, 0, 130, 1024);
    });

    // Outer yellow shoulders
    ctx.fillStyle = '#f0a818';
    ctx.fillRect(30, 0, 16, 1024);
    ctx.fillRect(978, 0, 16, 1024);

    // Solid white median divider lines
    ctx.fillStyle = '#eaeff2';
    ctx.fillRect(503, 0, 8, 1024);
    ctx.fillRect(513, 0, 8, 1024);

    // Dashed white lane dividers with weathered edges
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#eaeff2';
    ctx.setLineDash([90, 70]);
    ctx.beginPath();
    ctx.moveTo(270, 0);
    ctx.lineTo(270, 1024);
    ctx.moveTo(754, 0);
    ctx.lineTo(754, 1024);
    ctx.stroke();

    const tex = this.makeTexture(canvas, 1, 4);
    this._cache.set('highway', tex);
    return tex;
  }

  /**
   * 2b. Grand Boulevard Avenue (4-Lane wide avenue with center median demarcation)
   */
  static getAvenueTexture() {
    if (this._cache.has('avenue')) return this._cache.get('avenue');
    const { canvas, ctx } = this.createCanvas(1024, 1024);

    ctx.fillStyle = '#1e1f22';
    ctx.fillRect(0, 0, 1024, 1024);

    // Noise
    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 32;
      data[i] = Math.min(255, Math.max(12, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(12, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(14, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Tire wear channels
    [150, 360, 660, 870].forEach((trackX) => {
      const grad = ctx.createLinearGradient(trackX - 55, 0, trackX + 55, 0);
      grad.addColorStop(0, 'rgba(10, 11, 12, 0.0)');
      grad.addColorStop(0.5, 'rgba(8, 9, 10, 0.6)');
      grad.addColorStop(1, 'rgba(10, 11, 12, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(trackX - 55, 0, 110, 1024);
    });

    // Center median yellow hatched lines
    ctx.fillStyle = '#f5b025';
    ctx.fillRect(492, 0, 7, 1024);
    ctx.fillRect(525, 0, 7, 1024);

    // Diagonal yellow hash stripes in center median
    ctx.strokeStyle = '#f5b025';
    ctx.lineWidth = 4;
    for (let y = -20; y <= 1040; y += 40) {
      ctx.beginPath();
      ctx.moveTo(492, y);
      ctx.lineTo(525, y + 25);
      ctx.stroke();
    }

    // Outer white shoulder lines
    ctx.fillStyle = '#e4e8ec';
    ctx.fillRect(36, 0, 14, 1024);
    ctx.fillRect(974, 0, 14, 1024);

    // Dashed white lane dividers
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#e4e8ec';
    ctx.setLineDash([85, 65]);
    ctx.beginPath();
    ctx.moveTo(260, 0);
    ctx.lineTo(260, 1024);
    ctx.moveTo(764, 0);
    ctx.lineTo(764, 1024);
    ctx.stroke();

    const tex = this.makeTexture(canvas, 1, 4);
    this._cache.set('avenue', tex);
    return tex;
  }

  /**
   * 3. Intersection Texture with Crosswalk Zebra Lines
   */
  static getIntersectionTexture() {
    if (this._cache.has('intersection')) return this._cache.get('intersection');
    const { canvas, ctx } = this.createCanvas(1024, 1024);

    // Base asphalt
    ctx.fillStyle = '#1d1e21';
    ctx.fillRect(0, 0, 1024, 1024);

    // Aggregate noise
    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      data[i] = Math.min(255, Math.max(12, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(12, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(14, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Turning tire wear arcs in intersection center
    ctx.strokeStyle = 'rgba(8, 8, 10, 0.4)';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(200, 200, 320, 0, Math.PI * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(824, 200, 320, Math.PI * 0.5, Math.PI);
    ctx.stroke();

    // 4 Zebra crosswalks
    ctx.fillStyle = '#e6eaee';
    const drawZebra = (startX, startY, isHorizontal) => {
      const stripes = 8;
      for (let s = 0; s < stripes; s++) {
        if (isHorizontal) {
          ctx.fillRect(startX + s * 45, startY, 28, 90);
        } else {
          ctx.fillRect(startX, startY + s * 45, 90, 28);
        }
      }
    };

    // North, South, East, West crosswalks
    drawZebra(330, 60, true);
    drawZebra(330, 874, true);
    drawZebra(60, 330, false);
    drawZebra(874, 330, false);

    // Stop bars
    ctx.fillRect(320, 160, 384, 14);
    ctx.fillRect(320, 850, 384, 14);
    ctx.fillRect(160, 320, 14, 384);
    ctx.fillRect(850, 320, 14, 384);

    const tex = this.makeTexture(canvas, 1, 1);
    this._cache.set('intersection', tex);
    return tex;
  }

  /**
   * 3b. Circular Roundabout Texture with Concentric Driving Lanes
   */
  static getRoundaboutTexture() {
    if (this._cache.has('roundabout')) return this._cache.get('roundabout');
    const { canvas, ctx } = this.createCanvas(1024, 1024);

    // Dark asphalt base
    ctx.fillStyle = '#1d1e21';
    ctx.fillRect(0, 0, 1024, 1024);

    // Aggregate noise
    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 30;
      data[i] = Math.min(255, Math.max(12, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(12, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(14, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    const cx = 512;
    const cy = 512;

    // Circular tire wear channels
    [240, 340, 420].forEach((r) => {
      ctx.strokeStyle = 'rgba(8, 8, 10, 0.55)';
      ctx.lineWidth = 36;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Outer circular white boundary line
    ctx.strokeStyle = '#e6eaee';
    ctx.lineWidth = 12;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, 480, 0, Math.PI * 2);
    ctx.stroke();

    // Intermediate dashed circular lane dividers
    ctx.lineWidth = 10;
    ctx.setLineDash([35, 25]);
    ctx.beginPath();
    ctx.arc(cx, cy, 370, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 270, 0, Math.PI * 2);
    ctx.stroke();

    // Inner yellow apron ring
    ctx.strokeStyle = '#f5b025';
    ctx.lineWidth = 10;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, 175, 0, Math.PI * 2);
    ctx.stroke();

    const tex = this.makeTexture(canvas, 1, 1);
    this._cache.set('roundabout', tex);
    return tex;
  }

  /**
   * 3c. PBR Asphalt Bump Map (High frequency stone aggregate noise & slight paint thickness)
   */
  static getAsphaltBumpTexture() {
    if (this._cache.has('asphalt_bump')) return this._cache.get('asphalt_bump');
    const { canvas, ctx } = this.createCanvas(512, 512);

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);

    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 90;
      const val = Math.min(255, Math.max(0, 128 + n));
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = this.makeTexture(canvas, 4, 16);
    this._cache.set('asphalt_bump', tex);
    return tex;
  }

  /**
   * 3d. PBR Asphalt Roughness Map (Matte base with polished tire tracks)
   */
  static getAsphaltRoughnessTexture() {
    if (this._cache.has('asphalt_roughness')) return this._cache.get('asphalt_roughness');
    const { canvas, ctx } = this.createCanvas(512, 512);

    // Base rough asphalt ~0.88
    ctx.fillStyle = '#dcdcdc';
    ctx.fillRect(0, 0, 512, 512);

    // Polish in tire paths (smoother ~0.65)
    const tireGrad1 = ctx.createLinearGradient(70, 0, 185, 0);
    tireGrad1.addColorStop(0, 'rgba(220, 220, 220, 0)');
    tireGrad1.addColorStop(0.5, 'rgba(155, 155, 155, 0.85)');
    tireGrad1.addColorStop(1, 'rgba(220, 220, 220, 0)');
    ctx.fillStyle = tireGrad1;
    ctx.fillRect(70, 0, 115, 512);

    const tireGrad2 = ctx.createLinearGradient(325, 0, 440, 0);
    tireGrad2.addColorStop(0, 'rgba(220, 220, 220, 0)');
    tireGrad2.addColorStop(0.5, 'rgba(155, 155, 155, 0.85)');
    tireGrad2.addColorStop(1, 'rgba(220, 220, 220, 0)');
    ctx.fillStyle = tireGrad2;
    ctx.fillRect(325, 0, 115, 512);

    const tex = this.makeTexture(canvas, 1, 4);
    this._cache.set('asphalt_roughness', tex);
    return tex;
  }

  /**
   * 4. Sidewalk Texture (Concrete Flagstones with Expansion Joints)
   */
  static getSidewalkTexture() {
    if (this._cache.has('sidewalk')) return this._cache.get('sidewalk');
    const { canvas, ctx } = this.createCanvas(512, 512);

    // Concrete grey
    ctx.fillStyle = '#b5b7ba';
    ctx.fillRect(0, 0, 512, 512);

    // Concrete grit noise
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 18;
      data[i] = Math.min(255, Math.max(0, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Grid of slabs
    ctx.strokeStyle = '#6f7276';
    ctx.lineWidth = 3;
    const slabSize = 128;
    for (let x = 0; x <= 512; x += slabSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y <= 512; y += slabSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    const tex = this.makeTexture(canvas, 2, 4);
    this._cache.set('sidewalk', tex);
    return tex;
  }

  /**
   * 5. Downtown Glass Curtain Wall Skyscraper Facade
   */
  static getGlassTowerTexture(colorTheme = 'blue') {
    const key = `tower_${colorTheme}`;
    if (this._cache.has(key)) return this._cache.get(key);
    const { canvas, ctx } = this.createCanvas(1024, 1024);

    const glassColor = colorTheme === 'blue' ? '#183852' : (colorTheme === 'gold' ? '#3e3422' : '#22282d');
    const panelCols = 16;
    const panelRows = 32;
    const colW = 1024 / panelCols;
    const rowH = 1024 / panelRows;

    // Structural frame background
    ctx.fillStyle = '#101215';
    ctx.fillRect(0, 0, 1024, 1024);

    for (let r = 0; r < panelRows; r++) {
      for (let c = 0; c < panelCols; c++) {
        const x = c * colW;
        const y = r * rowH;

        // Window pane
        const isLit = Math.random() < 0.28;
        if (isLit) {
          ctx.fillStyle = Math.random() < 0.5 ? '#fcf1cd' : '#d2e7fc';
        } else {
          // Reflection gradient on dark glass
          const grad = ctx.createLinearGradient(x, y, x + colW, y + rowH);
          grad.addColorStop(0, glassColor);
          grad.addColorStop(1, '#0e1a26');
          ctx.fillStyle = grad;
        }

        ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);

        // Blinds / mullion divider
        if (!isLit && Math.random() < 0.4) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.fillRect(x + 2, y + 2, colW - 4, rowH * 0.4);
        }
      }
    }

    // Heavy vertical structural mullions
    ctx.fillStyle = '#33383e';
    for (let c = 0; c <= panelCols; c += 4) {
      ctx.fillRect(c * colW - 2, 0, 4, 1024);
    }

    const tex = this.makeTexture(canvas, 1, 1);
    this._cache.set(key, tex);
    return tex;
  }

  /**
   * 6. Commercial Building Facade (Composite Aluminum Panels & Shop Windows)
   */
  static getCommercialFacadeTexture() {
    if (this._cache.has('commercial')) return this._cache.get('commercial');
    const { canvas, ctx } = this.createCanvas(1024, 1024);

    // Warm beige/grey composite cladding
    ctx.fillStyle = '#8e9399';
    ctx.fillRect(0, 0, 1024, 1024);

    // Horizontal architectural banding
    const rows = 8;
    const rowH = 1024 / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rowH;

      // Ground floor storefronts
      if (r === rows - 1) {
        ctx.fillStyle = '#1e2226';
        ctx.fillRect(0, y, 1024, rowH);

        for (let s = 0; s < 4; s++) {
          ctx.fillStyle = '#f8f4e6';
          ctx.fillRect(s * 256 + 20, y + 25, 216, rowH - 40);
          ctx.fillStyle = '#222';
          ctx.fillRect(s * 256 + 30, y + 10, 196, 12);
        }
        continue;
      }

      // Upper floor window bands
      ctx.fillStyle = '#2d3339';
      ctx.fillRect(0, y + 30, 1024, rowH - 55);

      for (let w = 0; w < 16; w++) {
        const x = w * 64;
        ctx.fillStyle = Math.random() < 0.2 ? '#ffecb3' : '#1b2c3a';
        ctx.fillRect(x + 6, y + 34, 52, rowH - 63);
      }
    }

    const tex = this.makeTexture(canvas, 1, 1);
    this._cache.set('commercial', tex);
    return tex;
  }

  /**
   * 7. Residential Brick & Balconies Facade
   */
  static getResidentialFacadeTexture() {
    if (this._cache.has('residential')) return this._cache.get('residential');
    const { canvas, ctx } = this.createCanvas(512, 512);

    // Brick red/terracotta base
    ctx.fillStyle = '#8f4a3e';
    ctx.fillRect(0, 0, 512, 512);

    // Brick mortar lines
    ctx.fillStyle = '#e8ded8';
    const brickH = 12;
    const brickW = 28;
    for (let y = 0; y < 512; y += brickH) {
      ctx.fillRect(0, y, 512, 2);
      const offset = (y / brickH) % 2 === 0 ? 0 : brickW / 2;
      for (let x = offset; x < 512; x += brickW) {
        ctx.fillRect(x, y, 2, brickH);
      }
    }

    // Windows with stone lintels and sills
    const winCols = 4;
    const winRows = 4;
    for (let r = 0; r < winRows; r++) {
      for (let c = 0; c < winCols; c++) {
        const wx = c * 128 + 32;
        const wy = r * 128 + 32;

        // White frame
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(wx - 4, wy - 4, 68, 80);

        // Glass
        ctx.fillStyle = Math.random() < 0.4 ? '#fff2cc' : '#2b3a4a';
        ctx.fillRect(wx, wy, 60, 72);

        // Window muntins
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(wx + 28, wy, 4, 72);
        ctx.fillRect(wx, wy + 34, 60, 4);

        // Stone sill
        ctx.fillStyle = '#dfd6ce';
        ctx.fillRect(wx - 8, wy + 72, 76, 8);
      }
    }

    const tex = this.makeTexture(canvas, 1, 1);
    this._cache.set('residential', tex);
    return tex;
  }

  /**
   * 8. Industrial Corrugated Metal Facade
   */
  static getIndustrialFacadeTexture() {
    if (this._cache.has('industrial')) return this._cache.get('industrial');
    const { canvas, ctx } = this.createCanvas(512, 512);

    // Galvanized / corrugated steel base
    ctx.fillStyle = '#67717a';
    ctx.fillRect(0, 0, 512, 512);

    // Fluted vertical ribbing
    for (let x = 0; x < 512; x += 16) {
      // Highlight side
      ctx.fillStyle = '#9aa4ae';
      ctx.fillRect(x, 0, 6, 512);
      // Shadow side
      ctx.fillStyle = '#424a52';
      ctx.fillRect(x + 6, 0, 6, 512);
    }

    // Horizontal weathering / rust streaks
    ctx.fillStyle = 'rgba(105, 52, 28, 0.18)';
    ctx.fillRect(0, 420, 512, 92);

    const tex = this.makeTexture(canvas, 2, 2);
    this._cache.set('industrial', tex);
    return tex;
  }

  /**
   * 9. Shipping Container Texture (Ribbed metal with stencils)
   */
  static getContainerTexture(color = '#b72a2a') {
    const key = `container_${color}`;
    if (this._cache.has(key)) return this._cache.get(key);
    const { canvas, ctx } = this.createCanvas(512, 256);

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 512, 256);

    // Corrugations
    for (let x = 0; x < 512; x += 16) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(x, 0, 5, 256);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(x + 5, 0, 5, 256);
    }

    // Shipping logo & text stencils
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('MSCU 948271 4', 40, 50);
    ctx.font = '14px monospace';
    ctx.fillText('MAX GROSS 32,500 KG', 40, 75);
    ctx.fillText('TARE        3,850 KG', 40, 95);

    const tex = this.makeTexture(canvas, 1, 1);
    this._cache.set(key, tex);
    return tex;
  }

  /**
   * 10. Rooftop Texture (Gravel & HVAC details & Helipad marking)
   */
  static getRoofTexture(hasHelipad = false) {
    const key = `roof_${hasHelipad}`;
    if (this._cache.has(key)) return this._cache.get(key);
    const { canvas, ctx } = this.createCanvas(512, 512);

    // Dark grey roofing bitumen/gravel
    ctx.fillStyle = '#3a3c3f';
    ctx.fillRect(0, 0, 512, 512);

    // Gravel grit
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 25;
      data[i] = Math.min(255, Math.max(0, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    if (hasHelipad) {
      // White boundary square
      ctx.strokeStyle = '#f5f5f5';
      ctx.lineWidth = 10;
      ctx.strokeRect(106, 106, 300, 300);

      // Yellow inner circle
      ctx.strokeStyle = '#fbc02d';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(256, 256, 120, 0, Math.PI * 2);
      ctx.stroke();

      // Big white 'H'
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(206, 176, 24, 160);
      ctx.fillRect(282, 176, 24, 160);
      ctx.fillRect(206, 244, 100, 24);
    }

    const tex = this.makeTexture(canvas, 1, 1);
    this._cache.set(key, tex);
    return tex;
  }

  /**
   * 11. Terrain Textures: Rich multi-tone Grass, Rock, and Sand
   */
  static getGrassTexture() {
    if (this._cache.has('grass')) return this._cache.get('grass');
    const { canvas, ctx } = this.createCanvas(512, 512);

    // Deep natural green base
    ctx.fillStyle = '#3d632c';
    ctx.fillRect(0, 0, 512, 512);

    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 45;
      data[i] = Math.min(255, Math.max(0, data[i] + n * 0.7));     // R
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));   // G
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n * 0.5)); // B
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = this.makeTexture(canvas, 24, 24);
    this._cache.set('grass', tex);
    return tex;
  }

  static getRockTexture() {
    if (this._cache.has('rock')) return this._cache.get('rock');
    const { canvas, ctx } = this.createCanvas(512, 512);

    ctx.fillStyle = '#5c5752';
    ctx.fillRect(0, 0, 512, 512);

    // Stratified cliff strata lines
    ctx.strokeStyle = '#3e3b38';
    ctx.lineWidth = 4;
    for (let y = 10; y < 512; y += 30 + Math.random() * 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(150, y + (Math.random() - 0.5) * 30, 350, y + (Math.random() - 0.5) * 30, 512, y);
      ctx.stroke();
    }

    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 35;
      data[i] = Math.min(255, Math.max(0, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = this.makeTexture(canvas, 16, 16);
    this._cache.set('rock', tex);
    return tex;
  }

  /**
   * 12. Water Normal Map for realistic animated ripples
   */
  static getWaterNormalTexture() {
    if (this._cache.has('water_normal')) return this._cache.get('water_normal');
    const { canvas, ctx } = this.createCanvas(256, 256);
    const imgData = ctx.createImageData(256, 256);
    const data = imgData.data;

    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const i = (y * 256 + x) * 4;
        const nx = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.5 + 0.5;
        const ny = Math.cos(x * 0.15) * Math.sin(y * 0.15) * 0.5 + 0.5;
        data[i] = Math.floor(nx * 255);      // Normal X
        data[i + 1] = Math.floor(ny * 255);  // Normal Y
        data[i + 2] = 255;                   // Normal Z (pointing up)
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = this.makeTexture(canvas, 16, 16);
    this._cache.set('water_normal', tex);
    return tex;
  }


  /**
   * 14. Terracotta Spanish Clay Roof Tiles
   */
  static getTerracottaRoofTexture() {
    if (this._cache.has('terracotta')) return this._cache.get('terracotta');
    const { canvas, ctx } = this.createCanvas(512, 512);

    ctx.fillStyle = '#b24c29';
    ctx.fillRect(0, 0, 512, 512);

    // Fluted clay tile cylinders
    for (let x = 0; x < 512; x += 32) {
      const grad = ctx.createLinearGradient(x, 0, x + 32, 0);
      grad.addColorStop(0, '#7c2d15');
      grad.addColorStop(0.3, '#c85e38');
      grad.addColorStop(0.7, '#d66a42');
      grad.addColorStop(1, '#66220e');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 32, 512);
    }

    // Horizontal overlap shadow lines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    for (let y = 0; y < 512; y += 48) {
      ctx.fillRect(0, y, 512, 6);
    }

    const tex = this.makeTexture(canvas, 4, 4);
    this._cache.set('terracotta', tex);
    return tex;
  }

  /**
   * 15. Asphalt / Slate Architectural Shingles
   */
  static getAsphaltShingleTexture() {
    if (this._cache.has('shingles')) return this._cache.get('shingles');
    const { canvas, ctx } = this.createCanvas(512, 512);

    ctx.fillStyle = '#2c2e33';
    ctx.fillRect(0, 0, 512, 512);

    // Staggered rectangular tab shingles
    const tabH = 32;
    const tabW = 64;
    for (let r = 0; r < 512; r += tabH) {
      const offset = (r / tabH) % 2 === 0 ? 0 : tabW / 2;
      for (let c = -tabW; c < 512 + tabW; c += tabW) {
        const x = c + offset;
        const tone = Math.random() * 20 - 10;
        ctx.fillStyle = `rgb(${44 + tone}, ${46 + tone}, ${51 + tone})`;
        ctx.fillRect(x + 1, r + 1, tabW - 2, tabH - 4);

        // Shadow under tab
        ctx.fillStyle = 'rgba(10, 10, 15, 0.5)';
        ctx.fillRect(x, r + tabH - 3, tabW, 3);
      }
    }

    const tex = this.makeTexture(canvas, 4, 4);
    this._cache.set('shingles', tex);
    return tex;
  }

  /**
   * 16. Modern Warm Cedar / Timber Siding
   */
  static getModernWoodFacadeTexture() {
    if (this._cache.has('wood_facade')) return this._cache.get('wood_facade');
    const { canvas, ctx } = this.createCanvas(512, 512);

    ctx.fillStyle = '#8d5524';
    ctx.fillRect(0, 0, 512, 512);

    // Horizontal wood slats with seams
    const slatH = 20;
    for (let y = 0; y < 512; y += slatH) {
      const tone = (Math.random() - 0.5) * 24;
      ctx.fillStyle = `rgb(${141 + tone}, ${85 + tone}, ${36 + tone})`;
      ctx.fillRect(0, y + 2, 512, slatH - 3);

      // Dark shadow gap
      ctx.fillStyle = '#3a200d';
      ctx.fillRect(0, y + slatH - 1, 512, 1.5);
    }

    const tex = this.makeTexture(canvas, 2, 2);
    this._cache.set('wood_facade', tex);
    return tex;
  }
}
