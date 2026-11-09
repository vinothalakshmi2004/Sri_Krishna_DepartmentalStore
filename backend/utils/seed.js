/**
 * First-run seeding.
 *
 * Runs on every server start but only creates what is missing:
 *   - default admin (from DEFAULT_ADMIN_USERNAME / DEFAULT_ADMIN_PASSWORD) when no admin exists
 *   - store settings document with sensible defaults when none exists
 *   - 10 sample grocery items when the item collection is empty
 *
 * Can also be run on its own:  npm run seed
 */
const path = require('path');
const Admin = require('../models/Admin');
const Item = require('../models/Item');
const Settings = require('../models/Settings');

const DEFAULT_SETTINGS = {
  storeName: 'Sri Krishna Department Store',
  tagline: 'Fresh groceries delivered to your doorstep',
  about:
    'Sri Krishna Department Store is your neighbourhood store for rice, dals, oils, spices, dairy, ' +
    'fresh vegetables and daily essentials. Order online and we will deliver to your home.',
  phone: '9626533082',
  extraPhones: ['9360586396', '6385754323'],
  whatsapp: '9626533082',
  email: 'skdepartmentstore19@gmail.com',
  address: 'No: 1/189-1, Nearby EB Office, Periyamaththampalayam, Mettupalayam Road, Coimbatore - 641019',
  mapEmbedUrl: '',
  openingHours: 'Mon - Sun: 7:00 AM - 10:00 PM',
  // Free home delivery, only for orders of ₹1000 and above
  deliveryCharge: 0,
  freeDeliveryAbove: 0,
  minOrderAmount: 1000,
  allowedPincodes: [],
  isStoreOpen: true,
  galleryImages: [],
  heroImage: '',
  logo: '',
  logoFull: '',
  socialLinks: { facebook: '', instagram: '', youtube: '', twitter: '' },
};

const SAMPLE_ITEMS = [
  {
    name: 'Ponni Raw Rice',
    description: 'Premium quality Ponni raw rice, ideal for everyday meals.',
    price: 62, unit: 'kg', category: 'Rice & Grains', stock: 200, lowStockLimit: 20,
  },
  {
    name: 'Toor Dal',
    description: 'Unpolished toor dal, rich in protein. Perfect for sambar.',
    price: 145, unit: 'kg', category: 'Pulses & Dals', stock: 80, lowStockLimit: 10,
  },
  {
    name: 'Whole Wheat Atta',
    description: 'Stone-ground whole wheat flour for soft chapatis.',
    price: 55, unit: 'kg', category: 'Flours', stock: 120, lowStockLimit: 15,
  },
  {
    name: 'Sugar',
    description: 'Refined white sugar.',
    price: 46, unit: 'kg', category: 'Essentials', stock: 150, lowStockLimit: 20,
  },
  {
    name: 'Refined Sunflower Oil',
    description: 'Light and healthy refined sunflower oil.',
    price: 165, unit: 'litre', category: 'Oils & Ghee', stock: 60, lowStockLimit: 10,
  },
  {
    name: 'Toned Milk 500 ml',
    description: 'Fresh pasteurised toned milk, 500 ml pouch.',
    price: 28, unit: 'packet', category: 'Dairy & Eggs', stock: 100, lowStockLimit: 20,
  },
  {
    name: 'Farm Fresh Eggs',
    description: 'Farm fresh eggs, priced per egg.',
    price: 7, unit: 'piece', category: 'Dairy & Eggs', stock: 300, lowStockLimit: 30,
  },
  {
    name: 'Tomato',
    description: 'Fresh, juicy country tomatoes.',
    price: 40, unit: 'kg', category: 'Vegetables', stock: 50, lowStockLimit: 10,
  },
  {
    name: 'Onion',
    description: 'Fresh big onions.',
    price: 35, unit: 'kg', category: 'Vegetables', stock: 70, lowStockLimit: 10,
  },
  {
    // Deliberately low so the low stock alert can be seen right away
    name: 'Turmeric Powder 100 g',
    description: 'Pure turmeric powder, 100 g pack.',
    price: 32, unit: 'packet', category: 'Spices & Masala', stock: 4, lowStockLimit: 5,
  },
];

/** Create default admin, settings and sample items if they do not exist yet. */
const seedDatabase = async () => {
  // 1. Default admin
  if ((await Admin.countDocuments()) === 0) {
    const username = (process.env.DEFAULT_ADMIN_USERNAME || 'admin').trim().toLowerCase();
    let password = process.env.DEFAULT_ADMIN_PASSWORD;
    if (!password) {
      password = 'admin123';
      console.warn('[seed] DEFAULT_ADMIN_PASSWORD is not set - using "admin123". Change it after login!');
    }
    await Admin.create({ username, password, name: 'Store Admin' });
    console.log(`[seed] Default admin created (username: "${username}"). Change the password after first login.`);
  }

  // 2. Store settings
  if (!(await Settings.exists({ singletonKey: 'main' }))) {
    await Settings.create({ singletonKey: 'main', ...DEFAULT_SETTINGS });
    console.log('[seed] Default store settings created');
  }

  // 3. Sample items
  if ((await Item.estimatedDocumentCount()) === 0) {
    await Item.insertMany(SAMPLE_ITEMS);
    console.log(`[seed] ${SAMPLE_ITEMS.length} sample grocery items added`);
  }
};

// Allow "npm run seed" / "node utils/seed.js"
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const connectDB = require('../config/db');

  (async () => {
    try {
      await connectDB();
      await seedDatabase();
      console.log('[seed] Done');
    } catch (err) {
      console.error('[seed] Failed:', err.message);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}

module.exports = { seedDatabase, SAMPLE_ITEMS, DEFAULT_SETTINGS };
