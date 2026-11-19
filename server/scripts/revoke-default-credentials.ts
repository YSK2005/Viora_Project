import { randomBytes } from 'node:crypto';
import { prisma } from '../src/config/prisma';
import { hashPassword, verifyPassword } from '../src/utils/auth';

async function main() {
  let cursor: string | undefined;
  let count = 0;
  for (;;) {
    const users = await prisma.user.findMany({ take: 100, orderBy: { id: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    if (!users.length) break;
    for (const user of users) {
      if (!verifyPassword('Viora@12345', user.passwordHash)) continue;
      await prisma.$transaction(async tx => {
        const result = await tx.user.updateMany({ where: { id: user.id, passwordHash: user.passwordHash },
          data: { passwordHash: hashPassword(randomBytes(48).toString('hex')) } });
        if (result.count) { await tx.session.deleteMany({ where: { userId: user.id } }); count++; }
      });
    }
    cursor = users[users.length - 1].id;
  }
  console.log('Accounts requiring verified administrator recovery:', count);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
