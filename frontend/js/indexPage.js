/*
document.addEventListener('DOMContentLoaded', () => {
  document.title = 'BeautyCare | Nen tang TMDT dich vu lam dep an toan';

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const faqs = Array.from(document.querySelectorAll('.faq-item'));
  faqs.forEach((faq) => {
    faq.addEventListener('toggle', () => {
      if (!faq.open) return;
      faqs.forEach((item) => {
        if (item !== faq) item.open = false;
      });
    });
  });

  const footerBottom = document.querySelector('.footer-bottom');
  if (footerBottom) {
    footerBottom.textContent = '© BeautyCare Service Commerce Demo • Secure booking and payment research prototype';
  }
});
*/

document.addEventListener('DOMContentLoaded', () => {
  document.title = 'BeautyCare | Nền tảng TMĐT dịch vụ làm đẹp an toàn';

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const faqs = Array.from(document.querySelectorAll('.faq-item'));
  faqs.forEach((faq) => {
    faq.addEventListener('toggle', () => {
      if (!faq.open) return;
      faqs.forEach((item) => {
        if (item !== faq) item.open = false;
      });
    });
  });

  const footerBottom = document.querySelector('.footer-bottom');
  if (footerBottom) {
    footerBottom.textContent = '© BeautyCare Demo • Nền tảng đặt lịch, thanh toán và hội viên cho dịch vụ làm đẹp';
  }
});
