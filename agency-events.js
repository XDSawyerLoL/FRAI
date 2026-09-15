window.FRAI_AGENCY_EVENTS={"generatedAt":null,"count":0,"events":[]};
(function(){
  var add=document.querySelector('.add-event');
  if(add){
    add.removeAttribute('href');
    add.removeAttribute('target');
    add.removeAttribute('rel');
    add.setAttribute('role','button');
    add.style.cursor='pointer';
  }
  var api='https://frai-agency-events.onrender.com/events.js?v='+Date.now();
  document.write('<script src="'+api+'"><\/script>');
  window.addEventListener('DOMContentLoaded',function(){
    var s=document.createElement('script');
    s.src='agency-public-v2.js?v=20260915-2';
    s.defer=true;
    document.body.appendChild(s);
  },{once:true});
})();
