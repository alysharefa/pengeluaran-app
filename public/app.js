(() => {
  'use strict';

  const form = document.getElementById('form');
  const inputKeterangan = document.getElementById('keterangan');
  const inputKategori = document.getElementById('kategori');
  const inputJumlah = document.getElementById('jumlah');
  const btnSubmit = document.getElementById('submit');
  const btnCancel = document.getElementById('cancel');
  const list = document.getElementById('list');
  const emptyNote = document.getElementById('empty');
  const totalEl = document.getElementById('total');
  const countEl = document.getElementById('count');
  const messageEl = document.getElementById('message');

  const rupiah = new Intl.NumberFormat('id-ID');
  const dateFormat = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

  let items = [];
  let editingId = null;

  async function api(path, options = {}) {
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Permintaan gagal diproses.');
    return data;
  }

  function showMessage(text) {
    messageEl.textContent = text || '';
    messageEl.hidden = !text;
  }

  function resetForm() {
    editingId = null;
    form.reset();
    btnSubmit.textContent = 'Tambah pengeluaran';
    btnCancel.hidden = true;
  }

  function startEdit(item) {
    editingId = item.id;
    inputKeterangan.value = item.keterangan;
    inputKategori.value = item.kategori;
    inputJumlah.value = item.jumlah;
    btnSubmit.textContent = 'Simpan perubahan';
    btnCancel.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    inputKeterangan.focus();
  }

  function buildRow(item) {
    const li = document.createElement('li');
    li.className = 'row';

    const info = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = item.keterangan;

    const meta = document.createElement('div');
    meta.className = 'meta';
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = item.kategori;
    const when = document.createElement('time');
    when.dateTime = item.createdAt;
    when.textContent = dateFormat.format(new Date(item.createdAt));
    meta.append(chip, when);
    info.append(title, meta);

    const amount = document.createElement('div');
    amount.className = 'amount';
    amount.textContent = 'Rp ' + rupiah.format(item.jumlah);

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn quiet small';
    edit.textContent = 'Ubah';
    edit.addEventListener('click', () => startEdit(item));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn danger small';
    remove.textContent = 'Hapus';
    remove.addEventListener('click', () => removeItem(item));
    actions.append(edit, remove);

    li.append(info, amount, actions);
    return li;
  }

  function render() {
    list.replaceChildren(...items.map(buildRow));
    emptyNote.hidden = items.length > 0;
    const total = items.reduce((sum, item) => sum + item.jumlah, 0);
    totalEl.textContent = 'Rp ' + rupiah.format(total);
    countEl.textContent = items.length + ' transaksi';
  }

  async function load() {
    try {
      items = await api('/api/expenses');
      showMessage('');
      render();
    } catch (err) {
      showMessage(err.message);
    }
  }

  async function removeItem(item) {
    if (!window.confirm('Hapus pengeluaran "' + item.keterangan + '"?')) return;
    try {
      await api('/api/expenses/' + item.id, { method: 'DELETE' });
      if (editingId === item.id) resetForm();
      await load();
    } catch (err) {
      showMessage(err.message);
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = JSON.stringify({
      keterangan: inputKeterangan.value,
      kategori: inputKategori.value,
      jumlah: inputJumlah.value,
    });
    try {
      if (editingId) {
        await api('/api/expenses/' + editingId, { method: 'PUT', body: payload });
      } else {
        await api('/api/expenses', { method: 'POST', body: payload });
      }
      resetForm();
      await load();
    } catch (err) {
      showMessage(err.message);
    }
  });

  btnCancel.addEventListener('click', () => {
    resetForm();
    showMessage('');
  });

  load();
})();
