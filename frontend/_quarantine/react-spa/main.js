const API = 'http://localhost:3000/api';

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const res = await fetch(API+'/login',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
  });

  const data = await res.json();
  localStorage.setItem('user', JSON.stringify(data.user));
  location.href='services.html';
}

async function loadServices(){
  const res = await fetch(API+'/services');
  const services = await res.json();
  const div = document.getElementById('services');
  services.forEach(s=>{
    div.innerHTML += `
      <div class="card">
        <h3>${s.name}</h3>
        <p>${s.price} đ</p>
        <button class="js-select-service" data-service-id="${s.id}">Đặt</button>
      </div>`;
  });
  div.querySelectorAll('.js-select-service').forEach((button) => {
    button.addEventListener('click', () => {
      selectService(button.dataset.serviceId);
    });
  });
}

function selectService(id){
  localStorage.setItem('serviceId', id);
  location.href='payment.html';
}

async function pay(){
  const user = JSON.parse(localStorage.getItem('user'));
  const serviceId = localStorage.getItem('serviceId');

  const res = await fetch(API+'/payment',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({userId:user.id,serviceId})
  });

  const d = await res.json();
  price.innerText=d.price;
  discount.innerText=d.discount;
  final.innerText=d.finalPrice;
}
