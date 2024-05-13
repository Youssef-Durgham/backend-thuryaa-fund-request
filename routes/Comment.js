const router = require("express").Router();
const User = require("../model/Users.js");
const jwt = require("jsonwebtoken");
const Course = require("../model/course.js");
const { Post } = require("../model/Post.js");



// api to post comment
router.post('/posts/:postId/comment', async (req, res) => {
  const { postId } = req.params;
  const { userId, content } = req.body;
  
  const post = await Post.findById(postId);
  const comment = new Comment({ user: userId, content });

  post.comments.push(comment);
  await post.save();
  res.status(201).send(post);
});

// Endpoint to reply to a comment
router.post('/posts/:postId/comments/:commentId/reply', async (req, res) => {
  const { postId, commentId } = req.params;
  const { userId, content } = req.body;

  const post = await Post.findById(postId);
  if (!post) {
    return res.status(404).send({ error: 'Post not found.' });
  }

  // Find the comment to reply to
  const comment = post.comments.id(commentId);
  if (!comment) {
    return res.status(404).send({ error: 'Comment not found.' });
  }

  // Create a reply and add it to the comment
  const reply = new Comment({ user: userId, content });
  comment.replies.push(reply);

  await post.save();
  res.status(201).send({ comment: comment });
});

// Endpoint to vote on a post
router.patch('/posts/:postId/vote', async (req, res) => {
  const { postId } = req.params;
  const { vote } = req.body; // vote is 1 or -1
  const post = await Post.findById(postId);
  post.votes += vote;
  await post.save();
  res.status(200).send({ votes: post.votes });
});

// api to return comments
router.get('/courses/:courseId/posts', async (req, res) => {
  const { courseId } = req.params;
  const page = parseInt(req.query.page) || 1; // Default to first page if no page query provided
  const pageSize = 10; // Number of posts per page

  try {
    const posts = await Post.find({ course: courseId })
      .sort({ timestamp: -1 }) // Sort by date in descending order
      .skip((page - 1) * pageSize) // Skip the previous pages
      .limit(pageSize) // Limit to 10 posts
      .populate({
        path: 'comments', // Populating comments
        populate: { path: 'user', select: 'username' } // Nested population for comment's user details
      })
      .populate('user', 'username'); // Populate post creator's username

    const totalPosts = await Post.countDocuments({ course: courseId });
    const totalPages = Math.ceil(totalPosts / pageSize);

    res.status(200).send({
      posts,
      pageInfo: {
        currentPage: page,
        totalPages,
        pageSize,
        totalPosts
      }
    });
  } catch (error) {
    res.status(500).send({ error: 'Error fetching posts' });
  }
});



module.exports = router;