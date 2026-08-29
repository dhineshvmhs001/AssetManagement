const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: false }));

// Uploads are NOT served statically: invoices and asset photos are only
// reachable through GET /api/assets/:code/files/... behind the auth middleware.
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
