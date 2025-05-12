# Level Up! Homeschool Activity Tracker

A web application for tracking homeschool activities and rewards.

## Quick Start

### Installing Dependencies

First, install the root dependencies:

```bash
npm install
```

Then install client and server dependencies:

```bash
cd client && npm install
cd ../server && npm install
```

### Running the Application

From the project root, you can run both client and server simultaneously:

```bash
npm run dev
```

Or run them separately:

```bash
# Start the server only
npm run server

# Start the client only
npm run client
```

## Accessing the Application

- Client: http://localhost:3000
- Server API: http://localhost:5001/api/activities

## Troubleshooting

If you receive an "address in use" error, you can find and kill the process:

```bash
# Find process using port 5001
lsof -i :5001 | grep LISTEN

# Kill the process
kill [PID]
```

## Features

- Interactive activity cards showing task name and points
- Detailed activity descriptions in modal popups
- Points tracking system
- Daily reset functionality
- iPad-friendly responsive design

## Usage

- Click on any activity card to view its details
- Mark activities as complete/incomplete in the modal
- View your total points for the day at the top of the page
- Use the "Reset for New Day" button to start fresh each day

## Technologies Used

- Frontend: React, styled-components
- Backend: Node.js, Express
- Data Storage: JSON file 