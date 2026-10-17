'use strict';
// The presentation is preserved from DVIR DESIGNS v10. Product data is not hardcoded.
(async function startDvirDesigns(){
let PRODUCTS = [];
const backend=window.DVIR_CONFIG || {};
const dbEnabled=!!(backend.supabaseUrl && backend.supabaseAnonKey);
const apiRoot=String(backend.supabaseUrl||'').replace(/\/$/,'');
async function fetchCatalog(){
  if(dbEnabled){
    try{
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),8000);
      let r;
      try{
        r=await fetch(apiRoot+'/rest/v1/dvir_products?select=key,data,active&active=eq.true&order=key.asc&limit=1000',{
          headers:{apikey:backend.supabaseAnonKey},cache:'no-store',signal:controller.signal});
      }finally{clearTimeout(timeout)}
      if(!r.ok)throw new Error('Database read failed ('+r.status+')');
      const rows=await r.json();
      if(!Array.isArray(rows)||!rows.length)throw new Error('Database returned no active products');
      return rows.map(row=>row.data).filter(x=>x&&x.key).sort((a,b)=>{
        const order={pillows:0,curtains:1,tables:2};
        const group=(order[a.category]??99)-(order[b.category]??99);
        const number=p=>Number(String(p.key).match(/\d+/)?.[0]??999999);
        return group || number(a)-number(b);
      });
    }catch(error){
      console.warn('Live catalog temporarily unavailable; using published catalog backup',error);
    }
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
const offersStorageKey='dvir_customer_price_offers_v1';
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
function normalizeOffer(value){
  if(value==null||String(value).trim()==='')return null;
  const number=Number(value);
  if(!Number.isFinite(number)||number<=0||number>1000000)return null;
  return Math.round(number*100)/100 || null;
}
function sanitiseOffers(values,forCart=cart){
  const clean={};
  if(!values||typeof values!=='object'||Array.isArray(values))return clean;
  for(const [key,value] of Object.entries(values)){
    if(!Object.prototype.hasOwnProperty.call(forCart,key))continue;
    let id;try{[id]=JSON.parse(key)}catch{continue}
    const p=byKey.get(id),offer=normalizeOffer(value);
    if(p&&p.price==null&&offer!=null)clean[key]=offer;
  }
  return clean;
}
function loadOffers(){try{return JSON.parse(localStorage.getItem(offersStorageKey)||'{}')}catch{return {}}}
function saveOffers(){try{localStorage.setItem(offersStorageKey,JSON.stringify(priceOffers))}catch{}}
let priceOffers=sanitiseOffers(loadOffers());
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
  if(search.trim()){
    const normalized=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('he-IL');
    const compact=s=>normalized(s).replace(/[\s\-–—_]+/g,'');
    const q=normalized(search).trim(),qc=compact(q);
    result=result.filter(p=>{
      const id=p.category==='pillows'?'P-'+String(p.id).padStart(3,'0')
        :p.category==='curtains'?'C-'+String(p.id).padStart(3,'0'):String(p.label||'');
      const tokens=[p.key,p.id,id,p.label,p.title,p.color,p.fabric,p.sizeLabel,p.unit].filter(v=>v!==undefined&&v!==null);
      return tokens.some(value=>normalized(value).includes(q)||(qc&&compact(value).includes(qc)));
    });
  }
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

function renderCatalog(){
  const rows=filtered(),perBatch=12,totalShown=Math.min(rows.length,page*perBatch);
  $('result-line').textContent=rows.length+' פריטים · מוצגים '+totalShown;
  $('products-grid').innerHTML=rows.slice(0,totalShown).map(renderCard).join('');
  hydrateCleanImages($('products-grid'));
  $('no-results').hidden=rows.length!==0;
  const remaining=rows.length-totalShown;
  $('pagination').innerHTML=remaining>0
    ? '<button type="button" class="load-more-products" data-load-more>הצג עוד מוצרים ('+remaining+' נותרו) ↓</button>':'';
}
function cartRows(){return Object.entries(cart).map(([key,qty])=>{const [id,size]=JSON.parse(key);return {p:byKey.get(id),size,qty,key}}).filter(x=>x.p)}
function count(){return Object.values(cart).reduce((a,n)=>a+Number(n),0)}
function offerControl(p,key){
  if(p.price!=null)return '';
  const value=priceOffers[key]==null?'':String(priceOffers[key]);
  return '<label class="price-offer-label">הצעת המחיר שלך ליחידה (₪)'
    +'<input type="number" class="price-offer-input" data-offer-for="'+html(key)+'" value="'+html(value)+'" placeholder="הזנת מחיר" min="0.01" max="1000000" step="0.01" inputmode="decimal" dir="ltr" aria-label="הצעת מחיר ליחידה עבור '+html(p.title)+'">'
    +'</label>';
}
function itemPriceText(p,key,qty){
  if(p.price!=null)return money(p.price*qty);
  return priceOffers[key]!=null?'הצעתך: '+money(priceOffers[key]*qty)+' (ליחידה '+money(priceOffers[key])+')':'ללא מחיר קבוע — אפשר להציע מחיר';
}
function updateCartSummary(){
  const rows=cartRows();
  const total=rows.reduce((sum,{p,key,qty})=>sum+(p.price!=null?p.price:(priceOffers[key]??0))*qty,0);
  const proposed=rows.some(({p,key})=>p.price==null&&priceOffers[key]!=null);
  const missing=rows.some(({p,key})=>p.price==null&&priceOffers[key]==null);
  const distinctModels=new Set(rows.map(({p})=>p.key)).size;
  const quantity=rows.reduce((sum,row)=>sum+row.qty,0);
  $('cart-overview').textContent=rows.length
    ? distinctModels+' דגמים · '+quantity+' יחידות בסל'
    : 'הסל ריק';
  $('cart-total-label').textContent=proposed&&missing
    ? 'סכום חלקי משוער'
    : proposed?'סכום משוער (כולל הצעות)'
    : missing?'סכום חלקי — מחירים ידועים'
    :'סכום ביניים';
  $('total').textContent=money(Math.round(total*100)/100);
  $('pricing-note').hidden=!(proposed||missing);
  $('pricing-note').textContent=proposed&&missing
    ? 'הסכום כולל הצעות מחיר שלך. מוצרים ללא הצעה אינם נכללים בסכום. כל הצעה כפופה לאישור העסק.'
    :proposed?'הסכום כולל הצעות מחיר שהזנת — אלה אינן מחירים שאושרו על ידי העסק.'
    :'יש מוצרים ללא מחיר קבוע וללא הצעה, ולכן הם אינם נכללים בסכום.';
  if(!$('share-link-box').hidden&&lastSharedToken!==encodeShare()){
    $('share-link-box').hidden=true;lastSharedToken='';
  }
}
function renderCart(){const rows=cartRows(),n=count();$('cart-count').textContent=n;$('cart-count').hidden=!n;$('basket-number').textContent=n?'('+n+')':'';
  $('cart-list').innerHTML=rows.length?rows.map(({p,size,qty,key})=>`<div class="cart-line"><button class="cart-photo-trigger" type="button" data-zoom="${html(p.key)}" title="הגדלת התמונה" aria-label="הגדלת תמונה של ${html(p.title)}"><img src="${picture(p)||'assets/placeholder.svg'}" onerror="this.onerror=null;this.src='assets/placeholder.svg'" alt=""></button><div class="cart-product-details"><div class="cart-model">דגם ${itemCaption(p)}</div><strong>${html(p.title)}</strong><div class="meta">${p.sizes.length>1?`<label class="sr-only" for="cart-size-${html(p.key)}">שינוי מידה</label><select class="cart-size-select" id="cart-size-${html(p.key)}" data-cart-size="${html(key)}">${p.sizes.map(z=>`<option value="${html(z)}" ${z===size?'selected':''}>${html(z)}</option>`).join('')}</select>`:p.category==='curtains'?'':html(size)}${p.category==='curtains'?'':' · '}${html(p.color)}</div><div class="price">${itemPriceText(p,key,qty)}</div>${offerControl(p,key)}<div class="quantity-row"><button data-action="plus" data-key="${html(key)}" aria-label="הוספת יחידה">+</button><span>${qty}</span><button data-action="minus" data-key="${html(key)}" aria-label="הפחתת יחידה">−</button><button class="remove" data-action="remove" data-key="${html(key)}">הסרה</button></div></div></div>`).join(''):'<div class="cart-empty"><span class="symbol">♡</span>הסל ריק כרגע.<br>בחרו מוצרים מהקטלוג.</div>';
  hydrateCleanImages($('cart-list'));
  updateCartSummary();
  $('share-cart').disabled=!rows.length;$('copy-cart').disabled=!rows.length;$('whatsapp-share').disabled=!rows.length;

}
function addToCart(id,s){const p=byKey.get(id);const exact=p?.stock?.[s];const max=exact==null?99:Number(exact);if(!max)return toast('הפריט אינו זמין במידה הזאת');
  const key=cartKey(id,s);if((cart[key]||0)>=max)return toast('הגעת לכמות המלאי המרבית');cart[key]=(cart[key]||0)+1;saveCart();renderCart();toast('המוצר נוסף לסל');
}
function changeQty(key,diff){if(!(key in cart))return;let [id,size]=JSON.parse(key);let p=byKey.get(id);if(!p)return;
  const next=Math.min(p.stock[size]==null?99:Number(p.stock[size]),cart[key]+diff);if(next<=0){delete cart[key];delete priceOffers[key];saveOffers()}else cart[key]=next;saveCart();renderCart()}
function updateCartSize(key,newSize){
  if(!(key in cart))return;
  let id,oldSize;try{[id,oldSize]=JSON.parse(key)}catch{return}
  const p=byKey.get(id);
  if(!p||!p.sizes.includes(newSize)||oldSize===newSize)return;
  const newKey=cartKey(id,newSize),limit=p.stock?.[newSize]==null?99:Number(p.stock[newSize]);
  if(limit<=0){toast('המידה שנבחרה אינה זמינה');renderCart();return}
  const previous=cart[newKey]||0,total=previous+cart[key],quantity=Math.min(limit,total);
  const oldOffer=priceOffers[key];delete priceOffers[key];
  if(p.price==null&&oldOffer!=null&&priceOffers[newKey]==null)priceOffers[newKey]=oldOffer;
  delete cart[key];cart[newKey]=quantity;saveCart();saveOffers();renderCart();
  if(total>limit)toast('הכמות הותאמה למלאי הזמין');
}
function openCart(){renderCart();$('cart-scrim').hidden=false;$('cart-panel').classList.add('is-open');$('cart-panel').setAttribute('aria-hidden','false');document.body.classList.add('cart-open');$('close-cart').focus()}
function closeCart(){ $('cart-panel').classList.remove('is-open');$('cart-panel').setAttribute('aria-hidden','true');$('cart-scrim').hidden=true;document.body.classList.remove('cart-open') }
function normalizeCustomerName(value){
  return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
}
function customerName(){return normalizeCustomerName($('customer-name').value)}
function requireCustomerName(){
  const name=customerName(),field=$('customer-name');
  const missing=!name;
  $('customer-name-error').hidden=!missing;
  field.setAttribute('aria-invalid',missing?'true':'false');
  if(missing){toast('יש להזין שם לקוח לפני שיתוף הסל');field.focus();return null}
  field.value=name;
  return name;
}
$('customer-name').addEventListener('input',()=>{
  $('customer-name-error').hidden=true;
  $('customer-name').removeAttribute('aria-invalid');
  $('share-link-box').hidden=true;
  lastSharedToken='';
});
function encodeShare(){
  // Version 3 includes the customer's name and optional price offers; old v1/v2 links still work.
  const items=cartRows().map(({p,size,qty,key})=>[p.key,size,qty,p.price==null?(priceOffers[key]??null):null]);
  const bytes=new TextEncoder().encode(JSON.stringify([3,items,customerName()]));
  let s='';for(const b of bytes)s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function createCartShareUrl(){
  const url=new URL(location.href);
  url.hash='#all';url.searchParams.set('cart',encodeShare());
  return url;
}
function decodeShare(token){
  if(!token||token.length>20000)throw Error('invalid');
  const b64=token.replace(/-/g,'+').replace(/_/g,'/');
  const bin=atob(b64.padEnd(Math.ceil(b64.length/4)*4,'='));
  const bytes=Uint8Array.from(bin,ch=>ch.charCodeAt(0));
  const [version,items,name]=JSON.parse(new TextDecoder().decode(bytes));
  if(![1,2,3].includes(version)||!Array.isArray(items)||items.length>300)throw Error('invalid');
  const quantities={},offers={};
  for(const item of items){
    if(!Array.isArray(item)||item.length<3)continue;
    const [id,size,n,offer]=item,key=cartKey(id,size);
    quantities[key]=Number(n);
    if(version>=2&&offer!=null)offers[key]=offer;
  }
  const sharedCart=sanitiseCart(quantities);
  return {cart:sharedCart,offers:sanitiseOffers(offers,sharedCart),customerName:version===3?normalizeCustomerName(name):''};
}
async function copy(text){try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true}}catch(e){}
  const el=document.createElement('textarea');el.value=text;el.style.cssText='position:fixed;left:-2000px';document.body.appendChild(el);el.focus();el.select();let ok;try{ok=document.execCommand('copy')}catch(e){ok=false}el.remove();if(!ok)window.prompt('העתיקו את הטקסט:',text);return Boolean(ok)}
function cartDescription(){
  const parts=['DVIR DESIGNS — סל מוצרים','שם הלקוח: '+customerName(),''];
  for(const {p,size,qty,key} of cartRows()){
    const unitPrice=p.price!=null?p.price:priceOffers[key];
    const price=unitPrice!=null?(p.price!=null?'מחיר: ':'הצעת הלקוח: ')+money(unitPrice)+' ליחידה, סה״כ '+money(unitPrice*qty):'ללא מחיר או הצעה';
    parts.push(p.title+' | '+p.color+(p.category==='curtains'?'':' | '+size)+' | כמות: '+qty+' | '+price);
  }
  parts.push('','סכום כולל מחירים ידועים והצעות: '+$('total').textContent,'הצעות הלקוח כפופות לאישור העסק; אין כאן תשלום או הזמנה מאושרת.');
  return parts.join('\n');
}
// These four imported images were screenshots: remove phone bars on the client.
// No other product images are cropped or changed.
const cleanImageCrops={p174:[0,240,323,240],p175:[0,190,323,330],c26:[0,28,288,522],c48:[0,90,294,496]};
const cleanedImageCache=new Map();
function cleanProductImage(p){
  const source=String(p?.localImage||p?.image||''),crop=cleanImageCrops[p?.key];
  if(!crop||!source||!source.startsWith('assets/'))return Promise.resolve(source);
  const identifier=source+':'+crop.join(',');
  if(!cleanedImageCache.has(identifier)){
    cleanedImageCache.set(identifier,new Promise(resolve=>{
      const image=new Image();
      image.onload=()=>{
        try{
          const canvas=document.createElement('canvas');canvas.width=crop[2];canvas.height=crop[3];
          canvas.getContext('2d').drawImage(image,...crop,0,0,crop[2],crop[3]);
          canvas.toBlob(blob=>resolve(blob?URL.createObjectURL(blob):source),'image/webp',.90);
        }catch(_){resolve(source)}
      };
      image.onerror=()=>resolve(source);image.src=source;
    }));
  }
  return cleanedImageCache.get(identifier);
}
function hydrateCleanImages(container){
  container.querySelectorAll('img[src]').forEach(async element=>{
    const path=element.getAttribute('src')||'';
    const match=path.match(/^assets\/(?:pillows\/p(174|175)|curtains\/c(026|048))\.webp$/);
    if(!match)return;
    const key=match[1]?'p'+match[1]:'c'+Number(match[2]);
    const p=byKey.get(key);if(!p)return;
    const url=await cleanProductImage(p);
    if(element.isConnected)element.src=url;
  });
}
const zoomDialog=$('image-lightbox');
let zoomOrigin=null;
async function openZoom(key){
  const p=byKey.get(key),src=p?.localImage||p?.image;
  if(!src||zoomDialog.open)return;
  zoomOrigin=document.activeElement;
  const view=$('zoom-image');view.dataset.productKey=key;view.src=src;
  view.alt=p.title||'תמונת מוצר';
  $('zoom-caption').textContent=p.title||'תמונת מוצר';
  zoomDialog.showModal();$('zoom-close').focus();
  const cleaned=await cleanProductImage(p);
  if(zoomDialog.open&&view.dataset.productKey===key)view.src=cleaned;
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
$('pagination').addEventListener('click',e=>{
  if(!e.target.closest('[data-load-more]'))return;
  page+=1;renderCatalog();
});
$('cart-trigger').addEventListener('click',openCart);$('close-cart').addEventListener('click',closeCart);$('cart-scrim').addEventListener('click',closeCart);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('cart-panel').classList.contains('is-open'))closeCart()});
$('cart-list').addEventListener('change',e=>{const field=e.target.closest('[data-cart-size]');if(field)updateCartSize(field.dataset.cartSize,field.value)});
$('cart-list').addEventListener('input',e=>{
  const field=e.target.closest('[data-offer-for]');if(!field)return;
  const key=field.dataset.offerFor;
  let id;try{[id]=JSON.parse(key)}catch{return}
  const p=byKey.get(id);
  if(!p||p.price!=null||!(key in cart))return;
  const offer=normalizeOffer(field.value);
  if(offer==null)delete priceOffers[key];else priceOffers[key]=offer;
  saveOffers();
  const row=field.closest('.cart-product-details');
  const amount=row?.querySelector('.price');
  if(amount)amount.textContent=itemPriceText(p,key,cart[key]);
  updateCartSummary();
});
$('cart-list').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;changeQty(b.dataset.key,b.dataset.action==='plus'?1:b.dataset.action==='minus'?-1:-100000)});
$('cart-list').addEventListener('click',e=>{const b=e.target.closest('.cart-photo-trigger[data-zoom]');if(b)openZoom(b.dataset.zoom)});
$('share-cart').addEventListener('click',async()=>{
  if(!count())return;
  if(!requireCustomerName())return;
  const url=createCartShareUrl(),token=url.searchParams.get('cart');
  lastSharedToken=token;
  $('share-link-box').hidden=false;
  $('share-link-input').value=url.href;
  const locally=location.protocol==='file:'||location.protocol==='about:';
  $('share-hint').textContent=locally
    ? 'זוהי הדגמה מקומית בלבד. כדי לשלוח את הסל למישהו אחר, יש לפרסם את האתר ואז ליצור שוב קישור.'
    : 'זהו קישור לסל שבחרתם, ללא תשלום. מי שיפתח אותו יראה את שם הלקוח, הפריטים והכמויות באתר.';
  if(locally){toast('הקישור נוצר להדגמה. לשיתוף אמיתי יש לפרסם את האתר.');return;}
  const ok=await copy(url.href);
  toast(ok?'הקישור לסל נוצר והועתק':'הקישור מוכן להעתקה');
});
$('whatsapp-share').addEventListener('click',()=>{
  if(!count())return;
  const name=requireCustomerName();if(!name)return;
  if(location.protocol==='file:'||location.protocol==='about:'){toast('שיתוף WhatsApp זמין באתר שפורסם');return;}
  const url=createCartShareUrl();
  const message='DVIR DESIGNS — סל מוצרים\nשם הלקוח: '+name+'\nלצפייה בסל ובכמויות: '+url.href;
  window.open('https://wa.me/?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
});
$('copy-share-link').addEventListener('click',async()=>{
  const link=$('share-link-input').value;if(!link)return;
  const ok=await copy(link);
  toast(ok?'הקישור הועתק':'ניתן לסמן ולהעתיק את הקישור בשדה');
});
$('share-link-input').addEventListener('focus',e=>e.target.select());
$('copy-cart').addEventListener('click',async()=>{
  if(!count()||!requireCustomerName())return;
  toast(await copy(cartDescription())?'רשימת המוצרים עם שם הלקוח הועתקה':'העתיקו את הרשימה מהחלון');
});
window.addEventListener('hashchange',readHash);
readHash();renderCart();
const shared=new URLSearchParams(location.search).get('cart');
if(shared){try{const decoded=decodeShare(shared);cart=decoded.cart;priceOffers=decoded.offers;$('customer-name').value=decoded.customerName;saveCart();saveOffers();renderCart();openCart();toast('הסל המשותף נטען')}catch(e){toast('לא ניתן לפתוח את קישור הסל')}}

if(dbEnabled){
  $('catalog-disclaimer').textContent='פרטי המוצרים מתעדכנים ממערכת הניהול. המחיר והמלאי הסופיים כפופים לאישור העסק. ט.ל.ח';
  document.querySelector('.cart-bottom .cart-disclaimer:last-child').textContent='קישור הסל מאפשר שיתוף רשימת מוצרים ואינו מהווה הזמנה או תשלום. המלאי עשוי להשתנות עד לאישור העסק.';
  const reload=async()=>{
    try{
      const newProducts=await fetchCatalog();
      PRODUCTS=newProducts;byKey=new Map(PRODUCTS.map(x=>[x.key,x]));
      cart=sanitiseCart(cart);priceOffers=sanitiseOffers(priceOffers);saveCart();saveOffers();
      if(current==='catalog')renderCatalog();renderCart();
    }catch(e){console.warn('Catalog sync delayed',e)}
  };
  // Update on visitor return and periodically while the store is open.
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)reload()});
  setInterval(()=>{if(!document.hidden)reload()},60000);
}
})();
