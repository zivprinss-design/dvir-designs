'use strict';
(async function(){
const $=id=>document.getElementById(id), cfg=window.DVIR_CONFIG||{};
const loginStatus=$('login-status'),saveStatus=$('save-status');
if(!cfg.supabaseUrl||!cfg.supabaseAnonKey||!window.supabase){
  loginStatus.textContent='מערכת הניהול תופעל אחרי חיבור מסד הנתונים והגדרת config.js.';
  loginStatus.className='status err';$('login-form').querySelector('button').disabled=true;return;
}
const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
let products=[],editKey=null,editProduct=null,selectedKeys=new Set(),dragKey=null;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const message=(el,s,ok=false)=>{el.textContent=s;el.className='status '+(ok?'ok':'err')};
function sizeRow(size='',qty=0){let d=document.createElement('div');d.className='size-row';
 const input=document.createElement('input');input.value=size;input.placeholder='מידה, למשל 45×45';input.className='dimension';input.required=true;
 const n=document.createElement('input');n.className='quantity';n.type='number';n.min='0';n.step='1';n.value=qty;n.required=true;
 const b=document.createElement('button');b.type='button';b.textContent='הסרה';b.addEventListener('click',()=>d.remove());d.append(input,n,b);$('sizes').appendChild(d);
}
function orderNum(p){const id=Number(String(p.key||p.id||'').match(/\d+/)?.[0]||999999);return p.sortOrder!=null&&Number.isFinite(Number(p.sortOrder))?Number(p.sortOrder):id;}
const categories={pillows:0,curtains:1,tables:2};
function orderedProducts(){
 return [...products].sort((a,b)=>(categories[a.data.category]??9)-(categories[b.data.category]??9)
   ||orderNum(a.data)-orderNum(b.data)||a.key.localeCompare(b.key));
}
function showExtraImages(obj){
 const field=$('extra-images'),photos=Array.isArray(obj?.images)?obj.images:[];
 field.value=photos.join('\n');
 const wrap=$('additional-image-preview');wrap.replaceChildren();
 for(const url of photos){
  if(!/^(https:\/\/|assets\/)/.test(url))continue;
  const img=document.createElement('img');img.src=url;img.alt='תמונה נוספת';img.loading='lazy';
  wrap.append(img);
 }
}
function selectProduct(key,duplicate=false){const row=products.find(r=>r.key===key);editKey=duplicate?null:(row?.key||null);editProduct=row?structuredClone(row.data):null;
 if(duplicate&&editProduct){delete editProduct.id;delete editProduct.key;delete editProduct.sortOrder;}
 const obj=editProduct||{key:'',title:'',label:'',category:'pillows',price:null,color:'',unit:'יח׳',stock:{'יחידה':0},sizes:['יחידה'],localImage:''};
 $('editor-title').textContent=duplicate?'שכפול '+obj.title:row?'עריכת '+obj.title:'הוספת מוצר חדש';
 $('duplicate-product').disabled=!row||duplicate;
 const f=$('editor');for(const n of ['title','label','category','color','unit']) f.elements.namedItem(n).value=obj[n]||'';
 f.elements.namedItem('price').value=obj.price==null?'':obj.price;
 f.elements.namedItem('imageurl').value=/^https:\/\//.test(obj.localImage||'')?obj.localImage:'';
 $('image-upload').value='';$('multi-image-upload').value='';
 showExtraImages(obj);
 $('sizes').replaceChildren();for(const s of obj.sizes||[])sizeRow(s,obj.stock?.[s]??0);
 $('active').checked=row?row.active:true;
 $('preview').src=obj.localImage||'assets/placeholder.svg';saveStatus.textContent='';
}
function visibleProducts(){
 const q=$('search').value.trim().toLowerCase(),cat=$('category-filter').value;
 return orderedProducts().filter(r=>(!cat||r.data.category===cat)
  &&`${r.data.title} ${r.data.label||''} ${r.key} ${r.data.color||''}`.toLowerCase().includes(q));
}
function renderList(){
 const matching=visibleProducts();$('count').textContent='('+matching.length+')';
 $('list').replaceChildren();
 for(const r of matching){
  const p=r.data,card=document.createElement('div');card.className='item';card.draggable=true;card.dataset.key=r.key;
  const check=document.createElement('input');check.type='checkbox';check.className='admin-row-check';
  check.setAttribute('aria-label','בחירת '+p.title);check.checked=selectedKeys.has(r.key);
  check.addEventListener('change',()=>{if(check.checked)selectedKeys.add(r.key);else selectedKeys.delete(r.key);updateBulkUI()});
  const img=document.createElement('img');img.src=p.localImage||'assets/placeholder.svg';img.alt='';img.loading='lazy';
  img.onerror=()=>{img.onerror=null;img.src='assets/placeholder.svg'};
  const d=document.createElement('div'),strong=document.createElement('strong');strong.textContent=p.title;
  const small=document.createElement('small');small.textContent=(p.label||r.key)+' · '+(p.price==null?'מחיר לפי הצעה':'₪'+p.price)+(r.active?'':' · מוסתר');
  d.append(strong,small);
  const b=document.createElement('button');b.type='button';b.textContent='עריכה';
  b.addEventListener('click',()=>{selectProduct(r.key);if(innerWidth<850)$('editor').scrollIntoView({behavior:'smooth'})});
  card.addEventListener('dragstart',e=>{dragKey=r.key;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',r.key)});
  card.addEventListener('dragover',e=>{
   if(!dragKey||dragKey===r.key)return;
   const src=products.find(x=>x.key===dragKey);
   if(src?.data.category!==p.category)return;
   e.preventDefault();e.dataTransfer.dropEffect='move';card.classList.add('drag-target');
  });
  card.addEventListener('dragleave',()=>card.classList.remove('drag-target'));
  card.addEventListener('drop',async e=>{
   e.preventDefault();card.classList.remove('drag-target');
   const moving=dragKey;dragKey=null;
   if(moving&&moving!==r.key)await reorderProduct(moving,r.key);
  });
  card.addEventListener('dragend',()=>{dragKey=null;document.querySelectorAll('.drag-target').forEach(x=>x.classList.remove('drag-target'))});
  card.append(check,img,d,b);$('list').append(card);
 }
 updateBulkUI();
}
function updateBulkUI(){
 const visible=visibleProducts();
 const number=selectedKeys.size;
 $('selected-count').textContent=number?'נבחרו '+number+' מוצרים':'לא נבחרו מוצרים';
 $('bulk-show').disabled=$('bulk-hide').disabled=!number;
 $('select-all-visible').checked=visible.length>0&&visible.every(r=>selectedKeys.has(r.key));
 $('select-all-visible').indeterminate=visible.some(r=>selectedKeys.has(r.key))&&!$('select-all-visible').checked;
}
async function reorderProduct(movingKey,targetKey){
 const src=products.find(x=>x.key===movingKey),target=products.find(x=>x.key===targetKey);
 if(!src||!target||src.data.category!==target.data.category)return;
 const category=src.data.category;
 const arranged=orderedProducts().filter(x=>x.data.category===category&&x.key!==movingKey);
 const index=arranged.findIndex(x=>x.key===targetKey);if(index<0)return;
 const before=index>0?orderNum(arranged[index-1].data):null;
 const after=orderNum(arranged[index].data);
 const newOrder=before==null?after-1:(before+after)/2;
 if(!Number.isFinite(newOrder)||newOrder===before||newOrder===after){
  message(saveStatus,'לא ניתן להכניס מוצר בין פריטים קרובים כל כך. נסו לסדר מחדש.',false);return;
 }
 const updated={...src.data,sortOrder:newOrder};
 try{
  const {error}=await db.from('dvir_products').update({data:updated}).eq('key',movingKey);
  if(error)throw error;
  src.data=updated;renderList();message(saveStatus,'סדר המוצרים עודכן באתר.',true);
 }catch(err){message(saveStatus,'שינוי סדר נכשל: '+(err.message||err))}
}
async function updateBulkVisibility(active){
 const keys=[...selectedKeys];if(!keys.length)return;
 if(!confirm((active?'להציג':'להסתיר')+' '+keys.length+' מוצרים?'))return;
 $('bulk-hide').disabled=$('bulk-show').disabled=true;
 try{
  const {error}=await db.from('dvir_products').update({active}).in('key',keys);
  if(error)throw error;
  for(const row of products)if(selectedKeys.has(row.key))row.active=active;
  selectedKeys.clear();renderList();message(saveStatus,'הזמינות עודכנה '+(active?'להצגה':'להסתרה')+'.',true);
 }catch(err){message(saveStatus,'העדכון המרוכז נכשל: '+(err.message||err))}
 finally{updateBulkUI()}
}

async function loadProducts(){const {data,error}=await db.from('dvir_products').select('key,data,active').order('key',{ascending:true}).limit(1000);
 if(error)throw error;products=data||[];selectedKeys=new Set([...selectedKeys].filter(k=>products.some(p=>p.key===k)));renderList();
 if(!editKey)selectProduct(products[0]?.key);
}
async function isAdmin(){const {data,error}=await db.rpc('dvir_is_admin');if(error)throw error;return data===true;}
async function showDashboard(){const {data:{session}}=await db.auth.getSession();if(!session){$('login-screen').classList.remove('hidden');$('dashboard').classList.add('hidden');$('logout').classList.add('hidden');return;}
 if(!await isAdmin()){await db.auth.signOut();message(loginStatus,'המשתמש הזה לא אושר לניהול. הוסף אותו בטבלת dvir_admins ב-Supabase.');return;}
 $('login-screen').classList.add('hidden');$('dashboard').classList.remove('hidden');$('logout').classList.remove('hidden');await loadProducts();
}
$('login-form').addEventListener('submit',async e=>{e.preventDefault();message(loginStatus,'מתחבר...',true);
 const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
 if(error){message(loginStatus,error.message);return}
 try{await showDashboard()}catch(err){message(loginStatus,err.message)}});
$('logout').addEventListener('click',async()=>{await db.auth.signOut();await showDashboard()});
$('search').addEventListener('input',renderList);$('category-filter').addEventListener('change',renderList);
$('new-product').addEventListener('click',()=>selectProduct(null));
$('duplicate-product').addEventListener('click',()=>{if(editKey)selectProduct(editKey,true)});
$('select-all-visible').addEventListener('change',e=>{for(const row of visibleProducts()){if(e.target.checked)selectedKeys.add(row.key);else selectedKeys.delete(row.key)}renderList()});
$('bulk-show').addEventListener('click',()=>updateBulkVisibility(true));
$('bulk-hide').addEventListener('click',()=>updateBulkVisibility(false));
$('refresh').addEventListener('click',()=>loadProducts().catch(err=>message(saveStatus,err.message)));
$('add-size').addEventListener('click',()=>sizeRow('',0));
$('image-upload').addEventListener('change',()=>{const f=$('image-upload').files?.[0];if(!f)return;const blob=URL.createObjectURL(f);$('preview').src=blob;$('preview').onload=()=>URL.revokeObjectURL(blob)});
$('multi-image-upload').addEventListener('change',()=>{const files=[...$('multi-image-upload').files||[]];
 if(files.length>5)message(saveStatus,'ניתן להעלות עד 5 תמונות נוספות בכל שמירה');
 const wrap=$('additional-image-preview');
 wrap.querySelectorAll('[data-new-preview]').forEach(x=>x.remove());
 for(const file of files.slice(0,5)){const img=document.createElement('img');const url=URL.createObjectURL(file);img.src=url;
  img.dataset.newPreview='true';img.alt='תמונה חדשה להעלאה';img.onload=()=>URL.revokeObjectURL(url);wrap.append(img);}
});
$('preview-edits').addEventListener('click',()=>{
 const form=$('editor'),f=new FormData(form);
 const sizes=[...$('sizes').children].map(row=>row.querySelector('.dimension').value+' : '+row.querySelector('.quantity').value).join('\n');
 $('admin-preview-content').textContent=[
  'שם: '+String(f.get('title')||''),'מספר דגם: '+String(f.get('label')||''),
  'קטגוריה: '+String(f.get('category')||''),'צבע: '+String(f.get('color')||''),
  'מחיר: '+(f.get('price')||'לפי הצעה'),'זמין באתר: '+($('active').checked?'כן':'לא'),
  'מידות ומלאי:',sizes,'תמונות נוספות: '+(String(f.get('extraImages')||'').split(/\r?\n/).filter(x=>x.trim()).length+[...$('multi-image-upload').files||[]].length)
 ].join('\n');
 $('admin-preview-dialog').showModal();
});
$('admin-preview-close').addEventListener('click',()=>$('admin-preview-dialog').close());
$('editor').elements.namedItem('imageurl').addEventListener('change',e=>{if(e.target.value)$('preview').src=e.target.value});
$('editor').addEventListener('submit',async e=>{e.preventDefault();const form=$('editor'),btn=$('save');btn.disabled=true;message(saveStatus,'שומר...',true);
 try{
  const f=new FormData(form);const sizeInputs=[...$('sizes').children],sizes=[],stock={};
  for(const r of sizeInputs){const size=r.querySelector('.dimension').value.trim(),num=Number(r.querySelector('.quantity').value);
    if(!size||sizes.includes(size)||!Number.isSafeInteger(num)||num<0)throw Error('לכל מידה צריך שם ייחודי ומלאי שלם שאינו שלילי');sizes.push(size);stock[size]=num;}
  if(!sizes.length)throw Error('יש להוסיף לפחות מידה אחת');
  const now=Date.now(),unique=Math.random().toString(36).slice(2,7);
  const key=editKey||'new-'+now.toString(36)+'-'+unique;
  const urls=String(f.get('extraImages')||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(urls.some(x=>!/^https:\/\//.test(x)&&!/^assets\//.test(x)))throw Error('תמונות נוספות חייבות להיות כתובות HTTPS או נתיבים קיימים בתיקיית assets');
  const obj={...(editProduct||{}),key,id:editProduct?.id??now,title:String(f.get('title')||'').trim(),label:String(f.get('label')||'').trim(),category:String(f.get('category')||''),color:String(f.get('color')||'').trim(),unit:String(f.get('unit')||'יח׳').trim(),price:f.get('price')===''?null:Number(f.get('price')),sizes,stock,images:[...new Set(urls)],sizeLabel:editProduct?.sizeLabel||'מידה'};
  if(!obj.title)throw Error('יש להזין שם מוצר');if(obj.price!=null&&(!Number.isFinite(obj.price)||obj.price<0))throw Error('מחיר לא תקין');
  const file=$('image-upload').files?.[0];
  if(file){if(file.size>10*1024*1024||!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw Error('התמונה חייבת להיות PNG/JPG/WebP/GIF עד 10MB');
    const ext=file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'');const path=`${key}/${Date.now()}-${unique}.${ext}`;
    const {error}=await db.storage.from('dvir-product-images').upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;
    obj.localImage=db.storage.from('dvir-product-images').getPublicUrl(path).data.publicUrl;
  }else if(String(f.get('imageurl')||'').trim()){
    const url=String(f.get('imageurl')).trim();if(!url.startsWith('https://'))throw Error('כתובת תמונה חייבת להיות HTTPS');obj.localImage=url;
  }
  const more=[...$('multi-image-upload').files||[]];if(more.length>5)throw Error('ניתן להעלות עד 5 תמונות נוספות בכל שמירה');
  if(obj.images.length+more.length>12)throw Error('אפשר לשמור עד 12 תמונות נוספות למוצר');
  for(let i=0;i<more.length;i++){
    const photo=more[i];
    if(photo.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(photo.type))throw Error('כל תמונה נוספת חייבת להיות PNG/JPG/WebP עד 5MB');
    const ext=photo.type==='image/png'?'png':photo.type==='image/jpeg'?'jpg':'webp';
    const imagePath=key+'/'+Date.now()+'-'+i+'-'+unique+'.'+ext;
    const {error}=await db.storage.from('dvir-product-images').upload(imagePath,photo,{contentType:photo.type,upsert:false});
    if(error)throw error;
    obj.images.push(db.storage.from('dvir-product-images').getPublicUrl(imagePath).data.publicUrl);
  }
  obj.images=[...new Set(obj.images)].filter(url=>url!==obj.localImage);
  const {error}=await db.from('dvir_products').upsert({key,data:obj,active:$('active').checked},{onConflict:'key'});
  if(error)throw error;editKey=key;editProduct=obj;await loadProducts();selectProduct(key);message(saveStatus,'נשמר! השינוי זמין באתר.',true);
 }catch(err){message(saveStatus,err.message||'שגיאה בשמירה')}finally{btn.disabled=false}
});
try{await showDashboard()}catch(e){message(loginStatus,e.message)}
})();
