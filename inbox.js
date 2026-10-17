/* DVIR DESIGNS — admin-only request inbox. Data is protected by Supabase RLS. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const list=$('inbox-list');
if(!list)return;
let records=[],selectedCode=null,loading=false;
const $el=(tag,className,content)=>{
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(content!==undefined)node.textContent=String(content);
 return node;
};
const fmtDate=when=>{try{return new Date(when).toLocaleString('he-IL',{dateStyle:'medium',timeStyle:'short'})}catch{return when||''}};
const statusNames={new:'חדשה',read:'נקראה',archived:'בארכיון'};
function inboxMessage(msg,isGood=false){
 const target=$('inbox-status');target.textContent=msg;target.className='status '+(isGood?'ok':'err');
}
function shareUrl(code){
 const url=new URL('/',location.origin);
 url.searchParams.set('s',code);
 return url.href;
}
function filteredRecords(){
 const q=$('inbox-search').value.trim().toLowerCase(),status=$('inbox-filter').value;
 return records.filter(r=>(!status||r.status===status)&&(!q||[r.customer_name,r.phone,r.code]
   .filter(Boolean).some(value=>String(value).toLowerCase().includes(q))));
}
function drawInbox(){
 const shown=filteredRecords(),newCount=records.filter(r=>r.status==='new').length;
 $('inbox-stats').textContent=records.length+' בקשות · '+newCount+' חדשות';
 $('inbox-visible-count').textContent='('+shown.length+')';
 const badge=$('inbox-new-count');badge.hidden=newCount===0;badge.textContent=newCount>99?'99+':String(newCount);
 list.replaceChildren();
 if(!shown.length){
   list.append($el('p','muted',records.length?'לא נמצאו בקשות שמתאימות לחיפוש.':'עדיין לא התקבלו בקשות סל.'));return;
 }
 for(const req of shown){
   const card=$el('button','inbox-entry'+(req.code===selectedCode?' selected':'')),
     top=$el('span','inbox-entry-title'),
     name=$el('strong',null,req.customer_name||'לקוח'),
     status=$el('span','inbox-status-label inbox-'+req.status,statusNames[req.status]||req.status),
     meta=$el('span','inbox-entry-meta',fmtDate(req.created_at)),
     detail=$el('span','inbox-entry-contact',req.phone?'טלפון: '+req.phone:'ללא מספר טלפון'),
     items=$el('span','inbox-entry-meta',(Array.isArray(req.items)?req.items.length:0)+' פריטים בסל');
   card.type='button';card.dataset.code=req.code;
   top.append(name,status);card.append(top,meta,detail,items);
   card.addEventListener('click',()=>{selectedCode=req.code;drawInbox();drawDetails(req)});
   list.append(card);
 }
}
function drawDetails(req){
 const root=$('inbox-detail');root.replaceChildren();
 root.append($el('h3',null,'בקשה של '+req.customer_name));
 root.append($el('p','inbox-detail-date',fmtDate(req.created_at)+' · '+(statusNames[req.status]||req.status)));
 const contact=$el('div','inbox-contact');
 if(req.phone){
   contact.append($el('strong',null,'מספר טלפון: '));
   const link=$el('a',null,req.phone);
   link.href='tel:'+req.phone;link.setAttribute('dir','ltr');contact.append(link);
   const copy=$el('button','inbox-tiny-button','העתקה');
   copy.type='button';
   copy.addEventListener('click',async()=>{
     try{await navigator.clipboard.writeText(req.phone);inboxMessage('מספר הטלפון הועתק',true)}
     catch{inboxMessage('לא ניתן להעתיק אוטומטית')}
   });
   contact.append(copy);
 }else contact.append($el('span','muted','הלקוח לא הזין מספר טלפון'));
 root.append(contact);
 root.append($el('h4',null,'פריטים והצעות מחיר'));
 const ul=$el('ul','inbox-items');
 for(const item of (Array.isArray(req.items)?req.items:[])){
   if(!Array.isArray(item)||item.length<3)continue;
   const [key,size,qty,offer]=item;
   const itemText=String(key)+' · '+String(size)+' · כמות: '+String(qty)+
     (offer==null?'':' · הצעת לקוח: ₪'+Number(offer).toLocaleString('he-IL'));
   ul.append($el('li',null,itemText));
 }
 root.append(ul);
 const row=$el('div','inbox-detail-actions');
 const link=$el('a','button inbox-share-link','פתיחת הסל הקצר ↗');
 link.href=shareUrl(req.code);link.target='_blank';link.rel='noopener noreferrer';
 const btn=$el('button','inbox-tiny-button','העתקת קישור');
 btn.type='button';btn.addEventListener('click',async()=>{
   try{await navigator.clipboard.writeText(link.href);inboxMessage('קישור הסל הועתק',true)}
   catch{inboxMessage('העתק את הקישור משורת הכתובת')}
 });
 row.append(link,btn);root.append(row);
 const statusActions=$el('div','inbox-detail-actions');
 for(const [status,label] of [['new','סמן כחדש'],['read','סמן כנקרא'],['archived','העבר לארכיון']]){
   if(req.status===status)continue;
   const button=$el('button','inbox-tiny-button',label);button.type='button';
   button.addEventListener('click',()=>updateStatus(req.code,status,button));
   statusActions.append(button);
 }
 root.append(statusActions);
 root.append($el('p','admin-note','טלפון שמסר הלקוח נועד ליצירת קשר לגבי בקשתו. אין כאן הזמנה ששולמה.'));
}
async function updateStatus(code,status,button){
 const db=window.DVIR_ADMIN_DB;
 if(!db)return inboxMessage('יש להתחבר למנהל כדי לשנות בקשה');
 button.disabled=true;
 try{
  const {error}=await db.from('dvir_cart_requests').update({status,updated_at:new Date().toISOString()}).eq('code',code);
  if(error)throw error;
  const req=records.find(r=>r.code===code);
  if(req){req.status=status;req.updated_at=new Date().toISOString();drawInbox();drawDetails(req)}
  inboxMessage('סטטוס הבקשה עודכן',true);
 }catch(e){inboxMessage('לא ניתן לעדכן: '+e.message)}
 finally{button.disabled=false}
}
async function refreshInbox(){
 if(loading)return;
 const db=window.DVIR_ADMIN_DB;
 if(!db)return inboxMessage('מערכת הניהול לא מחוברת');
 loading=true;$('inbox-refresh').disabled=true;
 try{
  const {data,error}=await db.from('dvir_cart_requests')
    .select('code,customer_name,phone,items,status,created_at,updated_at')
    .order('created_at',{ascending:false}).limit(500);
  if(error)throw error;
  records=data||[];
  drawInbox();
  const selected=records.find(r=>r.code===selectedCode);
  if(selected)drawDetails(selected);
  else {selectedCode=null;$('inbox-detail').replaceChildren($el('p','muted','בחר בקשה מהרשימה כדי לראות את הפרטים.'))}
  inboxMessage('תיבת הבקשות מעודכנת',true);
 }catch(e){
  inboxMessage('לא ניתן לטעון בקשות: '+e.message);
 }finally{loading=false;$('inbox-refresh').disabled=false}
}
$('inbox-search').addEventListener('input',drawInbox);
$('inbox-filter').addEventListener('change',drawInbox);
$('inbox-refresh').addEventListener('click',refreshInbox);
const tab=document.querySelector('[data-studio-tab="inbox"]');
tab?.addEventListener('click',refreshInbox);
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&!$('dashboard').classList.contains('hidden')&&!$('studio-pane-inbox').hidden)refreshInbox()
});
window.DVIR_INBOX={refresh:refreshInbox};
})();
