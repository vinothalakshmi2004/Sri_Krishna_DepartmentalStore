# GreenMart Frontend

This is the customer ordering website and admin portal for **GreenMart**. It's built with React (Vite) and plain JavaScript, and talks to the GreenMart backend (Node.js + Express + MongoDB) at `http://localhost:5000`.

- **Customer website** (no login): a landing page, product ordering, cart, checkout, and order success. It's designed for phones first and has a sticky cart bar at the bottom.
- **Admin portal** (`/admin`): live order alerts with sound, a dashboard and charts, orders, items, income, expenses, customers, CSV reports, store settings, and account security.

**Tech:** React 18, Vite 6, React Router 6, Tailwind CSS 4, Axios, socket.io-client, Recharts, react-hot-toast, lucide-react

---

## 1. Setup

### Prerequisites

- Node.js 18 or newer
- The GreenMart backend, set up and running (see `../backend/README.md`)

### Install and run

```bash
# 1. Start the backend first (in another terminal)
cd backend
npm run dev                 # API on http://localhost:5000

# 2. Start the frontend
cd frontend
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm run dev                 # http://localhost:5173
```

Then open these addresses:

| URL | What you get |
|-----|--------------|
| http://localhost:5173 | Customer website |
| http://localhost:5173/admin | Admin portal (log in with **admin / admin123** on first run) |

**Change the admin password straight away**, under **Account & Security**.

### Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Development server with hot reload (also reachable on your local network) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serves the production build locally |

### Environment (`.env`)

| Key | Default | Meaning |
|-----|---------|---------|
| `VITE_API_URL` | `http://localhost:5000` | Backend address (no trailing slash). Images are loaded from `VITE_API_URL/uploads/...` |

Vite reads `.env` only when it starts, so restart `npm run dev` after you change it.

### Opening the site on phones (shop Wi-Fi)

`npm run dev` also listens on your local network and prints a URL such as `http://192.168.1.20:5173`. To use it from a phone:

1. In `frontend/.env`, set `VITE_API_URL=http://192.168.1.20:5000` (the PC's IP address).
2. In `backend/.env`, add the frontend URL to `CLIENT_URL`, for example `CLIENT_URL=http://localhost:5173,http://192.168.1.20:5173`.
3. Restart both servers.

---

## 2. Features

### Customer website

| Page | Highlights |
|------|------------|
| `/` Home | Hero with the store's open/closed badge, an **Offer Zone** (today's offers from the admin; item offers can be added to the cart right there, at the offer price), About, Why choose us, 6 featured products, gallery with a lightbox (swipe and arrow keys work), and Contact with click-to-call, WhatsApp, email, opening hours, and the Google Map. **Every piece of content comes from Store Settings.** |
| `/order` Products | Instant search, category chips with counts, an "in stock only" toggle, Add to Cart that turns into +/- buttons, out-of-stock labels, and a "Store is closed" banner. The category and search are kept in the URL so you can share a filtered link. |
| `/cart` | Change quantities, remove lines, see the delivery charge (free above the store's limit), a "minimum order" warning, and a "add ₹X more for free delivery" hint. On phones there's a sticky checkout bar. |
| `/checkout` | Name, 10-digit phone, address, landmark, 6-digit pincode (checked against the allowed list), and an optional note. Details can be remembered on the device. Payment is "Pay on delivery – Cash / GPay". |
| `/order-success/:orderId` | Animated tick, order ID with a copy button, order summary, Continue shopping, and a WhatsApp button to message the store. The cart is cleared once. |

**Cart behaviour**

- The cart lives in React Context and is saved in `localStorage`, so it survives refreshes and stays in step across browser tabs.
- `kg` and `litre` items change in steps of 0.5. Every other unit changes in whole numbers.
- When the Order or Cart page opens, the cart refreshes against the server. Prices are updated, quantities are capped at the available stock, and items the store no longer sells are removed. The customer sees a message about anything that changed.
- **The server always recalculates prices.** Nothing the browser sends is trusted.

### Admin portal

| Page | Highlights |
|------|------------|
| Login | Uses a JWT stored in `localStorage`. Pages are protected, and any 401 response logs you out automatically. |
| Dashboard | Date range selector (Today, This Week, This Month, Custom). 8 stat cards. A sales chart, an income vs expense chart (7 or 30 days), and a payment mode donut. Recent orders update live. Also shows top selling items and low stock alerts. |
| Orders | Status tabs with counts, plus filters for payment status, payment mode, date range, and search. Has pagination and sorting. New orders are highlighted, and each row has a one-click next-step button (Confirm, Dispatch, Delivered). Shows as cards on phones. |
| Order drawer | Customer details with call, WhatsApp (pre-filled with the order details), and Google Maps buttons. Shows items and totals, lets you change status with a note, and shows a timeline. Payment buttons: Paid + Cash/GPay/PhonePe/UPI/Other, or Mark unpaid. Also: admin note, **Print bill** (a clean receipt that suits 80 mm thermal printers or A4), Cancel (restores stock), and Delete. |
| Offers | Post daily offers for the landing page **Offer Zone**. A **special price** on an item applies to the product list, the cart, and the bill while the offer is live; the form shows the discount and generates the title and badge. An **announcement** (such as "Free delivery this Sunday") is display only. Each offer has an optional image and start/end dates, with "Today only", "3 days", "1 week", or "No end date" shortcuts. Tabs show Live, Scheduled, Paused, and Expired offers. You can pause or resume with a switch, and **Repeat today** runs an expired offer again. |
| Items | Table or grid view, search, category filter, and an availability/low-stock filter. **Click a price or stock number to edit it in place.** Toggle availability, add or edit in a modal with image upload, drag-and-drop, and preview. Delete asks for confirmation. Changes reach the customer site immediately. |
| Income | Totals for all income, order income, and manual income. Filters for source, payment mode, and dates. Entries from Delivered + Paid orders are created automatically and are locked. You can add, edit, or delete manual income. |
| Expenses | Add, edit, or delete expenses with filters and totals. Includes a chart that sums spending by category. |
| Customers | Built from order history: name, phone, number of orders, total spent, and last order. Click a customer to see their order history. |
| Reports | Pick a date range to see a summary (orders, income, expense, profit or loss). Export orders, income, or expenses as **CSV**. |
| Store Settings | An open/closed switch that applies instantly. Edit store details, contact info, the map embed (paste the whole `<iframe>`), and delivery rules (charge, free-delivery limit, minimum order, pincode chips). Upload a logo and hero image, upload up to 10 gallery photos at a time (20 in total), and add social links. A save bar appears when you have unsaved changes, plus a "Preview store" link. |
| Account & Security | Change your username, display name, and password. Changing the password keeps you logged in here and logs out other devices. **System settings** shows the masked DB URI and JWT secret, has a "Generate" button for a strong secret, and lets you update `.env`. |

**⚠ Warning:** the System Settings section has a red warning reading "Server restart required. Wrong value will stop the app." Saving asks for a confirmation checkbox first.

### Real-time notifications

- After login, the admin connects to Socket.io with the JWT.
- When a **new order** arrives:
  - A chime plays (`src/assets/notification.mp3`).
  - A toast shows the customer and amount, with a **View order** button.
  - The bell count goes up.
  - The orders list and dashboard refresh without reloading the page.
  - If the tab is in the background, a **browser notification** is shown.
- Desktop notification permission is requested once, or you can grant it from the bell menu with **Enable desktop alerts**.

> Browsers only play sounds after you've interacted with the page once. Click anywhere in the admin panel after opening it.

---

## 3. Project structure

```
frontend/
├── index.html                 # Poppins font, meta tags
├── vite.config.js             # React + Tailwind plugins, dev server on :5173
├── public/favicon.svg
└── src/
    ├── main.jsx               # Providers + Toaster
    ├── App.jsx                # Routes (admin pages lazy-loaded)
    ├── index.css              # Tailwind theme (colours, animations, print styles)
    ├── api/
    │   ├── client.js          # Axios instance, token, 401 auto-logout, error helpers
    │   ├── publicApi.js       # Settings, items, offers, place order
    │   └── adminApi.js        # auth, items, orders, income, expenses, settings, dashboard, customers, reports
    ├── context/
    │   ├── StoreContext.jsx   # Public store settings
    │   ├── CartContext.jsx    # Cart + localStorage
    │   ├── AuthContext.jsx    # Admin login state
    │   └── SocketContext.jsx  # Socket.io, notifications, useSocketEvent()
    ├── hooks/                 # useFetch, useDebounce, useDocumentTitle, useRefetchOnFocus, useLockBodyScroll
    ├── utils/                 # format (₹ / dates), pricing, links (WhatsApp/maps/images), notify, dateRange, storage, constants
    ├── assets/notification.mp3
    ├── components/
    │   ├── ui/                # Button, Modal, Drawer, Table, Badge, StatCard, Loader, EmptyState,
    │   │                      # ConfirmDialog, Card, Pagination, SegmentedControl, FormControls
    │   ├── public/            # Navbar, Footer, MobileCartBar, ProductCard, QuantityControl, Lightbox, ...
    │   └── admin/             # AdminLayout, Sidebar, Topbar, NotificationBell, OrderDrawer, PrintReceipt,
    │                          # ItemFormModal, LedgerFormModals, Charts, RangeSelector, FilterBar, ...
    └── pages/
        ├── public/            # Home, OrderPage, Cart, Checkout, OrderSuccess
        ├── admin/             # Login, Dashboard, Orders, Items, Income, Expenses, Customers,
        │                      # Reports, StoreSettings, Account, AdminShell
        └── NotFound.jsx
```

### Conventions

- **Currency:** formatted in ₹ with Indian grouping, for example `₹1,23,456.50`. Whole amounts show no decimals.
- **Dates:** shown as `DD-MM-YYYY hh:mm A`, for example `20-10-2026 07:45 PM`.
- **Theme colours:** defined once in `src/index.css` under `@theme`. Primary `#4CAF50` (`brand-500`), dark green `#2E7D32` (`brand-800`), leaf `#A5D6A7` (`brand-300`), mint `#F1F8F2`, beige `#FAF7F0`.
- **Errors:** every server error message is shown in a toast. Loading states show skeletons, and empty lists show friendly empty states.

---

## 4. Troubleshooting

| Problem | Fix |
|---------|-----|
| "Cannot reach the server" | Start the backend and check `VITE_API_URL` |
| CORS error in the browser console | Add the frontend's exact origin to `CLIENT_URL` in `backend/.env` and restart the backend |
| Images don't load | `VITE_API_URL` must point at the backend that stores the uploads |
| No sound for new orders | Click once anywhere in the admin page; browsers block audio until you interact |
| No desktop notifications | Use bell → **Enable desktop alerts**, or allow notifications in the browser's site settings |
| Logged out unexpectedly | The token expired (`JWT_EXPIRES_IN`), or the password or JWT secret was changed. Log in again. |
