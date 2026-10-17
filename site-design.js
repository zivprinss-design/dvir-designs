/* DVIR DESIGNS live design controls — public read, admin-only write via RLS. */
(function(){
'use strict';
const defaults=Object.freeze({
  lightBackground:'#f7f1ee', lightHeader:'#f4e5e2', lightAccent:'#f4d0ce',
  lightText:'#2e2929', lightCard:'#fffaf8', lightBorder:'#c0a6a0',
  darkBackground:'#1c191d', darkHeader:'#2d252b', darkAccent:'#ddb2b8',
  darkText:'#f7eff0', darkCard:'#2b252b', darkBorder:'#76626a',
  font:'Assistant', headingFont:'Heebo', fontScale:100,
  desktopColumns:4, productGap:22, cardRadius:14, imageRadius:10,
  imageFit:'cover', imageRatio:'square', buttonRadius:11, headerHeight:96,
  homeTitle:'קולקציות הטקסטיל שלנו', homeSubtitle:'עיצוב יוקרתי לאירועים מיוחדים',
  pillowsTitle:'קטלוג כריות',curtainsTitle:'קטלוג וילונות',
  tablesTitle:'קטלוג מפות',footerText:'LUXURY TEXTILES FOR EVENTS'
});
const fonts={Assistant:"'Assistant',Arial,sans-serif",Heebo:"'Heebo',Arial,sans-serif",Rubik:"'Rubik',Arial,sans-serif",Alef:"'Alef',Arial,sans-serif",'Frank Ruhl Libre':"'Frank Ruhl Libre',serif"};
const colorKeys=['lightBackground','lightHeader','lightAccent','lightText','lightCard','lightBorder','darkBackground','darkHeader','darkAccent','darkText','darkCard','darkBorder'];
const textKeys=['homeTitle','homeSubtitle','pillowsTitle','curtainsTitle','tablesTitle','footerText'];
const ranges={fontScale:[85,125],desktopColumns:[3,5],productGap:[10,40],cardRadius:[0,35],imageRadius:[0,35],buttonRadius:[0,35],headerHeight:[78,140]};
const hex=value=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value);
const escapeCSS=value=>String(value).replace(/[^a-zA-Z0-9,\- ()'%]/g,'');
function normalize(input){
  const data={...defaults};
  if(!input||typeof input!=='object'||Array.isArray(input))return data;
  for(const k of colorKeys)if(hex(input[k]))data[k]=input[k].toLowerCase();
  for(const k of Object.keys(ranges)){const v=Number(input[k]),[min,max]=ranges[k];if(Number.isFinite(v))data[k]=Math.round(Math.min(max,Math.max(min,v)))}
  if(Object.prototype.hasOwnProperty.call(fonts,input.font))data.font=input.font;
  if(Object.prototype.hasOwnProperty.call(fonts,input.headingFont))data.headingFont=input.headingFont;
  if(['cover','contain'].includes(input.imageFit))data.imageFit=input.imageFit;
  if(['square','portrait','landscape'].includes(input.imageRatio))data.imageRatio=input.imageRatio;
  for(const k of textKeys)if(typeof input[k]==='string'&&input[k].trim())data[k]=input[k].trim().slice(0,110);
  return data;
}
function cssFor(d){
 const c=(k)=>d[k],radius=d.cardRadius+'px';
 const ratio={square:'1/1',portrait:'4/5',landscape:'5/4'}[d.imageRatio];
 const light=`--cream:${c('lightBackground')};--header:${c('lightHeader')};--pink:${c('lightAccent')};--ink:${c('lightText')};--stroke:${c('lightBorder')};--card:${c('lightCard')};--font:${fonts[d.font]};--dvir-product-gap:${d.productGap}px`;
 const dark=`--cream:${c('darkBackground')};--header:${c('darkHeader')};--pink:${c('darkAccent')};--ink:${c('darkText')};--stroke:${c('darkBorder')};--card:${c('darkCard')};--font:${fonts[d.font]}`;
 return `
 html:not([data-theme="dark"]){${light}}
 html[data-theme="dark"]{${dark}}
 body{font-size:calc(18px * ${d.fontScale}/100)}
 .home-intro h1,.catalog-intro h1{font-family:${fonts[d.headingFont]}}
 .product-photo{aspect-ratio:${ratio}!important;height:auto!important;border-radius:${d.imageRadius}px!important}
 .product-photo-trigger img{object-fit:${d.imageFit}!important}
 .product-card{border-radius:${radius}!important}
 .products-grid{gap:var(--dvir-product-gap)!important}
 .pink-button,.product-add,.outline-button,.kind,.size-chip{border-radius:${d.buttonRadius}px!important}
 @media(min-width:1101px){
  .products-grid{grid-template-columns:repeat(${d.desktopColumns},minmax(0,1fr))!important}
  .header-inner{min-height:${d.headerHeight}px!important}
 }
 @media(max-width:700px){body{font-size:calc(16px * ${d.fontScale}/100)}}
 html:not([data-theme="dark"]) .product-card{color:var(--ink)}
 html[data-theme="dark"] .product-card{color:var(--ink)}
 html:not([data-theme="dark"]) .product-price{color:var(--ink)}
 html[data-theme="dark"] .product-price{color:var(--ink)}
 html:not([data-theme="dark"]) .site-header{background:var(--header)}
 html[data-theme="dark"] .site-header{background:var(--header)}
 `;
}
let current=normalize();
function apply(input){
 current=normalize(input);
 let style=document.getElementById('dvir-live-design');
 if(!style){style=document.createElement('style');style.id='dvir-live-design';document.head.append(style)}
 style.textContent=cssFor(current);
 const byId=(id,txt)=>{const el=document.getElementById(id);if(el)el.textContent=txt};
 byId('home-heading',current.homeTitle);
 const homeSub=document.querySelector('.home-intro p');if(homeSub)homeSub.textContent=current.homeSubtitle;
 for(const [category,key] of [['pillows','pillowsTitle'],['curtains','curtainsTitle'],['tables','tablesTitle']]){
  const label=document.querySelector('.category-tile[data-nav="'+category+'"] .category-label');
  if(label)label.textContent=current[key];
 }
 const heading=document.getElementById('catalog-heading');
 const active=location.hash.slice(1);
 const titles={pillows:current.pillowsTitle,curtains:current.curtainsTitle,tables:current.tablesTitle};
 if(heading&&titles[active])heading.textContent=titles[active];
 const footer=document.querySelector('footer.footer');if(footer)footer.textContent=current.footerText;
 window.DVIR_DESIGN_LABELS={pillows:current.pillowsTitle,curtains:current.curtainsTitle,tables:current.tablesTitle};
 document.documentElement.dataset.dvirDesigned='true';
 return current;
}
window.DVIR_DESIGN={defaults,normalize,apply,current:()=>({...current})};
window.addEventListener('message',e=>{
 if(window.parent===window||e.source!==window.parent||e.origin!==location.origin)return;
 if(e.data?.type==='DVIR_DESIGN_PREVIEW')apply(e.data.settings);
});
async function load(){
 const cfg=window.DVIR_CONFIG||{};
 if(!cfg.supabaseUrl||!cfg.supabaseAnonKey)return;
 try{
  const url=cfg.supabaseUrl.replace(/\/$/,'')+'/rest/v1/dvir_site_settings?select=data&id=eq.site&limit=1';
  const response=await fetch(url,{headers:{apikey:cfg.supabaseAnonKey},cache:'no-store'});
  if(!response.ok)throw Error('Settings HTTP '+response.status);
  const result=await response.json();
  if(Array.isArray(result)&&result[0]?.data)apply(result[0].data);
 }catch(err){console.warn('The published design stays active; live settings could not load',err)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
