'use strict';
const $=id=>document.getElementById(id);
const cfg=window.DONTUM_CONFIG||{};
let verifiedReady=false;
let loadingMine=false;
let targetRatingJobId='';
let mineJobs=[];
let mineLoaded=false;
let mineFilter='all';
let mineQuery='';
function ratingTargetFromUrl(){
  // Read only after await liff.init(); LIFF first restores extra params from liff.state.
  const q=new URLSearchParams(window.location.search);
  const id=String(q.get('job')||'');
  return q.get('tab')==='mine' && /^MT-\d{4}-\d{4,}$/.test(id) ? id : '';
}
function alertUser(message,info=false){$('alert').textContent=String(message);$('alert').classList.toggle('info',info);$('alert').hidden=false;}
function clearAlert(){$('alert').hidden=true;}
function showTab(name){
  const mine=name==='mine';
  $('pageMine').hidden=!mine;$('pageCreate').hidden=mine;$('success').hidden=true;
  $('tabCreate').classList.toggle('active',!mine);$('tabMine').classList.toggle('active',mine);
  $('tabCreate').setAttribute('aria-selected',String(!mine));$('tabMine').setAttribute('aria-selected',String(mine));
  clearAlert();
  if(mine)void loadMine();
}
function setLoading(button,value,text){
  if(value){button.dataset.oldText=button.textContent;button.textContent=text;button.disabled=true;}
  else{button.textContent=button.dataset.oldText||button.textContent;button.disabled=!verifiedReady;}
}
async function api(path,data){
  const token=window.liff?.getIDToken?.();
  if(!token)throw new Error('ยังไม่ได้ยืนยันบัญชี LINE กรุณาเปิดผ่าน LINE อีกครั้ง');
  const url=String(cfg.apiBase||'').replace(/\/$/,'')+'/api/'+path;
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({idToken:token,...(data?{data}:{})}),cache:'no-store'});
  let result;
  try{result=await response.json();}catch(_){throw new Error('ระบบตอบกลับไม่ถูกต้อง กรุณาตรวจการตั้งค่า API');}
  if(!response.ok||!result.ok)throw new Error(result.error||'ไม่สามารถดำเนินการได้');
  return result.result;
}
// Filters run only on tickets already returned for the verified LINE account.
const mineFilterLabels={all:'รายการทั้งหมด',wait:'งานรอรับ',active:'กำลังดำเนินการ',parts:'รออะไหล่ / ส่งซ่อมภายนอก',done:'งานเสร็จสิ้น'};
function statusGroup(status){
  if(status==='รอรับงาน')return 'wait';
  if(['รับงานแล้ว','กำลังซ่อม'].includes(status))return 'active';
  if(['รออะไหล่','ส่งซ่อมภายนอก'].includes(status))return 'parts';
  if(['ซ่อมเสร็จ','ปิดงาน'].includes(status))return 'done';
  return 'other';
}
function statusPillClass(status){
  if(status==='ปิดงาน')return 'closed';
  if(status==='ซ่อมเสร็จ')return 'done';
  if(statusGroup(status)==='parts')return 'parts';
  if(statusGroup(status)==='active')return 'active';
  return 'wait';
}
function countGroups(){
  const counts={all:mineJobs.length,wait:0,active:0,parts:0,done:0};
  mineJobs.forEach(job=>{const group=statusGroup(job.status);if(Object.prototype.hasOwnProperty.call(counts,group))counts[group]++;});
  $('countAll').textContent=String(counts.all);
  $('countOpen').textContent=String(counts.all-counts.done);
  $('countDone').textContent=String(counts.done);
  document.querySelectorAll('[data-count]').forEach(el=>{el.textContent=String(counts[el.dataset.count]||0);});
}
function selectMineFilter(next){
  if(!Object.prototype.hasOwnProperty.call(mineFilterLabels,next))return;
  mineFilter=next;
  document.querySelectorAll('#mineFilters [data-filter]').forEach(b=>{
    const active=b.dataset.filter===next;
    b.classList.toggle('active',active);
    b.setAttribute('aria-pressed',String(active));
  });
  renderMine();
}
function jobMetaRow(label,value){
  const line=document.createElement('div');line.className='job-meta-item';
  const name=document.createElement('span');name.className='job-meta-label';name.textContent=label;
  const val=document.createElement('span');val.textContent=String(value||'-');
  line.append(name,val);return line;
}
function renderMine(){
  const list=$('mineList');list.replaceChildren();
  $('mineListTitle').textContent=mineFilterLabels[mineFilter]||mineFilterLabels.all;
  const search=mineQuery.trim().toLocaleLowerCase('th');
  const matching=mineJobs.filter(job=>
    (mineFilter==='all'||statusGroup(job.status)===mineFilter)&&
    (!search||[job.id,job.category,job.department,job.location,job.assignedName,job.status]
      .some(x=>String(x||'').toLocaleLowerCase('th').includes(search))));
  $('mineVisibleCount').textContent=mineLoaded?`แสดง ${matching.length} จาก ${mineJobs.length} งาน`:'';
  if(!mineLoaded){const blank=document.createElement('div');blank.className='empty';blank.textContent='กดอัปเดตเพื่อดูรายการแจ้งซ่อมของคุณ';list.append(blank);return;}
  if(!matching.length){
    const blank=document.createElement('div');blank.className='empty';
    blank.textContent=mineJobs.length===0?'ยังไม่มีรายการแจ้งซ่อมที่ผูกกับ LINE นี้':'ไม่พบงานในหมวดนี้ ลองเลือกสถานะอื่นหรือเปลี่ยนคำค้นหา';
    list.append(blank);return;
  }
  matching.forEach(job=>{
    const card=document.createElement('article');card.className='job';card.dataset.jobId=String(job.id);
    const top=document.createElement('div');top.className='job-top';
    const title=document.createElement('span');title.className='job-title';title.textContent=String(job.id);
    const status=document.createElement('span');status.className='pill '+statusPillClass(job.status);status.textContent=String(job.status||'ไม่ระบุ');
    top.append(title,status);
    const type=document.createElement('div');type.className='job-type';type.textContent=String(job.category||'งานซ่อม');
    const meta=document.createElement('div');meta.className='job-meta';
    meta.append(jobMetaRow('หน่วยงาน:',job.department),jobMetaRow('สถานที่:',job.location));
    if(job.assignedName)meta.append(jobMetaRow('ช่างผู้รับผิดชอบ:',job.assignedName));
    const updated=document.createElement('div');updated.className='job-updated';
    const date=job.updatedAt?new Date(job.updatedAt):null;
    const formatted=date&&!Number.isNaN(date.getTime())?date.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}):'-';
    updated.textContent='อัปเดตล่าสุด: '+formatted;
    card.append(top,type,meta,updated);
    // Keep the same rating API and the one-rating-per-closed-ticket server rule.
    if(job.status==='ปิดงาน'){
      const wrap=document.createElement('div');wrap.className='rating-widget';
      if(job.rating){wrap.textContent='⭐ ประเมินแล้ว '+job.rating+'/5 คะแนน';}
      else{
        const label=document.createElement('label');label.textContent='⭐ ประเมินความพึงพอใจหลังปิดงาน';
        const select=document.createElement('select');select.setAttribute('aria-label','คะแนนความพึงพอใจ');
        [5,4,3,2,1].forEach(n=>{const opt=document.createElement('option');opt.value=n;opt.textContent='⭐'.repeat(n)+' ('+n+'/5)';select.append(opt);});
        const comment=document.createElement('input');comment.maxLength=500;comment.placeholder='ความคิดเห็น (ไม่บังคับ)';comment.setAttribute('aria-label','ความคิดเห็น');
        const button=document.createElement('button');button.className='btn secondary';button.type='button';button.textContent='ส่งคะแนน';
        button.addEventListener('click',async()=>{
          button.disabled=true;
          try{await api('rate',{id:job.id,score:Number(select.value),comment:comment.value});
            alertUser('ขอบคุณสำหรับการประเมินงาน '+job.id,true);await loadMine();
          }catch(e){alertUser(e.message);button.disabled=false;}
        });
        wrap.append(label,select,comment,button);
      }
      card.append(wrap);
    }
    if(job.id===targetRatingJobId)card.classList.add('rating-deeplink-target');
    list.append(card);
  });
  if(targetRatingJobId){
    const match=Array.from(list.children).find(el=>el.dataset.jobId===targetRatingJobId);
    if(match){
      match.scrollIntoView({behavior:'smooth',block:'center'});
      const select=match.querySelector('.rating-widget select');
      if(select)select.focus({preventScroll:true});
      else if(!match.querySelector('.rating-widget'))alertUser('ใบงาน '+targetRatingJobId+' ยังไม่อยู่ในสถานะปิดงาน',true);
    }
  }
}
async function loadMine(){
  if(!verifiedReady||loadingMine)return;
  loadingMine=true;const button=$('refreshBtn');setLoading(button,true,'กำลังโหลด…');
  const list=$('mineList');list.replaceChildren();
  const msg=document.createElement('div');msg.className='empty';msg.textContent='กำลังโหลดรายการแจ้งซ่อม…';list.append(msg);
  try{
    const jobs=await api('mine');
    if(!Array.isArray(jobs))throw new Error('รูปแบบข้อมูลรายการงานไม่ถูกต้อง');
    mineJobs=jobs;mineLoaded=true;
    if(targetRatingJobId){
      const target=mineJobs.find(job=>job.id===targetRatingJobId);
      mineQuery='';$('mineSearch').value='';
      mineFilter=target&&statusGroup(target.status)==='done'?'done':'all';
      document.querySelectorAll('#mineFilters [data-filter]').forEach(b=>{
        const active=b.dataset.filter===mineFilter;
        b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
      });
      if(!target)alertUser('ไม่พบใบงานในบัญชี LINE นี้ กรุณาเปิดด้วยบัญชี LINE ที่ใช้แจ้งซ่อม',true);
    }
    countGroups();renderMine();
  }catch(error){
    list.replaceChildren();
    const msg=document.createElement('div');msg.className='empty';msg.textContent='โหลดรายการไม่สำเร็จ กรุณาลองอีกครั้ง';list.append(msg);
    alertUser(error.message||'ไม่สามารถโหลดรายการงานได้');
  }finally{loadingMine=false;setLoading(button,false);}
}
async function compressPhoto(file){
  if(!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type))throw new Error('รองรับเฉพาะ JPEG, PNG และ WebP');
  if(file.size>12000000)throw new Error('รูปต้นฉบับใหญ่เกิน 12 MB');
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('อ่านรูปภาพไม่ได้'));image.src=url;
    });
    const scale=Math.min(1,960/Math.max(img.width,img.height));
    const cvs=document.createElement('canvas');cvs.width=Math.max(1,Math.round(img.width*scale));cvs.height=Math.max(1,Math.round(img.height*scale));
    const ctx=cvs.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,cvs.width,cvs.height);ctx.drawImage(img,0,0,cvs.width,cvs.height);
    let quality=.72, b64='';
    for(let i=0;i<6;i++){
      b64=cvs.toDataURL('image/jpeg',quality).split(',')[1];
      if(b64.length<850000)break;
      quality=Math.max(.35,quality-.09);
    }
    if(b64.length>850000)throw new Error('รูปภาพใหญ่เกินไป กรุณาเลือกภาพอื่น');
    return {mime:'image/jpeg',data:b64};
  }finally{URL.revokeObjectURL(url);}
}
function refreshPhotoPreview(){
  const list=$('photoPreview');list.replaceChildren();
  const files=Array.from($('photos').files||[]);
  if(files.length>3){alertUser('เลือกได้สูงสุด 3 รูป');$('photos').value='';return;}
  files.forEach(f=>{const item=document.createElement('span');item.textContent='📷 '+f.name;list.append(item);});
}
async function submitForm(event){
  event.preventDefault();if(!verifiedReady){alertUser('กรุณายืนยันบัญชี LINE ก่อน');return;}
  const btn=$('submitBtn');setLoading(btn,true,'กำลังส่งใบแจ้งซ่อม…');clearAlert();
  try{
    const form=new FormData($('repairForm'));
    const data=Object.fromEntries(form.entries());
    delete data.photos;
    const files=Array.from($('photos').files||[]);
    if(files.length>3)throw new Error('แนบรูปได้สูงสุด 3 รูป');
    data.photos=[];
    for(const f of files)data.photos.push(await compressPhoto(f));
    const result=await api('create',data);
    $('photoNotice').hidden=!result.photoWarning;
    $('photoNotice').textContent=result.photoWarning||'';
    $('successId').textContent=result.id;
    $('successNotice').textContent=result.noticeSent
      ?'ผูกใบแจ้งซ่อมกับ LINE ของคุณแล้ว และส่งข้อความยืนยันทาง LINE แล้ว'
      :'ผูกใบแจ้งซ่อมกับ LINE แล้ว แต่ส่งข้อความยืนยันไม่สำเร็จ กรุณาเพิ่มเพื่อนหรือปลดบล็อก LINE OA';
    $('pageCreate').hidden=true;$('pageMine').hidden=true;$('success').hidden=false;
    $('repairForm').reset();$('photoPreview').replaceChildren();window.scrollTo({top:0,behavior:'smooth'});
  }catch(error){alertUser(error.message||'ส่งข้อมูลไม่สำเร็จ');}
  finally{setLoading(btn,false);}
}
async function checkFriendship(){
  try{const info=await window.liff.getFriendship();$('friendPanel').hidden=Boolean(info.friendFlag);}catch(_){}
}
async function init(){
  $('tabCreate').addEventListener('click',()=>showTab('create'));
  $('tabMine').addEventListener('click',()=>showTab('mine'));
  $('refreshBtn').addEventListener('click',loadMine);
  $('mineFilters').addEventListener('click',event=>{
    const filter=event.target.closest('[data-filter]');
    if(!filter||!$('mineFilters').contains(filter))return;
    targetRatingJobId=''; // User deliberately switches away from a deep-linked ticket.
    selectMineFilter(filter.dataset.filter);
  });
  $('mineSearch').addEventListener('input',event=>{
    mineQuery=event.target.value;
    targetRatingJobId='';
    renderMine();
  });
  $('repairForm').addEventListener('submit',submitForm);
  $('photos').addEventListener('change',refreshPhotoPreview);
  $('viewMineBtn').addEventListener('click',()=>showTab('mine'));
  $('anotherBtn').addEventListener('click',()=>showTab('create'));
  $('friendBtn').addEventListener('click',async()=>{
    try{if(typeof window.liff?.requestFriendship==='function'&&window.liff.isInClient())
        await window.liff.requestFriendship();
      else window.open('https://line.me/R/ti/p/@281xcsnq','_blank','noopener');
      await checkFriendship();
    }catch(_){window.open('https://line.me/R/ti/p/@281xcsnq','_blank','noopener');}
  });
  if(!/^\d{5,}-[A-Za-z0-9]+$/.test(String(cfg.liffId||''))){
    $('identity').textContent='⚠️ ยังไม่ได้ตั้ง LIFF ID';alertUser('กรุณาตั้งค่า liffId ใน config.js');return;
  }
  if(!/^https:\/\//.test(String(cfg.apiBase||''))){alertUser('กรุณาตั้งค่า API URL');return;}
  try{
    if(!window.liff)throw new Error('โหลด LIFF SDK ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ต');
    await window.liff.init({liffId:cfg.liffId});
    if(!window.liff.isLoggedIn()){
      if(!window.liff.isInClient()){window.liff.login({redirectUri:location.href.split('#')[0]});return;}
      throw new Error('กรุณาเข้าสู่บัญชี LINE');
    }
    if(!window.liff.getIDToken())throw new Error('LINE ไม่ส่ง ID Token กรุณาเปิดลิงก์ใหม่');
    verifiedReady=true;$('submitBtn').disabled=false;
    const profile=await window.liff.getProfile().catch(()=>null);
    $('identity').textContent='✓ เชื่อมต่อ LINE แล้ว'+(profile?.displayName?' · '+profile.displayName:'');
    // Reporter can change this to their actual hospital name.
    if(profile?.displayName)$('reporter').value=profile.displayName.slice(0,100);
    await checkFriendship();
    // Navigate to the exact ticket only after LIFF init, login, and auth are ready.
    targetRatingJobId=ratingTargetFromUrl();
    if(targetRatingJobId)showTab('mine');
  }catch(error){
    $('identity').textContent='⚠️ ยังไม่สามารถเชื่อม LINE';
    alertUser('ไม่สามารถเปิดระบบผ่าน LINE ได้: '+String(error?.message||error));
  }
}
document.addEventListener('DOMContentLoaded',init);
