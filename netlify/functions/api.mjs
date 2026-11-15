// API sécurisée du site EPP Barrage Soubré (Netlify Functions + Supabase).
// Variables d'environnement à définir dans Netlify : SUPABASE_URL, SUPABASE_SERVICE_KEY, AUTH_SECRET (et SETUP_CODE, recommandé).
import {randomBytes,scryptSync,timingSafeEqual,createHmac} from 'node:crypto';
const CL=['CP1','CP2','CE1','CE2','CM1','CM2'],E=k=>process.env[k]||'',enc=encodeURIComponent;
async function sb(t,method='GET',q='',body,h={}){const r=await fetch(`${E('SUPABASE_URL').replace(/\/$/,'')}/rest/v1/${t}${q}`,{method,headers:{apikey:E('SUPABASE_SERVICE_KEY'),Authorization:'Bearer '+E('SUPABASE_SERVICE_KEY'),'Content-Type':'application/json',...h},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw new Error('db '+r.status);return r.status===204?null:await r.json().catch(()=>null)}
const rows=q=>sb('epp_store','GET','?select=key,data'+q);
const getRow=async k=>(await sb('epp_store','GET','?select=data&key=eq.'+enc(k)))?.[0]?.data;
const putRows=a=>sb('epp_store','POST','',a.map(([key,data])=>({key,data,updated_at:new Date().toISOString()})),{Prefer:'resolution=merge-duplicates'});
const getAcc=async k=>(await sb('epp_accounts','GET','?select=data&key=eq.'+enc(k)))?.[0]?.data;
const putAcc=(k,d)=>sb('epp_accounts','POST','',[{key:k,data:d}],{Prefer:'resolution=merge-duplicates'});
const delAcc=k=>sb('epp_accounts','DELETE','?key=eq.'+enc(k));
const inList=a=>'in.('+enc(a.map(k=>'"'+k.replace(/"/g,'\\"')+'"').join(','))+')';
const hashPw=(p,salt=randomBytes(16).toString('hex'))=>({salt,hash:scryptSync(p,salt,64).toString('hex')});
const okPw=(p,a)=>{const h=Buffer.from(scryptSync(p,a.salt,64).toString('hex')),x=Buffer.from(a.hash);return h.length===x.length&&timingSafeEqual(h,x)};
const secret=()=>{const s=E('AUTH_SECRET');if(s.length<16)throw new Error('AUTH_SECRET');return s};
const sign=o=>{const b=Buffer.from(JSON.stringify({...o,exp:Date.now()+12*3600e3})).toString('base64url');return b+'.'+createHmac('sha256',secret()).update(b).digest('base64url')};
const verify=t=>{try{const [b,s]=t.split('.'),g=createHmac('sha256',secret()).update(b).digest('base64url');if(s.length!==g.length||!timingSafeEqual(Buffer.from(s),Buffer.from(g)))return null;const o=JSON.parse(Buffer.from(b,'base64url'));return o.exp>Date.now()?o:null}catch{return null}};
const fails=new Map(),limited=ip=>{const f=fails.get(ip);return !!f&&f.n>=10&&Date.now()-f.t<9e5},fail=ip=>{const f=fails.get(ip);fails.set(ip,{n:(f&&Date.now()-f.t<9e5?f.n:0)+1,t:Date.now()})};
const json=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}});
const mAvg=(g,sb)=>{g=typeof g==='number'?{Composition:g}:g||{};let t=0,w=0;for(const [k,v] of Object.entries(g)){const n=parseFloat(v);if(isNaN(n))continue;const c=(sb.find(s=>s.n===k)||{c:1}).c;t+=n*c;w+=c}return w?t/w:null};
const session=(role,name,classe)=>({token:sign({role,name,classe}),role,name,classe});
export const config={path:'/api/*'};
export default async req=>{
 const url=new URL(req.url),p=url.pathname.replace(/^\/api\//,''),ip=req.headers.get('x-nf-client-connection-ip')||req.headers.get('x-forwarded-for')||'?';
 try{
  const body=req.method==='POST'?await req.json().catch(()=>({})):{},au=verify((req.headers.get('authorization')||'').replace(/^Bearer /,''));
  if(p==='public')return json({rows:await rows('&key='+inList(url.searchParams.get('lite')?['school','news']:['school','news','gallery']))});
  if(p==='status'){const w=url.searchParams.get('who');if(w==='director'){const a=await getAcc('director');return json({state:a?'ready':'register',setup:!a&&!!E('SETUP_CODE')})}
   if(!CL.includes(w))return json({error:'Classe inconnue.'},400);if(await getAcc('teacher:'+w))return json({state:'ready'});return json({state:(await getAcc('invite:'+w))?'register':'closed'})}
  if(p==='register'){if(limited(ip))return json({error:'Trop de tentatives. Réessayez plus tard.'},429);
   const {who,password='',setup=''}=body,n=String(body.name||'').trim().slice(0,80);
   if(!n)return json({error:'Le nom est obligatoire.'},400);if(String(password).length<6)return json({error:'Le mot de passe doit contenir au moins 6 caractères.'},400);
   if(who==='director'){if(await getAcc('director'))return json({error:'Le compte du directeur existe déjà.'},409);if(E('SETUP_CODE')&&setup!==E('SETUP_CODE')){fail(ip);return json({error:"Code d'installation incorrect."},403)}
    await putAcc('director',{name:n,...hashPw(String(password))});const s=(await getRow('school'))||{name:'EPP BARRAGE SOUBRE',year:'2025-2026'};await putRows([['school',{...s,director:n}]]);return json(session('director',n))}
   if(!CL.includes(who))return json({error:'Classe inconnue.'},400);if(await getAcc('teacher:'+who))return json({error:'Ce compte existe déjà.'},409);
   if(!await getAcc('invite:'+who))return json({error:"Le directeur doit d'abord autoriser la création de votre compte."},403);
   await putAcc('teacher:'+who,{name:n,...hashPw(String(password))});await delAcc('invite:'+who);await putRows([['teachers:'+who,{name:n}]]);return json(session('teacher',n,who))}
  if(p==='login'){if(limited(ip))return json({error:'Trop de tentatives. Réessayez plus tard.'},429);const w=body.who;
   if(w!=='director'&&!CL.includes(w))return json({error:'Identifiants incorrects.'},401);const a=await getAcc(w==='director'?'director':'teacher:'+w);
   if(!a||!okPw(String(body.password||''),a)){fail(ip);return json({error:'Identifiants incorrects.'},401)}return json(w==='director'?session('director',a.name):session('teacher',a.name,w))}
  if(p==='parent'){if(limited(ip))return json({error:'Trop de tentatives. Réessayez plus tard.'},429);
   const m=String(body.matricule||'').trim(),t=String(body.phone||'').trim(),st=(await getRow('students'))||[],s=st.find(x=>x.matricule===m&&x.phone===t);
   if(!s){fail(ip);return json({error:'Matricule ou numéro incorrect. Vérifiez et réessayez.'},404)}
   const R=Object.fromEntries((await rows('&key=neq.gallery&key=neq.archives')).map(r=>[r.key,r.data])),c=s.classe,sj=R['subjects:'+c]||[];
   const av=x=>{const G=R['grades:'+x]||{},l=Object.keys(G).map(mo=>mAvg(G[mo],sj)).filter(v=>v!=null);return l.length?l.reduce((a,b)=>a+b,0)/l.length:null};
   const cls=st.filter(x=>x.classe===c).map(x=>({m:x.matricule,a:av(x.matricule)})).sort((a,b)=>(b.a??-1)-(a.a??-1)),i=cls.findIndex(x=>x.m===m),att={};
   for(const [k,v] of Object.entries(R))if(k.startsWith('attendance:')&&k.endsWith(':'+c)&&v[m]!==undefined)att[k.split(':')[1]]=v[m];
   return json({student:{name:s.name,classe:c,matricule:m,photo:s.photo||''},grades:R['grades:'+m]||{},subjects:sj,teacher:R['teachers:'+c]?.name||'',attendance:att,rank:cls[i].a==null?'—':i+1,effectif:cls.length,school:R.school||{name:'EPP BARRAGE SOUBRE',year:'2025-2026'}})}
  if(!au)return json({error:'Session expirée : reconnectez-vous.'},401);
  if(p==='password'){const k=au.role==='director'?'director':'teacher:'+au.classe,a=await getAcc(k);if(!a||!okPw(String(body.old||''),a))return json({error:'Mot de passe actuel incorrect.'},403);
   if(String(body.new||'').length<6)return json({error:'Le nouveau mot de passe doit contenir au moins 6 caractères.'},400);await putAcc(k,{...a,...hashPw(String(body.new))});return json({ok:true})}
  if(p==='data'){let rs=await rows(au.role==='teacher'?'&key=neq.gallery&key=neq.archives&key=neq.news':''),extra={};
   if(au.role==='teacher'){const c=au.classe,st=(rs.find(r=>r.key==='students')?.data||[]).filter(s=>s.classe===c),ids=new Set(st.map(s=>s.matricule));
    rs=rs.filter(r=>r.key==='school'||r.key==='subjects:'+c||r.key==='teachers:'+c||(r.key.startsWith('attendance:')&&r.key.endsWith(':'+c))||(r.key.startsWith('grades:')&&ids.has(r.key.slice(7))));rs.push({key:'students',data:st})}
   else{const t={};for(const c of CL){const a=await getAcc('teacher:'+c);t[c]=a?{state:'ready',name:a.name}:{state:(await getAcc('invite:'+c))?'invited':'none'}}extra.accounts=t}
   return json({rows:rs,me:{role:au.role,name:au.name,classe:au.classe},...extra})}
  if(p==='invite'){if(au.role!=='director')return json({error:'Action non autorisée.'},403);const c=body.classe;if(!CL.includes(c))return json({error:'Classe inconnue.'},400);
   if(body.cancel){await delAcc('invite:'+c);return json({state:'none'})}await delAcc('teacher:'+c);await putAcc('invite:'+c,{});await putRows([['teachers:'+c,{}]]);return json({state:'invited'})}
  if(p==='save'){const up=Array.isArray(body.up)?body.up:[],del=Array.isArray(body.del)?body.del:[];let ok=()=>true;
   if(au.role==='teacher'){const c=au.classe,ids=new Set(((await getRow('students'))||[]).filter(s=>s.classe===c).map(s=>s.matricule));ok=k=>(k.startsWith('grades:')&&ids.has(k.slice(7)))||(k.startsWith('attendance:')&&k.endsWith(':'+c))}
   if([...up.map(x=>x&&x.key),...del].some(k=>typeof k!=='string'||!ok(k)))return json({error:'Action non autorisée.'},403);
   if(up.length)await putRows(up.map(x=>[x.key,x.data]));if(del.length)await sb('epp_store','DELETE','?key='+inList(del));return json({ok:true})}
  return json({error:'Introuvable.'},404);
 }catch(e){return json({error:e.message==='AUTH_SECRET'?'Configuration serveur incomplète (AUTH_SECRET).':'Erreur serveur. Réessayez.'},500)}
};
