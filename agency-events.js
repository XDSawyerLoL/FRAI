window.FRAI_AGENCY_EVENTS={"generatedAt":null,"count":0,"events":[]};
(function(){
  var api='https://frai-agency-events.onrender.com/events.js?v='+Date.now();
  document.write('<script src="'+api+'"><\/script>');
  window.addEventListener('DOMContentLoaded',function(){
    var s=document.createElement('script');
    s.src='agency-public-v2.js?v=20260915-2';
    s.defer=true;
    s.onload=function(){
      var h=document.createElement('script');
      h.src='agency-public-hotfix.js?v=20260915-1';
      h.defer=true;
      document.body.appendChild(h);
    };
    document.body.appendChild(s);
  },{once:true});
})();
