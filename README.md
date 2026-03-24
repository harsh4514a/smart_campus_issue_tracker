# Smart Campus Issue Tracker

Smart Campus Issue Tracker is a web-based platform designed to streamline the process of reporting, tracking, and resolving campus issues.
It enables students and staff to report problems while allowing administrators to manage and monitor issue resolution through a centralized dashboard.

---

## Overview

Managing campus issues such as maintenance, electrical faults, and IT problems can be challenging without a proper tracking system.
This application provides a structured platform where users can submit issues and administrators can track, assign, and resolve them efficiently.

---

## Features

### User Features

* Report campus issues with title, description, and category
* Track the status of submitted issues
* View history of previously reported issues
* Simple and responsive interface for quick reporting

### Admin Features

* Admin dashboard with issue statistics
* View all reported issues
* Assign issues to relevant departments
* Update issue status (Pending, Assigned, In Progress, Resolved)
* Filter and manage issues efficiently

---

## Tech Stack

### Frontend

Yes, HTML and CSS are used in the frontend of this project. The main technologies include:

* React.js
* Next.js
* Tailwind CSS
* HTML
* CSS

### Backend

* Node.js
* Express.js

### Database

* MongoDB

### Tools

* Git
* GitHub
* Postman

---

## System Workflow

1. A user reports an issue through the reporting form.
2. The issue is stored in the database.
3. The admin views the issue in the dashboard.
4. The admin assigns the issue to the appropriate department.
5. The issue status is updated as it progresses.
6. Once resolved, the issue is marked as completed.

---

## Installation

Clone the repository:

```bash
git clone https://github.com/your-username/smart-campus-issue-tracker.git
```

Navigate to the project directory:

```bash
cd smart-campus-issue-tracker
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

## Demo Users (View Only)

The app auto-creates three demo users when auth endpoints are used.
These accounts are strictly read-only and cannot perform create/update/delete actions.

Student panel demo user:

```text
Email: demo.student@charusat.edu.in
Password: DemoStudent@123
```

Worker (staff) panel demo user:

```text
Email: demo.worker@charusat.ac.in
Password: DemoWorker@123
```

Admin panel demo user:

```text
Email: demo.admin@campustracker.com
Password: DemoAdmin@123
```

You can override these credentials through environment variables shown in env.example.
