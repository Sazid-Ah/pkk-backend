const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const Employee = require('../models/Employee');

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private/Admin
const getEmployees = asyncHandler(async (req, res) => {
    // Return all employees (excluding password)
    const employees = await Employee.find({}).select('-password');
    res.json(employees);
});

// @desc    Create an employee (Standalone)
// @route   POST /api/employees
// @access  Private/Admin
const createEmployee = asyncHandler(async (req, res) => {
    const { username, password, fullName, phone, position, address, salary } = req.body;

    if (!username || !password || !fullName || !phone) {
        res.status(400);
        throw new Error('Please add all required fields');
    }

    if (salary !== undefined && Number(salary) < 0) {
        res.status(400);
        throw new Error('Salary cannot be negative');
    }

    // Check if employee exists (username)
    const employeeExists = await Employee.findOne({ username });
    if (employeeExists) {
        res.status(400);
        throw new Error('Employee username already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Calculate location from address
    let location = '';
    if (address && address.city) {
        location = address.city;
        if (address.state) {
            location += `, ${address.state}`;
        }
    }

    // Create Employee
    const employee = await Employee.create({
        username,
        password: hashedPassword,
        role: 'employee',
        fullName,
        phone,
        position,
        address,
        location,
        salary
    });

    if (employee) {
        res.status(201).json({
            _id: employee._id,
            username: employee.username,
            role: employee.role,
            fullName: employee.fullName,
            phone: employee.phone,
            position: employee.position,
            isActive: employee.isActive
        });
    } else {
        res.status(400);
        throw new Error('Invalid employee data');
    }
});

// @desc    Get single employee by ID
// @route   GET /api/employees/:id
// @access  Private/Admin
const getEmployeeById = asyncHandler(async (req, res) => {
    const employee = await Employee.findById(req.params.id).select('-password');
    if (employee) {
        res.json(employee);
    } else {
        res.status(404);
        throw new Error('Employee not found');
    }
});

// @desc    Update employee details
// @route   PUT /api/employees/:id
// @access  Private/Admin
const updateEmployee = asyncHandler(async (req, res) => {
    const employee = await Employee.findById(req.params.id);

    if (employee) {
        employee.fullName = req.body.fullName || employee.fullName;
        employee.phone = req.body.phone || employee.phone;
        employee.position = req.body.position || employee.position;
        employee.address = req.body.address || employee.address;
        employee.salary = req.body.salary || employee.salary;
        employee.isActive = req.body.isActive !== undefined ? req.body.isActive : employee.isActive;

        // Update location base on new address
        if (req.body.address && req.body.address.city) {
            let location = req.body.address.city;
            if (req.body.address.state) {
                location += `, ${req.body.address.state}`;
            }
            employee.location = location;
        }

        const updatedEmployee = await employee.save();
        res.json(updatedEmployee);
    } else {
        res.status(404);
        throw new Error('Employee not found');
    }
});

// @desc    Delete an employee
// @route   DELETE /api/employees/:id
// @access  Private/Admin
const deleteEmployee = asyncHandler(async (req, res) => {
    const employee = await Employee.findById(req.params.id);

    if (employee) {
        await employee.deleteOne();
        res.json({ message: 'Employee removed' });
    } else {
        res.status(404);
        throw new Error('Employee not found');
    }
});

module.exports = {
    getEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee,
};
