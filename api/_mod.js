// word-list scorer, same as the page's meter. 100 = held for your approval, 65 = mild (flagged in the email only)
const MOD_BAD=['fdp','ntm','pd','pede','pute','putes','salope','salopes','connard','connards','connasse','encule','enculer','enculee','nique','niquer','batard','batards','tg','fuck','fucking','fucker','shit','bitch','bitches','cunt','dick','dickhead','asshole','slut','whore','nigga','nigger','faggot','fag','retard','retarded','kys','puta','mierda','pendejo','scheisse','scheiss','arschloch','hurensohn','fotze','wichser','schlampe','nazi','rape','suicide'];
const MOD_STEM=['salop','connard','connass','encul','nigg','fuck','bitch','whore','faggot','hurenso','arschloch','scheiss'];
const MOD_MILD=['merde','putain','ptn','damn','crap','wtf','ffs','bordel','chier','con','conne','idiot','stupid','hate','ugly','moche','nul','ass','hell'];
const MOD_CUTE=['cute','cutie','love','lovely','slay','slayyy','omg','pretty','baby','bestie','angel','sweet','kawaii','uwu','xoxo','hello','hi','hey','mwah','mwa','yay','pink','bow'];
function modNorm(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/(?<=[a-z])!(?=[a-z])/g,'i').replace(/@/g,'a').replace(/\$/g,'s').replace(/(?<=[a-z])0|0(?=[a-z])/g,'o').replace(/(?<=[a-z])1|1(?=[a-z])/g,'i').replace(/(?<=[a-z])3|3(?=[a-z])/g,'e').replace(/(?<=[a-z])4|4(?=[a-z])/g,'a').replace(/(?<=[a-z])5|5(?=[a-z])/g,'s').replace(/(?<=[a-z])7|7(?=[a-z])/g,'t')}
function modScore(txt){const n=modNorm(txt);if(!n.replace(/[^a-z]/g,''))return 0;
 const toks=n.split(/[^a-z]+/).filter(Boolean),sq=x=>x.replace(/(.)\1+/g,'$1');
 /* single letters spaced out, e.g. "f d p" or "f.d.p" */
 const runs=[];let cur='';n.split(/[\s.\-_*]+/).forEach(w=>{if(w.length===1&&/[a-z]/.test(w))cur+=w;else{if(cur.length>1)runs.push(cur);cur=''}});if(cur.length>1)runs.push(cur);
 const bad=new Set(MOD_BAD),all=toks.concat(runs);for(let i=0;i<toks.length-1;i++)all.push(toks[i]+toks[i+1]);
 for(const w of all){if(bad.has(w)||bad.has(sq(w)))return 100;if(w.length>=5&&MOD_STEM.some(s=>sq(w).startsWith(sq(s))))return 100}
 if(toks.some(w=>MOD_MILD.includes(sq(w))||MOD_MILD.includes(w)))return 65;
 const cute=toks.some(w=>MOD_CUTE.includes(sq(w))||MOD_CUTE.includes(w));
 if(cute||/[♡♥❥ღ✿❀★☆✧]/.test(txt))return 0;
 let h=0;for(const c of n)h=(h*31+c.charCodeAt(0))>>>0;let v=3+h%14;if(/https?:|www\.|\.com|\.ru\b/.test(n))v=Math.max(v,70);if(txt.length>6&&txt===txt.toUpperCase()&&/[A-Z]/.test(txt))v=Math.max(v,35);return v}

module.exports = { modScore };
