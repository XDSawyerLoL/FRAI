window.FRAI_AGENCY_EVENTS={"generatedAt":null,"count":0,"events":[]};
(function(){
  document.write('<script src="agency-events-local.js?v='+Date.now()+'"><\/script>');
  window.addEventListener('DOMContentLoaded',function(){
    var add=document.querySelector('.add-event');
    if(add){
      add.href='ajouter-evenement.html';
      add.target='_blank';
      add.rel='noopener noreferrer';
      add.removeAttribute('role');
      add.style.cursor='';
    }
  },{once:true});
})();
