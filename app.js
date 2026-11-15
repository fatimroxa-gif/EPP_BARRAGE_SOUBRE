/* EPP BARRAGE SOUBRE - logique commune. Données sur serveur sécurisé (fonction Netlify + base Supabase). */
const CLASSES=['CP1','CP2','CE1','CE2','CM1','CM2'];
const MONTHS=['Septembre','Octobre','Novembre','Décembre','Janvier','Février','Mars','Avril','Mai','Juin'];
const PAGES=[['index','Accueil',''],['administration','Administration','director'],['attendance',"Faire l'appel",'director,teacher'],['grades','Saisir les notes','director,teacher'],['parent','Espace Parent',''],['bulletin','Bulletins','director,teacher'],['results','Résultats','director,teacher'],['archive','Archives','director']];
const sess=()=>{try{return JSON.parse(sessionStorage.getItem('epp_sess'))}catch(e){return null}};
let SESS=sess();
const myClasses=()=>SESS&&SESS.role==='teacher'?[SESS.classe]:CLASSES;
const T=c=>{const t=DB.teachers[c];return typeof t==='string'?{name:t}:t||{}};
const $=(s,r=document)=>r.querySelector(s);
const def=()=>({school:{name:'EPP BARRAGE SOUBRE',year:'2025-2026',director:''},students:[],teachers:{},grades:{},attendance:{},news:[],archives:[],subjects:{},gallery:[]});
let DB=def();
const PG=location.pathname.split('/').pop().replace(/\.html$/,'')||'index';
const _P=[['Français',1],['Mathématiques',1],['EDHC',1],['EPS',1],['Arts (AEC)',1]],_S=[['Français',1],['Mathématiques',1],['EDHC',1],['Histoire-Géographie',1],['Sciences et Technologie',1],['EPS',1],['Arts (AEC)',1]];
const PRESET=Object.fromEntries(CLASSES.map(c=>[c,(c[1]==='P'?_P:_S).map(([n,k])=>({n,c:k}))]));
function toast(m,err){let c=$('#toasts');if(!c){document.body.insertAdjacentHTML('beforeend','<div id="toasts" aria-live="polite"></div>');c=$('#toasts')}const e=document.createElement('div');e.className='toast'+(err||/doit|existe|Choisissez|plein|incorrect|obligatoire|introuvable|Aucun code|au moins|identiques/.test(m)?' err':'');e.textContent=m;c.append(e);setTimeout(()=>e.remove(),3200)}
let ONLINE=false,ACCTS={},snap={},q=Promise.resolve(),tm;
async function api(path,body){let r;try{r=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(SESS?.token?{Authorization:'Bearer '+SESS.token}:{})},body:body&&JSON.stringify(body)})}catch(e){throw new Error('Serveur injoignable. Vérifiez votre connexion.')}
 const d=await r.json().catch(()=>({}));if(!r.ok){if(r.status===401&&SESS){sessionStorage.removeItem('epp_sess');toast('Session expirée : reconnectez-vous.',true);setTimeout(()=>location.href='index.html',1500)}throw new Error(d.error||'Erreur serveur.')}return d}
const flat=d=>{const o={school:d.school,students:d.students,news:d.news,gallery:d.gallery,archives:d.archives};
 for(const [k,v] of Object.entries(d.teachers))o['teachers:'+k]=v;for(const [k,v] of Object.entries(d.subjects))o['subjects:'+k]=v;for(const [k,v] of Object.entries(d.grades))o['grades:'+k]=v;
 for(const [dt,cl] of Object.entries(d.attendance))for(const [c,v] of Object.entries(cl))o['attendance:'+dt+':'+c]=v;return o};
const unflat=rows=>{const d=def();for(const {key,data} of rows){const i=key.indexOf(':');if(i<0){d[key]=data;continue}const p=key.slice(0,i),r=key.slice(i+1);
 if(p==='attendance'){const n=r.indexOf(':'),dt=r.slice(0,n);(d.attendance[dt]=d.attendance[dt]||{})[r.slice(n+1)]=data}else d[p][r]=data}return d};
const mark=()=>{snap={};const f=flat(DB);for(const k in f)snap[k]=JSON.stringify(f[k])};
async function push(){const cur=flat(DB),up=[],del=[];for(const k in cur)if(snap[k]!==JSON.stringify(cur[k]))up.push({key:k,data:cur[k]});for(const k in snap)if(!(k in cur))del.push(k);
 if(!up.length&&!del.length)return;
 try{await api('save',{up,del});up.forEach(r=>snap[r.key]=JSON.stringify(r.data));del.forEach(k=>delete snap[k])}catch(e){toast(e.message,true)}}
async function pull(){try{const d=await api(SESS?'data':'public'+(PG==='index'?'':'?lite=1'));DB=Object.assign(def(),unflat(d.rows));ACCTS=d.accounts||{};mark();ONLINE=true}catch(e){toast(e.message,true)}}
const flush=()=>{clearTimeout(tm);q=q.then(push);return q};
const save=()=>{clearTimeout(tm);tm=setTimeout(()=>{q=q.then(push)},300)};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opts=(a,sel)=>a.map(v=>`<option ${v===sel?'selected':''}>${esc(v)}</option>`).join('');
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const fmt=n=>n==null?'—':n.toFixed(2);
const subs=c=>DB.subjects[c]||[];
const gm=g=>typeof g==='number'?{Composition:g}:g||{};
function monthAvg(m,c,mo){let t=0,w=0;for(const [k,v] of Object.entries(gm((DB.grades[m]||{})[mo]))){const n=parseFloat(v);if(isNaN(n))continue;const co=(subs(c).find(s=>s.n===k)||{c:1}).c;t+=n*co;w+=co}return w?t/w:null}
const studentAvg=m=>{const c=DB.students.find(s=>s.matricule===m)?.classe;return avg(Object.keys(DB.grades[m]||{}).map(mo=>monthAvg(m,c,mo)).filter(x=>x!=null))};
const mention=n=>n==null?'—':n>=16?'Excellent':n>=14?'Très bien':n>=12?'Bien':n>=10?'Passable':'Insuffisant';
const absences=m=>Object.values(DB.attendance).reduce((t,d)=>t+Object.values(d).filter(c=>c[m]==='A').length,0);
function ranked(c){const l=DB.students.filter(s=>s.classe===c).map(s=>({...s,avg:studentAvg(s.matricule)})).sort((a,b)=>(b.avg??-1)-(a.avg??-1));l.forEach((s,i)=>s.rank=s.avg==null?'—':i+1);return l}
const shrink=(f,mx=160)=>new Promise(r=>{if(!f)return r('');const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,mx/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);r(c.toDataURL('image/jpeg',.7))};im.src=fr.result};fr.readAsDataURL(f)});
function bulletin(s,effectif,ro){const c=s.classe,G=DB.grades[s.matricule]||{},mos=MONTHS.filter(m=>G[m]!==undefined),a=studentAvg(s.matricule),sb=subs(c),
 names=[...new Set([...sb.map(x=>x.n),...mos.flatMap(m=>Object.keys(gm(G[m])))])],cell=(m,n)=>gm(G[m])[n]??'—';
 return `<article class="sheet${ro?' view':''}"><div class="sh-head"><img src="logo.jpg" alt=""><div><h3>${esc(DB.school.name)}</h3><p>Bulletin scolaire - Année ${esc(DB.school.year)}</p></div>${s.photo?`<img class="photo" src="${s.photo}" alt="">`:''}</div>
 <p><b>${esc(s.name)}</b> - Matricule ${esc(s.matricule)} - Classe ${esc(c)} - Maître : ${esc(T(c).name||'—')}</p>
 ${mos.length?`<table><tr><th>Matière</th><th>Coef.</th>${mos.map(m=>`<th>${m}</th>`).join('')}</tr>${names.map(n=>`<tr><td>${esc(n)}</td><td>${(sb.find(x=>x.n===n)||{c:1}).c}</td>${mos.map(m=>`<td>${cell(m,n)}</td>`).join('')}</tr>`).join('')}<tr><th colspan="2">Moyenne du mois</th>${mos.map(m=>`<th>${fmt(monthAvg(s.matricule,c,m))}</th>`).join('')}</tr></table>`:'<p class="empty">Aucune note enregistrée.</p>'}
 <p><b>Moyenne générale :</b> ${fmt(a)}/20 - <b>Rang :</b> ${s.rank??'—'}${effectif?'/'+effectif:''} - <b>Absences :</b> ${absences(s.matricule)} - <b>Appréciation :</b> ${mention(a)}</p><div class="sign"><span>Le maître</span><span>Le directeur</span></div></article>`}

function loginView(){
 $('main').innerHTML=`<div class="card" style="max-width:440px;margin:auto"><h2>Connexion</h2><p>Accès réservé au personnel de l'école.</p><label for="who">Je suis</label><select id="who"><option value="director">Le directeur</option>${CLASSES.map(c=>`<option value="${c}">Maître de ${c}</option>`).join('')}</select><div id="nm" hidden><label for="tname">Votre nom complet</label><input id="tname" autocomplete="name"></div><div id="sp" hidden><label for="setup">Code d'installation (donné par la personne qui a mis le site en ligne)</label><input id="setup" type="password" autocomplete="off"></div><label for="code">Mot de passe</label><input id="code" type="password" autocomplete="current-password"><div id="cf" hidden><label for="code2">Confirmez le mot de passe</label><input id="code2" type="password" autocomplete="new-password"></div><p><small id="hint"></small></p><button id="go">Se connecter</button></div>`;
 let st='ready';
 const upd=async()=>{$('#go').disabled=true;try{const s=await api('status?who='+$('#who').value);st=s.state;$('#nm').hidden=$('#cf').hidden=st!=='register';$('#sp').hidden=!(st==='register'&&s.setup);$('#go').textContent=st==='register'?'Créer mon compte':'Se connecter';$('#go').disabled=st==='closed';
  $('#hint').textContent=st==='register'?'Première connexion : indiquez votre nom et créez votre mot de passe (6 caractères minimum). Notez-le bien.':st==='closed'?"Votre compte n'est pas encore ouvert : demandez au directeur de l'autoriser dans Administration.":''}catch(e){$('#hint').textContent=e.message}};
 const go=async()=>{const w=$('#who').value,v=$('#code').value;if(!v)return toast('Le mot de passe est obligatoire.');let b={who:w,password:v};
  if(st==='register'){if(!$('#tname').value.trim())return toast('Le nom est obligatoire.');if(v.length<6)return toast('Le mot de passe doit contenir au moins 6 caractères.');if(v!==$('#code2').value)return toast('Les deux mots de passe ne sont pas identiques.');b={...b,name:$('#tname').value.trim(),setup:$('#setup').value}}
  try{const d=await api(st==='register'?'register':'login',b);sessionStorage.setItem('epp_sess',JSON.stringify({role:d.role,classe:d.classe,name:d.name,token:d.token}));location.reload()}catch(e){toast(e.message,true)}};
 $('#who').onchange=upd;upd();$('#go').onclick=go;[$('#code'),$('#code2')].forEach(i=>i.onkeydown=e=>e.key==='Enter'&&go());
}
document.addEventListener('DOMContentLoaded',async()=>{
 await pull();
 const cur=location.pathname.split('/').pop().replace(/\.html$/,'')||'index';
 document.title=(PAGES.find(p=>p[0]===cur)?.[1]||'Accueil')+' - '+DB.school.name;document.head.insertAdjacentHTML('beforeend','<link rel="icon" href="logo.jpg"><meta name="theme-color" content="#0c1f8f">');
 document.body.insertAdjacentHTML('afterbegin',`<header><img src="logo.jpg" alt="Logo"><h1>${esc(DB.school.name)}</h1>${SESS?'<button id="logout" class="ghost" style="margin:0">Déconnexion</button>':''}<button id="mus" class="icon" aria-label="Activer ou couper la musique"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 3v11.3A3.5 3.5 0 1 0 11 17V7h7V3z"/></svg></button><audio id="au" loop src="musique%20epp%20.mp3"></audio><nav aria-label="Navigation principale">${PAGES.filter(([,,r])=>!r||r.split(',').includes(SESS?.role)).map(([h,t])=>`<a href="${h}.html" ${h===cur?'class="on" aria-current="page"':''}>${t}</a>`).join('')}${SESS?'':'<a href="grades.html">Espace du personnel</a>'}</nav></header>`);
 $('#logout')&&($('#logout').onclick=()=>{sessionStorage.removeItem('epp_sess');location.href='index.html'});
 const au=$('#au'),mb=$('#mus');mb.onclick=()=>au.paused?au.play().catch(()=>toast('Fichier musique introuvable.')):au.pause();au.onplay=au.onpause=()=>mb.classList.toggle('on',!au.paused);
 document.body.insertAdjacentHTML('beforeend',`<footer>© ${new Date().getFullYear()} EPP Barrage Soubré - Tous droits réservés.</footer>`);
 const need=(document.body.dataset.roles||'').split(',').filter(Boolean),p=window['page_'+document.body.dataset.page];
 if(need.length&&!need.includes(SESS?.role))loginView();else p&&p();
});

function page_index(){
 $('#gal').innerHTML=[...DB.gallery.map(g=>g.src),...Array.from({length:16},(_,i)=>`pohto5_(${i+1}).jpeg`)].map((u,i)=>`<img src="${u}" alt="Cérémonie ${i+1}" loading="lazy" onerror="this.remove()">`).join('');
 $('#gal').onclick=e=>{if(e.target.tagName==='IMG'){$('#lb img').src=e.target.src;$('#lb').hidden=false}};
 document.addEventListener('keydown',e=>e.key==='Escape'&&($('#lb').hidden=true));
 $('#lb').onclick=()=>$('#lb').hidden=true;
 $('#news').innerHTML=DB.news.length?DB.news.map(n=>`<li><b>${esc(n.date)}</b> - ${esc(n.text)}</li>`).join(''):'<li>Aucune actualité pour le moment.</li>';
}

function page_administration(){
 const sc=DB.school;
 $('#info').innerHTML=`<b>École :</b> ${esc(sc.name)}<br><b>Année scolaire :</b> ${esc(sc.year)}<br><b>Directeur :</b> ${esc(sc.director||SESS.name||'')}`;
 $('#sclass').innerHTML=opts(CLASSES);$('#sjc').innerHTML=opts(CLASSES);
 const drawT=()=>{$('#tstat').innerHTML=CLASSES.map(c=>{const a=ACCTS[c]||{state:'none'};return `<tr><td>${c}</td><td>${esc(a.name||'—')}</td><td>${a.state==='ready'?'<span class="chip ok">Compte créé</span>':a.state==='invited'?'<span class="chip">En attente du maître</span>':'<small>Non ouvert</small>'}</td><td><button class="ghost" data-c="${c}">${a.state==='ready'?'Réinitialiser':a.state==='invited'?'Annuler':'Autoriser'}</button></td></tr>`}).join('')};
 $('#tstat').onclick=async e=>{const c=e.target.dataset.c;if(!c)return;const a=ACCTS[c]||{state:'none'};if(a.state==='ready'&&!confirm('Réinitialiser le compte du maître de '+c+' ? Il devra créer un nouveau mot de passe.'))return;
  try{const r=await api('invite',{classe:c,cancel:a.state==='invited'});ACCTS[c]=r.state==='invited'?{state:'invited'}:{state:'none'};drawT();toast(r.state==='invited'?'Création du compte autorisée : le maître peut se connecter.':'Mis à jour.')}catch(x){toast(x.message,true)}};drawT();
 $('#savePin').onclick=async()=>{try{await api('password',{old:$('#oldPin').value,new:$('#newpin').value});$('#oldPin').value=$('#newpin').value='';toast('Mot de passe modifié.')}catch(e){toast(e.message,true)}};
 const drawJ=()=>{$('#sjl').innerHTML=subs($('#sjc').value).map((x,i)=>`<span class="chip ok">${esc(x.n)} (coef. ${x.c})<button class="x ghost" data-i="${i}" aria-label="Retirer ${esc(x.n)}">×</button></span>`).join('')||'<p class="empty">Aucune matière pour cette classe.</p>'};
 $('#sjc').onchange=drawJ;drawJ();
 $('#sjpre').onclick=()=>{const c=$('#sjc').value,l=DB.subjects[c]=DB.subjects[c]||[];let n=0;for(const x of PRESET[c])if(!l.some(y=>y.n===x.n)){l.push({...x});n++}save();drawJ();toast(n?n+' matière(s) du programme ajoutée(s).':'Toutes les matières du programme sont déjà enregistrées.')};
 $('#sjadd').onclick=()=>{const n=$('#sjn').value.trim(),k=parseInt($('#sjk').value)||1,c=$('#sjc').value;if(!n)return toast('Le nom de la matière est obligatoire.');const l=DB.subjects[c]=DB.subjects[c]||[];if(l.some(x=>x.n.toLowerCase()===n.toLowerCase()))return toast('Cette matière existe déjà.');l.push({n,c:k});save();$('#sjn').value='';drawJ()};
 $('#sjl').onclick=e=>{const i=e.target.dataset.i,c=$('#sjc').value;if(i!==undefined&&confirm('Retirer cette matière ?')){DB.subjects[c].splice(i,1);save();drawJ()}};
 $('#newYear').onclick=async()=>{const y=prompt("Nouvelle année scolaire (ex : 2026-2027). L'année en cours sera archivée et les notes remises à zéro.");if(!y)return;DB.archives.push({year:sc.year,date:new Date().toISOString(),students:DB.students,grades:DB.grades,attendance:DB.attendance,teachers:DB.teachers});sc.year=y;DB.grades={};DB.attendance={};save();await flush();location.reload()};
 const stats=()=>{const d=new Date().toISOString().slice(0,10),ab=Object.values(DB.attendance[d]||{}).reduce((t,c)=>t+Object.values(c).filter(v=>v==='A').length,0);
  $('#stats').innerHTML=[[DB.students.length,'Élèves'],[CLASSES.filter(c=>DB.students.some(s=>s.classe===c)).length,'Classes actives'],[ab,"Absents aujourd'hui"],[DB.news.length,'Actualités']].map(([n,l])=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('')};
 const drawS=()=>{const q=($('#q').value||'').toLowerCase();stats();$('#students').innerHTML=DB.students.map((s,i)=>({s,i})).filter(({s})=>(s.name+s.matricule+s.classe).toLowerCase().includes(q)).map(({s,i})=>`<tr><td>${s.photo?`<img class="av" src="${s.photo}" alt="">`:`<span class="av">${esc(s.name[0]||'?')}</span>`}${esc(s.name)}</td><td>${esc(s.classe)}</td><td>${esc(s.matricule)}</td><td>${esc(s.phone)}</td><td><button class="danger" data-i="${i}" aria-label="Supprimer ${esc(s.name)}">Supprimer</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">Aucun élève trouvé.</td></tr>'};
 $('#q').oninput=drawS;
 $('#students').onclick=e=>{const i=e.target.dataset.i;if(i!==undefined&&confirm('Supprimer cet élève ?')){delete DB.grades[DB.students[i].matricule];DB.students.splice(i,1);save();drawS()}};
 $('#addS').onsubmit=async e=>{e.preventDefault();const m=$('#mat').value.trim();
  if(DB.students.some(s=>s.matricule===m))return toast('Ce matricule existe déjà.');
  DB.students.push({name:$('#sname').value.trim(),classe:$('#sclass').value,matricule:m,phone:$('#phone').value.trim(),photo:await shrink($('#photo').files[0])});
  save();e.target.reset();drawS()};
 drawS();
 $('#exp').onclick=()=>{const b=new Blob([JSON.stringify(DB)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`sauvegarde-epp-${new Date().toISOString().slice(0,10)}.json`;a.click()};
 $('#imp').onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());if(!Array.isArray(d.students))throw 0;if(!confirm('Remplacer toutes les données actuelles par cette sauvegarde ?'))return;DB=Object.assign(def(),d);save();await flush();location.reload()}catch(x){toast('Fichier de sauvegarde incorrect.')}};
 $('#dbstatus').textContent=ONLINE?'Base de données sécurisée : connectée.':'Base de données injoignable.';
 const drawG=()=>{$('#gadm').innerHTML=DB.gallery.map((g,i)=>`<figure class="gi"><img src="${g.src}" alt="Photo ${i+1}"><button class="danger" data-g="${i}" aria-label="Supprimer la photo ${i+1}">Supprimer</button></figure>`).join('')||'<p class="empty">Aucune photo ajoutée.</p>'};
 $('#gfile').onchange=async e=>{for(const f of e.target.files)DB.gallery.unshift({src:await shrink(f,900)});save();e.target.value='';drawG();toast('Photos ajoutées.')};
 $('#gadm').onclick=e=>{const i=e.target.dataset.g;if(i!==undefined&&confirm('Supprimer cette photo ?')){DB.gallery.splice(i,1);save();drawG()}};drawG();
 const drawN=()=>$('#newsList').innerHTML=DB.news.map((n,i)=>`<li data-i="${i}">${esc(n.date)} - ${esc(n.text)}</li>`).join('');
 $('#newsList').onclick=e=>{const i=e.target.dataset.i;if(i!==undefined&&confirm('Supprimer cette actualité ?')){DB.news.splice(i,1);save();drawN()}};
 $('#pub').onclick=()=>{const t=$('#newsText').value.trim();if(!t)return;DB.news.unshift({date:new Date().toLocaleDateString('fr-FR'),text:t});save();$('#newsText').value='';drawN()};
 drawN();
}

function page_attendance(){
 $('#cls').innerHTML=opts(myClasses());$('#day').value=new Date().toISOString().slice(0,10);
 const draw=()=>{const c=$('#cls').value,rec=(DB.attendance[$('#day').value]||{})[c]||{},l=DB.students.filter(s=>s.classe===c);
  $('#list').innerHTML=l.map((s,i)=>`<tr><td>${esc(s.name)}</td><td><label><input type="radio" name="a${i}" value="P" ${rec[s.matricule]!=='A'?'checked':''}> Présent</label> <label><input type="radio" name="a${i}" value="A" ${rec[s.matricule]==='A'?'checked':''}> Absent</label></td></tr>`).join('')||'<tr><td>Aucun élève dans cette classe.</td></tr>'};
 $('#cls').onchange=$('#day').onchange=draw;draw();
 $('#allP').onclick=()=>document.querySelectorAll('#list input[value=P]').forEach(r=>r.checked=true);
 $('#saveA').onclick=()=>{const c=$('#cls').value,d=$('#day').value,rec={};
  DB.students.filter(s=>s.classe===c).forEach((s,i)=>rec[s.matricule]=document.querySelector(`input[name=a${i}]:checked`).value);
  (DB.attendance[d]=DB.attendance[d]||{})[c]=rec;save();toast("Appel enregistré.")};
}

function page_grades(){
 const M=new Date().toLocaleDateString('fr-FR',{month:'long'}),cm=M[0].toUpperCase()+M.slice(1),c=()=>$('#cls').value;
 $('#cls').innerHTML=opts(myClasses());$('#month').innerHTML=opts(MONTHS,MONTHS.includes(cm)?cm:'Juin');
 const avgLive=()=>{let t=0,w=0;subs(c()).forEach((x,i)=>{const v=parseFloat($('#n'+i)?.value);if(!isNaN(v)){t+=v*x.c;w+=x.c}});$('#mavg').textContent=w?fmt(t/w)+' / 20':'—'};
 const fields=()=>{const g=gm((DB.grades[$('#stu').value]||{})[$('#month').value]);$('#fields').innerHTML=subs(c()).map((x,i)=>`<label for="n${i}">${esc(x.n)} <small>(coef. ${x.c})</small></label><input id="n${i}" type="number" min="0" max="20" step="0.25" value="${g[x.n]??''}">`).join('');$('#fields').oninput=avgLive;avgLive()};
 const recap=()=>{const sb=subs(c()),mo=$('#month').value;$('#rtab').innerHTML=`<tr><th>Élève</th>${sb.map(x=>`<th>${esc(x.n)}</th>`).join('')}<th>Moyenne</th></tr>`+(DB.students.filter(s=>s.classe===c()).map(s=>{const g=gm((DB.grades[s.matricule]||{})[mo]);return `<tr><td>${esc(s.name)}</td>${sb.map(x=>`<td>${g[x.n]??'—'}</td>`).join('')}<td><b>${fmt(monthAvg(s.matricule,c(),mo))}</b></td></tr>`}).join('')||`<tr><td colspan="${sb.length+2}" class="empty">Aucun élève.</td></tr>`)};
 const drawS=()=>{const sb=subs(c());$('#subjList').innerHTML=sb.map(x=>`<span class="chip ok">${esc(x.n)} (coef. ${x.c})</span>`).join('');
  $('#subjHint').textContent=sb.length?'':(SESS.role==='director'?'Aucune matière pour cette classe : ajoutez-les dans Administration (Matières par classe).':"Le directeur n'a pas encore enregistré les matières de votre classe. Demandez-lui de le faire.");$('#entry').hidden=$('#recap').hidden=!sb.length;fields();recap()};
 const stu=()=>{$('#stu').innerHTML=DB.students.filter(s=>s.classe===c()).map(s=>`<option value="${esc(s.matricule)}">${esc(s.name)}</option>`).join('');drawS()};
 if(SESS.role==='teacher'){$('#mycode').hidden=false;$('#chg').onclick=async()=>{try{await api('password',{old:$('#oldc').value,new:$('#newc').value});$('#oldc').value=$('#newc').value='';toast('Mot de passe modifié.')}catch(e){toast(e.message,true)}}}
 $('#cls').onchange=stu;$('#stu').onchange=$('#month').onchange=()=>{fields();recap()};
 $('#saveG').onclick=()=>{const m=$('#stu').value;if(!m)return toast('Choisissez un élève.');const o={};
  for(const [i,x] of subs(c()).entries()){const raw=$('#n'+i).value;if(raw==='')continue;const v=parseFloat(raw);if(isNaN(v)||v<0||v>20)return toast(`La note de ${x.n} doit être entre 0 et 20.`);o[x.n]=v}
  (DB.grades[m]=DB.grades[m]||{})[$('#month').value]=o;save();toast('Notes enregistrées.');recap();const s=$('#stu');if(s.selectedIndex<s.options.length-1){s.selectedIndex++;fields()}};
 stu();
}

function page_parent(){
 const show=d=>{const s={...d.student,rank:d.rank};DB.school=d.school;DB.students=[s];DB.grades={[s.matricule]:d.grades};DB.subjects={[s.classe]:d.subjects};DB.teachers={[s.classe]:{name:d.teacher}};DB.attendance={};
  for(const [dt,v] of Object.entries(d.attendance))DB.attendance[dt]={[s.classe]:{[s.matricule]:v}};
  const st=d.attendance[new Date().toISOString().slice(0,10)],days=Object.keys(d.attendance).sort().reverse().slice(0,7);
  $('#out').innerHTML=`<div class="card"><h3>Présence de ${esc(s.name)}</h3><p>Aujourd'hui : ${st==='A'?'<span class="chip">Absent(e)</span>':st==='P'?'<span class="chip ok">Présent(e)</span>':'<small>Appel pas encore effectué.</small>'}</p>${days.length?`<table><tr><th>Date</th><th>Statut</th></tr>${days.map(x=>`<tr><td>${new Date(x).toLocaleDateString('fr-FR')}</td><td>${d.attendance[x]==='A'?'Absent(e)':'Présent(e)'}</td></tr>`).join('')}</table>`:''}</div>${bulletin(s,d.effectif,true)}<p><small>Le bulletin est consultable en ligne uniquement : téléchargement et impression non autorisés.</small></p>`;
  document.oncontextmenu=e=>e.preventDefault();document.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&/^[ps]$/i.test(e.key))e.preventDefault()}};
 $('#login').onclick=async()=>{try{show(await api('parent',{matricule:$('#mat').value.trim(),phone:$('#tel').value.trim()}))}catch(e){$('#out').innerHTML=`<p>${esc(e.message)}</p>`}};
}

function page_bulletin(){
 $('#cls').innerHTML=opts(myClasses());
 const draw=()=>{const l=ranked($('#cls').value);$('#count').textContent=l.length?`${l.length} bulletin${l.length>1?'s':''} dans la classe ${$('#cls').value}.`:'';$('#out').innerHTML=l.map(s=>bulletin(s,l.length)).join('')||'<p class="empty">Aucun élève dans cette classe.</p>'};
 $('#cls').onchange=draw;draw();$('#print').onclick=()=>print();
}

function page_results(){
 $('#cls').innerHTML=opts(myClasses());$('#per').innerHTML=opts(['Année complète',...MONTHS]);
 const draw=()=>{const c=$('#cls').value,p=$('#per').value,an=p==='Année complète';
  const l=DB.students.filter(s=>s.classe===c).map(s=>({...s,avg:an?studentAvg(s.matricule):monthAvg(s.matricule,c,p)})).sort((a,b)=>(b.avg??-1)-(a.avg??-1));
  let r=0,pv=null,k=0;l.forEach(s=>{if(s.avg==null){s.rank='—';return}k++;if(s.avg!==pv){r=k;pv=s.avg}s.rank=r});
  const v=l.filter(s=>s.avg!=null),pct=v.length?Math.round(v.filter(s=>s.avg>=10).length/v.length*100):0;
  $('#out').innerHTML=`<div class="stats"><div class="stat"><b>${l.length}</b><span>Élèves</span></div><div class="stat"><b>${fmt(avg(v.map(s=>s.avg)))}</b><span>Moyenne de la classe</span></div><div class="stat"><b>${pct}%</b><span>Taux de réussite</span></div><div class="stat"><b>${v.length?esc(v[0].name):'—'}</b><span>Premier(ère) : ${v.length?fmt(v[0].avg):'—'}</span></div></div>
  <div class="card"><h3>${c} - ${esc(p)}</h3><div class="bar" role="img" aria-label="Taux de réussite ${pct}%"><i style="width:${pct}%"></i></div><table><tr><th>Rang</th><th>Élève</th><th>Moyenne</th><th>Appréciation</th>${an?'<th>Décision</th>':''}</tr>${l.map(s=>`<tr><td>${s.rank}</td><td>${esc(s.name)}</td><td>${fmt(s.avg)}</td><td>${mention(s.avg)}</td>${an?`<td>${s.avg==null?'—':s.avg>=10?'<span class="chip ok">Admis(e)</span>':'<span class="chip">Redouble</span>'}</td>`:''}</tr>`).join('')||'<tr><td colspan="5" class="empty">Aucun élève dans cette classe.</td></tr>'}</table></div>`};
 $('#cls').onchange=$('#per').onchange=draw;$('#print').onclick=()=>print();draw();
}

function page_archive(){
 $('#out').innerHTML=DB.archives.map((a,i)=>{const ms=a.students.map(s=>avg(Object.values(a.grades[s.matricule]||{}).map(g=>avg(Object.values(gm(g)).map(Number).filter(x=>!isNaN(x)))).filter(x=>x!=null)));
  return `<div class="card"><h3>Année ${esc(a.year)}</h3><p>${a.students.length} élèves - moyenne générale : ${fmt(avg(ms.filter(x=>x!=null)))}</p><button data-i="${i}">Télécharger (JSON)</button></div>`}).join('')||'<p>Aucune année archivée pour le moment.</p>';
 $('#out').onclick=e=>{const i=e.target.dataset.i;if(i===undefined)return;const b=new Blob([JSON.stringify(DB.archives[i],null,2)],{type:'application/json'}),l=document.createElement('a');l.href=URL.createObjectURL(b);l.download=`archive-${DB.archives[i].year}.json`;l.click()};
}
