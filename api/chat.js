fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'signup',
    data: {
      email: 'test' + Date.now() + '@example.com',
      password: 'Test123456',
      profile: {
        nm: 'Pippo',
        cg: 'Test',
        et: 35,
        sx: 'M',
        ps: 70,
        al: 175,
        at: '1.55',
        ob: 'mantenere',
        lav: 'sedentario',
        po: 70,
        fab: { kc: 2000, pr: 120, cb: 220, gr: 60, bmr: 1600, tdee: 1800, bonusLav: 0, tef: 200 },
        schede: [
          { id: 'A', nm: 'Scheda A', ex: [] },
          { id: 'B', nm: 'Scheda B', ex: [] }
        ],
        act_s: 'A',
        marketing: false
      }
    }
  })
}).then(async r => {
  const text = await r.text();
  console.log('STATUS:', r.status);
  console.log('RESPONSE:', text);
});      
