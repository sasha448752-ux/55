window.CanvasCustomerOrderDetails = (() => {
  const names = { new: 'Новый', in_progress: 'В работе', shipped: 'Отправлен', done: 'Готов', cancelled: 'Отменён' };
  const node = (tag, text) => { const el = document.createElement(tag); el.textContent = text || ''; return el; };
  function attach(details, client, orderId) {
    const section = node('section'), output = node('div'), message = node('p');
    message.setAttribute('role', 'status');
    const refresh = node('button', 'Обновить доставку и историю'); refresh.type = 'button'; refresh.className = 'secondary';
    section.append(output, message, refresh); details.append(section);
    async function load() {
      if (refresh.disabled) return;
      refresh.disabled = true; message.textContent = 'Загружаем доставку и историю…';
      try {
        // RLS verifies ownership on both tables, including direct requests by ID.
        const [delivery, history] = await Promise.all([
          client.from('order_delivery').select('carrier,tracking_number').eq('order_id', orderId).maybeSingle(),
          client.from('order_status_history').select('changed_at,previous_status,new_status,id').eq('order_id', orderId).order('changed_at', { ascending: false }).order('id', { ascending: false }).limit(100),
        ]);
        if (delivery.error || history.error) throw new Error('load');
        output.replaceChildren(node('h3', 'Доставка'));
        if (delivery.data?.carrier || delivery.data?.tracking_number) {
          output.append(node('p', `Служба доставки: ${delivery.data.carrier || 'Не указана'}`), node('p', `Трек-номер: ${delivery.data.tracking_number || 'Пока не указан'}`));
        } else output.append(node('p', 'Данные доставки появятся после отправки заказа.'));
        output.append(node('h3', 'Последние изменения статуса'));
        if (!history.data?.length) output.append(node('p', 'История изменений пока отсутствует. Текущий статус указан выше.'));
        else {
          const list = node('ul');
          for (const event of history.data) list.append(node('li', `${new Date(event.changed_at).toLocaleString('ru-RU')}: ${names[event.previous_status] || event.previous_status || '—'} → ${names[event.new_status] || event.new_status}`));
          output.append(list);
        }
        message.textContent = '';
      } catch { message.textContent = 'Не удалось обновить данные. Попробуйте ещё раз.'; }
      finally { refresh.disabled = false; }
    }
    refresh.onclick = load;
    details.addEventListener('toggle', () => { if (details.open) void load(); });
  }
  return { attach };
})();
