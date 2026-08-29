const express = require('express');
const authRoutes = require('./auth.routes');
// const testRoutes = require('./test.routes');
const mailRoutes = require('./mail.routes');
const assetsRoutes = require('./assets.routes');
const vendorsRoutes = require('./vendors.routes');
const employeesRoutes = require('./employees.routes');
const ticketsRoutes = require('./tickets.routes');
const assignmentsRoutes = require('./assignments.routes');
const maintenanceRoutes = require('./maintenance.routes');

const router = express.Router();

router.use('/auth', authRoutes);
// router.use('/test', testRoutes);
router.use('/mail', mailRoutes);
router.use('/assets', assetsRoutes);
router.use('/vendors', vendorsRoutes);
router.use('/employees', employeesRoutes);
router.use('/tickets', ticketsRoutes);
router.use('/assignments', assignmentsRoutes);
router.use('/maintenance', maintenanceRoutes);

module.exports = router;
