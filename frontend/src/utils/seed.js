const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

async function seedDefaultAdmin() {
  const defaultEmail = process.env. ADMIN_EMAIL || 'admin@admin.com';
  const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const defaultName = process.env.ADMIN_NAME || 'Administrator';

  try {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email:  defaultEmail },
    });

    if (existingAdmin) {
      console.log(`✓ Admin user already exists: ${defaultEmail}`);
      return existingAdmin;
    }

    // Create default admin
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);

    const admin = await prisma.user. create({
      data: {
        email: defaultEmail,
        password: hashedPassword,
        name: defaultName,
      },
    });

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  ✓ Default admin user created successfully! ');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Email:     ${defaultEmail}`);
    console.log(`  Password: ${defaultPassword}`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('  ⚠️  Please change the password after first login! ');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    return admin;
  } catch (error) {
    console.error('Failed to seed admin user:', error);
    throw error;
  }
}

module.exports = { seedDefaultAdmin };