const { cpSync } = require('node:fs');
const { resolve } = require('node:path');
cpSync(resolve(__dirname, '../src/generated/prisma-client'), resolve(__dirname, '../dist/generated/prisma-client'), { recursive: true });
