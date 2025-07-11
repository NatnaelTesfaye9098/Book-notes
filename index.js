import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";
import cookieParser from "cookie-parser";
import authRoutes, { setAuthStatus, requireAuth } from "./routes/auth.js";

env.config();

const app = express();
const port = process.env.PORT || 3000;

const db = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const JWT_SECRET = process.env.JWT_SECRET;

async function initDB() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255),
                date VARCHAR(100),
                rating INTEGER,
                intro TEXT,
                mynotes TEXT
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            );
        `);
        await db.query(`
            ALTER TABLE notes
            ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
        `);
    } catch (err) {
        console.error("db error:", err);
        process.exit(1);
    }
}

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(setAuthStatus);

app.use("/", authRoutes(db, JWT_SECRET));

app.get("/", async (req, res) => {
    try {
        const result = await db.query("SELECT notes.*, users.username FROM notes LEFT JOIN users ON notes.user_id = users.id ORDER BY date DESC");
        const data = result.rows;
        res.render("index.ejs", { posts: data, user: req.user });
    } catch (err) {
        console.error("Error fetching posts:", err);
        res.status(500).send("Error fetching posts.");
    }
});

app.get("/notes/:id", async (req, res) => {
    try {
        const foundPost = await db.query("SELECT notes.*, users.username FROM notes LEFT JOIN users ON notes.user_id = users.id WHERE notes.id = $1", [req.params.id]);
        if (foundPost.rows.length === 0) {
            return res.status(404).send("Note not found.");
        }
        const post = foundPost.rows[0];
        res.render("note.ejs", { post: post, user: req.user });
    } catch (err) {
        console.error("Error fetching single note:", err);
        res.status(500).send("Error fetching note.");
    }
});

app.get("/new", requireAuth, (req, res) => {
    res.render("new.ejs", { editPost: null });
});

app.post("/submit", requireAuth, async (req, res) => {
    const { title, rating, intro, note } = req.body;
    const date = new Date();
    const newDate = date.toDateString();
    const userId = req.user.id;

    try {
        await db.query(
            "INSERT INTO notes(title, date, rating, intro, mynotes, user_id) VALUES($1, $2, $3, $4, $5, $6)",
            [title, newDate, rating, intro, note, userId]
        );
        res.redirect("/");
    } catch (err) {
        console.error("Error submitting new post:", err);
        res.status(500).send("Error submitting post.");
    }
});

app.get("/edit/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const userId = req.user.id;

    try {
        const result = await db.query("SELECT * FROM notes WHERE id=$1 AND user_id=$2", [id, userId]);
        if (result.rows.length === 0) {
            return res.status(403).send("You are not authorized to edit this post or post not found.");
        }
        const data = result.rows[0];
        res.render("new.ejs", { editPost: data });
    } catch (err) {
        console.error("Error fetching post for edit:", err);
        res.status(500).send("Error fetching post for edit.");
    }
});

app.post("/update/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const { title, rating, intro, note } = req.body;
    const date = new Date();
    const newDate = date.toDateString();
    const userId = req.user.id;

    try {
        const result = await db.query(
            "UPDATE notes SET title=$1, rating=$2, intro=$3, mynotes=$4, date=$5 WHERE id=$6 AND user_id=$7",
            [title, rating, intro, note, newDate, id, userId]
        );
        if (result.rowCount === 0) {
            return res.status(403).send("You are not authorized to update this post or post not found.");
        }
        res.redirect("/");
    } catch (err) {
        console.error("Error updating post:", err);
        res.status(500).send("Error updating post.");
    }
});

app.get("/delete/:id", requireAuth, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const userId = req.user.id;

        const checkPostOwnership = await db.query("SELECT user_id FROM notes WHERE id = $1", [postId]);

        if (checkPostOwnership.rows.length === 0) {
            return res.status(404).send("Note not found.");
        }

        if (checkPostOwnership.rows[0].user_id !== userId) {
            return res.status(403).send("You are not authorized to delete this post.");
        }

        const result = await db.query("DELETE FROM notes WHERE id = $1 AND user_id = $2", [postId, userId]);

        if (result.rowCount === 0) {
            return res.status(404).send("Note not found or not owned by you.");
        }

        res.redirect("/");
    } catch (err) {
        console.error("Error deleting post:", err);
        res.status(500).send("Error deleting post.");
    }
});

initDB()
    .then(() => {
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    })
    .catch((err) => {
        console.error("Failed to start server due to database error:", err);
    });