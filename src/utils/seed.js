const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

async function seedDefaultAdmin() {
  const defaultEmail = process.env. ADMIN_USER || 'admin@admin.com';
  const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const defaultName = process.env. ADMIN_NAME || 'Administrator';

  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { email: defaultEmail },
    });

    if (existingAdmin) {
      console.log('Admin user already exists:  ' + defaultEmail);
      return existingAdmin;
    }

    const hashedPassword = await bcrypt.hash(defaultPassword, 12);

    const admin = await prisma. user.create({
      data: {
        email: defaultEmail,
        password: hashedPassword,
        name: defaultName,
      },
    });

    console.log('');
    console.log('===============================================');
    console.log('  Default admin user created successfully!');
    console.log('===============================================');
    console.log('  Username:    ' + defaultEmail);
    console.log('  Password: ' + defaultPassword);
    console.log('===============================================');
    console.log('  Please change the password after first login! ');
    console.log('===============================================');
    console.log('');

    return admin;
  } catch (error) {
    console.error('Failed to seed admin user:', error);
    throw error;
  }
}

module.exports = { seedDefaultAdmin };