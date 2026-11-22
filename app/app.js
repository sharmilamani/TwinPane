
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let toastT; function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2200)}
function save(k,v){try{localStorage.setItem('twinpane:'+k,JSON.stringify(v))}catch(e){}}
function load(k){try{return JSON.parse(localStorage.getItem('twinpane:'+k))}catch(e){return null}}
const debounce=(f,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>f(...a),ms)}};
const fmtSize=n=>n==null?'':n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
const fmtDate=t=>t==null?'':new Date(t).toLocaleString(undefined,{year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'});

/* ---------- Myers diff ---------- */
function diffSeq(a,b){
  const n=a.length,m=b.length;let s=0;while(s<n&&s<m&&a[s]===b[s])s++;
  let ea=n,eb=m;while(ea>s&&eb>s&&a[ea-1]===b[eb-1]){ea--;eb--}
  const ops=[];for(let i=0;i<s;i++)ops.push(['=',i,i]);
  for(const o of myers(a,b,s,ea,s,eb))ops.push(o);
  for(let i=0;i<n-ea;i++)ops.push(['=',ea+i,eb+i]);
  return ops;
}
function myers(a,b,a0,a1,b0,b1){
  const n=a1-a0,m=b1-b0,ops=[];
  if(!n){for(let j=b0;j<b1;j++)ops.push(['+',j]);return ops}
  if(!m){for(let i=a0;i<a1;i++)ops.push(['-',i]);return ops}
  const max=n+m,off=max+1,v=new Int32Array(2*max+3),trace=[];
  for(let d=0;d<=max;d++){
    if(d>2500){for(let i=a0;i<a1;i++)ops.push(['-',i]);for(let j=b0;j<b1;j++)ops.push(['+',j]);return ops}
    trace.push(v.slice(off-d-1,off+d+2));
    for(let k=-d;k<=d;k+=2){
      let x=(k===-d||(k!==d&&v[off+k-1]<v[off+k+1]))?v[off+k+1]:v[off+k-1]+1,y=x-k;
      while(x<n&&y<m&&a[a0+x]===b[b0+y]){x++;y++}
      v[off+k]=x;
      if(x>=n&&y>=m)return backtrack(trace,d,n,m,a0,b0);
    }
  }
}
function backtrack(trace,D,n,m,a0,b0){
  const ops=[];let x=n,y=m;
  for(let d=D;d>0;d--){
    const vv=trace[d],g=k=>vv[k+d+1],k=x-y;
    const pk=(k===-d||(k!==d&&g(k-1)<g(k+1)))?k+1:k-1,px=g(pk),py=px-pk;
    while(x>px&&y>py){ops.push(['=',a0+x-1,b0+y-1]);x--;y--}
    if(x===px)ops.push(['+',b0+y-1]);else ops.push(['-',a0+x-1]);
    x=px;y=py;
  }
  while(x>0&&y>0){ops.push(['=',a0+x-1,b0+y-1]);x--;y--}
  return ops.reverse();
}

/* ---------- drag & drop helper ---------- */
function dropZone(el,cb){
  el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('dropping')});
  el.addEventListener('dragleave',()=>el.classList.remove('dropping'));
  el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('dropping');
    const fs=[...e.dataTransfer.files];if(!fs.length)return;
    if(fs.length>=2){cb('a',fs[0]);cb('b',fs[1]);return}
    const r=el.getBoundingClientRect();cb(e.clientX<r.left+r.width/2?'a':'b',fs[0]);});
}

/* ---------- modal ---------- */
function showModal(title,text){$('#mTitle').textContent=title;$('#mText').value=text;$('#modal').hidden=false;$('#mCopy').focus()}
$('#mClose').onclick=()=>$('#modal').hidden=true;
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')$('#modal').hidden=true});
$('#mCopy').onclick=()=>{const t=$('#mText');
  try{navigator.clipboard.writeText(t.value).then(()=>toast('Copied to clipboard'),()=>{t.select();toast('Press Ctrl+C to copy')})}catch(e){t.select();toast('Press Ctrl+C to copy')}};
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#modal').hidden=true});

/* =================== TEXT COMPARE =================== */
const S={a:'',b:'',nameA:'',nameB:'',opt:{case:false,ws:false,blank:true,wrap:true,only:false,pat:''},
  A:[],B:[],rows:[],hunks:[],allH:[],cur:-1,undo:[],expanded:new Set(),editing:false};
const splitLines=s=>{if(!s)return[];const L=s.replace(/\r\n?/g,'\n').split('\n');if(L[L.length-1]==='')L.pop();return L};
const endsNL=s=>/\n$/.test(s);
const TOK=/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;

function inlineDiff(a,b){
  const o=S.opt,ta=a.match(TOK)||[],tb=b.match(TOK)||[],m=new Map();
  const id=t=>{let s=t;if(o.ws&&/^\s+$/.test(s))s=' ';if(o.case)s=s.toLowerCase();let v=m.get(s);if(v===undefined){v=m.size;m.set(s,v)}return v};
  const ops=diffSeq(ta.map(id),tb.map(id));
  let same=0;for(const x of ops)if(x[0]==='=')same+=ta[x[1]].length;
  const mx=Math.max(a.length,b.length);
  if(mx>8&&same<0.3*mx)return[esc(a),esc(b)];
  let L='',R='',dl='',il='';
  const fl=()=>{if(dl){L+=`<mark class="d">${esc(dl)}</mark>`;dl=''}if(il){R+=`<mark class="i">${esc(il)}</mark>`;il=''}};
  for(const x of ops){if(x[0]==='='){fl();L+=esc(ta[x[1]]);R+=esc(tb[x[2]])}else if(x[0]==='-')dl+=ta[x[1]];else il+=tb[x[1]]}
  fl();return[L,R];
}

function computeText(){
  const o=S.opt;S.A=splitLines(S.a);S.B=splitLines(S.b);
  let re=null;$('#oPat').classList.remove('bad');
  if(o.pat){try{re=new RegExp(o.pat,'g'+(o.case?'i':''))}catch(e){$('#oPat').classList.add('bad')}}
  const norm=l=>{let t=l;if(re)t=t.replace(re,'');if(o.ws)t=t.replace(/\s+/g,' ').trim();if(o.case)t=t.toLowerCase();return t};
  const ids=new Map(),id=s=>{let v=ids.get(s);if(v===undefined){v=ids.size;ids.set(s,v)}return v};
  const na=S.A.map(norm),nb=S.B.map(norm);
  const ops=diffSeq(na.map(id),nb.map(id));
  const rows=[],hunks=[],allH=[];let h=null,ai=0,bi=0;
  const flush=()=>{if(!h)return;
    const unimp=o.blank&&h.dl.every(i=>na[i].trim()==='')&&h.il.every(j=>nb[j].trim()==='');
    h.a1=h.a0+h.dl.length;h.b1=h.b0+h.il.length;allH.push(h);
    const hi=unimp?-1:hunks.length,n=Math.max(h.dl.length,h.il.length);h.row0=rows.length;
    for(let k=0;k<n;k++){const l=h.dl[k]??null,r=h.il[k]??null;
      rows.push({t:unimp?'uni':(l!=null&&r!=null?'chg':l!=null?'del':'ins'),l,r,h:hi})}
    h.row1=rows.length;if(!unimp)hunks.push(h);h=null};
  for(const x of ops){
    if(x[0]==='='){flush();rows.push({t:S.A[x[1]]===S.B[x[2]]?'eq':'uni',l:x[1],r:x[2],h:-1});ai=x[1]+1;bi=x[2]+1}
    else{if(!h)h={a0:ai,b0:bi,dl:[],il:[]};if(x[0]==='-'){h.dl.push(x[1]);ai=x[1]+1}else{h.il.push(x[1]);bi=x[1]+1}}
  }
  flush();
  S.rows=rows;S.hunks=hunks;S.allH=allH;if(S.cur>=hunks.length)S.cur=hunks.length-1;
  renderText();persistText();
}

function rowHTML(i){
  const r=S.rows[i],A=S.A,B=S.B;let L,R;
  if(r.t==='chg'){[L,R]=inlineDiff(A[r.l],B[r.r])}
  else{L=r.l!=null?esc(A[r.l]):'';R=r.r!=null?esc(B[r.r]):''}
  let g='';
  if(r.h>=0&&S.hunks[r.h].row0===i)g=`<button class="mg" data-h="${r.h}" data-d="r" title="Copy left block to right">→</button><button class="mg" data-h="${r.h}" data-d="l" title="Copy right block to left">←</button>`;
  return `<div class="r ${r.t}${r.h>=0&&r.h===S.cur?' cur':''}" data-i="${i}"><span class="n">${r.l!=null?r.l+1:''}</span><span class="c L${r.l==null?' x':''}">${L}</span><span class="g">${g}</span><span class="n">${r.r!=null?r.r+1:''}</span><span class="c R${r.r==null?' x':''}">${R}</span></div>`;
}

function renderText(){
  const R=S.rows,out=[],ctx=3,o=S.opt;let i=0;
  while(i<R.length){
    if(o.only&&R[i].t==='eq'){
      let j=i;while(j<R.length&&R[j].t==='eq')j++;
      const head=i===0?0:ctx,tail=j===R.length?0:ctx,hide=(j-i)-head-tail;
      if(hide>1&&!S.expanded.has(i)){
        for(let k=i;k<i+head;k++)out.push(rowHTML(k));
        out.push(`<button class="fold" data-x="${i}">⋯ ${hide} identical lines — show</button>`);
        for(let k=j-tail;k<j;k++)out.push(rowHTML(k));
        i=j;continue}
    }
    out.push(rowHTML(i));i++;
  }
  const g=$('#tGrid');g.className=o.wrap?'':'nowrap';
  g.innerHTML=(S.hunks.length||R.some(r=>r.t!=='eq')?'':`<div class="identical" style="margin:10px">${R.length?'The two sides are identical.':'Both sides are empty — open or paste some text.'}</div>`)+`<div class="rows">${out.join('')}</div>`;
  // overview map
  const n=Math.max(R.length,1);
  $('#tMap').innerHTML=S.hunks.map((h,k)=>{const c=h.dl.length&&h.il.length?'c':h.dl.length?'d':'i';
    return `<div class="mk ${c}" data-h="${k}" style="top:${h.row0/n*100}%;height:${Math.max((h.row1-h.row0)/n*100,.5)}%"></div>`}).join('');
  // stats
  const nd=S.hunks.length,ch=S.hunks.reduce((s,h)=>s+Math.max(h.dl.length,h.il.length),0),un=R.filter(r=>r.t==='uni').length;
  $('#tStat').innerHTML=nd?`<b>${nd}</b> difference${nd>1?'s':''} · ${ch} line${ch>1?'s':''}${un?` · ${un} unimportant`:''}${S.cur>=0?` · at #${S.cur+1}`:''}`:(un?`Identical apart from <b>${un}</b> unimportant line${un>1?'s':''}`:'<b>Identical</b>');
  $('#tUndo').disabled=!S.undo.length;
}

function goHunk(k){
  if(!S.hunks.length)return;S.cur=(k+S.hunks.length)%S.hunks.length;renderText();
  const el=$(`#tGrid [data-i="${S.hunks[S.cur].row0}"]`),sc=$('#tScroll');
  if(el)sc.scrollTop=el.offsetTop-sc.clientHeight/3;
}
function merge(k,dir){
  const h=S.hunks[k];if(!h)return;S.undo.push({a:S.a,b:S.b});
  const A=S.A.slice(),B=S.B.slice();
  if(dir==='r'){S.dirtyB=true;B.splice(h.b0,h.b1-h.b0,...A.slice(h.a0,h.a1));S.b=B.join('\n')+(endsNL(S.b)||!B.length?'\n':'')}
  else{S.dirtyA=true;A.splice(h.a0,h.a1-h.a0,...B.slice(h.b0,h.b1));S.a=A.join('\n')+(endsNL(S.a)||!A.length?'\n':'')}
  if(!S.a.trim())S.a='';if(!S.b.trim())S.b='';
  const sc=$('#tScroll').scrollTop;computeText();$('#tScroll').scrollTop=sc;toast(dir==='r'?'Copied block to the right side':'Copied block to the left side');
}
function unifiedDiff(){
  const A=S.A,B=S.B,H=S.allH,ctx=3,out=[`--- ${S.nameA||'left'}`,`+++ ${S.nameB||'right'}`];
  let i=0;
  while(i<H.length){
    let j=i;while(j+1<H.length&&H[j+1].a0-H[j].a1<=2*ctx)j++;
    const f=H[i],l=H[j],as=Math.max(0,f.a0-ctx),ae=Math.min(A.length,l.a1+ctx),bs=f.b0-(f.a0-as),be=l.b1+(ae-l.a1);
    out.push(`@@ -${as+1},${ae-as} +${bs+1},${be-bs} @@`);
    let x=as;
    for(let k=i;k<=j;k++){const h=H[k];while(x<h.a0)out.push(' '+A[x++]);for(let q=h.a0;q<h.a1;q++)out.push('-'+A[q]);for(let q=h.b0;q<h.b1;q++)out.push('+'+B[q]);x=h.a1}
    while(x<ae)out.push(' '+A[x++]);
    i=j+1;
  }
  return H.length?out.join('\n')+'\n':'The two sides are identical.';
}
// The desktop app never stores what you compare (or file names) on disk; only the options are remembered.
const persistText=debounce(()=>save('text',window.native?{opt:S.opt}:{a:S.a.length<400000?S.a:'',b:S.b.length<400000?S.b:'',nameA:S.nameA,nameB:S.nameB,opt:S.opt}),500);
function setText(side,txt,name){S.undo=[];S.expanded.clear();S.cur=-1;if(side==='a'){S.a=txt;if(name!=null)S.nameA=name}else{S.b=txt;if(name!=null)S.nameB=name}syncNames()}
function syncNames(){$('#tNameA').value=S.nameA;$('#tNameB').value=S.nameB;$('#tA').value=S.a;$('#tB').value=S.b}
async function openTextFile(side,f){setText(side,await f.text(),f.abs||f.name);S[side==='a'?'pathA':'pathB']=f.abs||(N&&f instanceof Blob?N.pathOf(f):null)||null;S[side==='a'?'dirtyA':'dirtyB']=false;computeText()}

$('#tFileA').onchange=e=>{const f=e.target.files[0];if(f)openTextFile('a',f);e.target.value=''};
$('#tFileB').onchange=e=>{const f=e.target.files[0];if(f)openTextFile('b',f);e.target.value=''};
dropZone($('#tStage'),(s,f)=>openTextFile(s,f));
$('#tSwap').onclick=()=>{[S.a,S.b]=[S.b,S.a];[S.nameA,S.nameB]=[S.nameB,S.nameA];S.undo=[];syncNames();computeText()};
$('#tEdit').onclick=()=>{
  S.editing=!S.editing;$('#tEdit').setAttribute('aria-pressed',S.editing);$('#tEdit').textContent=S.editing?'Done — compare':'Edit / paste';
  $('#tEditPanes').hidden=!S.editing;$('#tDiff').hidden=S.editing;
  if(S.editing){$('#tA').value=S.a;$('#tB').value=S.b;$('#tA').focus()}
  else{if($('#tA').value!==S.a||$('#tB').value!==S.b){S.undo.push({a:S.a,b:S.b})}if($('#tA').value!==S.a)S.dirtyA=true;if($('#tB').value!==S.b)S.dirtyB=true;S.a=$('#tA').value;S.b=$('#tB').value;computeText()}
};
$('#tUndo').onclick=()=>{const u=S.undo.pop();if(!u)return;S.a=u.a;S.b=u.b;syncNames();computeText()};
$('#tPrev').onclick=()=>goHunk(S.cur<0?S.hunks.length-1:S.cur-1);
$('#tNext').onclick=()=>goHunk(S.cur+1);
$('#tExport').onclick=()=>showModal('Unified diff',unifiedDiff());
$('#tSaveL').onclick=()=>N?saveSide('a'):showModal('Left text — '+(S.nameA||'left'),S.a);
$('#tSaveR').onclick=()=>N?saveSide('b'):showModal('Right text — '+(S.nameB||'right'),S.b);
$('#tNameA').oninput=e=>{S.nameA=e.target.value;persistText()};
$('#tNameB').oninput=e=>{S.nameB=e.target.value;persistText()};
$('#tGrid').addEventListener('click',e=>{
  const m=e.target.closest('.mg');if(m){merge(+m.dataset.h,m.dataset.d);return}
  const f=e.target.closest('.fold');if(f){S.expanded.add(+f.dataset.x);renderText();return}
  const r=e.target.closest('.r');if(r){const h=S.rows[+r.dataset.i].h;if(h>=0&&h!==S.cur){S.cur=h;const sc=$('#tScroll').scrollTop;renderText();$('#tScroll').scrollTop=sc}}
});
$('#tMap').addEventListener('click',e=>{
  const mk=e.target.closest('.mk');if(mk){goHunk(+mk.dataset.h);return}
  const r=$('#tMap').getBoundingClientRect(),f=(e.clientY-r.top)/r.height,sc=$('#tScroll');sc.scrollTop=f*sc.scrollHeight-sc.clientHeight/2;
});
const optMap={oCase:'case',oWs:'ws',oBlank:'blank',oWrap:'wrap',oOnly:'only'};
for(const[id,k]of Object.entries(optMap))$('#'+id).onchange=e=>{S.opt[k]=e.target.checked;if(k==='wrap'){renderText();persistText()}else computeText()};
$('#oPat').oninput=debounce(e=>{S.opt.pat=e.target.value;computeText()},300);
document.addEventListener('keydown',e=>{
  if($('#v-text').hidden||S.editing||!e.altKey)return;
  if(e.key==='ArrowDown'){e.preventDefault();goHunk(S.cur+1)}else if(e.key==='ArrowUp'){e.preventDefault();goHunk(S.cur<0?S.hunks.length-1:S.cur-1)}
});

/* =================== FOLDER COMPARE =================== */
const F={L:new Map(),R:new Map(),rootL:'',rootR:'',items:[],filter:'all',collapsed:new Set(),sync:'l2r',mode:'content',name:'',busy:0};
function filesToMap(list){const m=new Map();let root='';
  for(const f of list){const p=(f.webkitRelativePath||f.name).split('/');root=p.length>1?p[0]:root;m.set(p.length>1?p.slice(1).join('/'):p[0],f)}
  return{m,root:root||'(files)'}}
async function sameFile(l,r){
  if(l.size!==r.size)return false;
  if(F.mode==='size')return true;
  if(F.mode==='sizedate')return Math.abs(l.lastModified-r.lastModified)<2000;
  const CH=4<<20;
  for(let o=0;o<l.size;o+=CH){
    const[a,b]=await Promise.all([l.slice(o,o+CH).arrayBuffer(),r.slice(o,o+CH).arrayBuffer()]);
    const x=new Uint8Array(a),y=new Uint8Array(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return false;
  }
  return true;
}
async function compareFolders(){
  const run=++F.busy;
  const paths=[...new Set([...F.L.keys(),...F.R.keys()])].sort();
  const items=[];let done=0;
  for(const p of paths){
    const l=F.L.get(p)||null,r=F.R.get(p)||null;let st;
    if(!l)st='ronly';else if(!r)st='lonly';else st=await sameFile(l,r)?'same':'diff';
    if(run!==F.busy)return;
    items.push({path:p,l,r,st});
    if(++done%25===0)$('#fStat').textContent=`Comparing ${done} of ${paths.length}…`;
  }
  F.items=items;$('#fNameL').textContent=F.rootL||'—';$('#fNameR').textContent=F.rootR||'—';
  renderFolders();
}
function globToRe(g){const parts=g.split(/[;,]/).map(s=>s.trim()).filter(Boolean);if(!parts.length)return null;
  return new RegExp('^(?:'+parts.map(p=>p.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.')).join('|')+')$','i')}
function renderFolders(){
  const re=globToRe(F.name);
  const pass=it=>(!re||re.test(it.path.split('/').pop()))&&(F.filter==='all'||(F.filter==='diff'?it.st!=='same':it.st===F.filter));
  const root={dirs:new Map(),files:[]};
  for(const it of F.items){const parts=it.path.split('/');let n=root;
    for(let i=0;i<parts.length-1;i++){let c=n.dirs.get(parts[i]);if(!c){c={name:parts[i],path:parts.slice(0,i+1).join('/'),dirs:new Map(),files:[]};n.dirs.set(parts[i],c)}n=c}
    n.files.push(it)}
  const agg=d=>{const s={vis:0,diff:0,hasL:false,hasR:false};
    for(const f of d.files){if(pass(f))s.vis++;if(f.st!=='same')s.diff++;if(f.l)s.hasL=true;if(f.r)s.hasR=true}
    for(const c of d.dirs.values()){const t=agg(c);s.vis+=t.vis;s.diff+=t.diff;s.hasL||=t.hasL;s.hasR||=t.hasR}return s};
  const out=[];const pad=dp=>`style="padding-left:${dp*1.15}em"`;
  const walk=(n,dp)=>{
    for(const d of[...n.dirs.values()].sort((a,b)=>a.name.localeCompare(b.name))){
      const s=agg(d);if(!s.vis)continue;const col=F.collapsed.has(d.path);
      const st=!s.hasL?'<span class="pill ronly">Right only</span>':!s.hasR?'<span class="pill lonly">Left only</span>':s.diff?`<span class="pill dirdiff">${s.diff} differ</span>`:'<span class="pill same">Same</span>';
      out.push(`<div class="fr dir${col?' collapsed':''}" data-dir="${esc(d.path)}" tabindex="0"><span class="nm" ${pad(dp)}><span class="caret">▾</span><span class="t">${esc(d.name)}/</span></span><span class="num"></span><span class="num dt"></span>${st}<span class="num"></span><span class="num dt"></span></div>`);
      if(!col)walk(d,dp+1);
    }
    for(const f of n.files.sort((a,b)=>a.path.localeCompare(b.path))){
      if(!pass(f))continue;const name=f.path.split('/').pop();
      const lab={same:'Same',diff:'Changed',lonly:'Left only',ronly:'Right only'}[f.st];
      let nw='';if(f.st==='diff'&&Math.abs(f.l.lastModified-f.r.lastModified)>=2000)nw=`<span class="newer">${f.l.lastModified>f.r.lastModified?'left':'right'} is newer</span>`;
      out.push(`<div class="fr${f.l&&f.r?'':' miss'}" data-path="${esc(f.path)}" tabindex="0"><span class="nm" ${pad(dp)}><span class="caret"></span><span class="t" title="${esc(f.path)}">${esc(name)}</span></span><span class="num">${f.l?fmtSize(f.l.size):''}</span><span class="num dt">${f.l?fmtDate(f.l.lastModified):''}</span><span style="justify-self:center"><span class="pill ${f.st}">${lab}</span>${nw}</span><span class="num">${f.r?fmtSize(f.r.size):''}</span><span class="num dt">${f.r?fmtDate(f.r.lastModified):''}</span></div>`);
    }
  };
  walk(root,0);
  $('#fList').innerHTML=out.join('')||`<div class="empty">${F.items.length?'No files match this filter.':'Choose a left and a right folder to compare.'}</div>`;
  const c={same:0,diff:0,lonly:0,ronly:0};for(const it of F.items)c[it.st]++;
  $('#fStat').innerHTML=`<b>${F.items.length}</b> files · <b>${c.diff}</b> changed · <b>${c.lonly}</b> left only · <b>${c.ronly}</b> right only · ${c.same} same`;
  renderPlan();
}
function planItems(){
  const P=[];
  for(const it of F.items){
    if(it.st==='same')continue;
    if(F.sync==='l2r'){if(it.st==='lonly')P.push(['copy','Copy → right',it.path,it.l.size]);else if(it.st==='ronly')P.push(['del','Delete on right',it.path,0]);else P.push(['over','Overwrite right',it.path,it.l.size])}
    else if(F.sync==='r2l'){if(it.st==='ronly')P.push(['copy','Copy → left',it.path,it.r.size]);else if(it.st==='lonly')P.push(['del','Delete on left',it.path,0]);else P.push(['over','Overwrite left',it.path,it.r.size])}
    else{if(it.st==='lonly')P.push(['copy','Copy → right',it.path,it.l.size]);else if(it.st==='ronly')P.push(['copy','Copy → left',it.path,it.r.size]);
      else{const ln=it.l.lastModified>=it.r.lastModified;P.push(['over',ln?'Update right':'Update left',it.path,ln?it.l.size:it.r.size])}}
  }
  return P;
}
function renderPlan(){
  $('#fRun').hidden=!(N&&F.absL&&F.absR);
  const P=planItems(),bytes=P.reduce((s,p)=>s+p[3],0);
  $('#fPlan').innerHTML=P.length?P.map(p=>`<li><span class="act ${p[0]}">${p[1]}</span><span>${esc(p[2])}</span></li>`).join('')+`<li style="border:0;color:var(--muted)">${P.length} action${P.length>1?'s':''} · ${fmtSize(bytes)} to copy</li>`:'<li style="border:0;color:var(--muted)">Nothing to do — the folders already match.</li>';
}
$('#fPlanCopy').onclick=()=>{const P=planItems();const names={l2r:'Mirror left → right',r2l:'Mirror right → left',both:'Update both, newer wins'};
  showModal('Sync plan',`# ${names[F.sync]}\n# left:  ${F.rootL}\n# right: ${F.rootR}\n`+P.map(p=>`${p[1].padEnd(16)} ${p[2]}`).join('\n'))};
async function pickFolder(side,list){if(!list.length)return;const{m,root}=filesToMap(list);if(side==='L'){F.L=m;F.rootL=root}else{F.R=m;F.rootR=root}F.collapsed.clear();await compareFolders()}
$('#fPickL').onchange=e=>{pickFolder('L',[...e.target.files]);e.target.value=''};
$('#fPickR').onchange=e=>{pickFolder('R',[...e.target.files]);e.target.value=''};
$('#fFilter').onclick=e=>{const b=e.target.closest('button');if(!b)return;F.filter=b.dataset.f;$$('#fFilter button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderFolders()};
$('#fSync').onclick=e=>{const b=e.target.closest('button');if(!b)return;F.sync=b.dataset.s;$$('#fSync button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderPlan()};
$('#fMode').onchange=e=>{F.mode=e.target.value;compareFolders()};
$('#fName').oninput=debounce(e=>{F.name=e.target.value;renderFolders()},200);
$('#fExpand').onclick=()=>{F.collapsed.clear();renderFolders()};
$('#fCollapse').onclick=()=>{for(const it of F.items){const p=it.path.split('/');for(let i=1;i<p.length;i++)F.collapsed.add(p.slice(0,i).join('/'))}renderFolders()};
function folderActivate(e){
  const d=e.target.closest('[data-dir]');if(d){const p=d.dataset.dir;F.collapsed.has(p)?F.collapsed.delete(p):F.collapsed.add(p);renderFolders();return}
  const f=e.target.closest('[data-path]');if(f)openPair(f.dataset.path);
}
$('#fList').addEventListener('click',folderActivate);
$('#fList').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();folderActivate(e)}});
const IMG_EXT=['png','jpg','jpeg','gif','webp','bmp','avif'];
async function isText(f){if(!f)return true;const b=new Uint8Array(await f.slice(0,8000).arrayBuffer());return!b.includes(0)}
async function openPair(path){
  const it=F.items.find(x=>x.path===path);if(!it)return;
  const sep=(F.absL||F.absR||'').includes('\\')?'\\':'/',jp=(r,p)=>r?r+sep+p.split('/').join(sep):null;
  await openFiles(it.l,it.r,it.l?(it.l.abs||`${F.rootL}/${path}`):'(missing)',it.r?(it.r.abs||`${F.rootR}/${path}`):'(missing)',it.l?.abs||jp(F.absL,path),it.r?.abs||jp(F.absR,path));
}
async function openFiles(l,r,nl,nr,pl,pr){
  const ext=(l||r).name.split('.').pop().toLowerCase(),it={l,r};
  if(IMG_EXT.includes(ext)){await setImg('a',it.l,nl);await setImg('b',it.r,nr);show('images');return}
  if(await isText(it.l)&&await isText(it.r)){
    S.a=it.l?await it.l.text():'';S.b=it.r?await it.r.text():'';S.nameA=nl;S.nameB=nr;S.pathA=pl||null;S.pathB=pr||null;S.dirtyA=S.dirtyB=false;S.undo=[];S.cur=-1;S.expanded.clear();syncNames();computeText();show('text');
    if(S.hunks.length)setTimeout(()=>goHunk(0),30);return}
  H.a=it.l?new Uint8Array(await it.l.arrayBuffer()):new Uint8Array();H.b=it.r?new Uint8Array(await it.r.arrayBuffer()):new Uint8Array();H.nameA=nl;H.nameB=nr;computeHex();show('hex');
}

/* =================== TABLE COMPARE =================== */
function parseCSV(t){
  t=t.replace(/\r\n?/g,'\n');const first=t.split('\n')[0]||'';let d=',',best=0;
  for(const c of[',','\t',';','|']){const n=first.split(c).length;if(n>best){best=n;d=c}}
  const rows=[];let row=[],f='',q=false;
  for(let i=0;i<t.length;i++){const ch=t[i];
    if(q){if(ch==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=ch}
    else if(ch==='"'&&f==='')q=true;
    else if(ch===d){row.push(f);f=''}
    else if(ch==='\n'){row.push(f);rows.push(row);row=[];f=''}
    else f+=ch}
  if(f!==''||row.length){row.push(f);rows.push(row)}
  return rows.filter(r=>!(r.length===1&&r[0].trim()===''));
}
const C={key:''};
function computeTable(){
  const ra=parseCSV($('#cA').value),rb=parseCSV($('#cB').value),hdr=$('#cHdr').checked;
  const width=Math.max(0,...ra.map(r=>r.length),...rb.map(r=>r.length));
  const gen=n=>Array.from({length:n},(_,i)=>'Column '+(i+1));
  const hA=hdr&&ra.length?ra[0]:gen(width),hB=hdr&&rb.length?rb[0]:gen(width);
  const dA=hdr?ra.slice(1):ra,dB=hdr?rb.slice(1):rb;
  const cols=[...hA];for(const c of hB)if(!cols.includes(c))cols.push(c);
  // key select
  const sel=$('#cKey'),prev=C.key;
  sel.innerHTML='<option value="">Row position</option>'+cols.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  sel.value=cols.includes(prev)?prev:'';C.key=sel.value;
  const ic=$('#cCase').checked,tr=$('#cTrim').checked,tol=parseFloat($('#cTol').value)||0;
  const nv=v=>{v=v??'';if(tr)v=v.trim();if(ic)v=v.toLowerCase();return v};
  const eq=(a,b)=>{const x=nv(a),y=nv(b);if(x===y)return true;
    const NUM=/^\s*[-+]?[$€£₹]?\s*[\d,]*\.?\d+\s*%?\s*$/;
    if(NUM.test(x)&&NUM.test(y)){const p=parseFloat(x.replace(/[^\d.+-]/g,'')),q=parseFloat(y.replace(/[^\d.+-]/g,''));if(!isNaN(p)&&!isNaN(q))return Math.abs(p-q)<=tol+1e-12}
    return false};
  const ixA=cols.map(c=>hA.indexOf(c)),ixB=cols.map(c=>hB.indexOf(c));
  const pairs=[];
  if(C.key){
    const ka=hA.indexOf(C.key),kb=hB.indexOf(C.key),mapB=new Map();
    dB.forEach((r,i)=>{const k=nv(r[kb]);if(!mapB.has(k))mapB.set(k,[]);mapB.get(k).push(i)});
    const used=new Set();
    for(const r of dA){const k=nv(r[ka]),lst=mapB.get(k);const j=lst&&lst.find(i=>!used.has(i));
      if(j!=null){used.add(j);pairs.push([r,dB[j]])}else pairs.push([r,null])}
    dB.forEach((r,i)=>{if(!used.has(i))pairs.push([null,r])});
  }else{for(let i=0;i<Math.max(dA.length,dB.length);i++)pairs.push([dA[i]||null,dB[i]||null])}
  let nC=0,nL=0,nR=0,nCells=0;
  const rows=pairs.map(([a,b])=>{
    if(!b){nL++;return{st:'lonly',cells:cols.map((c,k)=>({v:ixA[k]>=0?a[ixA[k]]??'':''}))}}
    if(!a){nR++;return{st:'ronly',cells:cols.map((c,k)=>({v:ixB[k]>=0?b[ixB[k]]??'':''}))}}
    let d=0;const cells=cols.map((c,k)=>{if(ixA[k]<0)return{v:b[ixB[k]]??'',one:1};if(ixB[k]<0)return{v:a[ixA[k]]??'',one:1};
      const x=a[ixA[k]]??'',y=b[ixB[k]]??'';if(eq(x,y))return{v:x};d++;return{o:x,n:y}});
    if(d){nC++;nCells+=d}return{st:d?'chg':'eq',cells}});
  const only=$('#cOnly').checked,sym={eq:'=',chg:'≠',lonly:'◀',ronly:'▶'};
  const keyIdx=cols.indexOf(C.key);
  $('#cOut').innerHTML=`<thead><tr><th></th>${cols.map(c=>`<th>${esc(c)}${!hA.includes(c)?' <sup>R only</sup>':!hB.includes(c)?' <sup>L only</sup>':''}</th>`).join('')}</tr></thead><tbody>`+
    rows.filter(r=>!only||r.st!=='eq').map(r=>`<tr class="${r.st}"><td class="st" title="${{eq:'Same',chg:'Changed',lonly:'Left only',ronly:'Right only'}[r.st]}">${sym[r.st]}</td>${r.cells.map((c,k)=>'o'in c?`<td class="cd"><span class="ov">${esc(c.o)||'∅'}</span><span class="nv">${esc(c.n)||'∅'}</span></td>`:`<td${k===keyIdx?' class="k"':c.one?' class="one"':''}>${esc(c.v)}</td>`).join('')}</tr>`).join('')+'</tbody>';
  const oneCols=cols.filter((c,k)=>ixA[k]<0||ixB[k]<0).length;
  $('#cStat').innerHTML=`<b>${rows.length}</b> rows · <b>${nC}</b> changed (${nCells} cell${nCells===1?'':'s'}) · <b>${nL}</b> left only · <b>${nR}</b> right only · ${rows.length-nC-nL-nR} same${oneCols?` · ${oneCols} column${oneCols>1?'s':''} on one side only (not compared)`:''}`;
}
const computeTableD=debounce(computeTable,250);
$('#cA').oninput=computeTableD;$('#cB').oninput=computeTableD;
for(const id of['cHdr','cCase','cTrim','cOnly'])$('#'+id).onchange=computeTable;
$('#cTol').oninput=computeTableD;
$('#cKey').onchange=e=>{C.key=e.target.value;computeTable()};
const loadCSV=async(side,f)=>{$(side==='a'?'#cA':'#cB').value=await f.text();computeTable()};
$('#cFileA').onchange=e=>{const f=e.target.files[0];if(f)loadCSV('a',f);e.target.value=''};
$('#cFileB').onchange=e=>{const f=e.target.files[0];if(f)loadCSV('b',f);e.target.value=''};
dropZone($('#v-table .srcs'),loadCSV);

/* =================== HEX COMPARE =================== */
const H={a:new Uint8Array(),b:new Uint8Array(),nameA:'',nameB:'',diffRows:[],limit:1024,cur:-1};
const hx2=n=>n.toString(16).padStart(2,'0').toUpperCase();
const asc=n=>n>=32&&n<127?esc(String.fromCharCode(n)):'·';
function computeHex(){
  const a=H.a,b=H.b,len=Math.max(a.length,b.length),rows=Math.ceil(len/16);
  H.diffRows=[];let nb=0,first=-1;
  for(let r=0;r<rows;r++){let d=false;for(let i=r*16;i<r*16+16&&i<len;i++){if(i>=a.length||i>=b.length||a[i]!==b[i]){d=true;nb++;if(first<0)first=i}}if(d)H.diffRows.push(r)}
  H.limit=1024;H.cur=-1;$('#hNameA').value=H.nameA+` (${a.length.toLocaleString()} bytes)`;$('#hNameB').value=H.nameB+` (${b.length.toLocaleString()} bytes)`;
  $('#hStat').innerHTML=nb?`<b>${nb.toLocaleString()}</b> differing byte${nb>1?'s':''} in <b>${H.diffRows.length}</b> row${H.diffRows.length>1?'s':''} · first at 0x${first.toString(16).toUpperCase()}`:(len?'<b>Identical</b>':'Open two files');
  renderHex();
}
function hexSide(arr,o,other){let h='',s='';
  for(let i=0;i<16;i++){const k=o+i;if(i===8)h+=' ';
    if(k<arr.length){const d=k>=other.length||arr[k]!==other[k];h+=d?`<b class="d">${hx2(arr[k])}</b> `:hx2(arr[k])+' ';s+=d?`<b class="d">${asc(arr[k])}</b>`:asc(arr[k])}
    else{h+='   ';s+=' '}}
  return[h,s]}
function renderHex(){
  const a=H.a,b=H.b,rows=Math.ceil(Math.max(a.length,b.length)/16),only=$('#hOnly').checked;
  const list=only?H.diffRows:Array.from({length:rows},(_,i)=>i),ds=new Set(H.diffRows);
  const out=[`<div class="hx head"><span class="o">Offset</span><span class="h">Left</span><span class="a"></span><span class="sep"></span><span class="h">Right</span><span class="a"></span></div>`];
  for(const r of list.slice(0,H.limit)){const o=r*16,[h1,s1]=hexSide(a,o,b),[h2,s2]=hexSide(b,o,a);
    out.push(`<div class="hx${ds.has(r)?' has':''}" data-r="${r}"><span class="o">${o.toString(16).toUpperCase().padStart(8,'0')}</span><span class="h">${h1}</span><span class="a">${s1}</span><span class="sep"></span><span class="h">${h2}</span><span class="a">${s2}</span></div>`)}
  if(list.length>H.limit)out.push(`<button class="btn more" id="hMore">Show ${Math.min(1024,list.length-H.limit)} more rows (${(list.length-H.limit).toLocaleString()} left)</button>`);
  if(!list.length)out.push(`<div class="empty">${rows?'No differing rows.':'Open or drop two files to compare their bytes.'}</div>`);
  $('#hGrid').innerHTML=out.join('');
}
function hexGo(step){
  if(!H.diffRows.length)return;H.cur=(H.cur+step+H.diffRows.length)%H.diffRows.length;const r=H.diffRows[H.cur];
  const only=$('#hOnly').checked,pos=only?H.cur:r;if(pos>=H.limit){H.limit=pos+256;renderHex()}
  const el=$(`#hGrid [data-r="${r}"]`),sc=$('#hScroll');if(el){sc.scrollTop=el.offsetTop-sc.clientHeight/3;$$('#hGrid .hx').forEach(x=>x.style.outline='');el.style.outline='2px solid var(--accent)'}
}
$('#hGrid').addEventListener('click',e=>{if(e.target.id==='hMore'){H.limit+=1024;renderHex()}});
$('#hOnly').onchange=renderHex;$('#hNext').onclick=()=>hexGo(1);$('#hPrev').onclick=()=>hexGo(-1);
const loadHex=async(side,f)=>{H[side]=new Uint8Array(await f.arrayBuffer());H[side==='a'?'nameA':'nameB']=f.name;computeHex()};
$('#hFileA').onchange=e=>{const f=e.target.files[0];if(f)loadHex('a',f);e.target.value=''};
$('#hFileB').onchange=e=>{const f=e.target.files[0];if(f)loadHex('b',f);e.target.value=''};
dropZone($('#hScroll'),loadHex);

/* =================== PICTURE COMPARE =================== */
const I={a:null,b:null,nameA:'',nameB:'',mode:'side',tol:12,swipe:50,blink:false,blinkT:null};
function toCanvas(src){if(!src)return null;const c=document.createElement('canvas');c.width=src.width;c.height=src.height;c.getContext('2d').drawImage(src,0,0);return c}
async function setImg(side,file,name){
  let c=null;if(file){try{c=toCanvas(await createImageBitmap(file instanceof Blob?file:new Blob([await file.arrayBuffer()])))}catch(e){toast('Could not read '+file.name+' as an image')}}
  I[side]=c;I[side==='a'?'nameA':'nameB']=name||(file?file.name:'(missing)');
}
function diffCanvas(){
  const a=I.a,b=I.b,W=Math.max(a.width,b.width),Hh=Math.max(a.height,b.height);
  const get=c=>{const t=document.createElement('canvas');t.width=W;t.height=Hh;t.getContext('2d').drawImage(c,0,0);return t.getContext('2d').getImageData(0,0,W,Hh).data};
  const pa=get(a),pb=get(b),out=document.createElement('canvas');out.width=W;out.height=Hh;
  const ctx=out.getContext('2d'),od=ctx.createImageData(W,Hh),o=od.data,tol=I.tol;
  const col=getComputedStyle(document.documentElement).getPropertyValue('--diffpx').trim()||'#e0237a';
  const m=col.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i),cr=m?parseInt(m[1],16):224,cg=m?parseInt(m[2],16):35,cb=m?parseInt(m[3],16):122;
  let n=0;
  for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,inA=x<a.width&&y<a.height,inB=x<b.width&&y<b.height;
    const d=!inA||!inB||Math.max(Math.abs(pa[i]-pb[i]),Math.abs(pa[i+1]-pb[i+1]),Math.abs(pa[i+2]-pb[i+2]),Math.abs(pa[i+3]-pb[i+3]))>tol;
    if(d){n++;o[i]=cr;o[i+1]=cg;o[i+2]=cb;o[i+3]=255}
    else{const g=(pa[i]*.3+pa[i+1]*.59+pa[i+2]*.11);o[i]=o[i+1]=o[i+2]=g;o[i+3]=Math.round(pa[i+3]*.28)}}
  ctx.putImageData(od,0,0);return{out,n,total:W*Hh,W,H:Hh};
}
function renderImg(){
  clearInterval(I.blinkT);const st=$('#iStage');st.innerHTML='';
  const a=I.a,b=I.b;
  if(!a&&!b){st.innerHTML='<div class="empty">Open or drop two pictures.</div>';$('#iStat').textContent='';return}
  let stat=`${a?a.width+'×'+a.height:'—'} vs ${b?b.width+'×'+b.height:'—'}`,D=null;
  if(a&&b){D=diffCanvas();const pct=D.n/D.total*100;stat=`${stat} · <b>${D.n.toLocaleString()}</b> pixels differ (${pct<0.01&&D.n?'<0.01':pct.toFixed(2)}%)${a.width!==b.width||a.height!==b.height?' · sizes differ':''}`}
  $('#iStat').innerHTML=stat;
  const fig=(c,cap)=>{const f=document.createElement('figure');if(c){const cc=toCanvas(c);f.appendChild(cc)}else{const e=document.createElement('div');e.className='empty';e.textContent='No picture on this side';f.appendChild(e)}const fc=document.createElement('figcaption');fc.textContent=cap;f.appendChild(fc);return f};
  if(I.mode==='side'||!a||!b){const w=document.createElement('div');w.className='side';w.append(fig(a,I.nameA),fig(b,I.nameB));st.appendChild(w);return}
  if(I.mode==='diff'){st.appendChild(fig(D.out,'Highlighted pixels differ by more than the tolerance'));return}
  if(I.mode==='swipe'){
    const W=Math.max(a.width,b.width),Hh=Math.max(a.height,b.height),pad=c=>{const t=document.createElement('canvas');t.width=W;t.height=Hh;t.getContext('2d').drawImage(c,0,0);return t};
    const box=document.createElement('div');box.className='swipe';const cb=pad(b),ca=pad(a);ca.className='top';box.append(cb,ca);const line=document.createElement('div');line.className='swline';box.appendChild(line);
    const rng=document.createElement('input');rng.type='range';rng.min=0;rng.max=100;rng.value=I.swipe;rng.id='iSwipe';rng.style.width='min(100%,640px)';rng.setAttribute('aria-label','Swipe position');
    const upd=()=>{I.swipe=+rng.value;ca.style.clipPath=`inset(0 ${100-I.swipe}% 0 0)`;line.style.left=`calc(${I.swipe}% - 1px)`};rng.oninput=upd;upd();
    const cap=document.createElement('figcaption');cap.textContent=`◀ ${I.nameA}   |   ${I.nameB} ▶`;
    st.append(box,rng,cap);return}
  if(I.mode==='blink'){
    const W=Math.max(a.width,b.width),Hh=Math.max(a.height,b.height),c=document.createElement('canvas');c.width=W;c.height=Hh;const x=c.getContext('2d');
    const cap=document.createElement('figcaption');let side=0;
    const draw=()=>{x.clearRect(0,0,W,Hh);x.drawImage(side?b:a,0,0);cap.textContent=(side?'Right: '+I.nameB:'Left: '+I.nameA)};draw();
    const ctl=document.createElement('div');ctl.className='grp';
    const tb=document.createElement('button');tb.className='btn';tb.textContent='Flip';tb.onclick=()=>{side^=1;draw()};
    const lab=document.createElement('label');lab.className='stat';lab.innerHTML='<input type="checkbox" id="iAuto"> Auto-blink';
    lab.querySelector('input').checked=I.blink;
    const setAuto=()=>{clearInterval(I.blinkT);if(I.blink)I.blinkT=setInterval(()=>{side^=1;draw()},650)};
    lab.querySelector('input').onchange=e=>{I.blink=e.target.checked;setAuto()};setAuto();
    ctl.append(tb,lab);st.append(c,cap,ctl);}
}
$('#iMode').onclick=e=>{const b=e.target.closest('button');if(!b)return;I.mode=b.dataset.m;$$('#iMode button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderImg()};
$('#iTol').oninput=debounce(e=>{I.tol=+e.target.value;$('#iTolV').textContent=I.tol;renderImg()},120);
$('#iFileA').onchange=async e=>{const f=e.target.files[0];if(f){await setImg('a',f);renderImg()}e.target.value=''};
$('#iFileB').onchange=async e=>{const f=e.target.files[0];if(f){await setImg('b',f);renderImg()}e.target.value=''};
dropZone($('#iStage'),async(s,f)=>{await setImg(s,f);renderImg()});

/* =================== TABS =================== */
const TABS=['text','folders','table','hex','images'];
function show(tab){
  if(!TABS.includes(tab))tab='text';
  for(const t of TABS)$('#v-'+t).hidden=t!==tab;
  $$('nav.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tab));
  try{history.replaceState(null,'','#'+tab)}catch(e){}
  save('tab',tab);if(tab==='images')renderImg();else clearInterval(I.blinkT);
}
$$('nav.tabs button').forEach(b=>b.onclick=()=>show(b.dataset.tab));

/* =================== SAMPLE DATA =================== */
const SAMPLE_A=`# backup.py — nightly backup of project folders
import os
import shutil
import datetime

SOURCE_DIRS = ["/home/asha/projects", "/home/asha/notes"]
DEST_ROOT = "/mnt/backup"
KEEP_DAYS = 7

def timestamp():
    return datetime.datetime.now().strftime("%Y-%m-%d")

def copy_tree(src, dest):
    if not os.path.exists(src):
        print("missing:", src)
        return 0
    shutil.copytree(src, dest)
    return 1

def prune(root, keep):
    folders = sorted(os.listdir(root))
    for old in folders[:-keep]:
        shutil.rmtree(os.path.join(root, old))

def main():
    target = os.path.join(DEST_ROOT, timestamp())
    os.makedirs(target)
    count = 0
    for src in SOURCE_DIRS:
        name = os.path.basename(src)
        count += copy_tree(src, os.path.join(target, name))
    prune(DEST_ROOT, KEEP_DAYS)
    print("copied", count, "folders")

if __name__ == "__main__":
    main()
`;
const SAMPLE_B=`# backup.py — nightly backup of project folders
import os
import shutil
import datetime
import logging

SOURCE_DIRS = ["/home/asha/projects", "/home/asha/notes", "/home/asha/photos"]
DEST_ROOT = "/mnt/backup"
KEEP_DAYS = 14

log = logging.getLogger("backup")

def timestamp():
    return datetime.datetime.now().strftime("%Y-%m-%d_%H%M")

def copy_tree(src, dest):
    if not os.path.isdir(src):
        log.warning("missing: %s", src)
        return 0
    shutil.copytree(src, dest, dirs_exist_ok=True)
    return 1

def prune(root, keep):
    folders = sorted(os.listdir(root))
    for old in folders[:-keep]:
        shutil.rmtree(os.path.join(root, old))

def main():
    logging.basicConfig(level=logging.INFO)
    target = os.path.join(DEST_ROOT, timestamp())
    os.makedirs(target, exist_ok=True)
    count = 0
    for src in SOURCE_DIRS:
        name = os.path.basename(src)
        count += copy_tree(src, os.path.join(target, name))
    prune(DEST_ROOT, KEEP_DAYS)
    log.info("copied %d folders to %s", count, target)

if __name__ == "__main__":
    main()
`;
const CSV_A=`sku,name,category,price,stock
A-100,Steel water bottle 750 ml,Kitchen,549,120
A-101,Bamboo cutting board,Kitchen,899,40
A-102,Cotton apron,Kitchen,399,65
B-200,LED desk lamp,Home office,1899,22
B-201,Laptop stand,Home office,1499,30
B-202,Wireless mouse,Home office,799,80
C-300,Yoga mat 6 mm,Fitness,1299,18
C-301,Resistance bands (set of 5),Fitness,649,55`;
const CSV_B=`sku,name,category,price,stock,supplier
A-100,Steel water bottle 750 ml,Kitchen,549,96,Kraftline
A-101,Bamboo cutting board,Kitchen,949,40,GreenCut
A-102,Cotton Apron,Kitchen,399,65,Kraftline
B-200,LED desk lamp,Home office,1899,0,Lumio
B-202,Wireless mouse,Home office,799.00,80,Clikk
C-300,Yoga mat 8 mm,Fitness,1299,18,FlexFit
C-301,Resistance bands (set of 5),Fitness,649,55,FlexFit
C-302,Foam roller,Fitness,999,25,FlexFit`;

function scene(v){
  const c=document.createElement('canvas');c.width=480;c.height=300;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,300);g.addColorStop(0,v?'#7fb3f0':'#86b9f2');g.addColorStop(1,'#dcecfb');x.fillStyle=g;x.fillRect(0,0,480,300);
  x.fillStyle='#ffd25a';x.beginPath();x.arc(v?380:360,70,32,0,7);x.fill();
  x.fillStyle='#5fa35a';x.beginPath();x.moveTo(0,230);x.quadraticCurveTo(140,150,260,220);x.quadraticCurveTo(380,170,480,215);x.lineTo(480,300);x.lineTo(0,300);x.fill();
  x.fillStyle='#e9e2d4';x.fillRect(150,170,110,80);x.fillStyle='#b5523b';x.beginPath();x.moveTo(140,172);x.lineTo(205,125);x.lineTo(270,172);x.fill();
  x.fillStyle='#6b4a2f';x.fillRect(195,205,24,45);x.fillStyle=v?'#f6c64a':'#8ac4ee';x.fillRect(162,188,24,20);x.fillRect(228,188,24,20);
  if(v){x.strokeStyle='#2c3440';x.lineWidth=2;for(const[bx,by]of[[90,60],[120,80]]){x.beginPath();x.moveTo(bx-9,by);x.quadraticCurveTo(bx-4,by-6,bx,by);x.quadraticCurveTo(bx+4,by-6,bx+9,by);x.stroke()}}
  x.fillStyle='#3f7f3c';x.beginPath();x.arc(v?60:70,215,26,0,7);x.fill();x.fillStyle='#6b4a2f';x.fillRect(v?56:66,235,8,22);
  return c;
}
const blobOf=c=>new Promise(r=>c.toBlob(r,'image/png'));
async function sampleFolders(){
  const t0=Date.parse('2026-10-01T09:00:00'),day=86400000,mk=(p,s,t)=>[p,new File([s],p.split('/').pop(),{lastModified:t})];
  const css1=`body { font: 16px/1.5 Georgia, serif; color: #222; }\nheader { padding: 24px; }\n.nav a { margin-right: 12px; }\n`;
  const css2=`body { font: 16px/1.6 "Source Serif", Georgia, serif; color: #1b1b1b; }\nheader { padding: 24px 32px; }\n.nav a { margin-right: 16px; }\n.nav a:hover { text-decoration: underline; }\n`;
  const html1=`<!doctype html>\n<html>\n<head>\n  <title>Asha's workshop</title>\n  <link rel="stylesheet" href="css/site.css">\n</head>\n<body>\n  <header><h1>Asha's workshop</h1></header>\n  <nav class="nav"><a href="/">Home</a><a href="about.html">About</a></nav>\n  <main>Handmade furniture from Bengaluru.</main>\n  <script src="js/legacy.js"><\/script>\n</body>\n</html>\n`;
  const html2=`<!doctype html>\n<html lang="en">\n<head>\n  <title>Asha's workshop</title>\n  <link rel="stylesheet" href="css/site.css">\n  <link rel="stylesheet" href="css/print.css" media="print">\n</head>\n<body>\n  <header><h1>Asha's workshop</h1></header>\n  <nav class="nav"><a href="/">Home</a><a href="about.html">About</a><a href="docs/CHANGELOG.md">Changes</a></nav>\n  <main>Handmade furniture from Bengaluru, made to order.</main>\n  <script src="js/app.js"><\/script>\n</body>\n</html>\n`;
  const about=`<h1>About</h1>\n<p>Teak and rosewood pieces, built one at a time.</p>\n`,app=`export function init(){ document.body.dataset.ready = "1"; }\n`,cfg=`{\n  "site": "workshop",\n  "lang": "en"\n}\n`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#b5523b"/></svg>\n`;
  const [p1,p2]=await Promise.all([blobOf(scene(0)),blobOf(scene(1))]);
  F.L=new Map([mk('index.html',html1,t0),mk('about.html',about,t0),mk('css/site.css',css1,t0),mk('js/app.js',app,t0),mk('js/legacy.js','var x = 1;\n',t0-30*day),mk('img/logo.svg',svg,t0),['img/hero.png',new File([p1],'hero.png',{lastModified:t0})],mk('README.md','# Workshop site\nStatic pages.\n',t0),mk('config.json',cfg,t0)]);
  F.R=new Map([mk('index.html',html2,t0+3*day),mk('about.html',about,t0),mk('css/site.css',css2,t0+2*day),mk('css/print.css','nav { display: none; }\n',t0+2*day),mk('js/app.js',app,t0),mk('img/logo.svg',svg,t0),['img/hero.png',new File([p2],'hero.png',{lastModified:t0+4*day})],mk('README.md','# Workshop site\nStatic pages, deployed with rsync.\n',t0+4*day),mk('config.json',cfg,t0),mk('docs/CHANGELOG.md','## 2026-10\n- print stylesheet\n- new hero picture\n',t0+4*day)]);
  F.rootL='sample/site-v1';F.rootR='sample/site-v2';
  await compareFolders();
}
function sampleHex(){
  const enc=new TextEncoder();
  const head=[0x89,0x54,0x50,0x4B,0x0D,0x0A,0x1A,0x0A,0,0,0,0x0D,0x48,0x44,0x52,0x01];
  const body=enc.encode('Twinpane sample record v1.0 — owner=asha; size=2048; flags=0x0003; checksum=5A3C;');
  const a=new Uint8Array([...head,...body,...Array.from({length:64},(_,i)=>(i*37)&255)]);
  const b=a.slice();b[15]=0x02;const s2=enc.encode('Twinpane sample record v1.1 — owner=asha; size=4096; flags=0x0007; checksum=9E11;');b.set(s2,16);b[16+s2.length+20]^=0xFF;
  H.a=a;H.b=b;H.nameA='record-old.bin';H.nameB='record-new.bin';computeHex();
}


/* =================== DESKTOP (Electron) =================== */
const N=window.native||null;
function nfile(abs,size,mtime){return{abs,name:abs.split(/[\\/]/).pop(),size,lastModified:mtime,
  slice:(a,b)=>({arrayBuffer:()=>N.readBytes(abs,a,Math.min(b,size))}),
  arrayBuffer:()=>N.readBytes(abs,0,size),
  text:async()=>new TextDecoder().decode(await N.readBytes(abs,0,size))}}
async function scanSide(side,dir){
  $('#fStat').textContent='Reading '+dir+'…';
  const list=await N.scanFolder(dir),m=new Map(list.map(e=>[e.rel,nfile(e.abs,e.size,e.mtime)]));
  if(side==='L'){F.L=m;F.rootL=dir;F.absL=dir}else{F.R=m;F.rootR=dir;F.absR=dir}
}
async function nativeFolder(side,dir){dir=dir||await N.pickFolder();if(!dir)return;await scanSide(side,dir);F.collapsed.clear();await compareFolders();show('folders')}
async function saveSide(side){
  if(S.editing){S.a=$('#tA').value;S.b=$('#tB').value}
  const key=side==='a'?'pathA':'pathB';let p=S[key];
  if(!p){p=await N.saveDialog((side==='a'?S.nameA:S.nameB)||'untitled.txt');if(!p)return;S[key]=p;if(side==='a')S.nameA=p;else S.nameB=p;syncNames()}
  try{await N.writeText(p,side==='a'?S.a:S.b);S[side==='a'?'dirtyA':'dirtyB']=false;toast('Saved '+p)}catch(e){toast('Could not save: '+e.message)}
}
if(N){
  document.documentElement.classList.add('desktop');
  $('#tSaveL').textContent='Save left';$('#tSaveR').textContent='Save right';
  $('#tSaveL').title=$('#tSaveR').title='Ctrl+S saves every changed side';
  $('#fPlanHint').textContent='Run sync copies and overwrites files for real. Deleted files go to the Recycle Bin. Click any file above to open it in the text, picture or hex view.';
  const pick={tFileA:f=>openTextFile('a',f),tFileB:f=>openTextFile('b',f),hFileA:f=>loadHex('a',f),hFileB:f=>loadHex('b',f),
    cFileA:f=>loadCSV('a',f),cFileB:f=>loadCSV('b',f),iFileA:async f=>{await setImg('a',f);renderImg()},iFileB:async f=>{await setImg('b',f);renderImg()}};
  for(const[id,fn]of Object.entries(pick))$('#'+id).closest('label').addEventListener('click',async e=>{e.preventDefault();
    const p=await N.pickFile();if(!p)return;const st=await N.stat(p);fn(nfile(p,st.size,st.mtime))});
  for(const side of['L','R'])$('#fPick'+side).closest('label').addEventListener('click',e=>{e.preventDefault();nativeFolder(side)});
  const fz=$('#v-folders');
  fz.addEventListener('dragover',e=>{e.preventDefault()});
  fz.addEventListener('drop',async e=>{e.preventDefault();const fs=[...e.dataTransfer.files].map(f=>N.pathOf(f)).filter(Boolean);if(!fs.length)return;
    if(fs.length>=2){await scanSide('L',fs[0]);await scanSide('R',fs[1]);F.collapsed.clear();await compareFolders();return}
    const r=fz.getBoundingClientRect();nativeFolder(e.clientX<r.left+r.width/2?'L':'R',fs[0])});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&!$('#v-text').hidden){e.preventDefault();
    if(S.editing){if($('#tA').value!==S.a)S.dirtyA=true;if($('#tB').value!==S.b)S.dirtyB=true}
    if(!S.dirtyA&&!S.dirtyB){toast('No unsaved changes');return}if(S.dirtyA)saveSide('a');if(S.dirtyB)saveSide('b')}});
  $('#fRun').onclick=async()=>{
    const P=planItems();if(!P.length){toast('Nothing to sync');return}
    const sep=F.absL.includes('\\')?'\\':'/',jp=(r,p)=>r+sep+p.split('/').join(sep);
    const ops=P.map(([k,label,path])=>{const toRight=/right/.test(label);
      if(k==='del')return{kind:'del',target:(toRight?F.R:F.L).get(path).abs};
      return{kind:'copy',from:(toRight?F.L:F.R).get(path).abs,to:jp(toRight?F.absR:F.absL,path)}});
    let res;try{res=await N.runSync(ops)}catch(e){toast('Sync stopped: '+e.message);return}
    if(res.cancelled)return;
    toast(res.errors.length?`${res.done} done, ${res.errors.length} failed: ${res.errors[0]}`:`Sync finished: ${res.done} action${res.done===1?'':'s'}`);
    await scanSide('L',F.absL);await scanSide('R',F.absR);await compareFolders();
  };
}
async function nativeArgs(){
  if(!N)return false;const args=await N.getArgs();if(!args.length)return false;
  const[a,b]=args;
  if(a.isDir){await scanSide('L',a.path);if(b&&b.isDir)await scanSide('R',b.path);await compareFolders();show('folders');return true}
  const fa=nfile(a.path,a.size,a.mtime),fb=b&&!b.isDir?nfile(b.path,b.size,b.mtime):null;
  await openFiles(fa,fb,a.path,b?b.path:'(none)',a.path,b?b.path:null);return true;
}

/* =================== BOOT =================== */
(async function(){
  const st=load('text');
  if(window.native&&st&&(st.a||st.b))save('text',{opt:st.opt||{}});
  if(!window.native&&st&&(st.a||st.b)){S.a=st.a||'';S.b=st.b||'';S.nameA=st.nameA||'';S.nameB=st.nameB||'';Object.assign(S.opt,st.opt||{})}
  else{if(st&&st.opt)Object.assign(S.opt,st.opt);S.a=SAMPLE_A;S.b=SAMPLE_B;S.nameA='backup.py (example, old)';S.nameB='backup.py (example, new)'}
  for(const[id,k]of Object.entries(optMap))$('#'+id).checked=!!S.opt[k];$('#oPat').value=S.opt.pat||'';
  syncNames();computeText();
  $('#cA').value=CSV_A;$('#cB').value=CSV_B;C.key='sku';computeTable();
  sampleHex();
  I.a=scene(0);I.b=scene(1);I.nameA='hero.png (example, before)';I.nameB='hero.png (example, after)';
  const h=(location.hash||'').slice(1);show(TABS.includes(h)?h:(load('tab')||'text'));
  const fromArgs=await nativeArgs().catch(e=>{toast('Could not open: '+e.message);return false});
  if(!fromArgs||!F.items.length)await sampleFolders();
  if(fromArgs&&F.absL)show('folders');
})();
