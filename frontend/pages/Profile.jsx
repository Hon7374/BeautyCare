export default function Profile() {
  const user = JSON.parse(localStorage.getItem("user"));

  const discount = user.member === "vip" ? 20 :
                   user.member === "gold" ? 10 : 0;

  return (
    <div>
      <h3>{user.name}</h3>
      <p>Hạng: {user.member}</p>
      <p>Giảm giá: {discount}%</p>
    </div>
  );
}
