const express = require('express');
const router = express.Router();
const {
    getEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
} = require('../controllers/employeeController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, admin, getEmployees)
    .post(protect, admin, createEmployee);

router.route('/:id')
    .put(protect, admin, updateEmployee)
    .delete(protect, admin, deleteEmployee);

module.exports = router;
