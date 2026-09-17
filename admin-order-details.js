// Loaded only by the administrator page; RLS remains the authorization boundary.
window.CanvasOrderDetails = (() => {
  const noteId = () => {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
  const statuses = { new: 'Новый', in_progress: 'В работе', shipped: 'Отправлен', done: 'Готов', cancelled: 'Отменён' };
  const make = (tag, text) => { const el = document.createElement(tag); if (text) el.textContent = text; return el; };
  const date = value => new Date(value).toLocaleString('ru-RU');
  function attach(host, client, orderId) {
    const details = make('details'); details.className = 'order-details';
    details.append(make('summary', 'Доставка, история и внутренние заметки'));
    const message = make('p'); message.setAttribute('role', 'status');
    const content = make('div'); details.append(message, content); host.append(details);
    let loading = false, loaded = false;
    // Updating a status must not replace forms containing unsaved input.
    const historyChanged = make('p');
    historyChanged.hidden = true;
    const refresh = make('button', 'Обновить историю'); refresh.type = 'button';
    historyChanged.append(refresh); details.append(historyChanged);
    let refreshHistory = null;
    refresh.onclick = async () => {
      if (!refreshHistory || refresh.disabled) return;
      refresh.disabled = true;
      try { await refreshHistory(); historyChanged.hidden = true; }
      catch { message.textContent = 'Не удалось обновить историю. Введённые данные сохранены в форме.'; }
      finally { refresh.disabled = false; }
    };
    async function load() {
      if (loading) return;
      loading = true; message.textContent = 'Загружаем подробности…';
      try {
        const results = await Promise.all([
          client.from('order_delivery').select('carrier,tracking_number').eq('order_id', orderId).maybeSingle(),
          client.from('order_status_history').select('id,changed_at,previous_status,new_status').eq('order_id', orderId).order('changed_at', { ascending: false }).order('id', { ascending: false }).limit(100),
          client.from('order_internal_notes').select('id,created_at,body').eq('order_id', orderId).order('created_at', { ascending: false }).limit(100),
        ]);
        if (results.some(result => result.error)) throw new Error('load');
        content.replaceChildren();
        const delivery = results[0].data || {};
        const form = make('form');
        form.append(make('h3', 'Доставка'));
        const field = (labelText, value) => {
          const label = make('label', labelText), input = make('input');
          input.value = value || ''; input.maxLength = 120; label.append(input); form.append(label); return input;
        };
        const carrier = field('Служба доставки', delivery.carrier);
        const tracking = field('Трек-номер', delivery.tracking_number);
        const save = make('button', 'Сохранить доставку'); save.type = 'submit'; form.append(save);
        form.onsubmit = async event => {
          event.preventDefault(); if (save.disabled) return;
          save.disabled = true; message.textContent = 'Сохраняем доставку…';
          try {
            const { data, error } = await client.from('order_delivery').upsert({ order_id: orderId, carrier: carrier.value.trim(), tracking_number: tracking.value.trim() }, { onConflict: 'order_id' }).select('order_id').single();
            if (error || !data) throw new Error('save');
            message.textContent = 'Данные доставки сохранены.';
          } catch { message.textContent = 'Не удалось сохранить доставку. Проверьте подключение и повторите.'; }
          finally { save.disabled = false; }
        };
        content.append(form, make('h3', 'Последние изменения статуса'));
        const history = make('ul');
        const emptyHistory = make('p', 'Записей пока нет. Старые изменения не восстанавливаются задним числом.');
        const renderHistory = events => {
          history.replaceChildren();
          for (const event of events || []) history.append(make('li', `${date(event.changed_at)}: ${statuses[event.previous_status] || event.previous_status || '—'} → ${statuses[event.new_status] || event.new_status}`));
          emptyHistory.hidden = history.children.length > 0;
        };
        renderHistory(results[1].data);
        refreshHistory = async () => {
          const { data, error } = await client.from('order_status_history').select('id,changed_at,previous_status,new_status').eq('order_id', orderId).order('changed_at', { ascending: false }).order('id', { ascending: false }).limit(100);
          if (error) throw error;
          renderHistory(data);
        };
        content.append(history, emptyHistory);
        content.append(make('h3', 'Внутренние заметки'), make('p', 'Клиент не видит эти заметки. Исправления добавляйте новой записью.'));
        const notes = make('ul');
        for (const note of results[2].data || []) notes.append(make('li', `${date(note.created_at)} — ${note.body}`));
        content.append(notes);
        const noteForm = make('form'), label = make('label', 'Новая заметка'), text = make('textarea');
        text.required = true; text.maxLength = 4000; label.append(text);
        const add = make('button', 'Добавить заметку'); add.type = 'submit';
        noteForm.append(label, add); content.append(noteForm);
        let attempt = null;
        noteForm.onsubmit = async event => {
          event.preventDefault(); if (add.disabled) return;
          const body = text.value.trim(); if (!body) { message.textContent = 'Введите текст заметки.'; return; }
          add.disabled = true; message.textContent = 'Сохраняем заметку…';
          try {
            // Keep ID across a retry after a lost response; do not invent a second note.
            if (!attempt || attempt.body !== body) attempt = { id: noteId(), order_id: orderId, body };
            const { error } = await client.from('order_internal_notes').insert(attempt);
            if (error) {
              if (error.code !== '23505') throw error;
              const existing = await client.from('order_internal_notes').select('id,body').eq('id', attempt.id).eq('order_id', orderId).single();
              if (existing.error || existing.data?.body !== body) throw error;
            }
            notes.prepend(make('li', `Только что — ${body}`));
            attempt = null;
            // Preserve edits made while the request was in flight.
            if (text.value.trim() === body) text.value = '';
            message.textContent = 'Заметка сохранена.';
          } catch { message.textContent = 'Не удалось подтвердить сохранение заметки. Можно повторить отправку.'; }
          finally { add.disabled = false; }
        };
        loaded = true; message.textContent = '';
      } catch {
        message.textContent = 'Подробности пока недоступны. Закройте и откройте раздел для повторной загрузки.';
      } finally { loading = false; }
    }
    details.addEventListener('toggle', () => { if (details.open && !loaded) void load(); });
    host.addEventListener('order-status-saved', () => { if (loaded) historyChanged.hidden = false; });
  }
  return { attach };
})();
