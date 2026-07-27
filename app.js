(() => {
  'use strict';

  const stage = document.getElementById('stage');
  const canvas = document.getElementById('fx');
  const fallback = document.getElementById('fallback');
  const exposureInput = document.getElementById('exposure');
  const spectrumButton = document.getElementById('spectrum');
  const materialButton = document.getElementById('material');
  const resetButton = document.getElementById('reset');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let gl;
  try {
    gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: 'high-performance'
    }) || canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: true });
  } catch (_) {}
  if (!gl) {
    fallback.style.display = 'grid';
    return;
  }


  const { vertexSource, fragmentSource } = window.LuxRiftShaders;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile error');
    }
    return shader;
  }

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Program link error');
    }
  } catch (error) {
    console.error(error);
    fallback.style.display = 'grid';
    return;
  }

  gl.useProgram(program);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const aPosition = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  const uniformNames = ['uResolution','uTime','uExposure','uSpectrum','uMaterial','uRift0','uRift1','uMeta0','uMeta1'];
  const uniforms = Object.fromEntries(uniformNames.map(name => [name, gl.getUniformLocation(program, name)]));

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a,b,t) => a + (b-a)*t;
  const shortestAngle = a => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };

  let width = innerWidth;
  let height = innerHeight;
  let dpr = 1;
  let spectrum = 0;
  let material = 0;
  let exposure = Number(exposureInput.value) / 100;
  const spectrumNames = ['DAYLIGHT','POLAR','AURORA'];
  const materialNames = ['OBSIDIAN','INDIGO','OXIDE'];

  function createRift() {
    return {
      x: width * 0.5, y: height * 0.5,
      length: 240, opening: 70, angle: -0.4,
      vx: 0, vy: 0, vLength: 0, vOpening: 0, vAngle: 0,
      targetLength: 240, targetOpening: 70,
      phase: Math.random() * Math.PI * 2,
      life: 0, targetLife: 0,
      bend: 1,
      active: false,
      born: performance.now()
    };
  }
  const rifts = [createRift(), createRift()];
  let activeRift = null;
  let activePointer = -1;
  let startX = 0, startY = 0;
  let lastX = 0, lastY = 0, lastTime = 0;
  let dragDistance = 0;
  let spawnCursor = 0;

  function seedComposition() {
    const minDim = Math.min(width,height);
    const a = rifts[0];
    Object.assign(a, {
      x: width * (width < 800 ? .58 : .61),
      y: height * (width < 800 ? .40 : .48),
      length: clamp(minDim * .63, 250, 620),
      opening: clamp(minDim * .135, 76, 150),
      angle: width < 800 ? -0.84 : -0.46,
      targetLength: clamp(minDim * .63, 250, 620),
      targetOpening: clamp(minDim * .135, 76, 150) * .92,
      phase: 1.2, life: 1, targetLife: 1, bend: 1.1,
      vx:0,vy:0,vLength:0,vOpening:0,vAngle:0,active:false,born:performance.now()
    });
    const b = rifts[1];
    Object.assign(b, {
      x: width * (width < 800 ? .29 : .24),
      y: height * (width < 800 ? .72 : .77),
      length: clamp(minDim * .28, 130, 280),
      opening: clamp(minDim * .055, 36, 64),
      angle: width < 800 ? .42 : .18,
      targetLength: clamp(minDim * .28, 130, 280),
      targetOpening: clamp(minDim * .055, 36, 64),
      phase: 3.7, life: .44, targetLife: .44, bend: .9,
      vx:0,vy:0,vLength:0,vOpening:0,vAngle:0,active:false,born:performance.now()-1000
    });
    spawnCursor = 1;
  }

  function chooseRift() {
    let index = spawnCursor % rifts.length;
    spawnCursor += 1;
    // Keep the strongest opening unless it is the only one; replace the faintest available trace.
    let best = index;
    for (let i=0;i<rifts.length;i++) {
      if (!rifts[i].active && rifts[i].life < rifts[best].life) best = i;
    }
    return rifts[best];
  }

  function beginRift(x,y,time) {
    const r = chooseRift();
    for (const other of rifts) {
      if (other !== r) other.targetLife = Math.min(other.targetLife, other.life * .28);
    }
    Object.assign(r, {
      x, y,
      length: 74,
      opening: 30,
      targetLength: 74,
      targetOpening: 30,
      angle: -Math.PI * .25,
      vx: 0, vy: 0, vLength: 0, vOpening: 0, vAngle: 0,
      phase: Math.random() * Math.PI * 2,
      life: Math.max(r.life, .2),
      targetLife: 1,
      bend: 1.08,
      active: true,
      born: time
    });
    activeRift = r;
    startX = lastX = x;
    startY = lastY = y;
    lastTime = time;
    dragDistance = 0;
  }

  function updateRiftFromPointer(x,y,time) {
    const r = activeRift;
    if (!r) return;
    const dx = x - startX;
    const dy = y - startY;
    const distance = Math.hypot(dx,dy);
    const dt = Math.max(.008, (time-lastTime)/1000);
    const vx = (x-lastX)/dt;
    const vy = (y-lastY)/dt;
    dragDistance = Math.max(dragDistance, distance);

    if (distance > 7) {
      const nextAngle = Math.atan2(dy,dx);
      const angleDelta = shortestAngle(nextAngle-r.angle);
      r.vAngle = lerp(r.vAngle, angleDelta/dt, .24);
      r.angle += angleDelta * .84;
    }
    const minDim = Math.min(width,height);
    const desiredLength = clamp(88 + distance * 1.10, 88, minDim * .94);
    const speed = Math.hypot(vx,vy);
    const desiredOpening = clamp(34 + distance * .23 + Math.min(speed*.012,20), 36, minDim * .245);
    r.vLength = lerp(r.vLength, (desiredLength-r.length)/dt, .18);
    r.vOpening = lerp(r.vOpening, (desiredOpening-r.opening)/dt, .18);
    r.length = lerp(r.length, desiredLength, .82);
    r.opening = lerp(r.opening, desiredOpening, .80);
    r.targetLength = desiredLength;
    r.targetOpening = desiredOpening;
    r.x = (startX+x)*.5;
    r.y = (startY+y)*.5;
    r.vx = lerp(r.vx, vx*.08, .25);
    r.vy = lerp(r.vy, vy*.08, .25);
    r.bend = clamp(.82 + speed/1800, .82, 1.5);
    r.life = lerp(r.life,1,.55);
    r.phase += speed * dt * .0017;
    lastX=x; lastY=y; lastTime=time;
  }

  function releaseRift(time) {
    const r = activeRift;
    if (!r) return;
    r.active = false;
    if (dragDistance < 12) {
      r.angle = -Math.PI*.32 + (Math.random()-.5)*.55;
      r.length = r.targetLength = clamp(Math.min(width,height)*.26,145,250);
      r.opening = clamp(Math.min(width,height)*.085,52,90);
      r.targetOpening = r.opening*.78;
      r.vOpening += 118;
      r.vLength += 84;
      r.phase += 1.2;
    } else {
      r.targetLength = r.length * .94;
      r.targetOpening = r.opening * .76;
      r.vOpening += clamp(Math.hypot(r.vx,r.vy)*.42, 18, 110);
      r.vLength += clamp(Math.abs(r.vLength)*.12, 8, 54);
      r.vAngle = clamp(r.vAngle*.18, -2.8, 2.8);
    }
    r.targetLife = 1;
    activeRift = null;
    activePointer = -1;
  }

  function stepRift(r,dt,index) {
    r.phase += dt * (reducedMotion ? .18 : .62 + index*.09);
    r.life += (r.targetLife-r.life) * (1-Math.exp(-5.8*dt));
    if (r.active) return;

    const kOpen = reducedMotion ? 30 : 54;
    const kLength = reducedMotion ? 23 : 39;
    r.vOpening += (r.targetOpening-r.opening)*kOpen*dt;
    r.vLength += (r.targetLength-r.length)*kLength*dt;
    r.vOpening *= Math.exp(-(reducedMotion?13:7.4)*dt);
    r.vLength *= Math.exp(-(reducedMotion?13:7.0)*dt);
    r.vAngle *= Math.exp(-(reducedMotion?9:2.9)*dt);

    r.opening += r.vOpening*dt;
    r.length += r.vLength*dt;
    r.angle += r.vAngle*dt;
    r.x += r.vx*dt;
    r.y += r.vy*dt;
    r.vx *= Math.exp(-2.6*dt);
    r.vy *= Math.exp(-2.6*dt);

    // Slow elastic precession keeps the opening alive without becoming a cursor follower.
    if (!reducedMotion) {
      r.angle += Math.sin(r.phase*.37+index)*dt*.008;
      r.opening += Math.sin(r.phase*1.43+index*.8)*dt*2.5;
    }
    r.opening = clamp(r.opening, 12, Math.min(width,height)*.28);
    r.length = clamp(r.length, 50, Math.min(width,height)*1.02);
    const margin = r.length*.14;
    if (r.x < -margin) { r.x=-margin; r.vx=Math.abs(r.vx)*.45; }
    if (r.x > width+margin) { r.x=width+margin; r.vx=-Math.abs(r.vx)*.45; }
    if (r.y < -margin) { r.y=-margin; r.vy=Math.abs(r.vy)*.45; }
    if (r.y > height+margin) { r.y=height+margin; r.vy=-Math.abs(r.vy)*.45; }
  }

  function resize() {
    width = Math.max(1, stage.clientWidth);
    height = Math.max(1, stage.clientHeight);
    dpr = clamp(Math.min(devicePixelRatio || 1, 1.45) * (width < 800 ? 0.62 : 0.68), 0.55, 1.15);
    canvas.width = Math.max(1, Math.round(width*dpr));
    canvas.height = Math.max(1, Math.round(height*dpr));
    canvas.style.width = width+'px';
    canvas.style.height = height+'px';
    gl.viewport(0,0,canvas.width,canvas.height);
    seedComposition();
  }

  function isHudTarget(target) {
    return target instanceof Element && !!target.closest('#hud');
  }
  stage.addEventListener('pointerdown', e => {
    if (isHudTarget(e.target)) return;
    if (e.button !== 0) return;
    e.preventDefault();
    activePointer = e.pointerId;
    stage.setPointerCapture?.(e.pointerId);
    beginRift(e.clientX,e.clientY,e.timeStamp || performance.now());
  });
  stage.addEventListener('pointermove', e => {
    if (e.pointerId !== activePointer || !activeRift) return;
    e.preventDefault();
    updateRiftFromPointer(e.clientX,e.clientY,e.timeStamp || performance.now());
  });
  const endPointer = e => {
    if (e.pointerId !== activePointer) return;
    releaseRift(e.timeStamp || performance.now());
  };
  stage.addEventListener('pointerup',endPointer);
  stage.addEventListener('pointercancel',endPointer);
  stage.addEventListener('dblclick', e => {
    if (isHudTarget(e.target)) return;
    e.preventDefault();
    seedComposition();
  });
  stage.addEventListener('contextmenu', e => e.preventDefault());
  stage.addEventListener('wheel', e => {
    if (isHudTarget(e.target)) return;
    e.preventDefault();
    exposure = clamp(exposure - e.deltaY * .0012, .7, 1.9);
    exposureInput.value = String(Math.round(exposure * 100));
  }, { passive: false });

  exposureInput.addEventListener('input', () => { exposure=Number(exposureInput.value)/100; });
  spectrumButton.addEventListener('click', e => {
    e.stopPropagation(); spectrum=(spectrum+1)%spectrumNames.length; spectrumButton.textContent=spectrumNames[spectrum];
  });
  materialButton.addEventListener('click', e => {
    e.stopPropagation(); material=(material+1)%materialNames.length; materialButton.textContent=materialNames[material];
  });
  resetButton.addEventListener('click', e => { e.stopPropagation(); seedComposition(); });
  for (const el of document.querySelectorAll('#hud button,#hud input')) {
    ['pointerdown','pointermove','pointerup','dblclick'].forEach(type => el.addEventListener(type,e=>e.stopPropagation()));
  }
  addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement) return;
    const key = e.key.toLowerCase();
    if (key === 's') {
      spectrum=(spectrum+1)%spectrumNames.length;
      spectrumButton.textContent=spectrumNames[spectrum];
    } else if (key === 'm') {
      material=(material+1)%materialNames.length;
      materialButton.textContent=materialNames[material];
    } else if (key === 'r') {
      seedComposition();
    } else if (key === '+' || key === '=') {
      exposure = clamp(exposure + .06, .7, 1.9);
      exposureInput.value = String(Math.round(exposure*100));
    } else if (key === '-' || key === '_') {
      exposure = clamp(exposure - .06, .7, 1.9);
      exposureInput.value = String(Math.round(exposure*100));
    } else {
      return;
    }
    e.preventDefault();
  });
  addEventListener('resize',resize,{passive:true});

  let lastFrame = performance.now();
  function render(now) {
    const dt = Math.min(.033,Math.max(.001,(now-lastFrame)/1000));
    lastFrame=now;
    rifts.forEach((r,i)=>stepRift(r,dt,i));

    gl.useProgram(program);
    gl.uniform2f(uniforms.uResolution,width,height);
    gl.uniform1f(uniforms.uTime,now/1000);
    gl.uniform1f(uniforms.uExposure,exposure);
    gl.uniform1f(uniforms.uSpectrum,spectrum);
    gl.uniform1f(uniforms.uMaterial,material);

    for (let i=0;i<rifts.length;i++) {
      const r=rifts[i];
      const breathing = r.opening * (1 + (reducedMotion?0:.014*Math.sin(r.phase*1.17+i)));
      gl.uniform4f(uniforms['uRift'+i],r.x,r.y,r.length,breathing);
      gl.uniform4f(uniforms['uMeta'+i],r.angle,r.phase,r.life,r.bend);
    }
    gl.drawArrays(gl.TRIANGLES,0,6);
    requestAnimationFrame(render);
  }

  resize();
  requestAnimationFrame(render);
})();
