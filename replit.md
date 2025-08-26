# PoolVisual Quotes

## Overview

PoolVisual Quotes is a white-label application specifically designed for pool renovation contractors. The system enables tradespeople to upload photos of existing pools and visualize renovation materials through advanced canvas-based editing tools. The platform supports creating professional quotes with accurate measurements and material calculations, complete with Stripe integration for deposit collection.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The application uses a React-based SPA architecture built with Vite and TypeScript. The frontend employs a component-driven design using shadcn/ui components for consistency and Radix UI primitives for accessibility. State management is handled through Zustand stores for authentication and canvas operations. The routing system uses Wouter for client-side navigation.

### Backend Architecture
The server runs on Express.js with TypeScript, providing RESTful API endpoints for all application functionality. The backend handles file uploads using Multer, implements JWT-based authentication with bcrypt for password hashing, and integrates with Stripe for payment processing. API routes are organized by feature area (auth, jobs, materials, quotes) with comprehensive error handling.

### Canvas System
The core visualization functionality is built on Konva.js for 2D canvas manipulation. The system supports multiple drawing tools including area masks, linear measurements, and waterline band calculations. Canvas state management includes calibration systems for accurate real-world measurements, undo/redo functionality, and material overlay capabilities.

### Database Design
The application uses PostgreSQL with Drizzle ORM for type-safe database operations. The schema supports multi-tenant architecture through organizations, with comprehensive entities for users, jobs, photos, materials, masks, quotes, and settings. Row-level security is implemented for data isolation between organizations.

### Material Management
Materials are categorized by pool renovation types (coping, waterline tiles, interior finishes, paving, fencing) with unit-specific pricing (m², lm, each). The system supports material libraries, pricing calculations with margin and wastage factors, and visual material overlays on canvas.

### Quote Generation
The quote builder automatically calculates quantities from canvas measurements, applies material pricing with configurable margins, includes labor rules, and generates professional PDFs. Quotes support multiple status workflows (draft, sent, accepted, declined) with public sharing links.

## External Dependencies

### Database and Storage
- **Neon Database**: PostgreSQL hosting for primary data storage
- **Drizzle ORM**: Type-safe database operations and migrations
- **File Storage**: Local file system for photo uploads (configurable for cloud storage)

### Payment Processing
- **Stripe**: Payment processing for quote deposits with webhook integration
- **@stripe/stripe-js**: Frontend Stripe integration for payment forms
- **@stripe/react-stripe-js**: React components for Stripe payment elements

### UI and Design
- **shadcn/ui**: Component library built on Radix UI primitives
- **Radix UI**: Accessible component primitives for dialogs, dropdowns, forms
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **Lucide React**: Icon library for consistent iconography

### Canvas and Visualization
- **Konva.js**: 2D canvas library for drawing tools and material overlays
- **React Query**: Server state management and caching
- **Zustand**: Client-side state management for canvas and authentication

### Development Tools
- **Vite**: Build tool and development server
- **TypeScript**: Type safety across frontend and backend
- **Zod**: Runtime type validation for API schemas
- **ESBuild**: Fast JavaScript bundling for production builds