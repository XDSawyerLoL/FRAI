window.FRAI_AGENCY_EVENTS={"generatedAt":"","count":2,"events":[{"id":"agency-20260915-160556-45dwfm","source":"agency","title":"Webinaire Maps Indemnisation","date":"2026-09-18","time":"14:00","end_time":"15:00","department":"92","city":"Issy-les-Moulineaux","location":"","organizer":"","capacity":"","registration_url":"https://teams.microsoft.com/l/message/19:20087be0-00d8-42f3-8f6e-0ebc9b37158c_ca79a6da-3aca-4594-af70-7614906733da@unq.gbl.spaces/1789467258950?context=%7B%22contextType%22%3A%22chat%22%7D","description":"","category":"autre","image":"","published":true,"url":"evenement-agence.html?id=agency-20260915-160556-45dwfm","created_at":"2026-09-15T14:05:56.370Z"},{"id":"agency-20260917-153008-he0v9m","source":"agency","title":"reunion des Service","date":"2026-09-25","time":"13:30","end_time":"15:00","department":"92","city":"issy-les-Moulineaux","location":"","organizer":"","capacity":"","registration_url":"","description":"","category":"autre","image":"","published":true,"url":"evenement-agence.html?id=agency-20260917-153008-he0v9m","created_at":"2026-09-17T13:30:08.784Z"}]};
if(window.FRAI_EVENTS_IDF&&Array.isArray(window.FRAI_EVENTS_IDF.events)){
  const seen=new Set(window.FRAI_EVENTS_IDF.events.map(e=>String(e&&e.id||'')));
  for(const e of window.FRAI_AGENCY_EVENTS.events||[]){
    const id=String(e&&e.id||'');
    if(!id||seen.has(id)) continue;
    window.FRAI_EVENTS_IDF.events.push(e);
    seen.add(id);
  }
}
