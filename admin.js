'use strict';
(async function(){
const $=id=>document.getElementById(id), cfg=window.DVIR_CONFIG||{};
const loginStatus=$('login-status'),saveStatus=$('save-status');
if(!cfg.supabaseUrl||!cfg.supabaseAnonKey||!window.supabase){
  loginStatus.textContent='מערכת הניהול תופעל אחרי חיבור מסד הנתונים והגדרת config.js.';
  loginStatus.className='status err';$('login-form').querySelector('button').disabled=true;return;
}
const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
let products=[],editKey=null,editProduct=null;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const message=(el,s,ok=false)=>{el.textContent=s;el.className='status '+(ok?'ok':'err')};
function sizeRow(size='',qty=0){let d=document.createElement('div');d.className='size-row';
 const input=document.createElement('input');input.value=size;input.placeholder='מידה, למשל 45×45';input.className='dimension';input.required=true;
 const n=document.createElement('input');n.className='quantity';n.type='number';n.min='0';n.step='1';n.value=qty;n.required=true;
 const b=document.createElement('button');b.type='button';b.textContent='הסרה';b.addEventListener('click',()=>d.remove());d.append(input,n,b);$('sizes').appendChild(d);
}
function selectProduct(key){const row=products.find(r=>r.key===key);editKey=row?.key||null;editProduct=row?structuredClone(row.data):null;
 const obj=editProduct||{key:'',title:'',label:'',category:'pillows',price:null,color:'',unit:'יח׳',stock:{'יחידה':0},sizes:['יחידה'],localImage:''};
 $('editor-title').textContent=row?'עריכת '+obj.title:'הוספת מוצר חדש';
 const f=$('editor');for(const n of ['title','label','category','color','unit']) f.elements.namedItem(n).value=obj[n]||'';
 f.elements.namedItem('price').value=obj.price==null?'':obj.price;
 f.elements.namedItem('imageurl').value=/^https:\/\//.test(obj.localImage||'')?obj.localImage:'';
 $('image-upload').value='';$('sizes').replaceChildren();for(const s of obj.sizes||[])sizeRow(s,obj.stock?.[s]??0);
 $('active').checked=row?row.active:true;
 $('preview').src=obj.localImage||'assets/placeholder.svg';saveStatus.textContent='';
}
function renderList(){const q=$('search').value.trim().toLowerCase(),cat=$('category-filter').value;
 const matching=products.filter(r=>(!cat||r.data.category===cat)&&`${r.data.title} ${r.data.label||''} ${r.key}`.toLowerCase().includes(q));
 $('count').textContent=`(${matching.length})`;
 $('list').replaceChildren();for(const r of matching){const p=r.data;const card=document.createElement('div');card.className='item';
 const img=document.createElement('img');img.src=p.localImage||'assets/placeholder.svg';img.alt='';img.onerror=()=>{img.onerror=null;img.src='assets/placeholder.svg'};
 const d=document.createElement('div');const strong=document.createElement('strong');strong.textContent=p.title;const small=document.createElement('small');small.textContent=(p.label||r.key)+' · '+(p.price==null?'מחיר לפי הצעה':'₪'+p.price)+(r.active?'':' · מוסתר');d.append(strong,small);
 const b=document.createElement('button');b.type='button';b.textContent='עריכה';b.addEventListener('click',()=>{selectProduct(r.key);if(innerWidth<850)$('editor').scrollIntoView({behavior:'smooth'})});
 card.append(img,d,b);$('list').append(card)}
}
async function loadProducts(){const {data,error}=await db.from('dvir_products').select('key,data,active').order('key',{ascending:true}).limit(1000);
 if(error)throw error;products=data||[];renderList();if(!editKey)selectProduct(products[0]?.key);
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
$('new-product').addEventListener('click',()=>selectProduct(null));$('refresh').addEventListener('click',()=>loadProducts().catch(err=>message(saveStatus,err.message)));
$('add-size').addEventListener('click',()=>sizeRow('',0));
$('image-upload').addEventListener('change',()=>{const f=$('image-upload').files?.[0];if(!f)return;const blob=URL.createObjectURL(f);$('preview').src=blob;$('preview').onload=()=>URL.revokeObjectURL(blob)});
$('editor').elements.namedItem('imageurl').addEventListener('change',e=>{if(e.target.value)$('preview').src=e.target.value});
$('editor').addEventListener('submit',async e=>{e.preventDefault();const form=$('editor'),btn=$('save');btn.disabled=true;message(saveStatus,'שומר...',true);
 try{
  const f=new FormData(form);const sizeInputs=[...$('sizes').children],sizes=[],stock={};
  for(const r of sizeInputs){const size=r.querySelector('.dimension').value.trim(),num=Number(r.querySelector('.quantity').value);
    if(!size||sizes.includes(size)||!Number.isSafeInteger(num)||num<0)throw Error('לכל מידה צריך שם ייחודי ומלאי שלם שאינו שלילי');sizes.push(size);stock[size]=num;}
  if(!sizes.length)throw Error('יש להוסיף לפחות מידה אחת');
  const now=Date.now(),unique=Math.random().toString(36).slice(2,7);
  const key=editKey||'new-'+now.toString(36)+'-'+unique;
  const obj={...(editProduct||{}),key,id:editProduct?.id??now,title:String(f.get('title')||'').trim(),label:String(f.get('label')||'').trim(),category:String(f.get('category')||''),color:String(f.get('color')||'').trim(),unit:String(f.get('unit')||'יח׳').trim(),price:f.get('price')===''?null:Number(f.get('price')),sizes,stock,sizeLabel:editProduct?.sizeLabel||'מידה'};
  if(!obj.title)throw Error('יש להזין שם מוצר');if(obj.price!=null&&(!Number.isFinite(obj.price)||obj.price<0))throw Error('מחיר לא תקין');
  const file=$('image-upload').files?.[0];
  if(file){if(file.size>10*1024*1024||!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw Error('התמונה חייבת להיות PNG/JPG/WebP/GIF עד 10MB');
    const ext=file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'');const path=`${key}/${Date.now()}-${unique}.${ext}`;
    const {error}=await db.storage.from('dvir-product-images').upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;
    obj.localImage=db.storage.from('dvir-product-images').getPublicUrl(path).data.publicUrl;
  }else if(String(f.get('imageurl')||'').trim()){
    const url=String(f.get('imageurl')).trim();if(!url.startsWith('https://'))throw Error('כתובת תמונה חייבת להיות HTTPS');obj.localImage=url;
  }
  const {error}=await db.from('dvir_products').upsert({key,data:obj,active:$('active').checked},{onConflict:'key'});
  if(error)throw error;editKey=key;editProduct=obj;await loadProducts();selectProduct(key);message(saveStatus,'נשמר! השינוי זמין באתר.',true);
 }catch(err){message(saveStatus,err.message||'שגיאה בשמירה')}finally{btn.disabled=false}
});
try{await showDashboard()}catch(e){message(loginStatus,e.message)}
})();
