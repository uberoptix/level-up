# Level Up - Product Requirements Document (PRD)

## 1. Introduction

### 1.1 Purpose
Level Up is a homeschool activity tracking application designed to gamify educational tasks for children. It allows users to track and complete activities to earn screen time minutes, with each point earned representing one minute of screen time.

### 1.2 Scope
The application consists of a React-based web frontend and a Node.js backend with real-time synchronization across multiple devices via Socket.IO. It is optimized for both desktop and mobile browsers, with special considerations for iOS Safari.

### 1.3 Target Audience
- Primary: Homeschooled children who need motivation to complete educational tasks
- Secondary: Parents and educators who want to track children's progress and manage rewards

## 2. Product Overview

### 2.1 Core Functionality
- Display a list of educational activities with associated point values
- Allow users to mark activities as complete or track activity counts
- Calculate total points earned from completed activities
- Show real-time updates across multiple connected devices
- Reset activities for a new day

### 2.2 Key Features
- **Activity Cards**: Visual representation of each activity with completion status
- **Modal Interaction**: Detailed view and interaction with activities
- **Counter Activities**: Special activities that can be completed multiple times (e.g., Logic Workbook)
- **Real-time Sync**: Updates synchronize across multiple devices instantly
- **Required Activities**: Core activities (Math and Spelling) that must be completed to unlock screen time
- **Daily Reset**: Activities can be reset for a new day

## 3. User Experience

### 3.1 User Interface
- Clean, retro-inspired design with a dark theme and neon accents
- Mobile-first responsive design with fallback views for iOS Safari
- Interactive cards that provide visual feedback on state changes

### 3.2 User Flows
1. **Activity Completion**:
   - User views activity cards on the main screen
   - User taps an activity to open the modal
   - User marks the activity as complete or increments/decrements the counter
   - The UI updates immediately, and changes sync to other devices

2. **Daily Reset**:
   - User or parent clicks the reset button
   - All activities are marked as incomplete
   - Counters are reset to zero
   - Changes sync across all connected devices

3. **Score Tracking**:
   - Activities completed accumulate points
   - Score displays at the top of the screen
   - Visual indicators show if required activities are completed

## 4. Technical Requirements

### 4.1 Frontend
- **Framework**: React.js
- **State Management**: React hooks for local state
- **Real-time Updates**: Socket.IO client
- **Styling**: CSS with responsive design principles
- **Compatibility**: Cross-browser support with iOS Safari optimizations

### 4.2 Backend
- **Server**: Node.js with Express
- **Real-time**: Socket.IO for bi-directional communication
- **Data Storage**: JSON file for persistence
- **API Endpoints**:
  - GET `/api/activities`: Retrieve all activities
  - PUT `/api/activities/:id`: Update activity completion status
  - POST `/api/reset`: Reset all activities for a new day

### 4.3 Communication Protocol
- RESTful API for CRUD operations
- WebSockets for real-time updates and notifications
- Client-side tracking of user-initiated updates to prevent duplicate notifications

## 5. Current Issues and Fixes

### 5.1 Modal Closing Issue (Fixed)
- **Problem**: Modal dialog closes when +/- buttons are clicked in counter activities
- **Solution**: Implemented event propagation control and added a preventClose mechanism to keep the modal open during counter interactions

### 5.2 Duplicate Notifications (Fixed)
- **Problem**: Users receiving "updated on another device" notifications for their own actions
- **Solution**: Added client-side tracking of user-initiated updates using a reference object to filter out self-updates

### 5.3 UI Text (Fixed)
- **Problem**: "Tap to change" text appears after counter activity completion
- **Solution**: Modified ActivityCard component to remove this text for completed counter activities

## 6. Future Enhancements

### 6.1 Authentication
- User accounts for different children
- Parent/admin accounts with additional permissions
- Login/logout functionality

### 6.2 Data Visualization
- Progress charts and statistics
- Weekly and monthly views of completed activities
- Achievement badges and milestones

### 6.3 Activity Management
- Admin interface for creating/editing activities
- Custom categories and tagging for activities
- Ability to schedule activities for specific days

### 6.4 Enhanced Sync
- Offline mode with automatic sync when connection is restored
- Conflict resolution for simultaneous updates
- Sync history and activity log

### 6.5 Customization
- Themes and visual customization options
- Sound effects and animations for completed activities
- Custom reward systems beyond screen time minutes

## 7. Performance Requirements

### 7.1 Load Time
- Initial page load: < 2 seconds on broadband connection
- Activity card rendering: < 100ms
- Real-time update propagation: < 500ms between devices

### 7.2 Scalability
- Support for up to 20 concurrent users
- Handle up to 100 activities without performance degradation
- Maintain responsiveness on low-end devices

### 7.3 Reliability
- 99.9% uptime for server
- Graceful degradation on connection loss
- Data persistence to prevent loss of progress

## 8. Accessibility Requirements
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Color contrast ratios meeting accessibility standards

## 9. Browser and Device Support
- **Desktop**: Chrome, Firefox, Safari, Edge (latest 2 versions)
- **Mobile**: iOS Safari, Chrome for Android, Samsung Internet
- **Screen Sizes**: 320px min width (mobile) to 1920px+ (desktop)

## 10. Success Metrics
- Increase in completed educational activities
- Decrease in parent-child conflicts over screen time
- User engagement (daily active usage)
- Time spent on educational activities vs. screen time consumed

## 11. Conclusion
The Level Up application successfully gamifies educational activities for homeschooled children, providing motivation through a screen time reward system. The application's real-time synchronization, intuitive interface, and responsive design create a seamless experience across devices, making it an effective tool for both children and parents in the homeschooling environment. 