window.FRAI_AGENCY_EVENTS={"generatedAt":"","count":0,"events":[]};
if(window.FRAI_EVENTS_IDF&&Array.isArray(window.FRAI_EVENTS_IDF.events)){
  const seen=new Set(window.FRAI_EVENTS_IDF.events.map(e=>String(e&&e.id||'')));
  for(const e of window.FRAI_AGENCY_EVENTS.events||[]){
    const id=String(e&&e.id||'');
    if(!id||seen.has(id)) continue;
    window.FRAI_EVENTS_IDF.events.push(e);
    seen.add(id);
  }
}
