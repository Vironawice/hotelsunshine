const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const multer = require('multer');
const sharp = require('sharp');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if(username === 'admin' && password === 'admin') {
    return res.json({ token: 'admin-token-' + Date.now(), role: 'admin' });
  }
  if(username === 'manager' && password === 'manager') {
    return res.json({ token: 'manager-token-' + Date.now(), role: 'manager' });
  }
  if(username === 'kitchen' && password === 'kitchen') {
    return res.json({ token: 'kitchen-token-' + Date.now(), role: 'kitchen' });
  }
  if(username === 'cashier' && password === 'cashier') {
    return res.json({ token: 'cashier-token-' + Date.now(), role: 'cashier' });
  }
  if(username === 'bar' && password === 'bar') {
    return res.json({ token: 'bar-token-' + Date.now(), role: 'bar' });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

const MENU_PATH = path.join(__dirname, 'menu.json');
const ORDERS_PATH = path.join(__dirname, 'orders.json');

function loadJSON(fp, fallback){
  try{
    if(fs.existsSync(fp)){
      const raw = fs.readFileSync(fp, 'utf8');
      return JSON.parse(raw);
    }
  }catch(e){ console.warn('failed reading', fp, e.message); }
  return fallback;
}

function saveJSON(fp, data){
  try{
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
    return true;
  }catch(e){ console.error('failed saving', fp, e.message); return false; }
}

let menu = loadJSON(MENU_PATH, [
  { id: 'f1', name: 'Margherita Pizza', price: 9.99, type: 'food' },
  { id: 'f2', name: 'Cheeseburger', price: 8.49, type: 'food' },
  { id: 'f3', name: 'Caesar Salad', price: 6.99, type: 'food' },
  { id: 'd1', name: 'Coca-Cola', price: 1.99, type: 'drink' },
  { id: 'd2', name: 'Orange Juice', price: 2.49, type: 'drink' },
  { id: 'd3', name: 'Coffee', price: 1.79, type: 'drink' }
]);

let orders = loadJSON(ORDERS_PATH, {});

const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_ENV = (process.env.PAYPAL_ENV || 'sandbox');
const PAYPAL_HOST = PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

async function getPayPalToken(){
  if(!PAYPAL_CLIENT || !PAYPAL_SECRET) throw new Error('PayPal credentials not set');
  const tokenUrl = `${PAYPAL_HOST}/v1/oauth2/token`;
  const auth = Buffer.from(`${PAYPAL_CLIENT}:${PAYPAL_SECRET}`).toString('base64');
  const params = new URLSearchParams(); params.append('grant_type','client_credentials');
  const res = await axios.post(tokenUrl, params.toString(), { headers: { Authorization: `Basic ${auth}`, 'Content-Type':'application/x-www-form-urlencoded' } });
  return res.data.access_token;
}

async function createPayPalOrder(total, currency, returnUrl, cancelUrl){
  const accessToken = await getPayPalToken();
  const url = `${PAYPAL_HOST}/v2/checkout/orders`;
  const body = {
    intent: 'CAPTURE',
    purchase_units: [{ amount: { currency_code: currency || 'USD', value: total.toFixed ? total.toFixed(2) : String(total) } }],
    application_context: { return_url: returnUrl, cancel_url: cancelUrl }
  };
  const res = await axios.post(url, body, { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type':'application/json' } });
  // find approval link
  const links = res.data.links || [];
  const approve = links.find(l => l.rel === 'approve');
  return { id: res.data.id, approveUrl: approve ? approve.href : null };
}

async function capturePayPalOrder(paypalOrderId){
  const accessToken = await getPayPalToken();
  const url = `${PAYPAL_HOST}/v2/checkout/orders/${paypalOrderId}/capture`;
  const res = await axios.post(url, {}, { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type':'application/json' } });
  return res.data;
}

app.get('/api/menu', (req, res) => {
  res.json(menu);
});

app.post('/api/menu', (req, res) => {
  const newMenu = req.body;
  if(!Array.isArray(newMenu)) return res.status(400).json({ error: 'menu must be an array' });
  menu = newMenu;
  saveJSON(MENU_PATH, menu);
  res.json({ ok: true });
});

// Configure Multer for image uploads
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/upload', upload.single('image'), async (req, res) => {
  const { id } = req.body;
  const item = menu.find(i => i.id == id);
  if(!item || !req.file) return res.status(400).json({ error: 'Item not found or file missing' });
  
  const filename = Date.now() + '.jpg';
  const dir = path.join(__dirname, 'public', 'uploads');
  if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
  }
  
  try {
    await sharp(req.file.buffer)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toFile(path.join(dir, filename));
      
    item.image = '/uploads/' + filename;
    saveJSON(MENU_PATH, menu);
    res.json({ ok: true });
  } catch (err) {
    console.error('Image processing error:', err);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

app.post('/api/delete-image', (req, res) => {
  const { id } = req.body;
  const item = menu.find(i => i.id == id);
  if(!item) return res.status(400).json({ error: 'Item not found' });
  
  if(item.image) {
    const filePath = path.join(__dirname, 'public', item.image);
    if(fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch(e){}
    }
  }
  
  item.image = '';
  saveJSON(MENU_PATH, menu);
  res.json({ ok: true });
});

app.post('/api/orders', async (req, res) => {
  const { items, customer, total, location } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'order must include items' });
  }
  if (!customer || !customer.name) {
    return res.status(400).json({ error: 'customer name required' });
  }
  const id = crypto.randomBytes(4).toString('hex');
  const order = { id, items, customer, total, location, status: 'pending', createdAt: new Date().toISOString() };
  orders[id] = order;
  saveJSON(ORDERS_PATH, orders);

  // create PayPal order if credentials present
  if(PAYPAL_CLIENT && PAYPAL_SECRET){
    try{
      const returnUrl = `${req.protocol}://${req.get('host')}/paypal/return?localOrderId=${id}`;
      const cancelUrl = `${req.protocol}://${req.get('host')}/payment.html?status=cancel&id=${id}`;
      const pp = await createPayPalOrder(total, 'USD', returnUrl, cancelUrl);
      // save paypal order id mapping
      orders[id].paypalOrderId = pp.id;
      saveJSON(ORDERS_PATH, orders);
      return res.json({ id, paymentUrl: pp.approveUrl });
    }catch(e){
      console.error('PayPal create failed', e.message);
      return res.json({ id, paymentUrl: `/payment.html?id=${id}` });
    }
  }

  res.json({ id, paymentUrl: `/payment.html?id=${id}` });
});

app.get('/api/orders/:id', (req, res) => {
  const id = req.params.id;
  const order = orders[id];
  if (!order) return res.status(404).json({ error: 'order not found' });
  res.json(order);
});

// PayPal return handler: captures PayPal order and updates local order
app.get('/paypal/return', async (req, res) => {
  const { token, localOrderId } = req.query;
  if(!token || !localOrderId) return res.status(400).send('missing token or localOrderId');
  try{
    const capture = await capturePayPalOrder(token);
    // update local order
    if(orders[localOrderId]){
      orders[localOrderId].status = 'paid';
      orders[localOrderId].paypalCapture = capture;
      saveJSON(ORDERS_PATH, orders);
    }
    // redirect user to a friendly payment success page
    res.redirect(`/payment.html?status=success&id=${localOrderId}`);
  }catch(e){
    console.error('capture error', e.message);
    res.redirect(`/payment.html?status=error&id=${localOrderId}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
