/* DVIR DESIGNS — private editing studio; saved settings are RLS-protected. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
if(!$('studio-design-form'))return;
const tabs=[...document.querySelectorAll('[data-studio-tab]')];
const panes=['products','design','photos'];
function switchTab(tab){
 if(!panes.includes(tab))return;
 for(const b of tabs){const active=b.dataset.studioTab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))}
 for(const name of panes)$('studio-pane-'+name).hidden=name!==tab;
 if(tab==='design')sendPreview();
 window.scrollTo({top:0,behavior:'smooth'});
}
tabs.forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.studioTab)));
const schema=window.DVIR_DESIGN;
const DEFAULTS={
 lightBackground:'#f7f1ee',lightHeader:'#f4e5e2',lightAccent:'#f4d0ce',lightText:'#2e2929',lightCard:'#fffaf8',lightBorder:'#c0a6a0',
 darkBackground:'#1c191d',darkHeader:'#2d252b',darkAccent:'#ddb2b8',darkText:'#f7eff0',darkCard:'#2b252b',darkBorder:'#76626a',
 font:'Assistant',headingFont:'Heebo',fontScale:100,desktopColumns:4,productGap:22,cardRadius:14,imageRadius:10,imageFit:'cover',imageRatio:'square',
 buttonRadius:11,headerHeight:96,homeTitle:'קולקציות הטקסטיל שלנו',homeSubtitle:'עיצוב יוקרתי לאירועים מיוחדים',
 pillowsTitle:'קטלוג כריות',curtainsTitle:'קטלוג וילונות',tablesTitle:'קטלוג מפות',footerText:'LUXURY TEXTILES FOR EVENTS'
};
const normalized=v=>{const d={...DEFAULTS};if(!v||typeof v!=='object')return d;
 for(const key of Object.keys(d)){const val=v[key],orig=d[key];
  if(typeof orig==='number'){if(Number.isFinite(Number(val)))d[key]=Number(val)}
  else if(typeof val==='string'&&val.length<150)d[key]=val;}
 return d};
const presets={
 original:{},
 rose:{lightBackground:'#fff5f3',lightHeader:'#f5d4d8',lightAccent:'#eac1c8',lightText:'#392c34',lightCard:'#fff9f7',lightBorder:'#c7a9ad',darkAccent:'#dfabb9'},
 sage:{lightBackground:'#f4f4ec',lightHeader:'#dce5d8',lightAccent:'#b5c6b3',lightText:'#283c30',lightCard:'#fdfdfa',lightBorder:'#aabdad',darkAccent:'#a8c2ac'},
 pearl:{lightBackground:'#f9f5ed',lightHeader:'#f0e4d5',lightAccent:'#e3ceb7',lightText:'#453629',lightCard:'#fffdf8',lightBorder:'#c9b6a3'},
 noir:{lightBackground:'#f3f0ef',lightHeader:'#e1d9dd',lightAccent:'#cdbbc6',lightText:'#2b252a',lightCard:'#faf8fa',lightBorder:'#b6a4b1',darkBackground:'#161316',darkHeader:'#282128',darkAccent:'#c2a5b7'}
};
const form=$('studio-design-form');let saved=normalized(),draft=normalized(),previewTimer=null,frameReady=false;
const status=(message,ok)=>{const x=$('studio-design-status');x.textContent=message;x.className='status '+(ok?'ok':'err')};
const colorKeys=['lightBackground','lightHeader','lightAccent','lightText','lightCard','lightBorder','darkBackground','darkHeader','darkAccent','darkText','darkCard','darkBorder'];
function fillForm(values){
 draft=normalized(values);
 for(const [key,value] of Object.entries(draft)){const element=form.elements.namedItem(key);if(element)element.value=String(value)}
 decorateInputs();
 sendPreview();
}
function readForm(){
 const raw={};for(const k of Object.keys(DEFAULTS)){const x=form.elements.namedItem(k);if(x)raw[k]=x.type==='range'?Number(x.value):x.value}
 const publicSchema=window.DVIR_SITE_SCHEMA;
 return publicSchema?.normalize?publicSchema.normalize(raw):normalized(raw);
}
function decorateInputs(){
 for(const key of colorKeys){const el=form.elements.namedItem(key),out=form.querySelector('[data-color-for="'+key+'"]');
  if(el&&out)out.textContent=el.value.toUpperCase();}
 form.querySelectorAll('[data-range-for]').forEach(out=>{
  const control=form.elements.namedItem(out.dataset.rangeFor);
  if(control)out.textContent=control.value+(out.dataset.suffix||'');
 });
 for(const b of form.querySelectorAll('[data-design-preset]'))b.classList.remove('active');
}
function sendPreview(){
 if(!$('studio-pane-design').hidden&&frameReady){
  const frame=$('studio-preview-frame');
  frame.contentWindow?.postMessage({type:'DVIR_DESIGN_PREVIEW',settings:draft},location.origin);
 }
}
form.addEventListener('input',()=>{
 draft=readForm();decorateInputs();
 clearTimeout(previewTimer);previewTimer=setTimeout(sendPreview,80);
});
form.querySelectorAll('[data-design-preset]').forEach(button=>button.addEventListener('click',()=>{
 const key=button.dataset.designPreset;
 fillForm({...DEFAULTS,...(presets[key]||{})});
 button.classList.add('active');
 status('ערכת העיצוב נטענה לתצוגה מקדימה. כדי לפרסם לחץ על ״שמירה ופרסום באתר״.',true);
}));
$('studio-preview-frame').addEventListener('load',()=>{frameReady=true;sendPreview()});
$('studio-desktop-view').addEventListener('click',()=>{
 $('studio-preview-shell').className='studio-preview-shell desktop';
 $('studio-desktop-view').classList.add('active');$('studio-mobile-view').classList.remove('active');
});
$('studio-mobile-view').addEventListener('click',()=>{
 $('studio-preview-shell').className='studio-preview-shell mobile';
 $('studio-mobile-view').classList.add('active');$('studio-desktop-view').classList.remove('active');
});
async function loadSaved(){
 const db=window.DVIR_ADMIN_DB;if(!db)return;
 try{
  const {data,error}=await db.from('dvir_site_settings').select('data').eq('id','site').maybeSingle();
  if(error)throw error;
  saved=normalized(data?.data||DEFAULTS);fillForm(saved);
  status('העיצוב השמור נטען. אפשר לערוך ולצפות לפני הפרסום.',true);
 }catch(e){status('לא ניתן לטעון הגדרות עיצוב: '+e.message,false)}
}
$('studio-revert').addEventListener('click',()=>{fillForm(saved);status('חזרת לגרסה השמורה. לא פורסם שינוי.',true)});
$('studio-reset').addEventListener('click',()=>{
 if(!confirm('לחזור לעיצוב המקורי בתצוגה המקדימה? השינוי לא יפורסם עד שתשמור.'))return;
 fillForm(DEFAULTS);status('העיצוב המקורי מוצג בטיוטה. יש לשמור כדי לפרסם.',true);
});
form.addEventListener('submit',async e=>{
 e.preventDefault();const db=window.DVIR_ADMIN_DB,button=$('studio-publish');button.disabled=true;
 status('שומר הגדרות עיצוב...',true);
 try{
  if(!db)throw Error('חיבור Supabase אינו זמין');
  const {data:admin,error:adminError}=await db.rpc('dvir_is_admin');
  if(adminError||admin!==true)throw Error('נדרשת כניסת מנהל מורשה');
  draft=readForm();
  const {error}=await db.from('dvir_site_settings').upsert({id:'site',data:draft,updated_at:new Date().toISOString()},{onConflict:'id'});
  if(error)throw error;
  saved={...draft};status('העיצוב פורסם! השינויים יופיעו ללקוחות בטעינה מחדש.',true);
 }catch(e){status('שמירה נכשלה: '+(e.message||String(e)),false)}
 finally{button.disabled=false}
});
loadSaved();

// Photo editor: pixels only, no generative transformations.
let source=null,sourceURL=null,editedFile=null,editedURL=null;
const pictureStatus=(m,ok)=>{const el=$('photo-status');el.textContent=m;el.className='status '+(ok?'ok':'err')};
function clearPhoto(){
 editedFile=null;
 if(editedURL){URL.revokeObjectURL(editedURL);editedURL=null}
 $('photo-apply').disabled=!source;
}
window.DVIR_ADMIN_PHOTO={
 getFile:()=>editedFile,
 clear:()=>{clearPhoto();source=null;$('photo-apply').disabled=true}
};
function editorSettings(){
 const read=name=>Number($('photo-'+name).value);
 return {ratio:$('photo-ratio').value,zoom:read('zoom'),x:read('x')/100,y:read('y')/100,
  rotate:read('rotate'),flip:$('photo-flip').checked,brightness:read('brightness'),contrast:read('contrast'),saturation:read('saturation')};
}
function drawEdited(output,exportFull=false){
 if(!source)return;
 const settings=editorSettings(),angle=settings.rotate*Math.PI/180;
 const maxDim=exportFull?2600:1300,scale=Math.min(1,maxDim/Math.max(source.naturalWidth,source.naturalHeight));
 const iw=Math.max(1,Math.round(source.naturalWidth*scale)),ih=Math.max(1,Math.round(source.naturalHeight*scale));
 const turn=settings.rotate===90||settings.rotate===270,virtual=document.createElement('canvas');
 virtual.width=turn?ih:iw;virtual.height=turn?iw:ih;
 const vc=virtual.getContext('2d');
 vc.translate(virtual.width/2,virtual.height/2);vc.rotate(angle);
 if(settings.flip)vc.scale(-1,1);
 vc.drawImage(source,-iw/2,-ih/2,iw,ih);
 const ratio=settings.ratio==='original'?virtual.width/virtual.height:Number(settings.ratio);
 const baseW=Math.min(virtual.width,virtual.height*ratio);
 const cropW=baseW/settings.zoom,cropH=cropW/ratio;
 const sx=(virtual.width-cropW)*settings.x,sy=(virtual.height-cropH)*settings.y;
 const width=exportFull?Math.max(1,Math.min(1600,Math.round(cropW))):560;
 output.width=width;output.height=Math.max(1,Math.round(width/ratio));
 const ctx=output.getContext('2d');
 ctx.clearRect(0,0,output.width,output.height);
 ctx.filter='brightness('+settings.brightness+'%) contrast('+settings.contrast+'%) saturate('+settings.saturation+'%)';
 ctx.drawImage(virtual,sx,sy,cropW,cropH,0,0,output.width,output.height);
 ctx.filter='none';
 const labels={zoom:settings.zoom.toFixed(2)+'×',x:Math.round(settings.x*100)+'%',y:Math.round(settings.y*100)+'%',
  brightness:settings.brightness+'%',contrast:settings.contrast+'%',saturation:settings.saturation+'%'};
 for(const [k,v]of Object.entries(labels)){const out=document.querySelector('[data-photo-label="'+k+'"]');if(out)out.textContent=v}
}
function redraw(){if(!source)return;try{drawEdited($('photo-canvas'))}catch(e){pictureStatus('התצוגה לא זמינה: '+e.message,false)}}
async function loadImage(src,isBlob=false){
 return new Promise((resolve,reject)=>{
  const img=new Image();
  if(!isBlob)img.crossOrigin='anonymous';
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(Error('אי אפשר לטעון את התמונה לעריכה. נסה להעלות קובץ מהמחשב במקום קישור מרוחק.'));
  img.src=src;
 });
}
async function fromFile(file){
 if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){
  pictureStatus('בחר קובץ JPG/PNG/WebP בגודל עד 10MB',false);return;
 }
 try{
  if(sourceURL)URL.revokeObjectURL(sourceURL);
  sourceURL=URL.createObjectURL(file);
  source=await loadImage(sourceURL,true);
  clearPhoto();resetControls();redraw();
  pictureStatus('התמונה נטענה. אפשר לחתוך, לסובב ולשנות את הגוונים.',true);
 }catch(e){pictureStatus(e.message,false)}
}
async function fromCurrent(){
 const uploaded=$('image-upload').files?.[0];if(uploaded){await fromFile(uploaded);return}
 const src=$('preview').getAttribute('src');
 if(!src){pictureStatus('בחר מוצר או העלה תמונה מהמחשב',false);return}
 try{
  source=await loadImage(new URL(src,location.href).href);
  clearPhoto();resetControls();redraw();
  pictureStatus('התמונה של המוצר נטענה לעריכה.',true);
 }catch(e){pictureStatus(e.message,false)}
}
function resetControls(){
 for(const [name,val]of Object.entries({ratio:'1',zoom:'1',x:'50',y:'50',rotate:'0',brightness:'100',contrast:'100',saturation:'100'}))$('photo-'+name).value=val;
 $('photo-flip').checked=false;
}
$('photo-load-current').addEventListener('click',fromCurrent);
$('photo-source-file').addEventListener('change',e=>fromFile(e.target.files?.[0]));
$('photo-reset').addEventListener('click',()=>{resetControls();redraw();pictureStatus('כל העריכות אופסו.',true)});
for(const name of ['ratio','zoom','x','y','rotate','flip','brightness','contrast','saturation']){
 $('photo-'+name).addEventListener('input',redraw);
}
$('open-photo-editor').addEventListener('click',()=>{
 switchTab('photos');fromCurrent();
});
$('photo-apply').addEventListener('click',async()=>{
 if(!source)return;
 const btn=$('photo-apply');btn.disabled=true;
 try{
  const output=document.createElement('canvas');
  drawEdited(output,true);
  const blob=await new Promise(resolve=>output.toBlob(resolve,'image/webp',.91));
  if(!blob||blob.size>10*1024*1024)throw Error('לא ניתן לייצא את התמונה. בחר חיתוך קטן יותר.');
  clearPhoto();
  editedFile=new File([blob],'dvir-cropped-'+Date.now()+'.webp',{type:'image/webp'});
  editedURL=URL.createObjectURL(blob);
  $('preview').src=editedURL;
  pictureStatus('התמונה המעובדת מוכנה. שמור את המוצר כדי לפרסם.',true);
  switchTab('products');
  $('save').scrollIntoView({behavior:'smooth',block:'center'});
 }catch(e){pictureStatus('שמירה נכשלה: '+e.message,false)}
 finally{btn.disabled=false}
});
$('image-upload').addEventListener('change',()=>clearPhoto());
window.DVIR_STUDIO={switchTab,openPhotoForCurrent:()=>{switchTab('photos');fromCurrent()}};
})();
