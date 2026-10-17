'use strict';
// The presentation is preserved from DVIR DESIGNS v10. Product data is not hardcoded.
(async function startDvirDesigns(){
let PRODUCTS = [];
const backend=window.DVIR_CONFIG || {};
const dbEnabled=!!(backend.supabaseUrl && backend.supabaseAnonKey);
const apiRoot=String(backend.supabaseUrl||'').replace(/\/$/,'');
async function fetchCatalog(){
  if(dbEnabled){
    const r=await fetch(apiRoot+'/rest/v1/dvir_products?select=key,data,active&active=eq.true&order=key.asc&limit=1000',{
      headers:{apikey:backend.supabaseAnonKey},cache:'no-store'});
    if(!r.ok)throw new Error('Database read failed ('+r.status+')');
    return (await r.json()).map(row=>row.data).filter(x=>x&&x.key).sort((a,b)=>{
      const order={pillows:0,curtains:1,tables:2};
      const group=(order[a.category]??99)-(order[b.category]??99);
      const number=p=>Number(String(p.key).match(/\d+/)?.[0]??999999);
      return group || number(a)-number(b);
    });
  }
  const r=await fetch('./products.json',{cache:'no-store'});
  if(!r.ok)throw new Error('Could not load catalog');
  return await r.json();
}
try{PRODUCTS=await fetchCatalog();}catch(err){
  console.error(err);
  document.getElementById('catalog-disclaimer').textContent='אירעה שגיאה בטעינת הקטלוג. נסו שוב בעוד כמה דקות.';
  return;
}

const $=id=>document.getElementById(id);
const getAll=q=>Array.from(document.querySelectorAll(q));
let byKey = new Map(PRODUCTS.map(p=>[p.key,p]));
const money=n=>'₪'+Number(n).toLocaleString('he-IL');
const html=s=>String(s??'').replace(/[&<>"']/g,t=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[t]));
const storageKey='dvir_figma_cart_v1';
const cartKey=(id,size)=>JSON.stringify([id,size]);
let cart={},current='home',category='pillows',sizeFilter='',search='',page=1,lastSharedToken='';
let toastTimer;
function loadCart(){try{return JSON.parse(localStorage.getItem(storageKey)||'{}')}catch{return {}}}
function saveCart(){try{localStorage.setItem(storageKey,JSON.stringify(cart))}catch{}}
function sanitiseCart(c){const result={};if(!c||typeof c!=='object')return result;
  for(const [key,value] of Object.entries(c)){
    let pair;try{pair=JSON.parse(key)}catch{continue}
    const [id,s]=pair||[];const p=byKey.get(id);const exact=p?.stock?.[s];const limit=exact==null?99:Number(exact);
    const qty=Number(value);if(!p||!p.sizes.includes(s)||limit<=0||!Number.isFinite(qty)||qty<=0)continue;
    result[key]=Math.max(1,Math.min(Math.floor(qty),limit));
  }return result;
}
cart=sanitiseCart(loadCart());
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2700)}
function show(view){for(const v of getAll('.view')){v.hidden=true;v.classList.remove('is-current')}
  const el=$('view-'+view);if(el){el.hidden=false;el.classList.add('is-current')}
  current=view;
  document.title=(view==='home'?'קולקציות הטקסטיל שלנו':'קטלוג '+(category==='pillows'?'כריות':category==='curtains'?'וילונות':category==='tables'?'מפות':'מוצרים'))+' · DVIR DESIGNS';
  window.scrollTo({top:0,behavior:'instant'});
}
function changeLocation(type,updateHash=true){
  if(type==='home'){show('home')}
  else{
    category=['pillows','curtains','tables','all'].includes(type)?type:'pillows';
    page=1;search='';sizeFilter='';$('search-products').value='';
    getAll('[data-size]').forEach(b=>b.classList.toggle('active',b.dataset.size===''));
    getAll('[data-category]').forEach(b=>b.classList.toggle('active',b.dataset.category===category));
    const titles={pillows:'קטלוג כריות',curtains:'קטלוג וילונות',tables:'קטלוג מפות',all:'הקטלוג המלא'};
    $('catalog-heading').textContent=titles[category];
    $('catalog-subtitle').textContent='בחרו פריטים, מידות וכמויות והוסיפו אותם לסל.';
    const tables=false;$('tables-empty').hidden=true;
    $('products-grid').hidden=false;$('pagination').hidden=false;$('no-results').hidden=true;
    $('filters-area').hidden=(category==='curtains'||category==='tables');$('result-line').hidden=false;
    show('catalog');if(!tables)renderCatalog();
  }
  if(updateHash){try{history.replaceState(null,'',location.pathname+location.search+'#'+type)}catch(_){}}
}
function filtered(){let result=PRODUCTS.filter(p=>category==='all'||p.category===category);
  if(sizeFilter)result=result.filter(p=>p.sizes.some(s=>s===sizeFilter||sizeFilter==='נקניק'&&(s.includes('נקניק')||s.includes('גליל'))));
  if(search.trim()){const q=search.trim().toLocaleLowerCase('he');result=result.filter(p=>`${p.title} ${p.color} ${p.fabric||''} ${p.id}`.toLocaleLowerCase('he').includes(q))}
  return result;
}
function picture(p){return html(p.localImage||p.image||'')}
function stockText(p,s){const n=p.stock?.[s];return n==null?'מלאי: יש לאמת מול העסק':`מלאי: ${Number(n)} ${html(p.unit||'יח׳')}`}
function itemCaption(p){if(p.category==='pillows')return 'P-'+String(p.id).padStart(3,'0');if(p.label)return html(p.label);return html(p.title)}
function renderCard(p){
 const priced=p.price!==null&&p.price!==undefined;
 const selected=p.sizes[0];
 const available=Boolean(picture(p));
 const showSizeSelector=p.category!=='curtains'&&p.sizes.length>1;
 const options=p.sizes.map(s=>`<option value="${html(s)}">${html(s)}</option>`).join('');
 const image=available?`<button type="button" class="product-photo-trigger" data-zoom="${html(p.key)}" title="הגדלת התמונה" aria-label="הגדלת תמונה של ${html(p.title)}"><img src="${picture(p)}" alt="${html(p.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.hidden=true;this.closest('.product-photo').classList.add('is-broken')"></button>`:'';
 const origin=p.category==='curtains'?'https://dvir-designs.squarespace.com/curtains':p.category==='tables'?'https://dvir-designs.squarespace.com/pillows-1':'';
 const unavailable=origin?`<a class="source-photo-link" href="${origin}" target="_blank" rel="noopener noreferrer">צפייה בקטלוג התמונות המקורי ↗</a>`:'';
 const subtitle=p.category==='curtains'&&p.height?`<span class="product-extra">גובה מרבי: ${p.height} מטר</span>`:'';
 const extraDetails=showSizeSelector?`<label for="size-${html(p.key)}">בחירת מידה</label><select class="product-size" id="size-${html(p.key)}" data-size-for="${html(p.key)}">${options}</select>`:'';
 return `<article class="product-card" data-key="${html(p.key)}" aria-label="${html(p.title)}">
   <div class="product-photo${available?'':' is-broken'}">${image}<div class="picture-warning"><span class="photo-icon">◈</span><span>תמונת דגם טרם זמינה</span>${unavailable}</div></div>
   <h3 class="product-title">${itemCaption(p)}</h3>
   ${p.category!=='pillows'?`<div class="product-descriptor">${html(p.title)}</div>`:''}
   <div class="product-price">${priced?money(p.price):'מחיר לפי בירור'}</div>
   <div class="product-size-label">${html(p.color||'')}</div>
   ${subtitle}
   <div class="product-options" data-single-size="${!showSizeSelector}">
     ${extraDetails}
     <div class="product-stock" id="stock-${html(p.key)}">${stockText(p,selected)}</div>
     <button type="button" class="product-add" data-add="${html(p.key)}">הוספה לסל +</button>
   </div>
 </article>`;
}
function promoteOriginalPictures(container){
  // Imported Figma-mapped local images are authoritative. No remote swaps.
}

function renderCatalog(){const rows=filtered();const perPage=10;const pages=Math.max(1,Math.ceil(rows.length/perPage));page=Math.min(Math.max(page,1),pages);
  $('result-line').textContent=`${rows.length} פריטים · עמוד ${page} מתוך ${pages}`;
  const items=rows.slice((page-1)*perPage,page*perPage);
  $('products-grid').innerHTML=items.map(renderCard).join('');
  promoteOriginalPictures($('products-grid'));
  $('no-results').hidden=rows.length!==0;
  let nav='';if(pages>1){
    nav+=`<button data-page="${page-1}" ${page===1?'disabled':''} aria-label="העמוד הקודם">‹ הקודם</button>`;
    const show=new Set([1,pages,page,page-1,page+1].filter(x=>x>=1&&x<=pages));let last=0;
    for(const n of [...show].sort((a,b)=>a-b)){if(n-last>1)nav+='<span class="page-ellipsis">…</span>';nav+=`<button data-page="${n}" class="${page===n?'active':''}" ${page===n?'aria-current="page"':''}>${n}</button>`;last=n}
    nav+=`<button data-page="${page+1}" ${page===pages?'disabled':''} aria-label="העמוד הבא">הבא ›</button>`;
  }
  $('pagination').innerHTML=nav;
}
function cartRows(){return Object.entries(cart).map(([key,qty])=>{const [id,size]=JSON.parse(key);return {p:byKey.get(id),size,qty,key}}).filter(x=>x.p)}
function count(){return Object.values(cart).reduce((a,n)=>a+Number(n),0)}
function renderCart(){const rows=cartRows(),n=count();$('cart-count').textContent=n;$('cart-count').hidden=!n;$('basket-number').textContent=n?'('+n+')':'';
  $('cart-list').innerHTML=rows.length?rows.map(({p,size,qty,key})=>`<div class="cart-line"><button class="cart-photo-trigger" type="button" data-zoom="${html(p.key)}" title="הגדלת התמונה" aria-label="הגדלת תמונה של ${html(p.title)}"><img src="${picture(p)||'assets/placeholder.svg'}" onerror="this.onerror=null;this.src='assets/placeholder.svg'" alt=""></button><div><strong>${html(p.title)}</strong><div class="meta">${p.sizes.length>1?`<label class="sr-only" for="cart-size-${html(p.key)}">שינוי מידה</label><select class="cart-size-select" id="cart-size-${html(p.key)}" data-cart-size="${html(key)}">${p.sizes.map(z=>`<option value="${html(z)}" ${z===size?'selected':''}>${html(z)}</option>`).join('')}</select>`:p.category==='curtains'?'':html(size)}${p.category==='curtains'?'':' · '}${html(p.color)}</div><div class="price">${p.price!=null?money(p.price*qty):'מחיר לפי הצעה'}</div><div class="quantity-row"><button data-action="plus" data-key="${html(key)}" aria-label="הוספת יחידה">+</button><span>${qty}</span><button data-action="minus" data-key="${html(key)}" aria-label="הפחתת יחידה">−</button><button class="remove" data-action="remove" data-key="${html(key)}">הסרה</button></div></div></div>`).join(''):'<div class="cart-empty"><span class="symbol">♡</span>הסל ריק כרגע.<br>בחרו מוצרים מהקטלוג.</div>';
  promoteOriginalPictures($('cart-list'));
  $('total').textContent=money(rows.reduce((t,{p,qty})=>t+(p.price||0)*qty,0));
  $('pricing-note').hidden=!rows.some(({p})=>p.price==null);
  $('share-cart').disabled=!rows.length;$('copy-cart').disabled=!rows.length;
  if(!$('share-link-box').hidden && lastSharedToken!==encodeShare()){$('share-link-box').hidden=true;lastSharedToken='';}
}
function addToCart(id,s){const p=byKey.get(id);const exact=p?.stock?.[s];const max=exact==null?99:Number(exact);if(!max)return toast('הפריט אינו זמין במידה הזאת');
  const key=cartKey(id,s);if((cart[key]||0)>=max)return toast('הגעת לכמות המלאי המרבית');cart[key]=(cart[key]||0)+1;saveCart();renderCart();toast('המוצר נוסף לסל');
}
function changeQty(key,diff){if(!(key in cart))return;let [id,size]=JSON.parse(key);let p=byKey.get(id);if(!p)return;
  const next=Math.min(p.stock[size]==null?99:Number(p.stock[size]),cart[key]+diff);if(next<=0)delete cart[key];else cart[key]=next;saveCart();renderCart()}
function updateCartSize(key,newSize){
  if(!(key in cart))return;
  let id,oldSize;try{[id,oldSize]=JSON.parse(key)}catch{return}
  const p=byKey.get(id);
  if(!p||!p.sizes.includes(newSize)||oldSize===newSize)return;
  const newKey=cartKey(id,newSize),limit=p.stock?.[newSize]==null?99:Number(p.stock[newSize]);
  if(limit<=0){toast('המידה שנבחרה אינה זמינה');renderCart();return}
  const previous=cart[newKey]||0,total=previous+cart[key],quantity=Math.min(limit,total);
  delete cart[key];cart[newKey]=quantity;saveCart();renderCart();
  if(total>limit)toast('הכמות הותאמה למלאי הזמין');
}
function openCart(){renderCart();$('cart-scrim').hidden=false;$('cart-panel').classList.add('is-open');$('cart-panel').setAttribute('aria-hidden','false');document.body.classList.add('cart-open');$('close-cart').focus()}
function closeCart(){ $('cart-panel').classList.remove('is-open');$('cart-panel').setAttribute('aria-hidden','true');$('cart-scrim').hidden=true;document.body.classList.remove('cart-open') }
function encodeShare(){const raw=JSON.stringify([1,cartRows().map(({p,size,qty})=>[p.key,size,qty])]);const bytes=new TextEncoder().encode(raw);let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function decodeShare(token){if(!token||token.length>20000)throw Error('invalid');const b64=token.replace(/-/g,'+').replace(/_/g,'/');const bin=atob(b64.padEnd(Math.ceil(b64.length/4)*4,'='));const bytes=Uint8Array.from(bin,ch=>ch.charCodeAt(0));const [version,items]=JSON.parse(new TextDecoder().decode(bytes));if(version!==1||!Array.isArray(items)||items.length>300)throw Error('invalid');const value={};for(const [id,size,n] of items)value[cartKey(id,size)]=Number(n);return sanitiseCart(value)}
async function copy(text){try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true}}catch(e){}
  const el=document.createElement('textarea');el.value=text;el.style.cssText='position:fixed;left:-2000px';document.body.appendChild(el);el.focus();el.select();let ok;try{ok=document.execCommand('copy')}catch(e){ok=false}el.remove();if(!ok)window.prompt('העתיקו את הטקסט:',text);return Boolean(ok)}
function cartDescription(){let parts=['DVIR DESIGNS — סל מוצרים',''];for(const {p,size,qty} of cartRows())parts.push(`${p.title} | ${p.color}${p.category==='curtains'?'':' | '+size} | כמות: ${qty} | ${p.price!=null?money(p.price*qty):'מחיר לפי הצעה'}`);parts.push('',`סכום ידוע: ${$('total').textContent}`,'המחירים והמלאי כפופים לאישור העסק.');return parts.join('\n')}
const zoomDialog=$('image-lightbox');
let zoomOrigin=null;
function openZoom(key){
  const p=byKey.get(key),src=p?.localImage||p?.image;
  if(!src||zoomDialog.open)return;
  zoomOrigin=document.activeElement;
  $('zoom-image').src=src;
  $('zoom-image').alt=p.title||'תמונת מוצר';
  $('zoom-caption').textContent=p.title||'תמונת מוצר';
  zoomDialog.showModal();
  $('zoom-close').focus();
}
function closeZoom(){if(zoomDialog.open)zoomDialog.close()}
$('zoom-close').addEventListener('click',closeZoom);
zoomDialog.addEventListener('click',e=>{if(e.target===zoomDialog)closeZoom()});
zoomDialog.addEventListener('close',()=>{
  $('zoom-image').removeAttribute('src');
  if(zoomOrigin?.isConnected)zoomOrigin.focus({preventScroll:true});
  zoomOrigin=null;
});
function readHash(){const tag=location.hash.replace('#','');changeLocation(['pillows','curtains','tables','all','home'].includes(tag)?tag:'home',false)}
getAll('[data-nav]').forEach(node=>node.addEventListener('click',e=>{e.preventDefault();changeLocation(node.dataset.nav)}));
getAll('[data-category]').forEach(node=>node.addEventListener('click',()=>changeLocation(node.dataset.category)));
getAll('[data-size]').forEach(node=>node.addEventListener('click',()=>{sizeFilter=node.dataset.size;page=1;getAll('[data-size]').forEach(b=>b.classList.toggle('active',b===node));renderCatalog()}));
$('search-products').addEventListener('input',e=>{search=e.target.value;page=1;renderCatalog()});
$('products-grid').addEventListener('change',e=>{const key=e.target.dataset.sizeFor;if(!key)return;const p=byKey.get(key);$('stock-'+key).textContent=stockText(p,e.target.value)});
$('products-grid').addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(!b)return;const key=b.dataset.add;addToCart(key,$('size-'+key)?.value || byKey.get(key)?.sizes?.[0])});
$('products-grid').addEventListener('click',e=>{const button=e.target.closest('.product-photo-trigger[data-zoom]');if(button && !button.closest('.product-photo')?.classList.contains('is-broken'))openZoom(button.dataset.zoom)});
$('pagination').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b)return;page=Number(b.dataset.page);renderCatalog();window.scrollTo({top:0,behavior:'smooth'})});
$('cart-trigger').addEventListener('click',openCart);$('close-cart').addEventListener('click',closeCart);$('cart-scrim').addEventListener('click',closeCart);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('cart-panel').classList.contains('is-open'))closeCart()});
$('cart-list').addEventListener('change',e=>{const field=e.target.closest('[data-cart-size]');if(field)updateCartSize(field.dataset.cartSize,field.value)});
$('cart-list').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;changeQty(b.dataset.key,b.dataset.action==='plus'?1:b.dataset.action==='minus'?-1:-100000)});
$('cart-list').addEventListener('click',e=>{const b=e.target.closest('.cart-photo-trigger[data-zoom]');if(b)openZoom(b.dataset.zoom)});
$('share-cart').addEventListener('click',async()=>{
  if(!count())return;
  const token=encodeShare();
  const url=new URL(location.href);
  url.hash='#all';url.searchParams.set('cart',token);
  lastSharedToken=token;
  $('share-link-box').hidden=false;
  $('share-link-input').value=url.href;
  const locally=location.protocol==='file:'||location.protocol==='about:';
  $('share-hint').textContent=locally
    ? 'זוהי הדגמה מקומית בלבד. כדי לשלוח את הסל למישהו אחר, יש לפרסם את האתר ואז ליצור שוב קישור.'
    : 'זהו קישור לסל שבחרתם, ללא תשלום. מי שיפתח אותו יראה את הפריטים והכמויות באתר.';
  if(locally){toast('הקישור נוצר להדגמה. לשיתוף אמיתי יש לפרסם את האתר.');return;}
  const ok=await copy(url.href);
  toast(ok?'הקישור לסל נוצר והועתק':'הקישור מוכן להעתקה');
});
$('copy-share-link').addEventListener('click',async()=>{
  const link=$('share-link-input').value;if(!link)return;
  const ok=await copy(link);
  toast(ok?'הקישור הועתק':'ניתן לסמן ולהעתיק את הקישור בשדה');
});
$('share-link-input').addEventListener('focus',e=>e.target.select());
$('copy-cart').addEventListener('click',async()=>toast(await copy(cartDescription())?'רשימת המוצרים הועתקה':'העתיקו את הרשימה מהחלון'));
window.addEventListener('hashchange',readHash);
readHash();renderCart();
const shared=new URLSearchParams(location.search).get('cart');
if(shared){try{cart=decodeShare(shared);saveCart();renderCart();openCart();toast('הסל המשותף נטען')}catch(e){toast('לא ניתן לפתוח את קישור הסל')}}

if(dbEnabled){
  $('catalog-disclaimer').textContent='פרטי המוצרים מתעדכנים ממערכת הניהול. המחיר והמלאי הסופיים כפופים לאישור העסק.';
  document.querySelector('.cart-bottom .cart-disclaimer:last-child').textContent='קישור הסל מאפשר שיתוף רשימת מוצרים ואינו מהווה הזמנה או תשלום. המלאי עשוי להשתנות עד לאישור העסק.';
  const reload=async()=>{
    try{
      const newProducts=await fetchCatalog();
      PRODUCTS=newProducts;byKey=new Map(PRODUCTS.map(x=>[x.key,x]));
      cart=sanitiseCart(cart);saveCart();
      if(current==='catalog')renderCatalog();renderCart();
    }catch(e){console.warn('Catalog sync delayed',e)}
  };
  // Update on visitor return and periodically while the store is open.
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)reload()});
  setInterval(()=>{if(!document.hidden)reload()},60000);
}
})();
