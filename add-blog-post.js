// add-blog-post.js
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = {
  "type": "service_account",
  "project_id": "chatsphereGPT",
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
  "private_key": process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://chatsphereGPT-default-rtdb.firebaseio.com"
  });
}

const db = admin.database();

const blogPost = {
  title: "Welcome to ChatSphere – The Ultimate Free Chat Platform",
  slug: "welcome-to-chatsphere",
  excerpt: "Discover ChatSphere: Your gateway to anonymous, free chat rooms with an intuitive interface and powerful features.",
  content: `Welcome to ChatSphere – your gateway to free, anonymous, and real-time conversations!

ChatSphere is a modern chat platform designed for people who value privacy, simplicity, and community. Whether you're looking to connect with strangers, engage in topic-specific discussions, or create your own chat rooms, ChatSphere offers a seamless experience tailored to your needs.

**Key Features:**

🔓 **100% Free & No Registration Required** – Jump into conversations instantly without any sign-up hassles. For anonymous users, we offer immediate access with zero barriers to entry.

🏠 **Create & Manage Your Own Rooms** – Have something specific to discuss? Create a room with a custom name, icon, and visibility settings (public or private). Build communities around your interests and topics.

🤫 **True Anonymous Chatting** – Chat without revealing your identity. Our platform supports completely anonymous messaging, perfect for candid conversations and exploring different perspectives.

💬 **Direct Messaging** – Beyond public rooms, connect one-on-one with other users. Send direct messages to build deeper connections within the community.

🎨 **Beautiful, Intuitive Interface** – Enjoy a sleek, frosted-glass UI with a dark theme optimized for comfortable viewing. The interface is designed with user experience at the forefront, making navigation effortless.

⚡ **Real-Time Updates** – Experience instant message delivery and live room activity. No waiting, no delays – true real-time communication at your fingertips.

👥 **Active Community** – Connect with thousands of users across the globe. See who's online, discover trending rooms, and expand your network.

🔒 **Privacy First** – Your conversations are your own. We prioritize user privacy and maintain strict data protection standards.

Whether you're seeking meaningful conversations, looking to share ideas, or simply exploring a new social platform, ChatSphere welcomes you. Join thousands of users today and experience the future of free, anonymous chat.

**Get Started Now** – No credit card, no email verification required. Just arrive, chat, and enjoy!`,
  createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
};

async function addPost() {
  try {
    const postsRef = db.ref('posts');
    const newPostRef = postsRef.push();
    await newPostRef.set(blogPost);
    console.log('✅ Blog post added successfully with ID:', newPostRef.key);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding blog post:', error);
    process.exit(1);
  }
}

addPost();
