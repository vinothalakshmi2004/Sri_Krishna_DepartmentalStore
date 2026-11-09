# GreenMart Backend

The REST API and real-time server for **GreenMart**, an in-house ordering system for a departmental store.

- Customers order from a public landing page. They don't need an account.
- Admins get a live notification for every new order. They manage orders, items, income, expenses, and store settings.

**Stack:** Node.js, Express 4, MongoDB (Mongoose 8), Socket.io, JWT, bcryptjs, multer, express-validator, helmet, express-rate-limit, json2csv.

---

## 1. Setup

### 1.1 Install MongoDB

You need MongoDB 5.0 or newer running on your machine (local install or Docker).

| OS | How |
|----|-----|
| **Windows** | Download the MSI from https://www.mongodb.com/try/download/community and choose "Install MongoDB as a Service". MongoDB then starts with Windows. |
| **macOS** | `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community` |
| **Ubuntu/Debian** | Follow https://www.mongodb.com/docs/manual/administration/install-on-linux/ and then run `sudo systemctl start mongod` |
| **Docker** | `docker run -d --name greenmart-mongo -p 27017:27017 mongo:7` |

To check that MongoDB is running, open `mongosh` and confirm it connects, or check that port `27017` is listening.

> **Shortcut on this PC (no install needed):** a portable MongoDB 7.0 is in the project's `mongodb/` folder.
> - Double-click `start-mongodb.bat` in the project root to start only MongoDB.
> - Double-click `start-greenmart.bat` to start MongoDB, the backend and the frontend together and open the browser.
>
> Data is stored in `mongodb/data`.

### 1.2 Install and run

```bash
cd backend
npm install
cp .env.example .env        # on Windows: copy .env.example .env
npm run dev                 # starts the server with nodemon (auto restart on code changes)
```

On a successful start you'll see:

```
[db] MongoDB connected: 127.0.0.1:27017/greenmart_test
[seed] Default admin created (username: "admin"). Change the password after first login.
[seed] Default store settings created
[seed] 10 sample grocery items added
[server] GreenMart API running on http://localhost:5000
```

**Log in with `admin` / `admin123`**, then change the password from the admin panel.

### 1.3 Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Starts the server with nodemon |
| `npm start` | Starts the server with node (for normal daily use) |
| `npm run seed` | Creates the default admin, settings, and sample items if missing, then exits |

### 1.4 Environment variables (`.env`)

| Key | Example | Meaning |
|-----|---------|---------|
| `PORT` | `5000` | Port for the API and Socket.io |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/greenmart_test` | MongoDB connection string |
| `JWT_SECRET` | `test_jwt_secret_change_me_123` | Secret for signing admin tokens. **Use a long random value in real use.** |
| `JWT_EXPIRES_IN` | `7d` | How long a login lasts (`12h`, `7d`, or a number of seconds) |
| `CLIENT_URL` | `http://localhost:5173` | Frontend origin(s) allowed by CORS and Socket.io. Separate several with commas. |
| `DEFAULT_ADMIN_USERNAME` | `admin` | Username for the first admin, used only when no admin exists |
| `DEFAULT_ADMIN_PASSWORD` | `admin123` | Password for the first admin |
| `NODE_ENV` | `development` | `production` hides internal error details |
| `MAX_UPLOAD_MB` | `5` | *(optional)* Maximum size of one image |
| `ORDER_RATE_LIMIT` | `10` | *(optional)* Maximum orders per IP address in 15 minutes |

The server reads `.env` only when it starts. **Restart the server after you change it.**

---

## 2. Project structure

```
backend/
├── server.js                 # App setup, routes, Socket.io, start-up
├── config/db.js              # MongoDB connection
├── models/                   # Mongoose schemas
│   ├── Admin.js  Item.js  Order.js  Expense.js  Income.js  Settings.js  Counter.js
├── routes/                   # URL + validation rules for each module
│   ├── public.js auth.js items.js orders.js expenses.js income.js
│   ├── settings.js dashboard.js customers.js reports.js
├── controllers/              # Request handlers (one per route file)
├── middleware/
│   ├── auth.js               # JWT protect + token verification (also used by Socket.io)
│   ├── upload.js             # multer image uploads
│   ├── validate.js           # express-validator result handler + shared rules
│   └── errorHandler.js       # 404 + central JSON error handler
├── utils/
│   ├── seed.js               # First-run admin, settings and sample items
│   ├── orderService.js       # Stock reserve/restore, order IDs, auto income
│   ├── socket.js             # Socket.io server + emit helpers
│   ├── envFile.js            # Read/update .env (System Settings)
│   ├── helpers.js            # Dates, pagination, sorting, sanitizers
│   ├── fileHelpers.js        # Upload paths and deletion
│   ├── constants.js          # Enums shared by models and validators
│   ├── AppError.js  asyncHandler.js
└── uploads/                  # Uploaded images (served at /uploads)
```

---

## 3. API conventions

- **Base URL:** `http://localhost:5000/api`
- **Admin authentication:** send the header `Authorization: Bearer <token>`. You get the token from `POST /api/auth/login`.
- **Successful responses** look like this:
  ```json
  { "success": true, "message": "optional", "data": { }, "pagination": { "total": 42, "page": 1, "limit": 20, "pages": 3 } }
  ```
- **Error responses** look like this. `message` is safe to show to the user directly.
  ```json
  { "success": false, "message": "Enter a valid 10-digit phone number", "errors": [ { "field": "phone", "message": "..." } ] }
  ```
  Status codes: `400` validation, `401` not logged in or bad token, `403` store closed, `404` not found, `409` duplicate or stock conflict, `413` body too large, `429` rate limited.
- **Dates:** send them as `YYYY-MM-DD`. Date filters (`from`, `to`) include both whole days, in the server's local time zone.
- **Lists:** accept `?page=1&limit=20&sort=-createdAt`. A leading `-` means descending, and only the fields listed for each endpoint can be used.
- **Images:** saved as paths like `/uploads/items/1729412345-ab12cd.jpg`. To display one, prefix the server URL: `http://localhost:5000/uploads/items/...`.
- **Enum values:**
  - Item units: `kg`, `g`, `litre`, `piece`, `packet`. Only `kg` and `litre` can be ordered in fractions such as 0.5.
  - Order status: `New`, `Confirmed`, `OutForDelivery`, `Delivered`, `Cancelled`
  - Payment status: `Pending`, `Paid`
  - Order payment mode: `Cash`, `GPay`, `PhonePe`, `UPI`, `Other`, `None`
  - Income/expense payment mode: `Cash`, `GPay`, `PhonePe`, `UPI`, `Card`, `BankTransfer`, `Other`
  - Expense category: `Purchase`, `Salary`, `Rent`, `Electricity`, `Transport`, `Other`

---

## 4. Public API (no login)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/public/settings` | Store information for the landing page: name, contact, map, hours, gallery, logo, delivery rules, `isStoreOpen` |
| GET | `/public/items?category=&search=&inStock=true` | Items marked available, sorted by category and then name. Each item has `inStock: true/false`. Add `inStock=true` to hide items that are out of stock. |
| GET | `/public/categories` | Array of category names, for example `["Dairy & Eggs", "Vegetables"]` |
| GET | `/public/offers` | Live offers for the landing page Offer Zone (see **Offers** below) |
| POST | `/public/orders` | Places an order. Limited to 10 per IP address every 15 minutes. |

### Place an order

```http
POST /api/public/orders
Content-Type: application/json

{
  "customerName": "Ravi Kumar",
  "phone": "9876543210",
  "address": "4, Gandhi Street, T Nagar",
  "landmark": "Near bus stand",
  "pincode": "600017",
  "note": "Please call before delivery",
  "items": [
    { "itemId": "6714f0c1a2b3c4d5e6f70801", "quantity": 2 },
    { "itemId": "6714f0c1a2b3c4d5e6f70808", "quantity": 0.5 }
  ]
}
```

The server checks these rules in order:

1. The store is open (`isStoreOpen`).
2. The pincode is in `allowedPincodes`. An empty list means every pincode is accepted.
3. Every item exists, is available, and has enough stock. Items that aren't sold in `kg` or `litre` need whole-number quantities.
4. The subtotal is at least `minOrderAmount`.

**The server recalculates prices from the database and ignores any price the client sends.** Delivery is free when the subtotal is at least `freeDeliveryAbove` (a value of 0 turns this off). Otherwise `deliveryCharge` is added. Stock is reduced atomically, so two customers can't buy the last unit. Admins then receive the `newOrder` socket event.

Response `201`:

```json
{ "success": true, "message": "Order placed successfully",
  "data": { "orderId": "ORD-0001", "status": "New", "items": [ ], "subtotal": 144, "deliveryCharge": 30, "grandTotal": 174, "createdAt": "..." } }
```

If items fail the checks, the response is `400`. `message` describes the first problem, and `errors[]` lists every problem item with its `itemId`, `name`, and `availableStock`.

---

## 5. Admin API (requires `Authorization: Bearer <token>`)

### Auth — `/api/auth`

| Method | Endpoint | Body | Notes |
|--------|----------|------|-------|
| POST | `/auth/login` | `{ username, password }` | Returns `{ token, expiresIn, admin }`. Allows 10 failed attempts per 15 minutes. |
| GET | `/auth/me` | | The admin who is logged in |
| PUT | `/auth/change-password` | `{ oldPassword, newPassword }` | Returns a new `token`. Older tokens stop working. |
| PUT | `/auth/change-username` | `{ username, name? }` | |

### Items — `/api/items`

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/items?search=&category=&isAvailable=true\|false&lowStock=true&page=&limit=&sort=` | Sort fields: `name`, `price`, `stock`, `category`, `createdAt`, `updatedAt`. Each item includes `isLowStock`. |
| GET | `/items/categories` | Every category in use |
| GET | `/items/:id` | |
| POST | `/items` | `multipart/form-data` with `name`, `price`, `category` (required) and `description`, `unit`, `stock`, `isAvailable`, `lowStockLimit`, plus an optional file field **`image`** |
| PUT | `/items/:id` | Same fields, all optional. Send a new `image` to replace the picture, or `removeImage=true` to remove it. |
| DELETE | `/items/:id` | Also deletes the image. Past orders keep their own copy of the item details. |
| PATCH | `/items/:id/toggle-availability` | Optional `{ isAvailable }`. Without it, the value flips. |
| PATCH | `/items/:id/stock` | `{ stock: 50 }` sets the stock, or `{ adjustBy: 20 }` / `{ adjustBy: -3 }` changes it. You can also send `lowStockLimit`. |

### Offers — `/api/offers`

Offers appear in the landing page **Offer Zone**. An offer is live when `isActive` is true and today is between `startDate` and `endDate`. If `endDate` is empty, the offer has no end.

There are two types:

- **`item`, a special price on one item.** While the offer is live, that item sells at `offerPrice` everywhere: the public item list (which then also returns `originalPrice` and `offerTitle`), the cart, and the order total the server calculates. Each order line saves both `price` and `originalPrice`. If two live offers target the same item, the lower price wins. If the item's normal price later falls below the offer price, the normal price is used.
- **`general`, an announcement only.** For example, "Free delivery this Sunday". It doesn't change any prices.

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/offers?status=active\|scheduled\|paused\|expired&search=` | Each offer has a `status` (`Active`, `Scheduled`, `Paused`, or `Expired`) and a `discountPercent`. The response also includes `statusCounts` for status tabs. |
| POST | `/offers` | `multipart/form-data` with `type`, `title`, `description`, `badge`, `item`, `offerPrice`, `startDate`, `endDate` (`""` means no end date), `isActive`, and an optional **`image`** file. For `item` offers, leaving `title` or `badge` empty generates them automatically, for example "Oil at just ₹149" and "10% OFF". |
| PUT | `/offers/:id` | Same fields, all optional. `removeImage=true` clears the image. |
| PATCH | `/offers/:id/toggle` | Optional `{ isActive }`. Pausing hides the offer and restores the normal price. |
| PATCH | `/offers/:id/repeat-today` | Runs an expired daily offer again for today only |
| DELETE | `/offers/:id` | |

Public: `GET /api/public/offers` returns the live offers, newest first. Item offers include the item with its current offer price, so a page can add it to the cart directly.

### Orders — `/api/orders` (`:id` can be the Mongo `_id` or `ORD-0001`)

| Method | Endpoint | Body / Notes |
|--------|----------|--------------|
| GET | `/orders?status=New,Confirmed&paymentStatus=&paymentMode=&from=&to=&search=&page=&limit=&sort=-createdAt` | `search` matches name, phone, or order ID. Sort fields: `createdAt`, `updatedAt`, `grandTotal`, `orderId`, `customerName`, `status`, `deliveredAt`. The response also includes `statusCounts: { All, New, Confirmed, OutForDelivery, Delivered, Cancelled }`, which applies every filter except `status` and is meant for status tabs. |
| GET | `/orders/:id` | The full order, plus `incomeEntry` if one was created automatically |
| PATCH | `/orders/:id/status` | `{ status, note? }`. Setting `Cancelled` does the same as cancel. |
| PATCH | `/orders/:id/payment` | `{ paymentStatus: "Paid", paymentMode: "GPay" }`. `Paid` needs a payment mode other than `None`. |
| PATCH | `/orders/:id/note` | `{ adminNote }` |
| PATCH | `/orders/:id/cancel` | `{ reason? }`. Puts the stock back. |
| DELETE | `/orders/:id` | Deletes the order and its automatic income entry. Stock is put back unless the order was delivered. |

**Order rules**

- A cancelled order is final and can't be moved to another status.
- Stock goes back exactly once, even if cancel or delete is clicked twice.
- **Automatic income:** when an order is both `Delivered` and `Paid`, one Income entry (`source: "Order"`) is created. If the order later moves away from Delivered, or its payment goes back to Pending, that entry is removed. If it becomes Delivered and Paid again, the entry is recreated.

### Expenses — `/api/expenses`

| Method | Endpoint | Body / Notes |
|--------|----------|--------------|
| GET | `/expenses?category=&paymentMode=&from=&to=&search=&page=&limit=&sort=-date` | The response also has `totalAmount` for the whole filtered list (not just the current page), and `categorySummary: [{ category, total, count }]` |
| GET | `/expenses/:id` | |
| POST | `/expenses` | `{ title, category, amount, date?, paymentMode?, note? }` |
| PUT | `/expenses/:id` | Any of the fields above |
| DELETE | `/expenses/:id` | |

### Income — `/api/income`

| Method | Endpoint | Body / Notes |
|--------|----------|--------------|
| GET | `/income?source=Order\|Manual&paymentMode=&from=&to=&search=&page=&limit=&sort=-date` | Includes `totalAmount` and `sourceSummary: { Order, Manual }`. `orderRef` is filled with the order's ID, customer, and total. |
| GET | `/income/:id` | |
| POST | `/income` | `{ amount, date?, paymentMode?, note? }`. Always saved as `Manual`. |
| PUT | `/income/:id` | **Manual entries only** |
| DELETE | `/income/:id` | **Manual entries only.** Order entries change only through their order. |

### Store settings — `/api/settings`

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/settings` | |
| PUT | `/settings` | JSON or `multipart/form-data`. Text fields: `storeName`, `tagline`, `about`, `phone` (the main number), `extraPhones` (up to 5 other numbers, as an array or `"9360586396,6385754323"`), `whatsapp`, `email`, `address`, `mapEmbedUrl` (an https URL or the whole Google Maps `<iframe>` code), `openingHours`, `deliveryCharge`, `freeDeliveryAbove`, `minOrderAmount`, `isStoreOpen`, `allowedPincodes` (an array or `"600001,600002"`), `socialLinks` (an object, JSON text, or `socialLinks[facebook]=...`, with keys `facebook`, `instagram`, `youtube`, `twitter`). Files: **`logo`** (square icon for the header, admin menu and browser tab), **`logoFull`** (wide logo with the store name for the footer, login page and printed bill) and **`heroImage`** each replace the current image; **`galleryImages`** (up to 10 per request, 20 in total) are added to the gallery. |
| DELETE | `/settings/image?type=logo\|logoFull\|heroImage\|gallery&url=/uploads/settings/x.jpg` | `url` is required only for gallery images |

### System settings (`.env`) — `/api/settings/system`

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/settings/system` | Returns `mongoUri` (password masked), `jwt { secret (masked), secretLength, isWeakSecret, expiresIn }`, `port`, `clientUrl`, `nodeEnv`, `restartRequired`, and `warning` |
| PUT | `/settings/system` | `{ MONGO_URI?, JWT_SECRET?, JWT_EXPIRES_IN?, PORT?, CLIENT_URL? }`. Responds `{ message: "Restart server to apply", warning, data }`. |

> ⚠️ **Warning:** these values control the whole system.
> - A wrong `MONGO_URI` stops the server from reaching the database.
> - Changing `JWT_SECRET` logs out every admin.
> - Changing `PORT` or `CLIENT_URL` needs matching changes in the frontend.
>
> The new values are written to `.env`, and the previous file is saved as `.env.backup`. **Nothing changes until the server is restarted.** Masked values (any value containing `****`) sent back unchanged are ignored. The frontend should show the `warning` text from the response before saving.

### Dashboard — `/api/dashboard`

`GET /dashboard/stats?range=today|week|month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD`

- `week` starts on Monday. `month` starts on the 1st. `custom` needs both `from` and `to`.
- Response `data`:

```json
{
  "range": { "type": "today", "from": "...", "to": "..." },
  "totalOrders": 12, "newOrders": 3, "pendingOrders": 5, "deliveredOrders": 6, "cancelledOrders": 1,
  "statusBreakdown": { "New": 3, "Confirmed": 1, "OutForDelivery": 1, "Delivered": 6, "Cancelled": 1 },
  "totalSales": 5230, "totalIncome": 4100, "totalExpense": 1500, "profit": 2600,
  "pendingPaymentAmount": 1130, "pendingPaymentCount": 4,
  "openOrders": { "new": 3, "pending": 5 },
  "topSellingItems": [ { "itemId": "...", "name": "Tomato", "unit": "kg", "quantity": 14.5, "revenue": 580, "orders": 9 } ],
  "lowStockItems": [ { "name": "Turmeric Powder 100 g", "stock": 4, "lowStockLimit": 5, "unit": "packet" } ],
  "lowStockCount": 1,
  "salesChart": {
    "last7Days":  [ { "date": "2026-10-14", "label": "14 Oct", "orders": 3, "sales": 950, "income": 800, "expense": 250 } ],
    "last30Days": [ ]
  },
  "paymentModeSplit": [ { "mode": "GPay", "count": 4, "amount": 2100 } ]
}
```

- `openOrders`, `lowStock*`, and `salesChart` ignore the selected range and always show the current picture. Every other figure uses the selected range.
- `totalSales` is the total value of orders that weren't cancelled. `totalIncome` is the sum of income entries, both automatic and manual.

### Customers — `/api/customers`

Customers are built by grouping orders by phone number.

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/customers?search=&page=&limit=&sort=-lastOrderDate` | Each customer has `name`, `phone`, `totalOrders`, `deliveredOrders`, `cancelledOrders`, `totalSpent` (cancelled orders excluded), `lastOrderDate`, `firstOrderDate`, and `lastAddress`. Sort fields: `lastOrderDate`, `totalSpent`, `totalOrders`, `name`, `firstOrderDate`. |
| GET | `/customers/:phone` | One customer's summary and the full list of their orders |

### Reports (CSV) — `/api/reports`

| Endpoint | Filters |
|----------|---------|
| GET `/reports/orders` | `from`, `to`, `status`, `paymentStatus` |
| GET `/reports/income` | `from`, `to`, `source` |
| GET `/reports/expenses` | `from`, `to`, `category` |

Each report downloads as a file such as `orders_2026-10-01_to_2026-10-20.csv`. The file is UTF-8 with a byte order mark (BOM), so it opens correctly in Excel. Because the request needs the auth header, download it like this:

```js
const res = await axios.get(`${API}/reports/orders`, {
  params: { from: '2026-10-01', to: '2026-10-31' },
  headers: { Authorization: `Bearer ${token}` },
  responseType: 'blob',
});
const url = URL.createObjectURL(res.data);
const a = document.createElement('a');
a.href = url;
a.download = 'orders.csv';
a.click();
URL.revokeObjectURL(url);
```

---

## 6. Real-time notifications (Socket.io)

Only admins can connect. The token is checked during the handshake, and connections without a valid token are rejected.

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', { auth: { token } });

socket.on('connect_error', (err) => console.log(err.message)); // e.g. "Session expired. Please log in again."
socket.on('newOrder', (order) => { /* play a sound, show a toast, refresh the list */ });
socket.on('orderUpdated', (order) => { /* order.change = 'status' | 'payment' | 'cancel' */ });
socket.on('orderDeleted', ({ _id, orderId }) => { });
socket.on('lowStock', (items) => { /* [{ name, stock, unit, lowStockLimit }] */ });
```

| Event | When | Payload |
|-------|------|---------|
| `newOrder` | A customer places an order | `{ _id, orderId, customerName, phone, address, pincode, itemCount, subtotal, deliveryCharge, grandTotal, status, paymentStatus, paymentMode, createdAt }` |
| `orderUpdated` | Status, payment, or cancel changes | The same summary plus `change` |
| `orderDeleted` | An order is deleted | `{ _id, orderId }` |
| `lowStock` | An order leaves items at or below their low stock limit | An array of items |

---

## 7. Security notes

- Passwords are hashed with bcrypt. Tokens expire after `JWT_EXPIRES_IN` and stop working once the password is changed.
- helmet sets secure headers. CORS only allows origins listed in `CLIENT_URL`.
- Order placement and login are rate limited.
- All input is validated. Search text is escaped before it's used in a regex, and sort fields come from an allow-list.
- Uploads must be JPG, PNG, WEBP, or GIF images of 5 MB or less, and they're saved under random file names.
- In CSV exports, text that starts with `=`, `+`, `-`, or `@` gets a leading `'` so Excel shows it as text instead of running it as a formula.
- **Before real use:** change the admin password, set a long random `JWT_SECRET`, and set `NODE_ENV=production`.

---

## 8. Troubleshooting

| Problem | Fix |
|---------|-----|
| `MongoDB connection failed` | Start MongoDB (Windows: `services.msc` → MongoDB → Start) and check `MONGO_URI` |
| `Port 5000 is already in use` | Stop the other process or change `PORT` in `.env` |
| The frontend gets CORS errors | Add the frontend's exact origin (protocol + host + port) to `CLIENT_URL` and restart |
| Images don't show in the frontend | Use `http://localhost:5000` + the stored `/uploads/...` path |
| `Too many orders from this device` | Wait 15 minutes, or raise `ORDER_RATE_LIMIT` |
| You forgot the admin password | Delete the admin from the `admins` collection in `mongosh` and restart. The default admin is created again. |
