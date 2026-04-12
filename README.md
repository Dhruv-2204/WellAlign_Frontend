# WellAlign Frontend

A Vue.js-based web application for digital posture assessment, real-time monitoring, and AI-powered corrective guidance.

## Project Overview

**WellAlign** is an end-to-end posture support platform that operationalizes an Assess-to-Prescribe workflow:
- **Assess phase**: Users upload front/side posture images; the system analyzes biomechanics using pose landmarks and machine learning, detects issues, and generates a detailed report.
- **Monitor phase**: Users start live webcam sessions to track posture in real time, receive instant alerts for sustained deviations, and generate session summaries.
- **Prescribe phase**: AI enrichment (Gemini) contextualizes findings into actionable guidance; YouTube resource links provide corrective exercise tutorials.
- **Progress phase**: Historical assessments and sessions are persisted, enabling trend tracking and personalized recommendation iteration.

## Frontend Role

The frontend is a single-page Vue.js application that:
- Manages user workflows (authentication, image upload, session setup, result display).
- Orchestrates calls to backend APIs and ML inference services.
- Renders real-time posture metrics, alerts, and historical trends.
- Provides graceful fallback and error recovery when services are unavailable.
- Integrates AI-enriched recommendations and video resource suggestions.

## Tech Stack

- **Vue.js 3.x** + **Vue Router 4.x**: reactive SPA routing and component management.
- **Tailwind CSS**: utility-first styling.
- **Chart.js**: trend visualization.
- **MediaPipe (JavaScript)**: pose landmark extraction (in frontend for front-view analysis).
- **Fetch API**: backend communication.

## Key Features

- Image-based posture assessment with feature-engineered ML classification.
- Real-time webcam posture monitoring with issue detection and event logging.
- Persistent storage of assessments and sessions for longitudinal tracking.
- AI-powered interpretation of posture findings and corrective recommendations.
- Integrated exercise-video surfacing from YouTube.
- Responsive UI with progress tracking, error recovery, and medical disclaimers.

## Getting Started

1. Clone the repository.
2. Open `index.html` in a browser or run a local server:
3. Ensure the backend API is running at `http://localhost:3000/api`.
4. Configure your backend URL in settings if needed.

## Dissertation Context

This frontend is part of a Year 3 undergraduate digital-health dissertation project. It demonstrates full-stack integration of computer vision, machine learning, cloud APIs, and user-centered design for a posture-support application.

## Abbreviations

- **Assess**: image-based or live posture analysis.
- **Monitor**: continuous real-time tracking.
- **Prescribe**: AI-interpreted guidance and resource recommendations.
- **WellAlign**: the project name, emphasizing alignment towards wellness through corrected posture.
