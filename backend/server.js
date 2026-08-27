require('dotenv').config();
const app = require('./src/app');
const { PORT } = require('./src/config/env');
const { connectDb } = require('./src/config/db');

app.listen(PORT, async () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  try {
    const now = await connectDb();
    console.log(`PostgreSQL connected at ${now}`);
  } catch (err) {
    const detail =
      err.errors?.map((e) => e.message).join('; ') ||
      err.message ||
      err.code ||
      String(err);
    console.error('PostgreSQL connection failed:', detail);
  }
});
