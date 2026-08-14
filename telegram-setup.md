# Уведомления о заказах в Telegram

Функция `telegram-order-notify` отправляет в выбранный чат Telegram данные заказа и загруженную фотографию. Токен бота не размещается на сайте и не попадает в GitHub.

## Однократная настройка

1. Создайте бота через [@BotFather](https://t.me/BotFather) и сохраните выданный токен у себя.
2. Добавьте бота в личный чат или рабочую группу. Для личного чата сначала отправьте боту команду `/start`.
3. Узнайте `chat_id` нужного чата. Его можно получить через метод Telegram `getUpdates` после отправки сообщения боту. Для группового чата значение обычно начинается с `-100`.
4. В Supabase Dashboard откройте **SQL Editor** и один раз выполните содержимое файла `telegram-notifications-migration.sql`.
5. Установите Supabase CLI, войдите в него и в папке сайта выполните команды ниже, подставив свои значения:

```powershell
npx supabase login
npx supabase link --project-ref ВАШ_PROJECT_REF
npx supabase secrets set TELEGRAM_BOT_TOKEN="ТОКЕН_БОТА" TELEGRAM_CHAT_ID="CHAT_ID"
npx supabase functions deploy telegram-order-notify --no-verify-jwt
```

`PROJECT_REF` — это часть адреса Supabase между `https://` и `.supabase.co`.

После этого каждый оформленный заказ будет сохранён в Supabase и сразу отправлен в Telegram. В заказе с несколькими холстами Telegram получит отдельное сообщение с фотографией по каждому холсту.
