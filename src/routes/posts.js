const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middlewares/auth');

const router = express.Router();

// Get all posts with author details
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author', 'username displayName avatar')
      .populate('comments.author', 'username displayName avatar')
      .sort({ createdAt: -1 });

    // Add like status for authenticated users
    const postsWithLikeStatus = posts.map(post => {
      // Convert to JSON to apply virtuals and transforms (like _id to id)
      const postJson = post.toJSON();
      postJson.id = post._id.toString(); // Explicitly add id
      if (req.user) {
        postJson.isLiked = post.isLikedBy(req.user.id);
      }
      return postJson;
    });

    res.json(postsWithLikeStatus);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get single post with full details
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username displayName avatar bio')
      .populate('comments.author', 'username displayName avatar');

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const postObj = post.toObject();
    if (req.user) {
      postObj.isLiked = post.isLikedBy(req.user.id);
    }

    res.json(postObj);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Create new post (protected)
router.post('/', auth, async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const post = new Post({
      title: title.trim(),
      content: content.trim(),
      author: req.user.id
    });

    await post.save();
    await post.populate('author', 'username displayName avatar');

    res.status(201).json(post);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Update post (protected, author only)
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, content } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to edit this post' });
    }

    if (title !== undefined) post.title = title.trim();
    if (content !== undefined) post.content = content.trim();

    await post.save();
    await post.populate('author', 'username displayName avatar');

    res.json(post);
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post (protected, author only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    await post.deleteOne();
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Get user's posts (protected)
router.get('/me/list', auth, async (req, res) => {
  try {
    const posts = await Post.find({ author: req.user.id })
      .populate('author', 'username displayName avatar')
      .populate('comments.author', 'username displayName avatar')
      .sort({ createdAt: -1 });

    const postsWithLikeStatus = posts.map(post => {
      const postObj = post.toObject();
      postObj.isLiked = post.isLikedBy(req.user.id);
      return postObj;
    });

    res.json(postsWithLikeStatus);
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

// Like/Unlike post (protected)
router.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const wasLiked = post.toggleLike(req.user.id);
    await post.save();

    res.json({
      message: wasLiked ? 'Post liked' : 'Post unliked',
      isLiked: wasLiked,
      likeCount: post.likeCount
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Failed to like/unlike post' });
  }
});

// Add comment to post (protected)
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comment = post.addComment(req.user.id, content);
    await post.save();
    await post.populate('comments.author', 'username displayName avatar');

    // Return the newly added comment
    const newComment = post.comments[post.comments.length - 1];
    res.status(201).json(newComment);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Delete comment (protected, comment author only)
router.delete('/:postId/comments/:commentId', auth, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.author.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    const removed = post.removeComment(commentId);
    if (removed) {
      await post.save();
      res.json({ message: 'Comment deleted successfully' });
    } else {
      res.status(404).json({ error: 'Comment not found' });
    }
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;


