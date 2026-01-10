const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API Routes

// GET /api/categories
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await prisma.category.findMany();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// GET /api/items - Retrieve all items with relations
app.get('/api/items', async (req, res) => {
    try {
        const items = await prisma.item.findMany({
            include: {
                category: true,
                user: {
                    select: { name: true, avatar: true }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Transform to flatten structure if frontend expects it, or update frontend.
        // Let's send structured data and update frontend.
        const startItems = items.map(item => ({
            id: item.id,
            title: item.title,
            category: item.category.name, // Flattened for display
            categoryId: item.categoryId, // For filtering
            image: item.image,
            wants: item.wants,
            userName: item.user.name,
            userAvatar: item.user.avatar,
            userId: item.userId,
            distance: item.distance,
            condition: item.condition
        }));

        res.json(startItems);
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ error: 'Failed to fetch items' });
    }
});

// POST /api/items - Create a new item
app.post('/api/items', async (req, res) => {
    try {
        const { title, categoryId, image, wants, userId, distance, condition } = req.body;

        // Basic validation
        if (!userId || !categoryId) {
            return res.status(400).json({ error: 'User ID and Category ID are required' });
        }

        const newItem = await prisma.item.create({
            data: {
                title,
                categoryId: parseInt(categoryId),
                image,
                wants,
                userId: parseInt(userId),
                distance: distance || 'Calculando...',
                condition: condition || 'Usado'
            }
        });
        res.status(201).json(newItem);
    } catch (error) {
        console.error('Error creating item:', error);
        res.status(500).json({ error: 'Failed to create item' });
    }
});

// POST /api/register
app.post('/api/register', async (req, res) => {
    const { email, password, name } = req.body;
    try {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const user = await prisma.user.create({
            data: {
                email,
                password, // NOTE: Hash this in production!
                name,
                avatar: `https://ui-avatars.com/api/?name=${name}&background=random`
            }
        });

        res.status(201).json({ success: true, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// --- Chat API ---

// POST /api/chats - Create or Get Chat
app.post('/api/chats', async (req, res) => {
    try {
        const userAId = parseInt(req.body.userAId);
        const userBId = parseInt(req.body.userBId);
        const itemId = req.body.itemId ? parseInt(req.body.itemId) : undefined;

        if (isNaN(userAId) || isNaN(userBId)) {
            console.error('Invalid Chat IDs:', req.body);
            return res.status(400).json({ error: 'Invalid user IDs' });
        }
        // Check availability
        let chat = await prisma.chat.findFirst({
            where: {
                AND: [
                    { OR: [{ userAId: userAId }, { userAId: userBId }] },
                    { OR: [{ userBId: userAId }, { userBId: userBId }] },
                    { itemId: itemId }
                ]
            }
        });

        if (!chat) {
            chat = await prisma.chat.create({
                data: {
                    userAId,
                    userBId,
                    itemId
                }
            });
        }
        res.json(chat);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error creating/getting chat' });
    }
});

// GET /api/chats/:userId - Get all chats for a user
app.get('/api/chats/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    try {
        const chats = await prisma.chat.findMany({
            where: {
                OR: [{ userAId: userId }, { userBId: userId }]
            },
            include: {
                item: true,
                userA: { select: { name: true, avatar: true } },
                userB: { select: { name: true, avatar: true } },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(chats);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error fetching chats' });
    }
});

// GET /api/chats/messages/:chatId
app.get('/api/chats/messages/:chatId', async (req, res) => {
    const chatId = parseInt(req.params.chatId);
    try {
        const messages = await prisma.message.findMany({
            where: { chatId },
            orderBy: { createdAt: 'asc' },
            include: { sender: { select: { name: true, avatar: true } } }
        });
        res.json(messages);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error fetching messages' });
    }
});

// POST /api/messages - Send message
app.post('/api/messages', async (req, res) => {
    const { chatId, senderId, content } = req.body;
    try {
        const message = await prisma.message.create({
            data: {
                chatId,
                senderId,
                content
            }
        });
        // Update chat timestamp
        await prisma.chat.update({
            where: { id: chatId },
            data: { updatedAt: new Date() } // Trigger update
        });
        res.json(message);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error sending message' });
    }
});

// --- Serve Frontend (Static) ---
const path = require('path');
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle SPA routing: return index.html for any unknown route
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
