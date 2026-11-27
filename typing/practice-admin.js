(() => {
  const $ = id => document.getElementById(id);
  const form = $('practiceForm');
  const saved = $('practiceSaved');
  const set = $('practiceSet');
  const count = $('practiceCount');
  const all = $('practiceAll');
  const status = $('practiceStatus');
  const url = $('practiceUrl');
  const copy = $('practiceCopy');
  let links = [];

  async function management(path, method = 'GET', payload) {
    const response = await fetch('/api/typing' + path, {
      method,
      headers: payload ? { 'Content-Type': 'application/json' } : {},
      body: payload ? JSON.stringify(payload) : undefined
    });
    if (response.status === 401) location.reload();
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '잠시 뒤 다시 시도해 주세요.');
    return data;
  }

  function render() {
    const link = links.find(x => x.token === saved.value);
    $('practiceLabel').value = link?.label || '';
    if (link) set.value = link.set_id;
    $('practiceMode').value = link?.mode || 'dictation';
    all.checked = link?.count === 'all';
    count.value = all.checked ? 10 : link?.count || 10;
    count.disabled = all.checked;
    $('practiceActive').checked = link?.active ?? true;
    url.hidden = copy.hidden = !link;
    url.value = link ? location.origin + '/haru/typing/shared#' + link.token : '';
  }

  async function load(token = saved.value) {
    const [data, catalog] = await Promise.all([management('/practice-links'), management('/sets')]);
    links = data.links;
    set.replaceChildren(...catalog.sets.map(entry => new Option(entry.name, entry.id)));
    saved.replaceChildren(new Option('새 링크', ''), ...links.map(link =>
      new Option(link.label + (link.active ? '' : ' (중지됨)'), link.token)));
    saved.value = token;
    render();
  }

  saved.addEventListener('change', render);
  all.addEventListener('change', () => { count.disabled = all.checked; });
  set.addEventListener('focus', async () => {
    try {
      const value = set.value;
      const { sets } = await management('/sets');
      set.replaceChildren(...sets.map(entry => new Option(entry.name, entry.id)));
      if (sets.some(entry => String(entry.id) === value)) set.value = value;
    } catch (error) { status.textContent = error.message; }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      const token = saved.value;
      const { link } = await management('/practice-links' + (token ? '/' + token : ''), token ? 'PUT' : 'POST', {
        label: $('practiceLabel').value,
        set_id: set.value,
        mode: $('practiceMode').value,
        count: all.checked ? 'all' : count.value,
        active: $('practiceActive').checked
      });
      await load(link.token);
      status.textContent = link.active ? '저장했어요. 아이에게 링크를 보내 주세요.' : '링크를 중지했어요.';
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url.value);
      status.textContent = '링크를 복사했어요.';
    } catch {
      url.select();
      status.textContent = '선택한 링크를 복사해 주세요.';
    }
  });
  $('guardianLogout').addEventListener('click', async () => {
    try { await management('/session', 'DELETE'); location.reload(); }
    catch (error) { status.textContent = error.message; }
  });
  load().catch(error => { status.textContent = error.message; });
})();
