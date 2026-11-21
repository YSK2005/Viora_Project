import { prisma } from '../src/config/prisma';
import { hashPassword } from '../src/utils/auth';

async function seedUsers() {
  console.log('👤 Seeding default users...');

  const business = await prisma.business.findFirst({
    where: { name: 'Viora Tech Solutions Pvt Ltd' },
  }) || await prisma.business.findFirst();

  if (!business) {
    console.error('❌ No business found in database');
    process.exit(1);
  }

  const usersToCreate = [
    {
      email: 'admin@viora.test',
      password: 'AdminPassword123!',
      name: 'Viora Admin',
      role: 'OWNER' as const,
    },
    {
      email: 'admin@viorabills.com',
      password: 'AdminPassword123!',
      name: 'Viora Billing Admin',
      role: 'OWNER' as const,
    },
  ];

  for (const u of usersToCreate) {
    let user = await prisma.user.findUnique({ where: { email: u.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: u.email,
          name: u.name,
          passwordHash: hashPassword(u.password),
        },
      });
      console.log(`✅ Created user: ${u.email}`);
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashPassword(u.password),
        },
      });
      console.log(`🔄 Updated password for existing user: ${u.email}`);
    }

    const membership = await prisma.businessMembership.findUnique({
      where: {
        userId_businessId: {
          userId: user.id,
          businessId: business.id,
        },
      },
    });

    if (!membership) {
      await prisma.businessMembership.create({
        data: {
          userId: user.id,
          businessId: business.id,
          role: u.role,
        },
      });
      console.log(`✅ Linked ${u.email} to business ${business.name} as ${u.role}`);
    }
  }

  console.log('🎉 Users seeded successfully!');
}

seedUsers()
  .catch((e) => {
    console.error('Error seeding users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
