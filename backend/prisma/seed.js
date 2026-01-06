const { PrismaClient } = require('@prisma/client')
require('dotenv').config()

const prisma = new PrismaClient()

async function main() {
    console.log('Start seeding ...')

    // 1. Create Categories
    const categoriesData = [
        { name: 'Ropa y Accesorios', icon: 'fa-shirt' },
        { name: 'Tecnología', icon: 'fa-laptop' },
        { name: 'Hogar y Muebles', icon: 'fa-couch' },
        { name: 'Libros', icon: 'fa-book' },
        { name: 'Deportes', icon: 'fa-bicycle' },
        { name: 'Instrumentos', icon: 'fa-guitar' },
    ]

    const categories = []
    for (const cat of categoriesData) {
        const c = await prisma.category.upsert({
            where: { name: cat.name },
            update: {},
            create: cat,
        })
        categories.push(c)
    }

    // 2. Create Users
    const usersData = [
        {
            email: 'alex@demo.com',
            name: 'Alex',
            password: 'password123', // In real app, hash this!
            avatar: 'https://ui-avatars.com/api/?name=Alex+User&background=22c55e&color=fff'
        },
        {
            email: 'maria@demo.com',
            name: 'María G.',
            password: 'password123',
            avatar: 'https://ui-avatars.com/api/?name=Maria+G&background=random'
        },
        {
            email: 'juan@demo.com',
            name: 'Juan P.',
            password: 'password123',
            avatar: 'https://ui-avatars.com/api/?name=Juan+P&background=random'
        }
    ]

    const users = []
    for (const u of usersData) {
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: {},
            create: u,
        })
        users.push(user)
    }

    // 3. Create Items
    const items = [
        {
            title: 'Bicicleta Vintage Restaurada',
            categoryName: 'Deportes',
            image: 'https://images.unsplash.com/photo-1485965120184-e224f723d621?auto=format&fit=crop&q=80&w=500',
            wants: 'Guitarra acústica o Mueble de TV',
            userEmail: 'maria@demo.com',
            distance: '2 km',
            condition: 'Excelente'
        },
        {
            title: 'Cámara Polaroid Antigua',
            categoryName: 'Tecnología',
            image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=500',
            wants: 'Libros de arte o Vinilos',
            userEmail: 'juan@demo.com',
            distance: '5 km',
            condition: 'Usado'
        },
        {
            title: 'Colección Harry Potter (Tapa dura)',
            categoryName: 'Libros',
            image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=500',
            wants: 'Juegos de mesa o Plantas',
            userEmail: 'alex@demo.com', // Alex's item
            distance: '1.5 km',
            condition: 'Bueno'
        }
    ]

    for (const item of items) {
        const cat = categories.find(c => c.name === item.categoryName)
        const usr = users.find(u => u.email === item.userEmail)

        if (cat && usr) {
            await prisma.item.create({
                data: {
                    title: item.title,
                    image: item.image,
                    wants: item.wants,
                    distance: item.distance,
                    condition: item.condition,
                    categoryId: cat.id,
                    userId: usr.id
                }
            })
            console.log(`Created item: ${item.title}`)
        }
    }

    console.log('Seeding finished.')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
