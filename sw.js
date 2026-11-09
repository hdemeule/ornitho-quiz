const V='ornitho-v21';
const SHELL=['./','index.html','sosies.js','app.js','data.json','audio.json','photos.json','etho.json','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','icon-maskable-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x!=='ornitho-img').map(x=>caches.delete(x)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(((u.hostname==='upload.wikimedia.org'||(u.hostname==='commons.wikimedia.org'&&u.pathname.includes('FilePath')))&&!/\.(mp3|ogg)$/.test(u.pathname))||u.hostname==='fonts.gstatic.com'||u.hostname==='fonts.googleapis.com'){
    e.respondWith(caches.open('ornitho-img').then(async c=>{const hit=await c.match(e.request);if(hit)return hit;try{const r=await fetch(e.request);if(r.ok||r.type==='opaque')c.put(e.request,r.clone());return r;}catch(x){return Response.error();}}));return;
  }
  if(u.origin===location.origin&&!u.pathname.startsWith('/api/')){
    e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(V).then(c=>c.put(e.request,cp));return r;}).catch(()=>caches.match(e.request)));
  }
});
