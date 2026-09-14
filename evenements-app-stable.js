(() => {
const zones={idf:{label:'Île-de-France',department:null,code:'idf'},'75':{label:'Paris (75)',department:'Paris',code:'75'},'77':{label:'Seine-et-Marne (77)',department:'Seine-et-Marne',code:'77'},'78':{label:'Yvelines (78)',department:'Yvelines',code:'78'},'91':{label:'Essonne (91)',department:'Essonne',code:'91'},'92':{label:'Hauts-de-Seine (92)',department:'Hauts-de-Seine',code:'92'},'93':{label:'Seine-Saint-Denis (93)',department:'Seine-Saint-Denis',code:'93'},'94':{label:'Val-de-Marne (94)',department:'Val-de-Marne',code:'94'},'95':{label:'Val-d’Oise (95)',department:"Val-d'Oise",code:'95'}};
const cats=[['mrs','MRS'],['jobdating','Job dating'],['alternance','Alternance'],['sanscv','Sans CV'],['ia','IA'],['autre','Autre']];
const INDEX={"generatedAt":"2026-09-14T12:59:10.189251+00:00","month":"2026-09","count":1293,"dates":{"2026-09-14":{"idf":{"total":82,"mrs":1,"jobdating":2,"alternance":3,"sanscv":0,"ia":2,"autre":74},"94":{"total":3,"mrs":1,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":2},"91":{"total":12,"mrs":0,"jobdating":1,"alternance":2,"sanscv":0,"ia":0,"autre":9},"93":{"total":19,"mrs":0,"jobdating":1,"alternance":0,"sanscv":0,"ia":0,"autre":18},"78":{"total":7,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":7},"77":{"total":6,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":6},"95":{"total":10,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":10},"92":{"total":14,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":14},"75":{"total":11,"mrs":0,"jobdating":0,"alternance":1,"sanscv":0,"ia":2,"autre":8}},"2026-09-15":{"idf":{"total":138,"mrs":0,"jobdating":4,"alternance":4,"sanscv":0,"ia":1,"autre":129},"77":{"total":19,"mrs":0,"jobdating":1,"alternance":0,"sanscv":0,"ia":0,"autre":18},"93":{"total":27,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":27},"91":{"total":10,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":10},"92":{"total":20,"mrs":0,"jobdating":2,"alternance":1,"sanscv":0,"ia":0,"autre":17},"95":{"total":12,"mrs":0,"jobdating":0,"alternance":1,"sanscv":0,"ia":0,"autre":11},"94":{"total":16,"mrs":0,"jobdating":0,"alternance":2,"sanscv":0,"ia":0,"autre":14},"75":{"total":21,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":21},"78":{"total":13,"mrs":0,"jobdating":1,"alternance":0,"sanscv":0,"ia":1,"autre":11}},"2026-09-16":{"idf":{"total":117,"mrs":0,"jobdating":9,"alternance":5,"sanscv":0,"ia":0,"autre":103},"92":{"total":12,"mrs":0,"jobdating":1,"alternance":0,"sanscv":0,"ia":0,"autre":11},"93":{"total":23,"mrs":0,"jobdating":1,"alternance":1,"sanscv":0,"ia":0,"autre":21},"77":{"total":17,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":17},"75":{"total":23,"mrs":0,"jobdating":0,"alternance":1,"sanscv":0,"ia":0,"autre":22},"91":{"total":7,"mrs":0,"jobdating":4,"alternance":2,"sanscv":0,"ia":0,"autre":1},"95":{"total":19,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":19},"94":{"total":7,"mrs":0,"jobdating":3,"alternance":0,"sanscv":0,"ia":0,"autre":4},"78":{"total":9,"mrs":0,"jobdating":0,"alternance":1,"sanscv":0,"ia":0,"autre":8}},"2026-09-17":{"idf":{"total":148,"mrs":3,"jobdating":10,"alternance":4,"sanscv":2,"ia":3,"autre":126},"78":{"total":21,"mrs":0,"jobdating":2,"alternance":0,"sanscv":0,"ia":0,"autre":19},"91":{"total":13,"mrs":0,"jobdating":2,"alternance":2,"sanscv":0,"ia":0,"autre":9},"77":{"total":15,"mrs":0,"jobdating":2,"alternance":0,"sanscv":1,"ia":0,"autre":12},"75":{"total":37,"mrs":2,"jobdating":0,"alternance":1,"sanscv":0,"ia":3,"autre":31},"95":{"total":19,"mrs":1,"jobdating":1,"alternance":0,"sanscv":0,"ia":0,"autre":17},"92":{"total":16,"mrs":0,"jobdating":3,"alternance":0,"sanscv":1,"ia":0,"autre":12},"94":{"total":13,"mrs":0,"jobdating":0,"alternance":1,"sanscv":0,"ia":0,"autre":12},"93":{"total":14,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":14}},"2026-09-18":{"idf":{"total":33,"mrs":0,"jobdating":1,"alternance":2,"sanscv":0,"ia":0,"autre":30},"93":{"total":5,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":5},"95":{"total":4,"mrs":0,"jobdating":0,"alternance":1,"sanscv":0,"ia":0,"autre":3},"91":{"total":3,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":3},"94":{"total":2,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":2},"77":{"total":4,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":4},"92":{"total":3,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":3},"75":{"total":4,"mrs":0,"jobdating":1,"alternance":0,"sanscv":0,"ia":0,"autre":3},"78":{"total":8,"mrs":0,"jobdating":0,"alternance":1,"sanscv":0,"ia":0,"autre":7}},"2026-09-19":{"idf":{"total":1,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":1},"77":{"total":1,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":1}},"2026-09-21":{"idf":{"total":121,"mrs":2,"jobdating":6,"alternance":6,"sanscv":0,"ia":8,"autre":99},"92":{"total":16,"mrs":0,"jobdating":2,"alternance":0,"sanscv":0,"ia":3,"autre":11},"78":{"total":14,"mrs":1,"jobdating":1,"alternance":0,"sanscv":0,"ia":0,"autre":12},"94":{"total":8,"mrs":1,"jobdating":1,"alternance":0,"sanscv":0,"ia":0,"autre":6},"91":{"total":11,"mrs":0,"jobdating":0,"alternance":4,"sanscv":0,"ia":0,"autre":7},"77":{"total":21,"mrs":0,"jobdating":2,"alternance":1,"sanscv":0,"ia":0,"autre":18},"93":{"total":18,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":1,"autre":17},"95":{"total":18,"mrs":0,"jobdating":0,"alternance":1,"sanscv":0,"ia":3,"autre":14},"75":{"total":15,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":1,"autre":14}},"2026-09-22":{"idf":{"total":186,"mrs":2,"jobdating":7,"alternance":7,"sanscv":0,"ia":17,"autre":153},"91":{"total":13,"mrs":0,"jobdating":0,"alternance":3,"sanscv":0,"ia":0,"autre":10},"93":{"total":39,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":8,"autre":31},"92":{"total":23,"mrs":2,"jobdating":0,"alternance":0,"sanscv":0,"ia":4,"autre":17},"77":{"total":18,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":3,"autre":15},"78":{"total":24,"mrs":0,"jobdating":3,"alternance":0,"sanscv":0,"ia":0,"autre":21},"95":{"total":33,"mrs":0,"jobdating":0,"alternance":3,"sanscv":0,"ia":0,"autre":30},"75":{"total":27,"mrs":0,"jobdating":2,"alternance":0,"sanscv":0,"ia":2,"autre":23},"94":{"total":9,"mrs":0,"jobdating":2,"alternance":1,"sanscv":0,"ia":0,"autre":6}},"2026-09-23":{"idf":{"total":98,"mrs":1,"jobdating":6,"alternance":3,"sanscv":0,"ia":9,"autre":79},"75":{"total":20,"mrs":1,"jobdating":0,"alternance":1,"sanscv":0,"ia":1,"autre":17},"77":{"total":14,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":1,"autre":13},"92":{"total":11,"mrs":0,"jobdating":2,"alternance":0,"sanscv":0,"ia":1,"autre":8},"94":{"total":8,"mrs":0,"jobdating":1,"alternance":0,"sanscv":0,"ia":0,"autre":7},"95":{"total":11,"mrs":0,"jobdating":1,"alternance":0,"sanscv":0,"ia":1,"autre":9},"91":{"total":5,"mrs":0,"jobdating":2,"alternance":0,"sanscv":0,"ia":1,"autre":2},"93":{"total":22,"mrs":0,"jobdating":0,"alternance":1,"sanscv":0,"ia":4,"autre":17},"78":{"total":7,"mrs":0,"jobdating":0,"alternance":1,"sanscv":0,"ia":0,"autre":6}},"2026-09-24":{"idf":{"total":119,"mrs":1,"jobdating":8,"alternance":5,"sanscv":0,"ia":7,"autre":98},"78":{"total":16,"mrs":1,"jobdating":2,"alternance":1,"sanscv":0,"ia":0,"autre":12},"77":{"total":27,"mrs":0,"jobdating":2,"alternance":0,"sanscv":0,"ia":3,"autre":22},"75":{"total":9,"mrs":0,"jobdating":0,"alternance":1,"sanscv":0,"ia":0,"autre":8},"95":{"total":13,"mrs":0,"jobdating":0,"alternance":1,"sanscv":0,"ia":2,"autre":10},"92":{"total":11,"mrs":0,"jobdating":1,"alternance":0,"sanscv":0,"ia":1,"autre":9},"94":{"total":14,"mrs":0,"jobdating":1,"alternance":1,"sanscv":0,"ia":0,"autre":12},"91":{"total":10,"mrs":0,"jobdating":1,"alternance":1,"sanscv":0,"ia":0,"autre":8},"93":{"total":19,"mrs":0,"jobdating":1,"alternance":0,"sanscv":0,"ia":1,"autre":17}},"2026-09-25":{"idf":{"total":59,"mrs":1,"jobdating":4,"alternance":0,"sanscv":0,"ia":9,"autre":45},"75":{"total":5,"mrs":0,"jobdating":2,"alternance":0,"sanscv":0,"ia":0,"autre":3},"94":{"total":2,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":2},"91":{"total":5,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":1,"autre":4},"92":{"total":4,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":1,"autre":3},"93":{"total":10,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":3,"autre":7},"77":{"total":12,"mrs":0,"jobdating":2,"alternance":0,"sanscv":0,"ia":4,"autre":6},"78":{"total":17,"mrs":1,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":16},"95":{"total":4,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":4}},"2026-09-26":{"idf":{"total":1,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":1},"93":{"total":1,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":1}},"2026-09-28":{"idf":{"total":57,"mrs":1,"jobdating":6,"alternance":0,"sanscv":0,"ia":0,"autre":50},"93":{"total":10,"mrs":0,"jobdating":2,"alternance":0,"sanscv":0,"ia":0,"autre":8},"94":{"total":16,"mrs":1,"jobdating":3,"alternance":0,"sanscv":0,"ia":0,"autre":12},"77":{"total":9,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":9},"78":{"total":4,"mrs":0,"jobdating":1,"alternance":0,"sanscv":0,"ia":0,"autre":3},"92":{"total":6,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":6},"95":{"total":5,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":5},"91":{"total":5,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":5},"75":{"total":2,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":2}},"2026-09-29":{"idf":{"total":77,"mrs":2,"jobdating":1,"alternance":3,"sanscv":0,"ia":1,"autre":70},"93":{"total":18,"mrs":0,"jobdating":0,"alternance":1,"sanscv":0,"ia":1,"autre":16},"75":{"total":10,"mrs":1,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":9},"77":{"total":11,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":11},"94":{"total":8,"mrs":1,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":7},"95":{"total":8,"mrs":0,"jobdating":1,"alternance":0,"sanscv":0,"ia":0,"autre":7},"92":{"total":7,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":7},"91":{"total":8,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":8},"78":{"total":7,"mrs":0,"jobdating":0,"alternance":2,"sanscv":0,"ia":0,"autre":5}},"2026-09-30":{"idf":{"total":56,"mrs":0,"jobdating":7,"alternance":1,"sanscv":0,"ia":1,"autre":47},"92":{"total":5,"mrs":0,"jobdating":1,"alternance":0,"sanscv":0,"ia":0,"autre":4},"95":{"total":8,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":8},"93":{"total":9,"mrs":0,"jobdating":1,"alternance":1,"sanscv":0,"ia":1,"autre":6},"91":{"total":3,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":3},"78":{"total":11,"mrs":0,"jobdating":5,"alternance":0,"sanscv":0,"ia":0,"autre":6},"77":{"total":10,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":10},"94":{"total":3,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":3},"75":{"total":7,"mrs":0,"jobdating":0,"alternance":0,"sanscv":0,"ia":0,"autre":7}}}};
const q=document.getElementById('q'),zone=document.getElementById('zone'),frame=document.getElementById('frame'),status=document.getElementById('status'),listView=document.getElementById('listView'),agendaView=document.getElementById('agendaView'),agendaPanel=document.getElementById('agendaPanel'),calendar=document.getElementById('calendar'),agendaTitle=document.getElementById('agendaTitle'),agendaData=document.getElementById('agendaData'),dayDetails=document.getElementById('dayDetails'),viewer=document.querySelector('.viewer');
let selectedDate=null,calendarMonth=new Date();calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const same=(a,b)=>a&&b&&iso(a)===iso(b);
const fmt=d=>new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);
const clean=v=>(v||'').trim();
function counts(d){const day=INDEX.dates[iso(d)];if(!day)return null;const z=zones[zone.value]||zones.idf;return day[z.code]||null}
function dateRange(d){const start=new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,0,0,0);const end=new Date(d.getFullYear(),d.getMonth(),d.getDate(),23,59,59,999);return [start.toISOString(),end.toISOString()]}
function urlFor(keyword,key,date,allDay=false){
  const z=zones[key]||zones.idf,u=new URL('https://openagenda.com/fr/francetravail');
  const term=clean(keyword);
  if(term&&!allDay)u.searchParams.set('search',term);
  u.searchParams.set('adminLevel1','Île-de-France');
  if(z.department)u.searchParams.set('adminLevel2',z.department);
  if(date){
    const [from,to]=dateRange(date);
    u.searchParams.set('timings[gte]',from);
    u.searchParams.set('timings[lte]',to);
  }else{
    u.searchParams.append('relative[]','current');
    u.searchParams.append('relative[]','upcoming');
  }
  return u.toString()
}
function runSearch(keyword,key){
  const z=zones[key]||zones.idf,term=clean(keyword)||'MRS';
  q.value=term;zone.value=key;
  status.textContent=`Résultats pour « ${term} » — ${z.label}${selectedDate?` — ${fmt(selectedDate)}`:''}`;
  frame.src=urlFor(term,key,selectedDate,false)
}
function runDay(key){
  if(!selectedDate)return;
  const z=zones[key]||zones.idf;
  zone.value=key;
  status.textContent=`Tous les événements — ${z.label} — ${fmt(selectedDate)}`;
  frame.src=urlFor('',key,selectedDate,true)
}
function dots(el,c){if(!c)return;let shown=0;for(const [k,label] of cats){for(let i=0;i<(c[k]||0)&&shown<6;i++,shown++){const x=document.createElement('i');x.className=`dot dot-${k}`;x.title=label;el.appendChild(x)}if(shown>=6)break}if(c.total>6){const m=document.createElement('span');m.className='more';m.textContent=`+${c.total-6}`;el.appendChild(m)}}
function renderCalendar(){
  calendar.innerHTML='';
  agendaTitle.textContent=new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(calendarMonth);
  for(const x of ['L','M','M','J','V','S','D']){const e=document.createElement('div');e.className='dow';e.textContent=x;calendar.appendChild(e)}
  const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth(),first=new Date(y,m,1),start=new Date(y,m,1-((first.getDay()+6)%7)),today=new Date();
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const c=counts(d),total=c?.total||0,b=document.createElement('button');
    b.type='button';b.className='day';
    if(d.getMonth()!==m)b.classList.add('other');
    if(same(d,today))b.classList.add('today');
    if(same(d,selectedDate))b.classList.add('selected');
    const n=document.createElement('span');n.className='daynum';n.textContent=d.getDate();b.appendChild(n);
    const ds=document.createElement('span');ds.className='dots';dots(ds,c);b.appendChild(ds);
    b.title=`${fmt(d)} — ${total} événement${total>1?'s':''}`;
    b.onclick=()=>{selectedDate=new Date(d.getFullYear(),d.getMonth(),d.getDate());calendarMonth=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar();renderDetails();runDay(zone.value)};
    calendar.appendChild(b)
  }
}
function renderDetails(){
  if(!selectedDate){dayDetails.innerHTML='<div class="day-empty">Cliquez sur un jour pour voir ce qui se passe ce jour-là.</div>';return}
  const c=counts(selectedDate),total=c?.total||0;
  let h=`<div class="day-details-title">${fmt(selectedDate)}</div>`;
  if(!total){
    h+='<div class="day-empty">Aucun événement recensé pour cette journée dans la zone sélectionnée.</div>'
  }else{
    h+=`<div style="font-size:12px;color:#344054;margin-bottom:6px"><b>${total}</b> événement${total>1?'s':''} ce jour.</div><div>`;
    for(const [k,label] of cats)if(c[k])h+=`<span style="display:inline-flex;align-items:center;gap:5px;margin:3px 10px 3px 0"><i class="dot dot-${k}"></i><b>${c[k]}</b> ${label}</span>`;
    h+='</div><div class="day-empty" style="margin-top:8px">Les événements de cette journée sont chargés dans la liste juste en dessous.</div><button id="showDayResults" type="button" style="height:34px;margin-top:9px;background:#0063cb;color:white;border:0;border-radius:7px;padding:0 12px;font-size:12px;font-weight:700">Voir les événements du jour ↓</button>'
  }
  dayDetails.innerHTML=h;
  document.getElementById('showDayResults')?.addEventListener('click',()=>viewer?.scrollIntoView({behavior:'smooth',block:'start'}))
}
function view(mode){
  const a=mode==='agenda';
  agendaPanel.classList.toggle('open',a);agendaView.classList.toggle('active',a);listView.classList.toggle('active',!a);
  agendaView.setAttribute('aria-pressed',String(a));listView.setAttribute('aria-pressed',String(!a));
  if(a){renderCalendar();renderDetails()}else if(selectedDate){selectedDate=null;runSearch(q.value,zone.value)}
}
agendaData.className='agenda-data';agendaData.textContent=`${INDEX.count} événements à venir indexés pour septembre en Île-de-France.`;
document.getElementById('f').onsubmit=e=>{e.preventDefault();runSearch(q.value,zone.value)};
zone.onchange=()=>{renderCalendar();renderDetails();if(selectedDate)runDay(zone.value);else runSearch(q.value,zone.value)};
document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{selectedDate=null;renderCalendar();renderDetails();runSearch(b.dataset.q,zone.value)});
listView.onclick=()=>view('list');agendaView.onclick=()=>view('agenda');
document.getElementById('prevMonth').onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);selectedDate=null;renderCalendar();renderDetails()};
document.getElementById('nextMonth').onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);selectedDate=null;renderCalendar();renderDetails()};
document.getElementById('clearDate').onclick=()=>{selectedDate=null;renderCalendar();renderDetails();runSearch(q.value,zone.value)};
runSearch('MRS','idf');
})();