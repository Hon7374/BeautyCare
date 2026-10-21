(function(){
  const token = localStorage.getItem('token');
  const uRaw = localStorage.getItem('user');
  const u = uRaw ? (()=>{ try{return JSON.parse(uRaw);}catch(e){return null;} })() : null;
  if(!token || !u){
    window.location.href = 'login.html';
    return;
  }
  if(u.role === 'admin'){
    window.location.href = 'admin/users.html';
  }else{
    window.location.href = 'user/profile.html';
  }
})();
