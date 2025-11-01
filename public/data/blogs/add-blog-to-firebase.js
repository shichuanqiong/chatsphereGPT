// 添加博客到 Firebase Realtime Database 的脚本
// 在浏览器控制台中运行此脚本

(async () => {
  const { ref, push, set } = await import('https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js');
  
  // 获取 Firebase db 实例
  // 注：需要在 window 上暴露 db 或通过其他方式获取
  const db = window.db;
  
  if (!db) {
    console.error('❌ Firebase database not initialized. Make sure db is available on window.');
    return;
  }

  const blogPost = {
    id: "blog-20251031-welcome",
    title: "Welcome to ChatSphere — Where Conversations Come Alive",
    author: "ChatSphere Team",
    date: "2025-10-31",
    slug: "welcome-to-chatsphere",
    tags: ["announcement", "intro", "update"],
    thumbnail: "https://i.ibb.co/9W0t2Mc/chatsphere-banner.jpg",
    excerpt: "Welcome to ChatSphere, your new digital space for real-time conversation and authentic connection. Built with simplicity and speed in mind, ChatSphere lets you chat instantly.",
    content: {
      intro: "Welcome to ChatSphere, your new digital space for real-time conversation and authentic connection. Built with simplicity and speed in mind, ChatSphere lets you chat instantly — whether you're joining as a guest or creating your own personalized account.",
      sections: [
        {
          heading: "💬 Introduction",
          body: "Our mission is simple: to bring people closer through smooth, distraction-free communication. No noise, no clutter — just pure conversation."
        },
        {
          heading: "⚙️ Features You'll Love",
          body: "- **Instant Rooms:** Create or join chatrooms in one click.\n- **Guest Mode:** Jump right in — no registration required.\n- **Private Messages:** Connect directly with friends in secure one-on-one chats.\n- **Dynamic Backgrounds:** Enjoy a rotating gallery of black-and-white photos, creating a calm and immersive chatting atmosphere.\n- **Ad-Supported Simplicity:** Lightweight, fast, and open to everyone."
        },
        {
          heading: "🧭 What's Next",
          body: "We're currently building an integrated blog and news system, allowing moderators and admins to post updates, tips, and community highlights directly to the platform. Expect to see improvements in real-time notifications, mobile optimization, and maybe even voice chat!"
        },
        {
          heading: "💡 Final Note",
          body: "Thank you for being part of ChatSphere's early community. Every message, every feedback, every friend you make here helps us shape something truly meaningful.\n\nStay tuned — and keep chatting!"
        }
      ],
      footer: {
        contact: "chatspherelive@gmail.com",
        website: "https://chatsphere.live"
      }
    },
    createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
  };

  try {
    const newPostRef = push(ref(db, 'posts'));
    await set(newPostRef, blogPost);
    console.log('✅ Blog post added successfully!');
    console.log('Post ID:', newPostRef.key);
  } catch (error) {
    console.error('❌ Error adding blog post:', error);
  }
})();
