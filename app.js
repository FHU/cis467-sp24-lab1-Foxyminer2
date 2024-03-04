const express = require('express');
const app = express();
const PORT = 3000;
const mysql = require('mysql2/promise');
const config = require('./config');

const prayerComs = `
    SELECT 
        prayers.prayerID, 
        prompt, 
        body, 
        coverImage, 
        audioRecitation, 
        aiCreator,

        CAST(CONCAT(
            "[", 
            GROUP_CONCAT(DISTINCT JSON_OBJECT("id", users.userID, "name", users.name)), 
            "]"
        ) as JSON) as creators,

        CAST(CONCAT(
            "[", 
            GROUP_CONCAT(DISTINCT JSON_OBJECT("id", scriptures.scriptureID, "verse", scriptures.verses)), 
            "]"
        ) as JSON) as scriptures,

        CAST(CONCAT(
            "[", 
            GROUP_CONCAT(DISTINCT JSON_OBJECT("id", tags.tagID, "description", tags.tagDescription)), 
            "]"
        ) as JSON) as tags, 

        (SELECT COUNT(userID) FROM likes WHERE likes.prayerID = prayers.prayerID) as likes ,

        (SELECT COUNT(userID) FROM saves WHERE saves.prayerID = prayers.prayerID) as saves

    FROM prayers

    LEFT JOIN prayerstags 
        ON prayerstags.prayerID = prayers.prayerID
    LEFT JOIN tags
        ON prayerstags.tagID = tags.tagID

    LEFT JOIN prayerscreators
        ON prayers.prayerID = prayerscreators.prayerID
    LEFT JOIN users
        ON prayerscreators.userID = users.userID

    LEFT JOIN prayersscriptures
        ON prayers.prayerID = prayersscriptures.prayerID
    LEFT JOIN scriptures
        ON prayersscriptures.scriptureID = scriptures.scriptureID
    
    GROUP BY prayers.prayerID
`;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = mysql.createPool(config.db);

app.listen(PORT, async () => {
    const host = process.env.HOSTNAME || "http://localhost";
    console.log(`Listening on ${host}:${PORT}`);
});

app.use((req, res, next) => {
    req.user = { id: 4, name: "Austin" };
    next();
});

app.get('/', async (req, res) => {
    try {
        const conn = await pool.getConnection();
        const [users, ] = await conn.query("SELECT * FROM users");
        conn.release();
        res.json(users);
    } catch (err) {
        res.json({ message: "error" });
        console.error(err);
    }
});

// Get all tags
app.get('/tags', async (req, res) => {
  try {
      const conn = await pool.getConnection();
      const [tags, ] = await conn.query("SELECT * FROM tags");
      conn.release();
      res.json(tags);
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "error" });
  }
});


// Get a specific tag by ID
app.get('/tags/:id', async (req, res) => {
  try {
      const { id } = req.params;
      const conn = await pool.getConnection();
      const [tag, ] = await conn.query("SELECT * FROM tags WHERE tagID = ?", [id]);
      conn.release();
      if (tag.length === 0) {
          return res.status(404).json({ message: "Tag not found" });
      }
      res.json(tag[0]);
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "error" });
  }
});



// Create a new tag
app.post('/tags', async (req, res) => {
    let conn;
    try {
        const { tagName } = req.body;
        if (!tagName) {
            return res.status(400).json({ message: "Tag name is required" });
        }
        conn = await pool.getConnection();
        const [existingTag] = await conn.query("SELECT * FROM tags WHERE tagName = ?", [tagName]);
        if (existingTag.length > 0) {
            res.setHeader('Location', `/tags/${existingTag[0].tagID}`);
            return res.status(303).json({ message: `Tag already exists. See Location header for URI.`, tag: existingTag[0] });
        }
        const [result] = await conn.query("INSERT INTO tags (tagName) VALUES (?)", [tagName]);
        const newTagID = result.insertId;
        const [newTag] = await conn.query("SELECT * FROM tags WHERE tagID = ?", [newTagID]);
        conn.release();
        res.status(201).json({ message: "Tag created successfully", tag: newTag[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "error" });
    } finally {
        if (conn) conn.release();
    }
});

// Update a tag
app.put('/tags/:id', async (req, res) => {
  try {
      const { id } = req.params;
      const { tagName } = req.body;
      if (!tagName) {
          return res.status(400).json({ message: "Tag name is required" });
      }
      const conn = await pool.getConnection();
      const [existingTag] = await conn.query("SELECT * FROM tags WHERE tagID = ?", [id]);
      if (existingTag.length === 0) {
          conn.release();
          return res.status(404).json({ message: "Tag not found" });
      }
      await conn.query("UPDATE tags SET tagName = ? WHERE tagID = ?", [tagName, id]);
      const [updatedTag] = await conn.query("SELECT * FROM tags WHERE tagID = ?", [id]);
      conn.release();
      res.status(200).json({ message: "Tag updated successfully", tag: updatedTag[0] });
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "error" });
  }
});

// Delete a tag
app.delete('/tags/:id', async (req, res) => {
  try {
      const { id } = req.params;
      const conn = await pool.getConnection();
      const [existingTag] = await conn.query("SELECT * FROM tags WHERE tagID = ?", [id]);
      if (existingTag.length === 0) {
          conn.release();
          return res.status(404).json({ message: "Tag not found" });
      }
      await conn.query("DELETE FROM tags WHERE tagID = ?", [id]);
      conn.release();
      res.status(204).send();
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "error" });
  }
});

// Get all prayers
app.get('/prayers', async (req, res) => {
  try {
      const conn = await pool.getConnection();
      const [prayers] = await conn.query(prayerComs);
      conn.release();
      res.json(prayers);
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "error" });
  }
});

// Get a specific prayer by ID
app.get('/prayers/:id', async (req, res) => {
  try {
      const { id } = req.params;
      const conn = await pool.getConnection();
      const [prayer, ] = await conn.query("SELECT * FROM prayers WHERE prayerID = ?", [id]);
      conn.release();
      if (prayer.length === 0) {
          return res.status(404).json({ message: "Prayer not found" });
      }
      res.json(prayer[0]);
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "error" });
  }
});

// Create a new prayer
app.post('/prayers', async (req, res) => {
  try {
      const { prompt, body, coverImage, audioRecitation, aiCreator, likes, saves } = req.body;
      const conn = await pool.getConnection();
      const result = await conn.query("INSERT INTO prayers (prompt, body, coverImage, audioRecitation, aiCreator, likes, saves) VALUES (?, ?, ?, ?, ?, ?, ?)", [prompt, body, coverImage, audioRecitation, aiCreator, likes, saves]);
      conn.release();
      res.status(201).json({ message: "Prayer created successfully", prayerID: result.insertId });
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "error" });
  }
});

// Update a prayer
app.put('/prayers/:id', async (req, res) => {
  try {
      const { id } = req.params;
      const { prompt, body, coverImage, audioRecitation, aiCreator, likes, saves } = req.body;
      const conn = await pool.getConnection();
      const [existingPrayer] = await conn.query("SELECT * FROM prayers WHERE prayerID = ?", [id]);
      if (existingPrayer.length === 0) {
          conn.release();
          return res.status(404).json({ message: "Prayer not found" });
      }
      await conn.query("UPDATE prayers SET prompt = ?, body = ?, coverImage = ?, audioRecitation = ?, aiCreator = ?, likes = ?, saves = ? WHERE prayerID = ?", [prompt, body, coverImage, audioRecitation, aiCreator, likes, saves, id]);
      conn.release();
      res.status(200).json({ message: "Prayer updated successfully" });
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "error" });
  }
});

// Delete a prayer
app.delete('/prayers/:id', async (req, res) => {
  try {
      const { id } = req.params;
      const conn = await pool.getConnection();
      const [existingPrayer] = await conn.query("SELECT * FROM prayers WHERE prayerID = ?", [id]);
      if (existingPrayer.length === 0) {
          conn.release();
          return res.status(404).json({ message: "Prayer not found" });
      }
      await conn.query("DELETE FROM prayers WHERE prayerID = ?", [id]);
      conn.release();
      res.status(204).send();
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "error" });
  }
});


// Get all likes for a specific prayer
app.get('/prayers/:id/likes', async (req, res) => {
  try {
      const { id } = req.params;
      const conn = await pool.getConnection();
      const [likes] = await conn.query("SELECT * FROM likes WHERE prayerID = ?", [id]);
      conn.release();
      if(likes.length == 0){
        return res.status(404).json({message: "No likes found for this prayer"})
      }
      res.json(likes);
  } catch (err) {
      res.status(500).json({ message: "error" });
      console.error(err);
  }
});

// Get a specific like for a specific prayer by ID
app.get('/prayers/:prayerId/likes/:likeId', async (req, res) => {
  try {
      const { prayerId, likeId } = req.params;
      const conn = await pool.getConnection();
      const [like, ] = await conn.query("SELECT * FROM likes WHERE likeID = ? AND prayerID = ?", [likeId, prayerId]);
      conn.release();
      if (like.length === 0) {
          return res.status(404).json({ message: "Like not found" });
      }
      res.json(like[0]);
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "error" });
  }
});

// Create a like for a specific prayer
app.post('/prayers/:id/likes', async (req, res) => {
  let conn;
  try {
      const { id } = req.params;
      const { userID } = req.body;
      if (!userID) {
          return res.status(400).json({ message: "userID is required" });
      }
      conn = await pool.getConnection();
      const [existingPrayer] = await conn.query("SELECT * FROM prayers WHERE prayerID = ?", [id]);
      if (existingPrayer.length === 0) {
          return res.status(404).json({ message: "Prayer not found" });
      }
      const [result] = await conn.query("INSERT INTO likes (userID, prayerID) VALUES (?, ?)", [userID, id]);
      const newLikeID = result.insertId;
      res.status(201).json({ message: "Like created successfully", likeID: newLikeID, userID, prayerID: id });
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "error" });
  } finally {
      if (conn) conn.release();
  }
});

// Delete a like for a specific prayer
app.delete('/prayers/:prayerId/likes/:likeId', async (req, res) => {
  try {
      const { prayerId, likeId } = req.params;
      const conn = await pool.getConnection();
      const [existingLike] = await conn.query("SELECT * FROM likes WHERE likeID = ? AND prayerID = ?", [likeId, prayerId]);
      if (existingLike.length === 0) {
          conn.release();
          return res.status(404).json({ message: "Like not found" });
      }
      await conn.query("DELETE FROM likes WHERE likeID = ? AND prayerID = ?", [likeId, prayerId]);
      conn.release();
      res.status(204).send();
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "error" });
  }
});
// Get all saves for a specific prayer
app.get('/prayers/:id/saves', async (req, res) => {
  try {
      const { id } = req.params;
      const conn = await pool.getConnection();
      const [saves] = await conn.query("SELECT * FROM saves WHERE prayerID = ?", [id]);
      conn.release();

      if(saves.length == 0){
        return res.status(404).json({message: "No saves found for this prayer"})
      }

      res.json(saves);
  } catch (err) {
      res.status(500).json({ message: "error" });
      console.error(err);
  }
});

// Get a specific save for a specific prayer by ID
app.get('/prayers/:prayerId/saves/:saveId', async (req, res) => {
  try {
      const { prayerId, saveId } = req.params;
      const conn = await pool.getConnection();
      const [save, ] = await conn.query("SELECT * FROM saves WHERE saveID = ? AND prayerID = ?", [saveId, prayerId]);
      conn.release();
      if (save.length === 0) {
          return res.status(404).json({ message: "Save not found" });
      }
      res.json(save[0]);
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "error" });
  }
});

// Create a save for a specific prayer
app.post('/prayers/:id/saves', async (req, res) => {
  let conn;
  try {
      const { id } = req.params;
      const { userID } = req.body;
      if (!userID) {
          return res.status(400).json({ message: "userID is required" });
      }
      conn = await pool.getConnection();
      const [existingPrayer] = await conn.query("SELECT * FROM prayers WHERE prayerID = ?", [id]);
      if (existingPrayer.length === 0) {
          return res.status(404).json({ message: "Prayer not found" });
      }
      const [result] = await conn.query("INSERT INTO saves (userID, prayerID) VALUES (?, ?)", [userID, id]);
      const newSaveID = result.insertId;
      res.status(201).json({ message: "Save created successfully", saveID: newSaveID, userID, prayerID: id });
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "error" });
  } finally {
      if (conn) conn.release();
  }
});

// Delete a save for a specific prayer
app.delete('/prayers/:prayerId/saves/:saveId', async (req, res) => {
  try {
      const { prayerId, saveId } = req.params;
      const conn = await pool.getConnection();
      const [existingSave] = await conn.query("SELECT * FROM saves WHERE saveID = ? AND prayerID = ?", [saveId, prayerId]);
      if (existingSave.length === 0) {
          conn.release();
          return res.status(404).json({ message: "Save not found" });
      }
      await conn.query("DELETE FROM saves WHERE saveID = ? AND prayerID = ?", [saveId, prayerId]);
      conn.release();
      res.status(204).send();
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "error" });
  }
});



// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

module.exports = app;