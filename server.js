require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files (index.html, styles.css, script.js) from the current directory
app.use(express.static(__dirname));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));

// Define Database Schemas
const menuSchema = new mongoose.Schema({
    id: Number,
    name: String,
    price: Number,
    desc: String,
    category: String,
    image: String
});
const Menu = mongoose.model('Menu', menuSchema);

const orderSchema = new mongoose.Schema({
    id: Number,
    items: Array,
    total: Number,
    customer: Object,
    status: { type: String, default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// Configure Multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Initialize default menu if DB is empty
Menu.countDocuments().then(count => {
    if (count === 0) {
        const defaultMenu = [
            { id: 1, name: "Abacha (African Salad)", price: 2500, desc: "Traditional cassava salad with ugba and fish.", category: "Main" },
            { id: 2, name: "Ofe Onugbu & Fufu", price: 3500, desc: "Bitter leaf soup served with pounded yam or fufu.", category: "Soups" },
            { id: 3, name: "Jollof Rice & Chicken", price: 3000, desc: "Smoky Nigerian Jollof with grilled chicken.", category: "Main" },
            { id: 4, name: "Pepper Soup (Goat Meat)", price: 2800, desc: "Spicy broth with tender goat meat chunks.", category: "Soups" },
            { id: 5, name: "Grilled Catfish", price: 5000, desc: "Whole grilled catfish with spicy sauce and chips.", category: "Main" },
            { id: 6, name: "Club Sandwich", price: 2200, desc: "Toasted bread, chicken, egg, and cheese.", category: "Snacks" },
            { id: 7, name: "Chapman", price: 1500, desc: "Signature fruity cocktail drink.", category: "Drinks" },
            { id: 8, name: "Palm Wine (Fresh)", price: 1000, desc: "Freshly tapped palm wine.", category: "Drinks" }
        ];
        Menu.insertMany(defaultMenu).then(() => console.log("Default menu initialized"));
    }
});

// API Endpoint to get menu data
app.get('/api/menu', async (req, res) => {
    try {
        const menu = await Menu.find({}).sort({ id: 1 });
        res.json(menu);
    } catch (err) { res.status(500).json({ error: 'Failed to read menu' }); }
});

// API Endpoint to save menu data
app.post('/api/menu', async (req, res) => {
    try {
        // Replace entire menu (simplest approach for the current admin UI)
        await Menu.deleteMany({});
        await Menu.insertMany(req.body);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to save menu' }); }
});

// API Endpoint to upload image
app.post('/api/upload', upload.single('image'), async (req, res) => {
    const { id } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const item = await Menu.findOne({ id: id });
        if (item) {
            item.image = '/uploads/' + req.file.filename;
            await item.save();
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Item not found' });
        }
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// API Endpoint to get all orders
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find({}).sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) { res.status(500).json({ error: 'Failed to read orders' }); }
});

// API Endpoint to update an order status
app.put('/api/orders/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    try {
        const result = await Order.findOneAndUpdate({ id: id }, { status: status });
        if (!result) return res.status(404).json({ error: 'Order not found' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to update order' }); }
});

// API Endpoint to delete an order
app.delete('/api/orders/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const result = await Order.findOneAndDelete({ id: id });
        if (!result) return res.status(404).json({ error: 'Order not found' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to delete order' }); }
});

// API Endpoint to save orders
app.post('/api/orders', async (req, res) => {
    try {
        const order = new Order(req.body);
        await order.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to save order' }); }
});

// API Endpoint for Admin Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt:', username, password);
    if (username === 'admin' && password === 'sunshine') {
        res.json({ success: true, token: 'admin-token' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Start the server
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

module.exports = app;