# 🏫 Smart Campus Issue Tracker

Smart Campus Issue Tracker is a **full-stack web application** designed to streamline reporting, tracking, and resolution of campus issues.  
It enables students and faculty to raise issues while allowing admins and staff to manage them efficiently through a centralized system.

---

## 🚀 Overview

Managing campus issues like maintenance, electrical faults, and IT problems can be inefficient without a structured system.  
This platform provides a **role-based, centralized solution** to track issues, assign responsibilities, and monitor progress in real time.

---

## 🎯 Key Features

### 👤 User Features (Students & Faculty)

- Report issues with title, description, category, and department  
- Track real-time status of submitted issues  
- View history of previously reported issues  
- Clean and responsive UI for quick reporting  

---

### 🛠️ Staff Features

- View assigned issues  
- Update issue status (In Progress → Resolved)  
- Manage workload efficiently  

---

### 🧑‍💼 Admin Features

- Centralized dashboard with analytics and insights  
- View, filter, and manage all issues  
- Assign issues to departments or staff  
- Monitor status (Pending, Assigned, In Progress, Resolved, Rejected)  
- Access reports (issue trends, department distribution, status breakdown)  

---

### 🏢 Department Admin Features

- Manage department-specific issues  
- Assign issues to staff members  
- Track department workload and performance  
- Use filtered dashboards for focused management  

---

## ⚙️ Tech Stack

### Frontend
- React.js  
- Next.js  
- Tailwind CSS  
- HTML  
- CSS  

### Backend
- Node.js  
- Express.js  

### Database
- MongoDB  

### Tools
- Git & GitHub  
- Postman  

---

## 🧠 System Architecture

- Role-Based Access Control (RBAC):  
  Admin | Department Admin | Staff | Student | Faculty  

- 45+ RESTful APIs handling:
  - Issue creation  
  - Assignment  
  - Status updates  
  - User management  
  - Reporting & analytics  

---

## 🔄 Workflow

1. User (Student/Faculty) submits an issue  
2. Issue is stored in MongoDB  
3. Admin/Dept Admin reviews and assigns issue  
4. Staff works on the issue and updates status  
5. Issue progresses through lifecycle  
6. Issue is marked as resolved  

---

## 📊 Dashboard & Analytics

- Issue status distribution  
- Department-wise issue analysis  
- Issue activity trends  
- Real-time tracking and filtering  

---

## 🧪 Demo Users (Read-Only)

The system provides demo accounts for testing (no create/update/delete access).

- Student  
  Email: demo.student@charusat.edu.in  
  Password: DemoStudent@123  

- Staff  
  Email: demo.worker@charusat.ac.in  
  Password: DemoWorker@123  

- Admin  
  Email: demo.admin@campustracker.com  
  Password: DemoAdmin@123

- Department Admin  
  Email: demo.deptadmin@charusat.ac.in  
  Password: DemoDeptAdmin@123

You can override these credentials using environment variables from `env.example`.

---

## 🛠️ Installation

Clone the repository:
```bash
git clone https://github.com/your-username/smart-campus-issue-tracker.git
```
Navigate to project folder:
```bash
cd smart-campus-issue-tracker
```
Install dependencies:
```bash
 npm install
```
Run development server:
```bash
 npm run dev
```


