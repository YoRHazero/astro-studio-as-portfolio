import{_ as e,b as t,i as n}from"./index-Cs9KBw7h.js";import{c as r,f as i,i as a,l as o,n as s,t as c,u as l}from"./react-three-fiber.esm-CMHEC_0O.js";var u=t(e(),1),d=n(),f=9e3,p=14e3,m=12,h=.62,g=.82;function _(e){let t=2166136261;for(let n=0;n<e.length;n++)t=Math.imul(t^e.charCodeAt(n),16777619);return()=>(t=Math.imul(t^t>>>15,2246822507),t=Math.imul(t^t>>>13,3266489909),((t^=t>>>16)>>>0)/4294967296)}var v=`
  uniform float uTime;
  uniform float uSize;
  uniform float uOuter;
  uniform float uJet;
  uniform vec3 uHot;
  uniform vec3 uCool;
  attribute vec4 aOrbit; // disk and stars: radius, phase, thickness, size · jet: spread, phase, pole, size
  attribute float aKind; // 0 = disk, 1 = jet, 2 = galaxy star, 3 = a star that will go supernova
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 p;
    float boost = 1.0;
    if (aKind < 0.5) {
      // Keplerian: the inner disk laps the outer disk many times over.
      float r = aOrbit.x;
      float angle = aOrbit.y + uTime * 0.9 * pow(r, -1.5);
      p = vec3(cos(angle) * r, aOrbit.z * (0.02 + r * 0.035), sin(angle) * r);
      float outward = smoothstep(${g.toFixed(2)}, uOuter, r);
      vColor = mix(uHot, uCool, pow(outward, 0.6));
      // Relativistic beaming: the side turning toward us is brighter.
      vAlpha = (1.0 - outward * 0.75) * (1.0 + 0.55 * cos(angle));
    } else if (aKind > 1.5) {
      // A galaxy turns almost like a solid wheel near the middle and lags further out.
      float r = aOrbit.x;
      float angle = aOrbit.y + uTime * 0.22 / (0.45 + r);
      float thickness = 0.03 + 0.3 * exp(-r * 1.6);
      p = vec3(cos(angle) * r, aOrbit.z * thickness, sin(angle) * r);
      float outward = smoothstep(0.15, uOuter * 0.6, r);
      vColor = mix(uHot, uCool, outward);
      vAlpha = 0.75 * (1.0 - smoothstep(uOuter * 0.55, uOuter, r) * 0.8);
      if (aKind > 2.5) {
        // Each of these stars explodes on its own clock: a sudden flash, then a slow fade.
        float period = 18.0 + 22.0 * fract(aOrbit.y * 7.31);
        float age = fract(uTime / period + fract(aOrbit.y * 3.17)) * period;
        float flare = smoothstep(0.0, 0.1, age) * exp(-age * 1.3);
        vColor = mix(vColor, vec3(0.92, 0.96, 1.0), min(1.0, flare * 3.0));
        vAlpha += flare * 4.0;
        boost = 1.0 + flare * 7.0;
      }
    } else {
      float along = fract(aOrbit.y + uTime * 0.12 * (0.6 + aOrbit.x));
      float height = along * 4.2;
      float radius = (0.03 + height * 0.07) * aOrbit.x;
      float angle = aOrbit.y * 40.0 + uTime * 0.5;
      p = vec3(cos(angle) * radius, aOrbit.z * (0.35 + height), sin(angle) * radius);
      vColor = mix(vec3(0.75, 0.85, 1.0), uHot, 0.3);
      vAlpha = (1.0 - along) * 0.7 * uJet;
    }
    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = aOrbit.w * boost * uSize / -viewPosition.z;
  }
`,y=`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float falloff = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(vColor, falloff * falloff * vAlpha);
  }
`;function b(e,t){let n=new o;return n.setAttribute(`position`,new r(new Float32Array(t.length*3),3)),n.setAttribute(`aOrbit`,new r(e,4)),n.setAttribute(`aKind`,new r(t,1)),n}function x(e){let t=2.6+e()*1.1,n=new Float32Array(42400),r=new Float32Array(10600),a={outer:t,tilt:.2+e()*.4,roll:(e()-.5)*.9,cool:new i().setHSL(.02+e()*.07,1,.5+e()*.08),hot:new i().setHSL(.09+e()*.05,1,.9),jet:.45+e()*.55};for(let r=0;r<f;r++)n.set([g+(t-g)*e()**1.7,e()*Math.PI*2,(e()-.5)*2,1+e()*1.6],r*4);for(let t=f;t<10600;t++)n.set([e(),e(),e()<.5?-1:1,.8+e()*1.2],t*4),r[t]=1;return{...a,geometry:b(n,r)}}function S(e){let t=3.3+e()*.6,n=2+Math.floor(e()*2),r=2.2+e()*1.6,a=new Float32Array(p*4),o=new Float32Array(p),s={outer:t,tilt:.75+e()*.45,roll:(e()-.5)*1.2,cool:new i().setHSL(.58+e()*.06,.85,.72),hot:new i().setHSL(.1+e()*.03,1,.82),jet:0},c=()=>(e()+e()+e()-1.5)/1.5;for(let i=0;i<p;i++){let s=e()<.24,l=s?e()**1.8*.9:.25+e()**.75*(t-.25),u=Math.floor(e()*n)/n*Math.PI*2,d=s?e()*Math.PI*2:u+r*Math.log(1+l)+c()*(.55-l*.07);a.set([l,d,c(),.7+e()*1.4],i*4),o[i]=!s&&i%Math.round(p/m)===0?3:2}return{...s,geometry:b(a,o)}}function C({seed:e,kind:t}){let n=(0,u.useRef)(null),r=(0,u.useRef)(null),i=a(e=>e.viewport.dpr),o=(0,u.useMemo)(()=>window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,[]),c=(0,u.useMemo)(()=>{let n=_(e),r=t===`galaxy`?S(n):x(n),i={uTime:{value:0},uSize:{value:22},uOuter:{value:r.outer},uJet:{value:r.jet},uHot:{value:r.hot},uCool:{value:r.cool}};return{...r,uniforms:i}},[e,t]),f=(0,u.useMemo)(()=>{let e=document.createElement(`canvas`);e.width=e.height=256;let t=e.getContext(`2d`),n=t.createRadialGradient(128,128,0,128,128,128);return n.addColorStop(0,`rgb(255 255 255 / 0.55)`),n.addColorStop(.25,`rgb(255 255 255 / 0.16)`),n.addColorStop(1,`rgb(255 255 255 / 0)`),t.fillStyle=n,t.fillRect(0,0,256,256),new l(e)},[]);return s(e=>{let t=o?12:e.clock.elapsedTime+12;r.current&&(r.current.uniforms.uTime.value=t,r.current.uniforms.uSize.value=22*i),n.current&&(n.current.rotation.x=c.tilt+Math.sin(t*.15)*.04)}),(0,d.jsxs)(`group`,{children:[(0,d.jsxs)(`mesh`,{children:[(0,d.jsx)(`planeGeometry`,{args:t===`galaxy`?[5,5]:[9,9]}),(0,d.jsx)(`meshBasicMaterial`,{map:f,color:t===`galaxy`?c.hot:c.cool,transparent:!0,depthWrite:!1,blending:2})]}),t===`blackhole`&&(0,d.jsxs)(d.Fragment,{children:[(0,d.jsxs)(`mesh`,{children:[(0,d.jsx)(`sphereGeometry`,{args:[h,48,32]}),(0,d.jsx)(`meshBasicMaterial`,{color:`#000000`})]}),(0,d.jsxs)(`mesh`,{"position-z":.01,children:[(0,d.jsx)(`ringGeometry`,{args:[h,.69,96]}),(0,d.jsx)(`meshBasicMaterial`,{color:`#ffe2c4`,transparent:!0,opacity:.85,depthTest:!1,blending:2})]})]}),(0,d.jsx)(`group`,{ref:n,rotation:[c.tilt,0,c.roll],children:(0,d.jsx)(`points`,{geometry:c.geometry,frustumCulled:!1,children:(0,d.jsx)(`shaderMaterial`,{ref:r,vertexShader:v,fragmentShader:y,uniforms:c.uniforms,transparent:!0,depthWrite:!1,blending:2})})})]})}function w({kind:e,seed:t,active:n}){return(0,d.jsx)(c,{frameloop:n?`always`:`never`,dpr:[1,2],resize:{offsetSize:!0},gl:{alpha:!0,antialias:!0},camera:{fov:35,position:[0,0,11]},children:(0,d.jsx)(C,{seed:t,kind:e},e+t)})}export{w as default};