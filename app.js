'use strict';
const $=id=>document.getElementById(id);
const cfg=window.DONTUM_CONFIG||{};
let verifiedReady=false;
let loadingMine=false;
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
async function loadMine(){
  if(!verifiedReady||loadingMine)return;
  loadingMine=true;const b=$('refreshBtn');setLoading(b,true,'กำลังโหลด…');
  $('mineList').textContent='กำลังโหลดรายการแจ้งซ่อม…';
  try{
    const jobs=await api('mine');$('mineList').replaceChildren();
    if(!jobs.length){$('mineList').textContent='ยังไม่มีรายการแจ้งซ่อมที่ผูกกับ LINE นี้';return;}
    jobs.forEach(job=>{
      const card=document.createElement('article');card.className='job';
      const top=document.createElement('div');top.className='job-top';
      const title=document.createElement('span');title.className='job-title';title.textContent=job.id;
      const status=document.createElement('span');status.textContent=job.status;
      status.className='pill'+(['รอรับงาน','รออะไหล่','ส่งซ่อมภายนอก'].includes(job.status)?' wait':
        job.status==='ซ่อมเสร็จ'?' done':job.status==='ปิดงาน'?' closed':'');
      top.append(title,status);
      const meta=document.createElement('div');meta.className='job-meta';
      const date=job.updatedAt?new Date(job.updatedAt):null;
      const formatted=date&&!Number.isNaN(date.getTime())?date.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}):'-';
      meta.textContent='ประเภท: '+job.category+' · '+job.department+'\nสถานที่: '+job.location+
        (job.assignedName?' · ผู้รับผิดชอบ: '+job.assignedName:'')+'\nอัปเดตล่าสุด: '+formatted;
      meta.style.whiteSpace='pre-line';card.append(top,meta);
      if(job.status==='ปิดงาน'){
        const wrap=document.createElement('div');wrap.className='rating-widget';
        if(job.rating){wrap.textContent='⭐ ประเมินแล้ว '+job.rating+'/5 คะแนน';}
        else{
          const label=document.createElement('label');label.textContent='ประเมินความพึงพอใจหลังปิดงาน';
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
      $('mineList').append(card);
    });
  }catch(error){$('mineList').textContent='โหลดรายการไม่สำเร็จ';alertUser(error.message);}
  finally{loadingMine=false;setLoading(b,false);}
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
  $('repairForm').addEventListener('submit',submitForm);
  $('photos').addEventListener('change',refreshPhotoPreview);
  $('viewMineBtn').addEventListener('click',()=>showTab('mine'));
  $('anotherBtn').addEventListener('click',()=>showTab('create'));
  $('friendBtn').addEventListener('click',async()=>{
    try{if(typeof window.liff?.requestFriendship==='function'&&window.liff.isInClient())
        await window.liff.requestFriendship();
      else window.open('https://line.me/R/ti/p/@281xcsng','_blank','noopener');
      await checkFriendship();
    }catch(_){window.open('https://line.me/R/ti/p/@281xcsng','_blank','noopener');}
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
  }catch(error){
    $('identity').textContent='⚠️ ยังไม่สามารถเชื่อม LINE';
    alertUser('ไม่สามารถเปิดระบบผ่าน LINE ได้: '+String(error?.message||error));
  }
}
document.addEventListener('DOMContentLoaded',init);
