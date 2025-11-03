# TalkiSphere v0.2 — Firebase Realtime

A modern, real-time chat application built with React, TypeScript, Firebase, and Tailwind CSS.

## ✨ Features

- 🔐 **Multiple Authentication Methods**: Login, Register, or Chat as Guest
- 💬 **Real-time Messaging**: Powered by Firebase Realtime Database
- 🌙 **Room Types**: Official, Public, and Private chat rooms
- 👥 **Online Users**: See who's online and filter by gender
- 😊 **Quick Emoji**: Hover to send emojis instantly
- 🎨 **Modern UI**: Beautiful gradients, animations, and glassmorphism effects
- 📱 **Responsive Design**: Works on desktop and mobile

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm (npm install -g pnpm)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/shichuanqiong/talkisphere.git
   cd talkisphere
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure Firebase**
   
   Create a `.env` file in the root directory:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_domain.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://your_db.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc
   VITE_PUBLIC_SITE_URL=https://talkisphere.com
   ```

4. **Configure Firebase Console**
   
   - Import `firebase.rules.json` into your Realtime Database rules
   - Enable Email/Password and Anonymous authentication
   - Create the Realtime Database

5. **Run development server**
   ```bash
   pnpm dev
   ```

   Open `http://localhost:5173` in your browser.

## 📦 Building for Production

```bash
pnpm build
```

Output will be in the `dist/` directory.

## 🚀 Deployment

### Deploy to GitHub Pages

```bash
pnpm build
pnpm deploy
```

Visit: https://talkisphere.com

### Deploy to Firebase Hosting

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init hosting`
4. Build and deploy: `pnpm build && firebase deploy --only hosting`

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

## 📁 Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Page components (Login, Home, Blog)
├── utils/         # Utility functions
├── auth.tsx       # Authentication context
├── firebase.ts    # Firebase configuration
└── main.tsx       # App entry point
```

## 🎨 UI Improvements

- Gradient backgrounds and modern design
- Smooth animations and transitions
- Custom scrollbar styling
- Enhanced button interactions
- Improved input field styles
- Glassmorphism effects

## 🔒 Security

Firebase security rules are defined in `firebase.rules.json`. Make sure to import these rules into your Firebase Realtime Database.

## 📝 License

MIT License - feel free to use this project!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

