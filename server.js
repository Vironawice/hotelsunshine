require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const app = express();
const router = express.Router();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files (index.html, styles.css, script.js) from the current directory
app.use(express.static(__dirname));

if (!process.env.MONGODB_URI) {
    console.error("Error: MONGODB_URI is not defined in environment variables.");
}

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
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'hotel-sunshine',
        allowed_formats: ['jpg', 'png', 'jpeg']
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
router.get('/menu', async (req, res) => {
    try {
        const menu = await Menu.find({}).sort({ id: 1 });
        res.json(menu);
    } catch (err) {
        console.error("Menu fetch error:", err);
        res.status(500).json({ error: 'Failed to read menu', details: err.message });
    }
});

// API Endpoint to save menu data
router.post('/menu', async (req, res) => {
    try {
        // Replace entire menu (simplest approach for the current admin UI)
        await Menu.deleteMany({});
        await Menu.insertMany(req.body);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to save menu' }); }
});

// API Endpoint to upload image
router.post('/upload', upload.single('image'), async (req, res) => {
    const { id } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const item = await Menu.findOne({ id: id });
        if (item) {
            item.image = req.file.path;
            await item.save();
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Item not found' });
        }
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// API Endpoint to get all orders
router.get('/orders', async (req, res) => {
    try {
        const orders = await Order.find({}).sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) { res.status(500).json({ error: 'Failed to read orders' }); }
});

// API Endpoint to update an order status
router.put('/orders/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    try {
        const result = await Order.findOneAndUpdate({ id: id }, { status: status });
        if (!result) return res.status(404).json({ error: 'Order not found' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to update order' }); }
});

// API Endpoint to delete an order
router.delete('/orders/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const result = await Order.findOneAndDelete({ id: id });
        if (!result) return res.status(404).json({ error: 'Order not found' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to delete order' }); }
});

// API Endpoint to save orders
router.post('/orders', async (req, res) => {
    try {
        const order = new Order(req.body);
        await order.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to save order' }); }
});

// API Endpoint for Admin Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt:', username, password);
    if (username === 'admin' && password === 'sunshine') {
        res.json({ success: true, token: 'admin-token' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Mount the router for both local and Netlify paths
app.use('/api', router);
app.use('/.netlify/functions/api', router);

// Start the server
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

module.exports = app;