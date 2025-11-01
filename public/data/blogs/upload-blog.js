/**
 * Blog Upload Script for Firebase Realtime Database
 * Run this in the browser console at: https://shichuanqiong.github.io/chatsphereGPT/#/
 * 
 * Instructions:
 * 1. Open browser console (F12 or DevTools)
 * 2. Copy and paste this entire script
 * 3. Press Enter to execute
 */

(async () => {
  console.log('🚀 Starting blog upload...');
  
  try {
    // Fetch the blog JSON file
    const response = await fetch('https://shichuanqiong.github.io/chatsphereGPT/data/blogs/blog-20251101-welcome.json');
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    const blogPost = await response.json();
    
    console.log('📄 Blog post loaded:', blogPost.title);
    
    // Get Firebase references from the window (injected by the app)
    const { getDatabase, ref, set } = window.firebase.database;
    const db = getDatabase();
    
    if (!db) throw new Error('Firebase database not initialized');
    
    // Write to /blog/posts/{slug}
    await set(ref(db, `blog/posts/${blogPost.slug}`), blogPost);
    console.log(`✅ Blog post written to /blog/posts/${blogPost.slug}`);
    
    // Write to /blog/latest
    await set(ref(db, `blog/latest`), {
      slug: blogPost.slug,
      title: blogPost.title,
      createdAt: blogPost.createdAt,
      updatedAt: blogPost.updatedAt
    });
    console.log(`✅ Latest blog reference written to /blog/latest`);
    
    console.log('🎉 Blog post successfully created!');
    console.log(`📍 Slug: ${blogPost.slug}`);
    console.log(`📅 Created: ${new Date(blogPost.createdAt).toLocaleString()}`);
    
    return { success: true, slug: blogPost.slug };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
})();
