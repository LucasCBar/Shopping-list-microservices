// client-demo.js  —  Fluxo completo via API Gateway (porta 3000)
const BASE = process.env.GW_URL || 'http://localhost:3000';

async function req(method, path, body, token) {
  const headers = { 'accept': 'application/json' };
  if (body != null) headers['content-type'] = 'application/json';
  if (token) headers['authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} → ${JSON.stringify(data)}`);
  return data;
}

function title(t) {
  const line = '-'.repeat(t.length);
  console.log(`\n${t}\n${line}`);
}

(async () => {
  // 0) Checar health do gateway
  title('0) Gateway /health');
  console.log(await req('GET', '/health'));

  // 1) Registrar usuário (email random p/ não conflitar)
  const rnd = Math.floor(Math.random() * 1e6);
  const email = `demo${rnd}@example.com`;
  const username = `demo${rnd}`;
  title('1) Registro');
  const reg = await req('POST', '/api/auth/register', {
    email, username, password: '123456', firstName: 'Demo'
  });
  console.log(reg);

  // 2) Login
  title('2) Login');
  const login = await req('POST', '/api/auth/login', { email, password: '123456' });
  console.log({ user: login.user });
  const token = login.token;

  // 3) Buscar itens (usar um termo comum do seed, ex.: "Arroz")
  title('3) Buscar itens (q=arroz)');
  const items = await req('GET', '/api/search?q=arroz', null, token);
  console.log({ totalItemsFound: items.items.length });
  const chosenItem = items.items[0] || (await req('GET', '/api/items'))[0];

  if (!chosenItem) throw new Error('Nenhum item encontrado. Verifique o item-service.');
  console.log({ chosenItem: { id: chosenItem.id, name: chosenItem.name, price: chosenItem.averagePrice } });

  // 4) Criar lista
  title('4) Criar lista');
  const list = await req('POST', '/api/lists', { name: 'Compras da semana', description: 'Gerada pelo client-demo' }, token);
  console.log({ listId: list.id, name: list.name });

  // 5) Adicionar item à lista
  title('5) Adicionar item à lista');
  const added = await req('POST', `/api/lists/${list.id}/items`, {
    itemId: chosenItem.id, quantity: 2
  }, token);
  console.log(added);

  // 6) Buscar resumo da lista
  title('6) Resumo da lista');
  const summary = await req('GET', `/api/lists/${list.id}/summary`, null, token);
  console.log(summary);

  // 7) Dashboard
  title('7) Dashboard do usuário');
  const dash = await req('GET', '/api/dashboard', null, token);
  console.log(dash);

  console.log('\n✅ Fluxo completo concluído com sucesso!');
})().catch(err => {
  console.error('\n❌ Erro no client-demo:', err.message);
  process.exit(1);
});
