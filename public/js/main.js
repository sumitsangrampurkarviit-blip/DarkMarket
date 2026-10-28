// Auto-dismiss alerts
document.querySelectorAll('.alert').forEach(el => {
  setTimeout(() => el.style.opacity = '0', 4000);
  setTimeout(() => el.remove(), 4500);
});

// Copy to clipboard
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    const toast = document.createElement('div');
    toast.className = 'alert ok';
    toast.textContent = 'Copied!';
    document.body.prepend(toast);
    setTimeout(() => toast.remove(), 2000);
  });
}

// ── Live purchase ticker ──────────────────────────────────────
(function() {
  const el = document.getElementById('ticker');
  if (!el) return;

  const names = [
    'Rahul S.','Priya M.','Amit K.','Sneha R.','Vikram P.','Ananya T.','Rohan G.','Kavya N.',
    'Arjun D.','Pooja L.','Suresh B.','Deepa V.','Kiran J.','Sanjay H.','Meera C.',
    'Ahmed K.','Fatima Z.','Omar H.','Zara A.','Hassan M.','Aisha R.','Yusuf T.','Layla N.',
    'Ibrahim S.','Noor F.','Tariq B.','Samira E.','Khalid O.','Mariam D.','Bilal Q.',
    'Ali R.','Sara H.','Mohammed A.','Hana Y.','Usman K.','Rania S.','Faisal M.','Dina T.',
    'Raj P.','Neha S.','Arun T.','Divya K.','Varun M.','Shreya B.','Nikhil R.','Isha G.',
    'Carlos M.','Lena K.','Marco V.','Yuki T.','Chen W.','Sofia B.','Ivan P.','Mia L.'
  ];
  const cards = [
    'Steam $25','PSN $50','Xbox $25','Steam $50','Nintendo $25',
    'Google Play $25','iTunes $25','Amazon $50','Steam $10','PSN $25',
    'Xbox $50','Steam $100','Amazon $25','iTunes $50','PSN $10'
  ];
  const amounts = [50,75,100,120,150,175,200,225,250,275,300];

  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function ago() {
    const m = Math.floor(Math.random() * 118) + 1;
    return m < 60 ? m + 'm ago' : Math.floor(m/60) + 'h ago';
  }

  const items = Array.from({ length: 20 }, () =>
    `<span class="ticker-item">🔒 <span>${rand(names)}</span> purchased <strong>${rand(cards)}</strong> · <strong>$${rand(amounts)}</strong> · <em>${ago()}</em></span>`
  );
  // Duplicate for seamless infinite CSS scroll
  el.innerHTML = [...items, ...items].join('');
})();
