import { Router } from 'express';
import Post from '../models/Post.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

// Public: list all posts (newest first)
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).limit(200);
    res.json(posts.map(p => p.toJSON()));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: get post by id
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    res.json(post.toJSON());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Private: my posts
router.get('/me/list', requireAuth, async (req, res) => {
  try {
    const posts = await Post.find({ authorId: req.user.id }).sort({ createdAt: -1 });
    res.json(posts.map(p => p.toJSON()));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Private: create
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
    const post = await Post.create({
      title,
      content,
      authorId: req.user.id,
      authorUsername: req.user.username,
    });
    res.status(201).json(post.toJSON());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Private: update
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { title, content } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (post.authorId.toString() !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (typeof title === 'string') post.title = title;
    if (typeof content === 'string') post.content = content;
    await post.save();
    res.json(post.toJSON());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Private: delete
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (post.authorId.toString() !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await post.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;


